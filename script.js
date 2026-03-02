// 전역 unhandled promise rejection 로깅
window.addEventListener('unhandledrejection', (evt) => {
    console.warn('Unhandled promise rejection:', evt.reason);
    // prevent default to avoid console spam
    // evt.preventDefault();
});

// ASCII 관련 설정
const ASCII_CHARS = ' .:-=+*#%@';
const ASCII_CHARS_EXTENDED = '  ..::--==++**##%%@@@@';
let densityLevel = 2;
let columnCount = 80; // 출력 폭(문자 수)

// 일시적 축소용 캔버스
const tempCanvas = document.createElement('canvas');
const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

// 비디오 및 캔버스 요소
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
// getContext with willReadFrequently to silence performance warning
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const asciiOutput = document.getElementById('asciiOutput');

// 제어 요소
const musicInput = document.getElementById('musicInput');
const musicBtn = document.getElementById('musicBtn');
const musicName = document.getElementById('musicName');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const densitySlider = document.getElementById('densitySlider');
const densityValue = document.getElementById('densityValue');
const showStatsCheckbox = document.getElementById('showStats');
const stats = document.getElementById('stats');

// 통계
let fps = 0;
let frameCount = 0;
let lastTime = Date.now();

// 오디오 관련
let audio = null;
let audioContext = null;
let analyser = null;
let dataArray = null;
let audioSource = null; // source 재생성 방지
let micStream = null; // 마이크 스트림
let isMicActive = false;
let bassFreq = 0;
let midFreq = 0;
let trebleFreq = 0;
let averageVolume = 0;

// beat detection
let lastBassFreq = 0;
let beatCooldown = 0;
const BEAT_THRESHOLD = 0.35; // bass increase threshold
const BEAT_COOLDOWN_FRAMES = 15;

// density restore timer
let restoreTimer = null;

// user preference density
let userDensity = densityLevel;

// 포즈 감지 관련
let poseDetector = null;
let poses = [];

// ============= 애플리케이션 초기화 =============
async function init() {
    try {
        // feature detection
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('브라우저가 getUserMedia를 지원하지 않습니다. HTTPS 또는 최신 Chrome/Firefox를 사용하세요.');
        }
        // 웹캠 액세스
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 480, height: 360 },
            audio: false
        });
        
        video.srcObject = stream;
        // 메타데이터와 첫 번째 프레임이 준비될 때까지 기다립니다.
        await new Promise(resolve => {
            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                resolve();
            } else {
                video.addEventListener('loadeddata', () => {
                    resolve();
                }, { once: true });
            }
        });
        video.play().catch(()=>{});
        document.getElementById('cameraStat').textContent = '✓ 활성';
        document.querySelector('.container').classList.add('camera-active');

        // 포즈 감지 모델 로드 (ml5.js)
        if (typeof ml5 === 'undefined') {
            throw new Error('ml5.js가 로드되지 않았습니다. 스크립트 태그를 확인하세요.');
        }
        poseDetector = ml5.poseNet(video, () => {
            console.log('포즈 감지 모델 로드 완료');
        });
        poseDetector.on('pose', (results) => {
            poses = results;
        });

        // 오디오 컨텍스트 설정
        setupAudio();
        
        // 렌더링 루프 시작
        renderLoop();
        
    } catch (error) {
        console.error('초기화 오류:', error);
        const msg = document.getElementById('errorMsg');
        msg.textContent = '카메라 또는 마이크 액세스 오류: ' + error.message;
        msg.style.display = 'block';
        alert('카메라 또는 마이크 액세스가 거부되었습니다. 콘솔을 확인하세요.');
    }
}

// ============= 오디오 설정 =============
function setupAudio() {
    if (audioContext) return;
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6; // 더 빠른 반응
    dataArray = new Uint8Array(analyser.frequencyBinCount);
}

// ============= 음악 파일 선택 =============
musicBtn.addEventListener('click', () => {
    musicInput.click();
});

musicInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        musicName.textContent = file.name;
        console.log('선택된 음악:', file.name);
        
        // 오디오 요소 생성
        if (audio) {
            audio.pause();
            audio.src = '';
        }
        
        audio = new Audio();
        audio.src = URL.createObjectURL(file);
        audio.crossOrigin = 'anonymous';
        
        // 오디오 컨텍스트 설정
        if (!audioContext) setupAudio();
        
        // source가 이미 있으면 제거, 새로 생성
        if (audioSource) {
            try { audioSource.disconnect(); } catch(e) { }
        }
        audioSource = audioContext.createMediaElementAudioSource(audio);
        audioSource.connect(analyser);
        analyser.connect(audioContext.destination);
        console.log('오디오 소스 연결됨');
        
        // 재생 버튼 활성화
        playBtn.disabled = false;
        pauseBtn.disabled = true;
    }
});

// ============= 재생 제어 =============
playBtn.addEventListener('click', () => {
    if (audio && audioContext.state === 'suspended') {
        audioContext.resume();
        console.log('AudioContext resumed');
    }
    if (audio) {
        audio.play();
        console.log('음악 재생시작, 볼륨:', averageVolume);
        playBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
        document.querySelector('.container').classList.add('music-playing');
        document.getElementById('musicStat').textContent = '▶ 재생 중';
    }
});

pauseBtn.addEventListener('click', () => {
    if (audio) {
        audio.pause();
        playBtn.disabled = false;
        pauseBtn.disabled = true;
        document.getElementById('musicStat').textContent = '⏸ 일시정지';
    }
});

stopBtn.addEventListener('click', () => {
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
        playBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        document.querySelector('.container').classList.remove('music-playing');
        document.getElementById('musicStat').textContent = '⏹ 정지';
        averageVolume = 0;
        updateVolumeStat();
    }
});

// ============= 밀도 제어 =============
densitySlider.addEventListener('input', (e) => {
    densityLevel = parseInt(e.target.value);
    densityValue.textContent = densityLevel;
});

// ============= 컬럼 수 제어 =============
const columnSlider = document.getElementById('columnSlider');
const columnValue = document.getElementById('columnValue');
columnSlider.addEventListener('input', (e) => {
    columnCount = parseInt(e.target.value);
    columnValue.textContent = columnCount;
});

// ============= 통계 표시 =============
showStatsCheckbox.addEventListener('change', () => {
    stats.style.display = showStatsCheckbox.checked ? 'grid' : 'none';
});

// ============= 이미지를 ASCII로 변환 =============
function imageToAscii(imageData, width, height) {
    const data = imageData.data;
    let ascii = '';
    let charIndex = 0;
    
    const step = densityLevel;
    const charSet = ASCII_CHARS_EXTENDED;
    
    for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
            const index = (y * width + x) * 4;
            
            // 그레이스케일 값 계산
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const gray = (r * 0.299 + g * 0.587 + b * 0.114);
            
            // 0-255를 0-charSet.length로 정규화
            charIndex = Math.floor((gray / 255) * (charSet.length - 1));
            charIndex = Math.max(0, Math.min(charIndex, charSet.length - 1));
            
            ascii += charSet[charIndex];
        }
        ascii += '\n';
    }
    
    return ascii;
}

// ============= 음악 분석 =============
function analyzeMusic() {
    if (!analyser || !audio || audio.paused) {
        if (audio && !audio.paused && !analyser) {
            console.warn('⚠️ analyser가 없음. setupAudio() 확인 필요');
        }
        return;
    }
    
    analyser.getByteFrequencyData(dataArray);
    
    // 주파수 대역 분석
    const length = dataArray.length;
    const bassRange = Math.floor(length * 0.1);
    const midRange = Math.floor(length * 0.3);
    const trebleRange = length;
    
    // Bass (저음) 분석
    let bassSum = 0;
    for (let i = 0; i < bassRange; i++) {
        bassSum += dataArray[i];
    }
    bassFreq = bassSum / bassRange / 255;
    
    // Mid (중음) 분석
    let midSum = 0;
    let midCount = midRange - bassRange;
    for (let i = bassRange; i < midRange; i++) {
        midSum += dataArray[i];
    }
    midFreq = midSum / midCount / 255;
    
    // Treble (고음) 분석
    let trebleSum = 0;
    let trebleCount = trebleRange - midRange;
    for (let i = midRange; i < trebleRange; i++) {
        trebleSum += dataArray[i];
    }
    trebleFreq = trebleSum / trebleCount / 255;
    
    // 평균 음량 (민감도 개선: 0-255 대신 로그 스케일 사용)
    let volumeSum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        volumeSum += dataArray[i];
    }
    const rawVolume = volumeSum / dataArray.length;
    // 로그 스케일로 변환하여 작은 음량도 감지 가능하게 함
    averageVolume = Math.pow(rawVolume / 255, 0.5); // 제곱근으로 민감도 향상

    // beat detection using bass spike
    if (beatCooldown <= 0 && bassFreq - lastBassFreq > BEAT_THRESHOLD) {
        console.log('🥁 Beat detected! Bass:', bassFreq.toFixed(2));
        triggerBeat();
        beatCooldown = BEAT_COOLDOWN_FRAMES;
    }
    lastBassFreq = bassFreq;
    if (beatCooldown > 0) beatCooldown--;
}

// ============= 통계 업데이트 =============
function updateStats() {
    // FPS 계산
    frameCount++;
    const currentTime = Date.now();
    if (currentTime - lastTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastTime = currentTime;
        document.getElementById('fpsStat').textContent = fps;
    }
    
    // 음량 통계
    updateVolumeStat();
    
    // 주파수 통계
    const dominantFreq = 
        bassFreq > midFreq && bassFreq > trebleFreq ? 'Bass' :
        midFreq > trebleFreq ? 'Mid' : 'Treble';
    document.getElementById('frequencyStat').textContent = dominantFreq;
}

function updateVolumeStat() {
    const volumePercent = Math.round(averageVolume * 100);
    document.getElementById('volumeStat').textContent = volumePercent;
}

// ============= 음악에 따른 효과 적용 =============
function applyMusicEffects() {
    const container = document.querySelector('.ascii-container');
    const output = document.getElementById('asciiOutput');
    
    if (audio && !audio.paused) {
        // 색상 시프트: 주파수 기반 hue
        const hue = Math.floor(((bassFreq * 0.5 + midFreq * 0.3 + trebleFreq * 0.2) % 1) * 360);
        output.style.color = `hsl(${hue}, 100%, 50%)`;
        output.style.textShadow = `0 0 5px hsl(${hue}, 100%, 50%)`;

        // 콘텐츠 클래스 유지
        if (bassFreq > midFreq && bassFreq > trebleFreq) {
            document.querySelector('.container').classList.add('music-bass');
            document.querySelector('.container').classList.remove('music-mid', 'music-treble');
        } else if (midFreq > trebleFreq) {
            document.querySelector('.container').classList.add('music-mid');
            document.querySelector('.container').classList.remove('music-bass', 'music-treble');
        } else {
            document.querySelector('.container').classList.add('music-treble');
            document.querySelector('.container').classList.remove('music-bass', 'music-mid');
        }
        
        // 음량에 따른 애니메이션
        if (averageVolume > 0.5) {
            container.classList.add('music-active');
            output.classList.add('music-active');
        } else {
            container.classList.remove('music-active');
            output.classList.remove('music-active');
        }
    } else {
        container.classList.remove('music-active');
        output.classList.remove('music-active');
        document.querySelector('.container').classList.remove('music-bass', 'music-mid', 'music-treble');
        // reset color
        output.style.color = '#00ff00';
        output.style.textShadow = '0 0 5px rgba(0, 255, 0, 0.3)';
    }
}

// ============= 렌더링 루프 =============
function renderLoop() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // 캔버스에 비디오 그리기 (뒤집기)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
        
        // 축소된 이미지 생성
        const cols = columnCount;
        const rows = Math.floor(canvas.height * cols / canvas.width);
        tempCanvas.width = cols;
        tempCanvas.height = rows;
        tempCtx.save();
        tempCtx.scale(-1, 1);
        tempCtx.drawImage(video, -cols, 0, cols, rows);
        tempCtx.restore();

        const imageData = tempCtx.getImageData(0, 0, cols, rows);
        
        // ASCII로 변환
        const ascii = imageToAscii(imageData, cols, rows);
        asciiOutput.textContent = ascii;
    }
    
    // 음악 분석
    analyzeMusic();
    
    // 효과 적용
    applyMusicEffects();
    
    // 통계 업데이트
    updateStats();
    
    // 다음 프레임 요청
    requestAnimationFrame(renderLoop);
}

// ============= 애플리케이션 시작 =============
window.addEventListener('load', init);

// beat trigger helper
function triggerBeat() {
    // density 해상도 높이기 (작은 step → 세부 묘사)
    densityLevel = 1;
    if (restoreTimer) clearTimeout(restoreTimer);
    restoreTimer = setTimeout(() => {
        densityLevel = userDensity;
    }, 200);
    
    // glitch effect
    const cont = document.querySelector('.ascii-container');
    cont.classList.add('glitch');
    setTimeout(() => cont.classList.remove('glitch'), 120);
    
    // 작은 문자 깨짐 효과: 약간의 랜덤 노이즈
    const orig = asciiOutput.textContent;
    let noisy = '';
    for (let i = 0; i < orig.length; i++) {
        if (Math.random() < 0.02 && orig[i] !== '\n') {
            noisy += ASCII_CHARS_EXTENDED[Math.floor(Math.random() * ASCII_CHARS_EXTENDED.length)];
        } else {
            noisy += orig[i];
        }
    }
    asciiOutput.textContent = noisy;
}

// ============= 창 닫을 때 정리 =============
window.addEventListener('beforeunload', () => {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    if (audio) {
        audio.pause();
        audio.src = '';
    }
});

// ======== 마이크 입력 추가 ========
// 기존 마이크 변수는 이미 선언됨 (let micStream = null; let isMicActive = false;)

const micBtn = document.getElementById('micBtn');
const micStopBtn = document.getElementById('micStopBtn');  
const micStatus = document.getElementById('micStatus');

micBtn.addEventListener('click', async () => {
    try {
        if (!audioContext) setupAudio();
        micStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false // 자동 게인 제어 비활성화 (수동 조절 가능)
            } 
        });
        console.log('마이크 활성화됨');
        
        if (audioSource) { 
            try { audioSource.disconnect(); } catch(e) { } 
        }
        
        // 게인 노드 추가 (마이크 입력 증폭)
        let gainNode = audioContext.createGain();
        gainNode.gain.value = 3; // 3배 증폭 (시스템 오디오 감지 개선)
        
        // 올바른 메서드명은 createMediaStreamSource입니다.
        audioSource = audioContext.createMediaStreamSource(micStream);
        audioSource.connect(gainNode);
        gainNode.connect(analyser);
        analyser.connect(audioContext.destination);
        
        isMicActive = true;
        micBtn.disabled = true;
        micStopBtn.disabled = false;
        micStatus.textContent = 'ON';
        micStatus.style.color = '#00ff00';
        document.getElementById('musicName').textContent = '시스템 오디오 감지 중';
        document.getElementById('musicStat').textContent = '마이크 활성';
        playBtn.disabled = true;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
        console.log('유튜브 등의 시스템 오디오 감지 시작');
    } catch (error) {
        console.error('마이크 오류:', error);
        alert('마이크 액세스가 거부되었습니다. 브라우저 설정에서 허용하세요.');
    }
});

micStopBtn.addEventListener('click', () => {
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        console.log('마이크 중지됨');
    }
    
    if (audioSource) {
        try { audioSource.disconnect(); } catch(e) { }
    }
    
    isMicActive = false;
    micBtn.disabled = false;
    micStopBtn.disabled = true;
    micStatus.textContent = 'OFF';
    micStatus.style.color = '#00aa00';
    document.getElementById('musicName').textContent = '선택된 파일 없음';
    document.getElementById('musicStat').textContent = '정지';
});

