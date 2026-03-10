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

        // Palette theme / waveform / emoji elements
        this.asciiContainer = document.getElementById('ascii-container');
        this.emojiCanvas = document.getElementById('emoji-canvas');
        this.emojiCtx = this.emojiCanvas ? this.emojiCanvas.getContext('2d') : null;

        // Status Indicators
        this.webcamIndicator = document.getElementById('webcam-status');
        this.audioIndicator = document.getElementById('audio-status');

        // HUD & Header elements
        this.headerFps = document.getElementById('header-fps');
        this.headerAudio = document.getElementById('header-audio');
        this.headerBass = document.getElementById('header-bass');
        this.headerLatency = document.getElementById('header-latency');
        this.hudRec = document.getElementById('hud-rec');

        // FPS tracking
        this.fpsFrameCount = 0;
        this.fpsLastTime = performance.now();

        // Audio Meters
        this.meters = {
            bass: document.querySelector('#meter-bass .fill'),
            mid: document.querySelector('#meter-mid .fill'),
            treble: document.querySelector('#meter-treble .fill')
        };
        this.meterValues = {
            bass: document.getElementById('meter-bass-value'),
            mid: document.getElementById('meter-mid-value'),
            treble: document.getElementById('meter-treble-value')
        };
        this.quickState = {
            theme: document.getElementById('state-theme'),
            style: document.getElementById('state-style'),
            density: document.getElementById('state-density'),
            colorMode: document.getElementById('state-color-mode'),
            densityValue: document.getElementById('density-value')
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
            katakana: 'ｦｧｨｩｪｫｬｭｮｯｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑ메모야유요라리루레로완0123456789',
            cyber: '@#$%&!><[]{}-=+*~^|',
            glitch: "$#@!%&"
        };
        this.currentStyle = 'classic';

        // Palette Theme State
        this.currentTheme = 'none';
        this.cyberpunkPhase = 0;
        this.themePresets = {
            'none':        { desc: '기본 모드 — 커스텀 설정 유지' },
            'cyberpunk':   { desc: 'CYBERPUNK — 네온 글리치 + 크로마틱 어버레이션' },
            'emoji':       { desc: 'EMOJI — 달빛 브라이트니스 매핑 🌑🌒🌓🌔🌕' },
            'depth':       { desc: '3D DEPTH — 얼굴 구조를 분석하여 입체적 매핑 @#.' }
        };

        // Depth state
        this.faceMesh = null;
        this.latestFaceLandmarks = null;
        this.depthCanvas = document.createElement('canvas'); // For rendering depth map
        this.depthCtx = this.depthCanvas.getContext('2d');

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
        this.updateControlState();
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
                this.updateControlState();
            });
        });

        // Color mode radios
        this.colorModeRadios = document.querySelectorAll('input[name="color-mode"]');
        this.colorModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.colorMode = e.target.value;
                this.updateControlState();
            });
        });

        // Custom color picker
        this.customColorPicker = document.getElementById('custom-color');
        this.customColorPicker.addEventListener('input', (e) => {
            this.currentColor = e.target.value;
            // Deselect presets if none match
            this.colorPresetBtns.forEach(b => {
                b.classList.toggle('active', b.dataset.color.toLowerCase() === e.target.value.toLowerCase());
            });
            this.updateControlState();
        });

        if (this.densitySlider) {
            this.densitySlider.addEventListener('input', () => this.updateControlState());
        }

        // Palette theme buttons
        this.themePresetBtns = document.querySelectorAll('.theme-preset-btn');
        this.themePresetBtns.forEach(btn => {
            btn.addEventListener('click', () => this.applyTheme(btn.dataset.theme));
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

    _themeLabel(theme) {
        const map = {
            none: 'DEFAULT',
            cyberpunk: 'CYBERPUNK',
            emoji: 'EMOJI',
            depth: 'DEPTH 3D'
        };
        return map[theme] || 'DEFAULT';
    }

    _styleLabel(style) {
        const map = {
            classic: 'CLASSIC',
            dense: 'DENSE',
            katakana: 'JP',
            cyber: 'CYBER',
            glitch: 'GLITCH'
        };
        return map[style] || 'CLASSIC';
    }

    updateControlState() {
        if (this.quickState.theme) this.quickState.theme.textContent = this._themeLabel(this.currentTheme);
        if (this.quickState.style) this.quickState.style.textContent = this._styleLabel(this.currentStyle);

        const density = this.densitySlider ? this.densitySlider.value : '50';
        if (this.quickState.density) this.quickState.density.textContent = density;
        if (this.quickState.densityValue) this.quickState.densityValue.textContent = density;

        const mode = (this.colorMode || 'solid').toUpperCase();
        if (this.quickState.colorMode) this.quickState.colorMode.textContent = mode;
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

    applyTheme(name) {
        if (this.currentTheme === name) return;

        // 테마 전환 애니메이션 시작
        this.asciiContainer.classList.add('theme-switching');

        setTimeout(() => {
            this.currentTheme = name;
            this.themePresetBtns.forEach(b => b.classList.toggle('active', b.dataset.theme === name));

            // 색상 패널: DEFAULT일 때만 표시
            const colorPanel = document.getElementById('color-panel');
            const lockNotice = document.getElementById('theme-lock-notice');
            const isDefault = name === 'none';
            if (colorPanel) colorPanel.style.display = isDefault ? '' : 'none';
            if (lockNotice) lockNotice.style.display = isDefault ? 'none' : '';

            if (name === 'emoji') {
                if (this.emojiCanvas) this.emojiCanvas.style.display = 'block';
                this.output.style.display = 'none';
            } else {
                if (this.emojiCanvas) this.emojiCanvas.style.display = 'none';
                this.output.style.display = '';
            }

            if (name === 'cyberpunk') {
                this.colorMode = 'cyberpunk';
                this.currentColor = '#FF00FF';
                this.customColorPicker.value = '#ff00ff';
                this.colorPresetBtns.forEach(b => b.classList.remove('active'));
                this.handleStyleChange('cyber');
                this.styleRadios.forEach(r => { r.checked = r.value === 'cyber'; });
            } else if (name === 'emoji') {
                this.colorMode = 'solid';
                this.currentColor = '#FFFFFF';
            } else if (name === 'depth') {
                this.colorMode = 'solid';
                this.currentColor = '#00FF41';
                this.handleStyleChange('dense');
                this.styleRadios.forEach(r => { r.checked = r.value === 'dense'; });
            } else {
                // Restore from UI controls (Original Mode)
                let foundMode = false;
                this.colorModeRadios.forEach(r => { 
                    if (r.checked) {
                        this.colorMode = r.value;
                        foundMode = true;
                    }
                });
                if (!foundMode) {
                    this.colorMode = 'solid';
                    if (this.colorModeRadios[0]) this.colorModeRadios[0].checked = true;
                }

                this.colorPresetBtns.forEach(b => { 
                    if (b.classList.contains('active')) this.currentColor = b.dataset.color; 
                });

                // Restore style from radio
                this.styleRadios.forEach(r => {
                    if (r.checked) this.handleStyleChange(r.value);
                });
            }

            this.updateControlState();

            // 전환 애니메이션 종료
            setTimeout(() => {
                this.asciiContainer.classList.remove('theme-switching');
            }, 50);
        }, 300); // CSS transition 시간과 맞춤
    }

    handleStyleChange(style) {
        this.currentStyle = style;
        this.customInputPanel.style.display = style === 'glitch' ? 'block' : 'none';
        if (style === 'glitch') this.presets.glitch = this.customInput.value || " ";
        this.updateControlState();
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
            this.initFaceMesh();
            requestAnimationFrame(this.updateLoop);
        } catch (err) {
            console.error("Init failed:", err);
            alert("카메라 권한을 허용해주세요. 웹캠 접근이 필요합니다.");
        }
    }

    initFaceMesh() {
        if (typeof FaceMesh === 'undefined') {
            console.warn("FaceMesh not loaded yet.");
            return;
        }
        this.faceMesh = new FaceMesh({locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }});
        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        this.faceMesh.onResults((results) => {
            if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
                this.latestFaceLandmarks = results.multiFaceLandmarks[0];
            } else {
                this.latestFaceLandmarks = null;
            }
        });
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

        this.depthCanvas.width = this.canvas.width;
        this.depthCanvas.height = this.canvas.height;
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
        if (this.meterValues.bass) this.meterValues.bass.textContent = `${Math.round(this.audioLevels.bass * 100)}%`;
        if (this.meterValues.mid) this.meterValues.mid.textContent = `${Math.round(this.audioLevels.mid * 100)}%`;
        if (this.meterValues.treble) this.meterValues.treble.textContent = `${Math.round(this.audioLevels.treble * 100)}%`;
    }

    getAsciiChar(brightness) {
            let charSet = this.presets[this.currentStyle];
            
            // Cyber/Glitch: scramble chars on bass hit
            if ((this.currentStyle === 'cyber' || this.currentStyle === 'glitch') && this.audioLevels.bass > 0.75) {
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

    renderEmojiCanvas(pixels) {
        if (!this.emojiCtx) return;
        const emojis = ['🌑', '🌒', '🌓', '🌔', '🌕'];
        const emojiSize = 18;
        const cols = Math.floor(this.canvas.width / 2);
        const rows = this.canvas.height;
        const w = cols * emojiSize;
        const h = rows * emojiSize;

        if (this.emojiCanvas.width !== w || this.emojiCanvas.height !== h) {
            this.emojiCanvas.width = w;
            this.emojiCanvas.height = h;
        }

        const ctx = this.emojiCtx;
        ctx.fillStyle = '#000500';
        ctx.fillRect(0, 0, w, h);
        ctx.font = `${emojiSize}px serif`;
        ctx.textBaseline = 'top';

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const px = (y * this.canvas.width + x * 2) * 4;
                const brightness = pixels[px] * 0.299 + pixels[px + 1] * 0.587 + pixels[px + 2] * 0.114;
                const adjusted = Math.min(255, brightness * (1 + this.audioLevels.volume * 0.5));
                const idx = Math.floor((adjusted / 255) * (emojis.length - 1));
                ctx.fillText(emojis[idx], x * emojiSize, y * emojiSize);
            }
        }

        // Subtle scanlines
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let i = 0; i < h; i += 4) ctx.fillRect(0, i, w, 1);
    }

    updateLoop() {
        const frameStart = performance.now();

        // FPS counter
        this.fpsFrameCount++;
        if (frameStart - this.fpsLastTime >= 1000) {
            const fps = this.fpsFrameCount;
            this.fpsFrameCount = 0;
            this.fpsLastTime = frameStart;
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

        // Build ASCII string / Emoji canvas
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const pixels = imageData.data;

        // Process FaceMesh asynchronously
        if (this.faceMesh) {
            this.faceMesh.send({image: this.video});
        }

        if (this.currentTheme === 'emoji') {
            this.renderEmojiCanvas(pixels);
        } else if (this.currentTheme === 'depth') {
            this.renderDepthAscii(pixels);
        } else {
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
        }

        this.applyVisualEffects();

        // Update latency display
        const latency = Math.round(performance.now() - frameStart);
        if (this.headerLatency) this.headerLatency.textContent = latency + 'ms';

        requestAnimationFrame(this.updateLoop);
    }

    renderDepthAscii(pixels) {
        // 1. Generate Depth Map buffer if landmarks exist
        const depthBuffer = new Uint8Array(this.canvas.width * this.canvas.height).fill(255); // Default "far" (255)

        if (this.latestFaceLandmarks) {
            const ctx = this.depthCtx;
            ctx.fillStyle = 'white'; // White is "far"
            ctx.fillRect(0, 0, this.depthCanvas.width, this.depthCanvas.height);

            // Draw landmarks as soft dots. Z value mapped to brightness.
            // In MediaPipe, smaller Z is closer.
            // Let's map Z roughly from -0.1 (near) to 0.1 (far) -> 0 to 255
            this.latestFaceLandmarks.forEach(lm => {
                const x = (1 - lm.x) * this.depthCanvas.width; // Mirrored
                const y = lm.y * this.depthCanvas.height;
                const zNorm = (lm.z + 0.08) / 0.16; // Normalize Z -0.08..0.08 to 0..1
                const depth = Math.max(0, Math.min(255, zNorm * 255));
                
                // Draw a soft circle
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, 4);
                gradient.addColorStop(0, `rgb(${depth},${depth},${depth})`);
                gradient.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            });

            // Read back depth data
            const depthData = ctx.getImageData(0, 0, this.depthCanvas.width, this.depthCanvas.height).data;
            for (let i = 0; i < depthBuffer.length; i++) {
                depthBuffer[i] = depthData[i * 4];
            }
        }

        const depthChars = '@#. '; // Near to Far
        let asciiStr = "";
        for (let y = 0; y < this.canvas.height; y++) {
            for (let x = 0; x < this.canvas.width; x++) {
                const offset = (y * this.canvas.width + x);
                const depth = depthBuffer[offset];
                
                // Audio reactivity: expand/contract depth range
                const adjustedDepth = Math.max(0, Math.min(255, depth * (1 - this.audioLevels.volume * 0.1)));
                
                let idx;
                if (adjustedDepth < 70) idx = 0; // @ (Near)
                else if (adjustedDepth < 140) idx = 1; // # (Mid)
                else if (adjustedDepth < 210) idx = 2; // . (Far)
                else idx = 3; // (Background)
                
                asciiStr += depthChars[idx];
            }
            asciiStr += "\n";
        }

        this.lastAsciiFrame = asciiStr;
        this.output.textContent = asciiStr;
        this.updateRecordingCanvas(asciiStr);
    }

    applyVisualEffects() {
        // Update Header status meters
        if (this.headerAudio) this.headerAudio.textContent = Math.round(this.audioLevels.volume * 100) + '%';
        if (this.headerBass) this.headerBass.textContent = Math.round(this.audioLevels.bass * 100) + '%';

        const container = this.asciiContainer || this.output.parentElement;
        const visualOutput = (this.currentTheme === 'emoji') ? this.emojiCanvas : this.output;

        // --- EXTREME BEAT REACTION (Content only) ---
        const bassTrigger = this.audioLevels.bass > 0.92;
        const volTrigger = this.audioLevels.volume > 0.8;

        // Reset previous transformations to prevent stack
        visualOutput.style.transform = '';

        // 1. Heavy Glitch on Bass Kick (Apply to output instead of container)
        if (bassTrigger) {
            visualOutput.classList.add('effect-heavy-glitch');
            setTimeout(() => visualOutput.classList.remove('effect-heavy-glitch'), 200);
        }

        // 2. Strobe on High Volume
        if (volTrigger) {
            container.classList.add('effect-strobe');
        } else {
            container.classList.remove('effect-strobe');
        }

        // 3. Chromatic Split on Treble/High volume
        if (this.audioLevels.volume > 0.5) {
            this.output.classList.add('effect-chromatic');
        } else {
            this.output.classList.remove('effect-chromatic');
        }

        // 4. Dynamic Scale (Pulse internal content only)
        const scaleVal = 1 + (this.audioLevels.volume * 0.08);
        visualOutput.style.transform = `scale(${scaleVal})`;

        // Color based on selected mode
        let color, shadow;

        if (this.colorMode === 'cyberpunk') {
            const neonHues = [300, 180, 60]; // magenta, cyan, yellow
            this.cyberpunkPhase = (this.cyberpunkPhase + 2.5 + this.audioLevels.volume * 10) % 360;
            const hIdx = Math.floor(this.cyberpunkPhase / 120) % 3;
            color = `hsl(${neonHues[hIdx]}, 100%, 62%)`;
            const spread = 2 + Math.floor(this.audioLevels.volume * 5);
            const comp = (neonHues[hIdx] + 180) % 360;
            const adj  = (neonHues[hIdx] +  90) % 360;
            const glow = 10 + Math.floor(this.audioLevels.volume * 22);
            shadow = `-${spread}px 0 hsl(${comp},100%,58%), ${spread}px 0 hsl(${adj},100%,58%), 0 0 ${glow}px ${color}`;
        } else if (this.colorMode === 'rainbow') {
            this.rainbowHue = (this.rainbowHue + 1.2 + this.audioLevels.treble * 4) % 360;
            color = `hsl(${this.rainbowHue}, 100%, 68%)`;
            shadow = `0 0 8px hsl(${this.rainbowHue}, 100%, 45%)`;
        } else if (this.colorMode === 'pulse') {
            const intensity = 0.3 + this.audioLevels.volume * 0.7;
            color = this._applyIntensity(this.currentColor, intensity);
            const glowStr = Math.floor(this.audioLevels.volume * 18);
            shadow = `0 0 ${glowStr}px ${color}`;
        } else {
            // Solid — flash white on strong bass
            if (this.audioLevels.bass > 0.85) {
                color = '#ffffff';
                shadow = '0 0 12px #ffffff';
            } else {
                color = this.currentColor;
                shadow = `0 0 4px ${this.currentColor}55`;
            }
        }

        if (this.currentTheme !== 'emoji') {
            this.output.style.color = color;
            this.output.style.textShadow = shadow;
        }

        // Audio-reactive container glow
        const gv = this.audioLevels.volume;
        if (gv > 0.04) {
            const gs = Math.floor(8 + gv * 42);
            const gc = this.colorMode === 'cyberpunk'
                ? `hsl(${this.cyberpunkPhase % 360}, 100%, 50%)`
                : color;
            container.style.boxShadow =
                `0 0 0 1px rgba(0,100,20,0.12), 0 24px 80px rgba(0,0,0,0.9), inset 0 0 100px rgba(0,80,10,0.06), 0 0 ${gs}px ${gc}55, 0 0 ${gs * 2}px ${gc}22`;
        } else {
            container.style.boxShadow = '';
        }

        // Scale font to fill container width
        const containerWidth = container.clientWidth;
        const fontSize = (containerWidth / this.width) * 1.6;
        this.output.style.fontSize = `${fontSize}px`;
    }
}

window.addEventListener('DOMContentLoaded', () => { new AsciiEngine(); });
