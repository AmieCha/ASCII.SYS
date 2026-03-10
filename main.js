/**
 * ASCII REACTIVE - Core Logic
 */

class AsciiEngine {
    constructor() {
        // Elements
        this.video = document.getElementById('webcam-video');
        this.canvas = document.getElementById('proc-canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.output = document.getElementById('ascii-output');
        this.startBtn = document.getElementById('start-btn');
        this.startOverlay = document.querySelector('.overlay');
        this.densitySlider = document.getElementById('density-slider');

        // Status Indicators
        this.webcamIndicator = document.getElementById('webcam-status');
        this.audioIndicator = document.getElementById('audio-status');

        // HUD elements
        this.hudFps = document.getElementById('hud-fps');
        this.hudAudio = document.getElementById('hud-audio');
        this.hudBass = document.getElementById('hud-bass');
        this.hudRec = document.getElementById('hud-rec');
        this.headerFps = document.getElementById('header-fps');
        this.headerLatency = document.getElementById('header-latency');

        // FPS tracking
        this.fpsFrameCount = 0;
        this.fpsLastTime = performance.now();

        // Audio Meters
        this.meters = {
            bass: document.querySelector('#meter-bass .fill'),
            mid: document.querySelector('#meter-mid .fill'),
            treble: document.querySelector('#meter-treble .fill')
        };

        // Configuration
        this.width = 120;
        this.height = 0;

        // Audio State
        this.audioCtx = null;
        this.analyser = null;
        this.dataArray = null;
        this.audioStream = null;
        this.audioLevels = { bass: 0, mid: 0, treble: 0, volume: 0 };

        // Style Presets
        this.presets = {
            classic: " .:-=+*#",
            dense: "@#%MW",
            matrix: "01|/\\",
            glitch: "$#@!%&"
        };
        this.currentStyle = 'classic';

        // Color State
        this.currentColor = '#00FF41';
        this.colorMode = 'solid';
        this.rainbowHue = 120;

        // Recording State
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.recordedBlob = null;
        this.recordingCanvas = document.createElement('canvas');
        this.recordingCtx = this.recordingCanvas.getContext('2d');
        this.recordStartTime = 0;
        this.recordDuration = 10000;
        this.lastAsciiFrame = '';

        this._bindEvents();
        this.updateLoop = this.updateLoop.bind(this);
    }

    _bindEvents() {
        this.startBtn.addEventListener('click', () => this.init());

        // ASCII style radios
        this.styleRadios = document.querySelectorAll('input[name="ascii-style"]');
        this.customInputPanel = document.getElementById('custom-input-panel');
        this.customInput = document.getElementById('custom-chars-input');

        this.styleRadios.forEach(radio => {
            radio.addEventListener('change', (e) => this.handleStyleChange(e.target.value));
        });

        this.customInput.addEventListener('input', () => {
            if (this.currentStyle === 'glitch') {
                this.presets.glitch = this.customInput.value || " ";
            }
        });

        // Color presets
        this.colorPresetBtns = document.querySelectorAll('.color-preset');
        this.colorPresetBtns.forEach(btn => {
            const c = btn.dataset.color;
            btn.style.background = c;
            btn.style.boxShadow = `0 0 8px ${c}88`;
            btn.addEventListener('click', () => {
                this.colorPresetBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentColor = c;
                this.customColorPicker.value = this._hexToInputColor(c);
            });
        });

        // Color mode radios
        this.colorModeRadios = document.querySelectorAll('input[name="color-mode"]');
        this.colorModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => { this.colorMode = e.target.value; });
        });

        // Custom color picker
        this.customColorPicker = document.getElementById('custom-color');
        this.customColorPicker.addEventListener('input', (e) => {
            this.currentColor = e.target.value;
            // Deselect presets if none match
            this.colorPresetBtns.forEach(b => {
                b.classList.toggle('active', b.dataset.color.toLowerCase() === e.target.value.toLowerCase());
            });
        });

        // Collapsible sections
        document.querySelectorAll('[data-collapsible] .section-label').forEach(label => {
            label.addEventListener('click', () => {
                label.closest('[data-collapsible]').classList.toggle('collapsed');
            });
        });

        // Recording controls
        this.recordBtn = document.getElementById('record-btn');
        this.recordStatus = document.getElementById('record-status');
        this.progressFill = document.querySelector('.progress-fill');
        this.timerDisplay = document.querySelector('.timer');
        this.sharePrompt = document.getElementById('share-prompt');

        this.recordBtn.addEventListener('click', () => this.toggleRecording());

        // Share buttons
        document.getElementById('download-btn').addEventListener('click', () => this.downloadVideo());
        document.getElementById('share-web-btn').addEventListener('click', () => this.shareVideo());
        document.getElementById('copy-ascii-btn').addEventListener('click', () => this.copyAsciiFrame());
    }

    // Normalize hex color for <input type="color"> (which needs 6-digit #rrggbb)
    _hexToInputColor(hex) {
        if (hex === '#FFFFFF') return '#ffffff';
        return hex.toLowerCase();
    }

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    async startRecording() {
        this.isRecording = true;
        this.recordedChunks = [];
        this.recordedBlob = null;
        this.recordStartTime = Date.now();
        this.recordBtn.classList.add('recording');
        this.recordBtn.querySelector('.btn-text').textContent = "STOP";
        if (this.hudRec) this.hudRec.style.display = 'inline';
        this.recordStatus.style.display = 'flex';
        this.sharePrompt.style.display = 'none';

        // Prepare recording canvas
        const fontSize = 12;
        this.recordingCanvas.width = this.width * (fontSize * 0.6);
        this.recordingCanvas.height = this.canvas.height * fontSize;

        const stream = this.recordingCanvas.captureStream(30);

        if (this.audioStream) {
            const audioTracks = this.audioStream.getAudioTracks();
            if (audioTracks.length > 0) stream.addTrack(audioTracks[0]);
        }

        const options = { mimeType: 'video/webm;codecs=vp9' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) options.mimeType = 'video/webm';

        this.mediaRecorder = new MediaRecorder(stream, options);
        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.recordedChunks.push(e.data);
        };
        this.mediaRecorder.onstop = () => this._onRecordingComplete();

        this.mediaRecorder.start();
        this._recordTimeout = setTimeout(() => this.stopRecording(), this.recordDuration);
    }

    stopRecording() {
        if (!this.isRecording) return;
        clearTimeout(this._recordTimeout);
        this.isRecording = false;
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        this.recordBtn.classList.remove('recording');
        this.recordBtn.querySelector('.btn-text').textContent = "RECORD";
        if (this.hudRec) this.hudRec.style.display = 'none';
        this.recordStatus.style.display = 'none';
    }

    _onRecordingComplete() {
        this.recordedBlob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.sharePrompt.style.display = 'block';
    }

    updateRecordingCanvas(asciiStr) {
        if (!this.isRecording) return;

        const ctx = this.recordingCtx;
        const { width, height } = this.recordingCanvas;
        const fontSize = 12;

        ctx.fillStyle = "#000500";
        ctx.fillRect(0, 0, width, height);

        ctx.font = `${fontSize}px 'Share Tech Mono', monospace`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = this.output.style.color || this.currentColor;

        const lines = asciiStr.split('\n');
        lines.forEach((line, i) => ctx.fillText(line, 0, i * fontSize));

        // Scanlines
        ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
        for (let i = 0; i < height; i += 4) ctx.fillRect(0, i, width, 1);

        // Progress
        const elapsed = Date.now() - this.recordStartTime;
        const progress = Math.min(100, (elapsed / this.recordDuration) * 100);
        this.progressFill.style.width = `${progress}%`;
        this.timerDisplay.textContent = `${((this.recordDuration - elapsed) / 1000).toFixed(1)}s`;
    }

    downloadVideo() {
        if (!this.recordedBlob) return;
        const url = URL.createObjectURL(this.recordedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ascii-reactive-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
    }

    async shareVideo() {
        if (!this.recordedBlob) return;
        if (navigator.canShare) {
            const file = new File([this.recordedBlob], `ascii-reactive-${Date.now()}.webm`, { type: 'video/webm' });
            try {
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: 'ASCII REACTIVE',
                        text: 'Real-time ASCII face video',
                        files: [file]
                    });
                    return;
                }
            } catch (err) {
                // Fallback to download if share cancelled or unsupported
            }
        }
        // Fallback
        this.downloadVideo();
    }

    async copyAsciiFrame() {
        const btn = document.getElementById('copy-ascii-btn');
        try {
            await navigator.clipboard.writeText(this.lastAsciiFrame);
            const orig = btn.textContent;
            btn.textContent = '[ COPIED! ]';
            setTimeout(() => { btn.textContent = orig; }, 1800);
        } catch (err) {
            btn.textContent = '[ FAILED ]';
            setTimeout(() => { btn.textContent = 'COPY ASCII FRAME'; }, 1800);
        }
    }

    handleStyleChange(style) {
        this.currentStyle = style;
        this.customInputPanel.style.display = style === 'glitch' ? 'block' : 'none';
        if (style === 'glitch') this.presets.glitch = this.customInput.value || " ";
    }

    async init() {
        try {
            const videoStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
                audio: false
            });
            this.video.srcObject = videoStream;
            await this.video.play();
            this.webcamIndicator.classList.replace('inactive', 'active');

            try {
                this.audioStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                const audioTracks = this.audioStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    this.setupAudio(new MediaStream([audioTracks[0]]));
                    this.audioIndicator.classList.replace('inactive', 'active');
                }
                this.audioStream.getVideoTracks().forEach(track => track.stop());
            } catch (audioErr) {
                console.warn("Audio capture skipped:", audioErr);
            }

            this.startOverlay.style.opacity = '0';
            setTimeout(() => this.startOverlay.style.display = 'none', 500);

            this.resizeCanvas();
            requestAnimationFrame(this.updateLoop);
        } catch (err) {
            console.error("Init failed:", err);
            alert("카메라 권한을 허용해주세요. 웹캠 접근이 필요합니다.");
        }
    }

    setupAudio(stream) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = this.audioCtx.createMediaStreamSource(stream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
    }

    resizeCanvas() {
        const videoWidth = this.video.videoWidth || 640;
        const videoHeight = this.video.videoHeight || 480;
        const aspect = videoHeight / videoWidth;
        this.canvas.width = this.width;
        this.canvas.height = Math.floor(this.width * aspect * 0.55);
    }

    analyzeFrequency() {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(this.dataArray);

        const section = Math.floor(this.dataArray.length / 3);
        let bassSum = 0, midSum = 0, trebleSum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            if (i < section) bassSum += this.dataArray[i];
            else if (i < section * 2) midSum += this.dataArray[i];
            else trebleSum += this.dataArray[i];
        }

        this.audioLevels.bass = (bassSum / section) / 255;
        this.audioLevels.mid = (midSum / section) / 255;
        this.audioLevels.treble = (trebleSum / section) / 255;
        this.audioLevels.volume = this.audioLevels.bass * 0.5 + this.audioLevels.mid * 0.3 + this.audioLevels.treble * 0.2;

        this.meters.bass.style.setProperty('--level', `${this.audioLevels.bass * 100}%`);
        this.meters.mid.style.setProperty('--level', `${this.audioLevels.mid * 100}%`);
        this.meters.treble.style.setProperty('--level', `${this.audioLevels.treble * 100}%`);
    }

    getAsciiChar(brightness) {
        let charSet = this.presets[this.currentStyle];
        if (this.currentStyle === 'glitch' && this.audioLevels.bass > 0.8) {
            charSet = charSet.split('').sort(() => Math.random() - 0.5).join('');
        }
        const index = Math.floor((brightness / 255) * (charSet.length - 1));
        return charSet[Math.max(0, index)];
    }

    // Convert hex color to a dimmed/brightened version based on intensity (0–1)
    _applyIntensity(hex, intensity) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const f = 0.25 + intensity * 0.75;
        return `rgb(${Math.min(255, Math.floor(r * f))},${Math.min(255, Math.floor(g * f))},${Math.min(255, Math.floor(b * f))})`;
    }

    updateLoop() {
        const frameStart = performance.now();

        // FPS counter
        this.fpsFrameCount++;
        if (frameStart - this.fpsLastTime >= 1000) {
            const fps = this.fpsFrameCount;
            this.fpsFrameCount = 0;
            this.fpsLastTime = frameStart;
            if (this.hudFps) this.hudFps.textContent = fps;
            if (this.headerFps) this.headerFps.textContent = fps;
        }

        this.analyzeFrequency();

        const baseDensity = parseInt(this.densitySlider.value);
        const dynamicWidth = baseDensity + (this.audioLevels.volume * 50);
        if (Math.abs(this.width - dynamicWidth) > 3) {
            this.width = Math.floor(dynamicWidth);
            this.resizeCanvas();
        }

        // Mirror video to canvas
        this.ctx.save();
        this.ctx.translate(this.canvas.width, 0);
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();

        // Build ASCII string
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const pixels = imageData.data;

        let asciiStr = "";
        for (let y = 0; y < this.canvas.height; y++) {
            for (let x = 0; x < this.canvas.width; x++) {
                const offset = (y * this.canvas.width + x) * 4;
                const brightness = pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114;
                const adjusted = Math.min(255, brightness * (1 + this.audioLevels.volume));
                asciiStr += this.getAsciiChar(adjusted);
            }
            asciiStr += "\n";
        }

        this.lastAsciiFrame = asciiStr;
        this.output.textContent = asciiStr;
        this.updateRecordingCanvas(asciiStr);
        this.applyVisualEffects();

        // Update latency display
        const latency = Math.round(performance.now() - frameStart);
        if (this.headerLatency) this.headerLatency.textContent = latency + 'ms';

        requestAnimationFrame(this.updateLoop);
    }

    applyVisualEffects() {
        // Update HUD audio meters
        if (this.hudAudio) this.hudAudio.textContent = Math.round(this.audioLevels.volume * 100) + '%';
        if (this.hudBass) this.hudBass.textContent = Math.round(this.audioLevels.bass * 100) + '%';

        const container = this.output.parentElement;

        // Shake on hard bass hit
        if (this.audioLevels.bass > 0.85) {
            container.classList.add('shake-pulse');
        } else {
            container.classList.remove('shake-pulse');
        }

        // Color based on selected mode
        let color, shadow;

        if (this.colorMode === 'rainbow') {
            this.rainbowHue = (this.rainbowHue + 1.2 + this.audioLevels.treble * 4) % 360;
            color = `hsl(${this.rainbowHue}, 100%, 68%)`;
            shadow = `0 0 8px hsl(${this.rainbowHue}, 100%, 45%)`;
        } else if (this.colorMode === 'pulse') {
            const intensity = 0.3 + this.audioLevels.volume * 0.7;
            color = this._applyIntensity(this.currentColor, intensity);
            const glowStr = Math.floor(this.audioLevels.volume * 18);
            shadow = `0 0 ${glowStr}px ${color}`;
        } else {
            // Solid — flash white on strong bass, otherwise use selected color
            if (this.audioLevels.bass > 0.85) {
                color = '#ffffff';
                shadow = '0 0 12px #ffffff';
            } else {
                color = this.currentColor;
                shadow = `0 0 4px ${this.currentColor}55`;
            }
        }

        this.output.style.color = color;
        this.output.style.textShadow = shadow;

        // Scale font to fill container width
        const containerWidth = container.clientWidth;
        const fontSize = (containerWidth / this.width) * 1.6;
        this.output.style.fontSize = `${fontSize}px`;
    }
}

window.addEventListener('DOMContentLoaded', () => { new AsciiEngine(); });
