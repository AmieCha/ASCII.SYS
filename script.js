// ASCII 관련 설정
const ASCII_CHARS = ' .:-=+*#%@';
const ASCII_CHARS_EXTENDED = '  ..::--==++**##%%@@@@';
let densityLevel = 2;
let columnCount = 80; // 출력 폭(문자 수)

// 일시적 축소용 캔버스
const tempCanvas = document.createElement('canvas');
const tempCtx = tempCanvas.getContext('2d');

// 비디오 및 캔버스 요소
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
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
let bassFreq = 0;
let midFreq = 0;
let trebleFreq = 0;
let averageVolume = 0;

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
        video.onloadedmetadata = () => {
            video.play();
            document.getElementById('cameraStat').textContent = '✓ 활성';
            document.querySelector('.container').classList.add('camera-active');
        };

            // 포즈 감지 모델 로드 (ml5.js)
        if (typeof ml5 === 'undefined') {
            throw new Error('ml5.js가 로드되지 않았습니다. 스크립트 태그를 확인하세요.');
        }
        poseDetector = await ml5.poseNet(video, () => {
            console.log('포즈 감지 모델 로드 완료');
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
    analyser.smoothingTimeConstant = 0.8;
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
        
        // 오디오 요소 생성
        if (audio) {
            audio.pause();
            audio.src = '';
        }
        
        audio = new Audio();
        audio.src = URL.createObjectURL(file);
        
        // 오디오 컨텍스트에 연결
        if (!audioContext) setupAudio();
        
        const source = audioContext.createMediaElementAudioSource(audio);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        
        // 재생 버튼 활성화
        playBtn.disabled = false;
        pauseBtn.disabled = true;
    }
});

// ============= 재생 제어 =============
playBtn.addEventListener('click', () => {
    if (audio && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    if (audio) {
        audio.play();
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
    if (!analyser) return;
    
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
    
    // 평균 음량
    let volumeSum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        volumeSum += dataArray[i];
    }
    averageVolume = (volumeSum / dataArray.length) / 255;
}

// ============= 포즈 감지 =============
function detectPose() {
    poseDetector.on('pose', (results) => {
        poses = results;
    });
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
        // 우세한 주파수 대역에 따른 색상 변경
        if (bassFreq > 0.3) {
            document.querySelector('.container').classList.add('music-bass');
            document.querySelector('.container').classList.remove('music-mid', 'music-treble');
        } else if (midFreq > 0.3) {
            document.querySelector('.container').classList.add('music-mid');
            document.querySelector('.container').classList.remove('music-bass', 'music-treble');
        } else if (trebleFreq > 0.3) {
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
        
        // 포즈 감지
        detectPose();
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
