# 🌌 ASCII REACTIVE // NEURAL INTERFACE v2.1

![ASCII REACTIVE Header](https://img.shields.io/badge/Status-Stable-00FF41?style=for-the-badge&logo=matrix&logoColor=00FF41)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)
![JS](https://img.shields.io/badge/Vanilla-JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

**ASCII REACTIVE**는 사용자의 웹캠 피드와 실시간 오디오 데이터를 결합하여 몰입감 넘치는 아스키 아트(ASCII Art)를 생성하는 반응형 웹 어플리케이션입니다.

---

## ✨ 핵심 기능 (Key Features)

### 📹 실시간 아스키 렌더링 (Real-time ASCII Rendering)
- 웹캠 피드를 고성능 알고리즘을 통해 실시간 텍스트 데이터로 변환합니다.
- 조도 및 대비 자동 조정으로 선명한 아스키 윤곽선을 보장합니다.

### 🔊 오디오 반응형 엔진 (Audio Reactive Engine)
- **주파수 분석**: Bass(저음), Mid(중음), Treble(고음)을 실시간으로 분석합니다.
- **다이나믹 스케일링**: 베이스 비트에 맞춰 화면이 흔들리거나(Shake) 아스키 밀도가 변화합니다.
- **비트 펄스**: 음악의 리듬에 따라 텍스트의 밝기와 글로우(Glow) 효과가 반응합니다.

### 🎨 커스텀 스타일 및 테마 (Customization)
- **프리셋 스타일**: Classic, Dense, Matrix, Glitch 등 4가지 기본 모드를 제공합니다.
- **글리치 모드**: 베이스 강도가 높을 때 문자가 무작위로 뒤섞이는 글리치 연출을 지원합니다.
- **컬러 시스템**: Matrix Green, Cyber Blue, Blood Red 등 5개 이상의 프리셋과 Rainbow(무지개), Beat Pulse 모드를 지원합니다.
- **커스텀 문자셋**: 사용자가 직접 원하는 문자를 입력하여 아스키 아트를 구성할 수 있습니다.

### ⏺ 녹화 및 공유 (Recording & Sharing)
- **10초 캡처**: 버튼 클릭 시 고음질 오디오가 포함된 10초 분량의 WebM 영상을 녹화합니다.
- **간편 공유**: Web Share API를 통해 모바일/데스크탑에서 즉시 공유하거나 파일로 저장할 수 있습니다.
- **프레임 복사**: 현재 화면의 아스키 텍스트 프레임을 클립보드에 즉시 복사하여 텍스트로 활용 가능합니다.

---

## 🛠 사용된 기술 (Tech Stack)

- **Layout/Structure**: Semantic HTML5
- **Styling**: Vanilla CSS (Cyber-grid System, Glassmorphism, CSS Variables)
- **Logic**: Vanilla JavaScript (ES6+)
- **APIs**:
  - `MediaDevices.getUserMedia()` (Webcam Access)
  - `MediaDevices.getDisplayMedia()` (Tab Audio Capture)
  - `Web Audio API` (Frequency Analysis)
  - `Canvas API` (Pixel Processing & Recording Buffer)
  - `MediaRecorder API` (Video Capturing)
  - `Web Share API` (Native Sharing)

---

## 🚀 빠른 시작 (Quick Start)

이 프로젝트는 서버 설치 없이 브라우저에서 즉시 실행이 가능합니다.

1. **저장소 복제**
   ```bash
   git clone https://github.com/your-username/ascii-reactive.git
   ```

2. **파일 실행**
   - `index.html` 파일을 크롬(Chrome)이나 최신 브라우저로 엽니다.
   - **중요**: 로컬 호스트나 HTTPS 환경에서 실행해야 카메라 및 오디오 기능이 정상 작동합니다. (VS Code의 Live Server 익스텐션 사용을 권장합니다.)

3. **연결 시작**
   - 메인 화면의 `// 연결 시작` 버튼을 누릅니다.
   - 브라우저 상단에서 카메라 권한을 허용합니다.
   - "탭 공유" 창이 뜨면 **"시스템 오디오 공유"** 또는 **"탭 오디오 공유"**를 체크한 후 확인을 누릅니다.

---

## 🎮 조작 가이드 (Controls)

- **주파수 분석**: 현재 입력되는 사운드의 영역별 강도를 미터기로 확인합니다.
- **밀도 조절**: 슬라이더를 통해 아스키 입자의 크기를 조절하여 더 세밀하거나 거친 느낌을 연출합니다.
- **섹션 확장/축소**: 각 컨트롤 패널의 라벨을 클릭하여 필요한 설정만 열어볼 수 있습니다.
- **녹화 기능**: `RECORD` 버튼을 누르면 타이머가 시작되며 10초 후 자동으로 전용 영상이 생성됩니다.

---

## 📜 라이선스 (License)

이 프로젝트는 [MIT License](LICENSE)를 따릅니다. 누구나 자유롭게 수정 및 배포가 가능합니다.

---

## 📧 연락처 (Contact)

질문이나 피드백이 있다면 저장소의 **Issue** 탭을 이용해 주세요!

