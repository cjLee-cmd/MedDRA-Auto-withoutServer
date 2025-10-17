# MedDRA CIOMS 도구 - 로컬 설치 패키지 배포 가이드

이 문서는 **옵션 1: 로컬 설치 패키지** 방식으로 MedDRA CIOMS 도구를 배포하는 전체 과정을 안내합니다.

---

## 📋 목차

1. [배포 준비](#배포-준비)
2. [필수 파일 생성](#필수-파일-생성)
3. [설치 스크립트 작성](#설치-스크립트-작성)
4. [사용자 가이드 작성](#사용자-가이드-작성)
5. [배포 패키지 생성](#배포-패키지-생성)
6. [테스트 절차](#테스트-절차)
7. [배포 및 지원](#배포-및-지원)

---

## 배포 준비

### 시스템 요구사항

**개발자 (배포 준비자)**:
- Python 3.10+
- Node.js 16+
- Git

**최종 사용자**:
- Python 3.10+ (Windows: python.org에서 다운로드)
- Node.js 16+ (nodejs.org에서 다운로드)
- 4GB RAM 이상
- 2GB 디스크 여유 공간
- 인터넷 연결 (초기 설치 시)

### 배포 패키지 구조

```
MedDRA_CIOMS_Tool_v1/
├── ascii-281/              # MedDRA 데이터 디렉터리
│   ├── llt.asc
│   ├── pt.asc
│   ├── mdhier.asc
│   └── ... (기타 .asc 파일들)
├── index.html              # 로그인 페이지
├── main.html               # 메인 UI
├── script.js               # 프론트엔드 로직
├── meddra_server.py        # 백엔드 서버
├── meddra_lookup.py        # MedDRA 검색 엔진
├── gemini_client.py        # Gemini AI 통합
├── db_autofill.js          # Playwright 자동화 스크립트
├── requirements.txt        # Python 의존성
├── package.json            # Node.js 의존성
├── package-lock.json       # Node.js 의존성 잠금
├── .env.example            # 환경 변수 템플릿
├── .gitignore              # Git 제외 파일 (선택)
├── setup.sh                # Mac/Linux 설치 스크립트
├── setup.bat               # Windows 설치 스크립트
├── start.sh                # Mac/Linux 실행 스크립트
├── start.bat               # Windows 실행 스크립트
├── stop.sh                 # Mac/Linux 종료 스크립트 (선택)
├── stop.bat                # Windows 종료 스크립트 (선택)
├── README.md               # 프로젝트 개요
├── INSTALL_GUIDE.md        # 설치 가이드
└── USER_MANUAL.md          # 사용자 매뉴얼
```

---

## 필수 파일 생성

### 1. requirements.txt 생성

```bash
cat > requirements.txt << 'EOF'
# Python 3.10 이상 필요
# MedDRA CIOMS 도구 의존성

# Gemini AI (선택 사항)
google-generativeai>=0.3.0

# 기타 표준 라이브러리만 사용 (별도 설치 불필요)
# - http.server (내장)
# - pathlib (내장)
# - json (내장)
# - argparse (내장)
EOF
```

**참고**: 현재 코드는 대부분 Python 표준 라이브러리를 사용하므로 `google-generativeai`만 추가 설치 필요합니다.

### 2. package.json 생성

```bash
cat > package.json << 'EOF'
{
  "name": "meddra-cioms-tool",
  "version": "1.0.0",
  "description": "MedDRA CIOMS PDF 분석 및 DB 자동 입력 도구",
  "main": "db_autofill.js",
  "scripts": {
    "install-browsers": "npx playwright install chromium",
    "test": "echo \"No tests configured\" && exit 0"
  },
  "keywords": [
    "MedDRA",
    "CIOMS",
    "Pharmacovigilance",
    "Automation"
  ],
  "author": "",
  "license": "UNLICENSED",
  "dependencies": {
    "playwright": "^1.40.0"
  },
  "engines": {
    "node": ">=16.0.0",
    "npm": ">=8.0.0"
  },
  "private": true
}
EOF
```

### 3. .env.example 생성

```bash
cat > .env.example << 'EOF'
# Gemini API Key (선택 사항 - AI 재정렬 기능 사용 시)
# https://makersuite.google.com/app/apikey 에서 발급
GEMINI_API_KEY=your_api_key_here

# 서버 설정 (기본값, 변경 가능)
HOST=127.0.0.1
PORT=8000

# Gemini 모델 (기본값)
GEMINI_MODEL=gemini-1.5-flash
EOF
```

### 4. .gitignore 생성 (Git 사용 시)

```bash
cat > .gitignore << 'EOF'
# Python
venv/
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
*.egg-info/

# Node.js
node_modules/
package-lock.json

# 환경 변수
.env

# Playwright
.playwright/
playwright-report/
test-results/

# 로그
*.log
server.pid

# OS
.DS_Store
Thumbs.db
*.swp

# IDE
.vscode/
.idea/
*.sublime-*

# 테스트 파일
test_*.js
*_test.js
screenshot.png
debug-*.png
EOF
```

---

## 설치 스크립트 작성

### 1. setup.sh (Mac/Linux)

```bash
cat > setup.sh << 'SCRIPT_EOF'
#!/bin/bash
# MedDRA CIOMS 도구 설치 스크립트 (Mac/Linux)
set -e

echo "======================================"
echo "MedDRA CIOMS 도구 설치 시작"
echo "======================================"
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Python 버전 확인
echo "1️⃣  Python 버전 확인..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3이 설치되어 있지 않습니다.${NC}"
    echo "   https://www.python.org/downloads/ 에서 Python 3.10 이상을 설치해주세요."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo -e "${GREEN}✓${NC} Python $PYTHON_VERSION 감지됨"

# Python 버전 체크 (3.10 이상)
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2)

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]); then
    echo -e "${RED}❌ Python 3.10 이상이 필요합니다. 현재: $PYTHON_VERSION${NC}"
    exit 1
fi

# Node.js 버전 확인
echo ""
echo "2️⃣  Node.js 버전 확인..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js가 설치되어 있지 않습니다.${NC}"
    echo "   https://nodejs.org/ 에서 Node.js 16 이상을 설치해주세요."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2)
echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION 감지됨"

# Node.js 버전 체크 (16 이상)
NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 16 ]; then
    echo -e "${RED}❌ Node.js 16 이상이 필요합니다. 현재: $NODE_VERSION${NC}"
    exit 1
fi

# Python 가상환경 생성
echo ""
echo "3️⃣  Python 가상환경 생성 중..."
if [ -d "venv" ]; then
    echo -e "${YELLOW}⚠️  기존 가상환경이 존재합니다. 삭제하고 다시 생성합니다.${NC}"
    rm -rf venv
fi

python3 -m venv venv
echo -e "${GREEN}✓${NC} 가상환경 생성 완료"

# 가상환경 활성화
source venv/bin/activate

# pip 업그레이드
echo ""
echo "4️⃣  pip 업그레이드 중..."
pip install --quiet --upgrade pip
echo -e "${GREEN}✓${NC} pip 업그레이드 완료"

# Python 패키지 설치
echo ""
echo "5️⃣  Python 패키지 설치 중..."
if [ -f "requirements.txt" ]; then
    pip install --quiet -r requirements.txt
    echo -e "${GREEN}✓${NC} Python 패키지 설치 완료"
else
    echo -e "${YELLOW}⚠️  requirements.txt 파일이 없습니다. 건너뜁니다.${NC}"
fi

# Node.js 패키지 설치
echo ""
echo "6️⃣  Node.js 패키지 설치 중..."
if [ -f "package.json" ]; then
    npm install --silent
    echo -e "${GREEN}✓${NC} Node.js 패키지 설치 완료"
else
    echo -e "${RED}❌ package.json 파일이 없습니다.${NC}"
    exit 1
fi

# Playwright 브라우저 설치
echo ""
echo "7️⃣  Playwright 브라우저 설치 중..."
echo "   (Chromium 다운로드 중... 약 1-2분 소요)"
npx playwright install chromium --quiet
echo -e "${GREEN}✓${NC} Playwright 브라우저 설치 완료"

# 환경 변수 파일 생성
echo ""
echo "8️⃣  환경 변수 파일 설정..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓${NC} .env 파일 생성됨"
        echo -e "${YELLOW}   📝 Gemini AI를 사용하려면 .env 파일을 편집하여 API 키를 입력하세요.${NC}"
    else
        echo -e "${YELLOW}⚠️  .env.example 파일이 없습니다. 건너뜁니다.${NC}"
    fi
else
    echo -e "${GREEN}✓${NC} .env 파일이 이미 존재합니다."
fi

# 실행 권한 부여
echo ""
echo "9️⃣  실행 스크립트 권한 설정..."
chmod +x start.sh 2>/dev/null || true
chmod +x stop.sh 2>/dev/null || true
echo -e "${GREEN}✓${NC} 권한 설정 완료"

# 설치 완료
echo ""
echo "======================================"
echo -e "${GREEN}✅ 설치가 완료되었습니다!${NC}"
echo "======================================"
echo ""
echo "📖 사용 방법:"
echo "   1. 서버 시작:"
echo "      ./start.sh"
echo ""
echo "   2. 브라우저에서 접속:"
echo "      http://127.0.0.1:8000"
echo ""
echo "   3. 로그인 정보:"
echo "      아이디: acuzen"
echo "      비밀번호: acuzen"
echo ""
echo "   4. 서버 종료:"
echo "      Ctrl+C (터미널에서)"
echo ""
echo -e "${YELLOW}💡 팁: INSTALL_GUIDE.md를 참고하여 자세한 사용법을 확인하세요.${NC}"
echo ""
SCRIPT_EOF

chmod +x setup.sh
```

### 2. setup.bat (Windows)

```bash
cat > setup.bat << 'SCRIPT_EOF'
@echo off
setlocal EnableDelayedExpansion

REM MedDRA CIOMS 도구 설치 스크립트 (Windows)

echo ======================================
echo MedDRA CIOMS 도구 설치 시작
echo ======================================
echo.

REM Python 확인
echo 1. Python 버전 확인...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Python 3이 설치되어 있지 않습니다.
    echo     https://www.python.org/downloads/ 에서 Python 3.10 이상을 설치해주세요.
    echo     설치 시 "Add Python to PATH" 옵션을 반드시 체크하세요.
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo [OK] Python %PYTHON_VERSION% 감지됨
echo.

REM Node.js 확인
echo 2. Node.js 버전 확인...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Node.js가 설치되어 있지 않습니다.
    echo     https://nodejs.org/ 에서 Node.js 16 이상을 설치해주세요.
    pause
    exit /b 1
)

for /f "tokens=1" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% 감지됨
echo.

REM Python 가상환경 생성
echo 3. Python 가상환경 생성 중...
if exist venv (
    echo [!] 기존 가상환경이 존재합니다. 삭제하고 다시 생성합니다.
    rmdir /s /q venv
)

python -m venv venv
if %errorlevel% neq 0 (
    echo [X] 가상환경 생성 실패
    pause
    exit /b 1
)
echo [OK] 가상환경 생성 완료
echo.

REM 가상환경 활성화
call venv\Scripts\activate.bat

REM pip 업그레이드
echo 4. pip 업그레이드 중...
python -m pip install --quiet --upgrade pip
echo [OK] pip 업그레이드 완료
echo.

REM Python 패키지 설치
echo 5. Python 패키지 설치 중...
if exist requirements.txt (
    pip install --quiet -r requirements.txt
    echo [OK] Python 패키지 설치 완료
) else (
    echo [!] requirements.txt 파일이 없습니다. 건너뜁니다.
)
echo.

REM Node.js 패키지 설치
echo 6. Node.js 패키지 설치 중...
if exist package.json (
    call npm install --silent
    echo [OK] Node.js 패키지 설치 완료
) else (
    echo [X] package.json 파일이 없습니다.
    pause
    exit /b 1
)
echo.

REM Playwright 브라우저 설치
echo 7. Playwright 브라우저 설치 중...
echo    (Chromium 다운로드 중... 약 1-2분 소요)
call npx playwright install chromium
echo [OK] Playwright 브라우저 설치 완료
echo.

REM 환경 변수 파일 생성
echo 8. 환경 변수 파일 설정...
if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo [OK] .env 파일 생성됨
        echo [!] Gemini AI를 사용하려면 .env 파일을 편집하여 API 키를 입력하세요.
    ) else (
        echo [!] .env.example 파일이 없습니다. 건너뜁니다.
    )
) else (
    echo [OK] .env 파일이 이미 존재합니다.
)
echo.

REM 설치 완료
echo ======================================
echo [완료] 설치가 완료되었습니다!
echo ======================================
echo.
echo 사용 방법:
echo    1. 서버 시작:
echo       start.bat
echo.
echo    2. 브라우저에서 접속:
echo       http://127.0.0.1:8000
echo.
echo    3. 로그인 정보:
echo       아이디: acuzen
echo       비밀번호: acuzen
echo.
echo    4. 서버 종료:
echo       Ctrl+C (명령 프롬프트에서)
echo.
echo 팁: INSTALL_GUIDE.md를 참고하여 자세한 사용법을 확인하세요.
echo.

pause
endlocal
SCRIPT_EOF
```

### 3. start.sh (Mac/Linux 실행 스크립트)

```bash
cat > start.sh << 'SCRIPT_EOF'
#!/bin/bash
# MedDRA CIOMS 도구 시작 스크립트 (Mac/Linux)

# 가상환경 활성화
if [ ! -d "venv" ]; then
    echo "❌ 가상환경이 없습니다. 먼저 setup.sh를 실행하세요."
    exit 1
fi

source venv/bin/activate

# 서버 시작
echo "🚀 MedDRA CIOMS 서버 시작 중..."
echo ""
echo "✅ 서버 실행 중: http://127.0.0.1:8000"
echo ""
echo "📝 로그인 정보:"
echo "   아이디: acuzen"
echo "   비밀번호: acuzen"
echo ""
echo "⏹️  종료하려면 Ctrl+C를 누르세요."
echo ""

# 서버 실행
python3 meddra_server.py --host 127.0.0.1 --port 8000

# 종료 메시지
echo ""
echo "👋 서버가 종료되었습니다."
SCRIPT_EOF

chmod +x start.sh
```

### 4. start.bat (Windows 실행 스크립트)

```bash
cat > start.bat << 'SCRIPT_EOF'
@echo off

REM 가상환경 확인
if not exist venv (
    echo [X] 가상환경이 없습니다. 먼저 setup.bat을 실행하세요.
    pause
    exit /b 1
)

REM 가상환경 활성화
call venv\Scripts\activate.bat

REM 서버 시작
echo MedDRA CIOMS 서버 시작 중...
echo.
echo [OK] 서버 실행 중: http://127.0.0.1:8000
echo.
echo 로그인 정보:
echo    아이디: acuzen
echo    비밀번호: acuzen
echo.
echo 종료하려면 Ctrl+C를 누르세요.
echo.

REM 서버 실행
python meddra_server.py --host 127.0.0.1 --port 8000

echo.
echo 서버가 종료되었습니다.
pause
SCRIPT_EOF
```

---

## 사용자 가이드 작성

### 1. INSTALL_GUIDE.md

```bash
cat > INSTALL_GUIDE.md << 'EOF'
# MedDRA CIOMS 도구 설치 가이드

## 시스템 요구사항

### 필수 소프트웨어
- **Python 3.10 이상**: [python.org](https://www.python.org/downloads/)에서 다운로드
- **Node.js 16 이상**: [nodejs.org](https://nodejs.org/)에서 다운로드

### 하드웨어 요구사항
- **RAM**: 4GB 이상 (8GB 권장)
- **디스크 공간**: 2GB 이상 여유 공간
- **인터넷**: 초기 설치 시 필요 (약 200MB 다운로드)

### 지원 운영체제
- Windows 10/11
- macOS 10.15 (Catalina) 이상
- Ubuntu 20.04 이상 (기타 Linux 배포판도 호환)

---

## 설치 과정

### Windows 사용자

#### 1단계: Python 설치
1. https://www.python.org/downloads/ 접속
2. "Download Python 3.11.x" 버튼 클릭
3. 다운로드한 설치 파일 실행
4. **중요**: "Add Python to PATH" 체크박스 선택
5. "Install Now" 클릭

**설치 확인**:
```cmd
python --version
```
출력: `Python 3.11.x` 또는 그 이상

#### 2단계: Node.js 설치
1. https://nodejs.org/ 접속
2. "LTS" 버전 다운로드
3. 다운로드한 설치 파일 실행
4. 기본 옵션으로 설치 진행

**설치 확인**:
```cmd
node --version
```
출력: `v18.x.x` 또는 그 이상

#### 3단계: 도구 설치
1. 배포 패키지 압축 해제
2. 압축 해제한 폴더에서 `setup.bat` 더블클릭
3. 설치 완료까지 대기 (약 3-5분)

#### 4단계: 서버 실행
1. `start.bat` 더블클릭
2. 명령 프롬프트 창에 서버 실행 메시지 표시
3. 웹 브라우저에서 http://127.0.0.1:8000 접속

---

### Mac 사용자

#### 1단계: Python 설치
1. https://www.python.org/downloads/ 접속
2. "Download Python 3.11.x" 버튼 클릭
3. 다운로드한 .pkg 파일 실행
4. 설치 마법사 따라 진행

**설치 확인**:
```bash
python3 --version
```
출력: `Python 3.11.x` 또는 그 이상

#### 2단계: Node.js 설치
1. https://nodejs.org/ 접속
2. "LTS" 버전 다운로드
3. 다운로드한 .pkg 파일 실행
4. 설치 마법사 따라 진행

**설치 확인**:
```bash
node --version
```
출력: `v18.x.x` 또는 그 이상

#### 3단계: 도구 설치
1. 배포 패키지 압축 해제
2. 터미널 열기 (Applications > Utilities > Terminal)
3. 압축 해제한 폴더로 이동:
   ```bash
   cd ~/Downloads/MedDRA_CIOMS_Tool_v1
   ```
4. 설치 스크립트 실행:
   ```bash
   ./setup.sh
   ```
5. 설치 완료까지 대기 (약 3-5분)

**권한 오류 발생 시**:
```bash
chmod +x setup.sh
./setup.sh
```

#### 4단계: 서버 실행
```bash
./start.sh
```
웹 브라우저에서 http://127.0.0.1:8000 접속

---

### Linux 사용자

#### 1단계: Python 설치
**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install python3.11 python3-pip python3-venv
```

**CentOS/RHEL**:
```bash
sudo yum install python3.11 python3-pip
```

**설치 확인**:
```bash
python3 --version
```

#### 2단계: Node.js 설치
**Ubuntu/Debian**:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

**CentOS/RHEL**:
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

**설치 확인**:
```bash
node --version
```

#### 3단계: 추가 의존성 설치
```bash
sudo apt install -y libgbm1 libgtk-3-0 libasound2  # Ubuntu/Debian
```

#### 4단계: 도구 설치 및 실행
```bash
cd ~/Downloads/MedDRA_CIOMS_Tool_v1
./setup.sh
./start.sh
```

---

## 문제 해결

### Python 명령어를 찾을 수 없음

**Windows**:
- PATH에 Python이 추가되지 않음
- Python 재설치 시 "Add Python to PATH" 체크
- 또는 환경 변수 수동 추가

**Mac/Linux**:
```bash
# Python 3 명령어 확인
which python3
# 없다면 Homebrew로 설치 (Mac)
brew install python@3.11
```

### 포트 8000 이미 사용 중

**다른 포트 사용**:

Mac/Linux:
```bash
python3 meddra_server.py --port 8080
```

Windows:
```cmd
python meddra_server.py --port 8080
```

브라우저에서 http://127.0.0.1:8080 접속

### Playwright 설치 오류

**수동 재설치**:
```bash
# Mac/Linux
source venv/bin/activate
npx playwright install chromium --force

# Windows
venv\Scripts\activate.bat
npx playwright install chromium --force
```

### 권한 오류 (Mac/Linux)

```bash
chmod +x setup.sh start.sh
sudo chown -R $USER:$USER .
```

### Windows Defender 경고

- "Windows에서 PC 보호" 메시지 시
- "추가 정보" 클릭 → "실행" 클릭
- 정상적인 Python 스크립트입니다.

---

## 다음 단계

설치가 완료되면 **USER_MANUAL.md**를 참고하여 도구 사용법을 익히세요.

기본 로그인 정보:
- **아이디**: acuzen
- **비밀번호**: acuzen

**보안**: 프로덕션 환경에서는 로그인 정보를 변경하세요.

---

## 지원 문의

문제가 해결되지 않으면 다음 정보와 함께 문의하세요:

1. 운영체제 및 버전
2. Python 버전 (`python --version` 출력)
3. Node.js 버전 (`node --version` 출력)
4. 오류 메시지 전문 (스크린샷)
EOF
```

### 2. USER_MANUAL.md

```markdown
# MedDRA CIOMS 도구 사용자 매뉴얼

## 목차
1. [시작하기](#시작하기)
2. [로그인](#로그인)
3. [CIOMS PDF 업로드](#cioms-pdf-업로드)
4. [MedDRA 코드 검색](#meddra-코드-검색)
5. [DB 자동 입력](#db-자동-입력)
6. [고급 기능](#고급-기능)
7. [문제 해결](#문제-해결)

---

## 시작하기

### 서버 시작

**Windows**: `start.bat` 더블클릭

**Mac/Linux**:
```bash
./start.sh
```

### 웹 인터페이스 접속

브라우저에서 http://127.0.0.1:8000 접속

**지원 브라우저**:
- Google Chrome (권장)
- Microsoft Edge
- Firefox
- Safari

---

## 로그인

### 기본 로그인 정보
- **아이디**: `acuzen`
- **비밀번호**: `acuzen`

### 다크 모드
로그인 페이지에서 우측 상단 다크 모드 토글로 테마 변경 가능

---

## CIOMS PDF 업로드

### 업로드 방법

#### 방법 1: 드래그 앤 드롭
1. PDF 파일을 업로드 영역으로 드래그
2. 파일 자동 업로드 및 분석 시작

#### 방법 2: 파일 선택
1. 업로드 영역 클릭
2. 파일 탐색기에서 PDF 선택
3. "열기" 클릭

### 데이터 추출

PDF 업로드 후 자동으로:
- 환자 정보 추출
- 유해 반응 목록 추출
- 의약품 정보 추출

추출된 데이터는 모달 창에 표시됩니다.

---

## MedDRA 코드 검색

### 자동 검색

1. CIOMS 데이터 추출 후 **"MedDRA 코드 자동 검색"** 버튼 클릭
2. 각 유해 반응에 대해 자동으로 MedDRA 코드 검색 실행
3. 검색 진행률 표시
4. 결과를 카드 형식으로 표시

### 수동 검색

1. 좌측 사이드바 검색창에 증상 입력 (예: "두통", "어지럼증")
2. "검색" 버튼 클릭 또는 Enter
3. 검색 결과 확인

### 검색 옵션

- **비활성 용어 포함**: 비활성화된 MedDRA 용어도 검색
- **결과 수 제한**: 표시할 결과 개수 설정 (기본: 10개)

### 검색 결과 해석

각 결과 카드에는 다음 정보 포함:
- **LLT 코드**: Lowest Level Term 코드
- **LLT 이름**: 영문 및 한글 명칭
- **PT**: Preferred Term (상위 분류)
- **SOC**: System Organ Class (최상위 분류)
- **계층 구조**: SOC → HLGT → HLT → PT → LLT

---

## DB 자동 입력

### 사전 준비

1. MedDRA-DB 사이트 로그인 정보 준비
   - URL: https://cjlee-cmd.github.io/MedDRA-DB/
   - 아이디/비밀번호

2. CIOMS 데이터 추출 완료

### 자동 입력 실행

1. **"MedDRA-DB에 자동 입력"** 버튼 클릭
2. 확인 다이얼로그에서 "확인" 클릭
3. Playwright가 자동으로 브라우저 실행:
   - MedDRA-DB 사이트 접속
   - 로그인 (자동)
   - 새 폼 작성 페이지 이동
   - CIOMS 데이터 자동 입력
   - 저장 버튼 클릭

### 진행 과정

로딩 오버레이에 진행 상황 표시:
- "DB 자동 입력 중..."
- "처리 중..."
- "완료"

### 결과 확인

자동 입력 완료 후:
- 성공 메시지 표시
- 입력된 데이터 요약 확인
- MedDRA-DB 사이트에서 폼 확인

### 주의사항

- **자동 입력 중 브라우저 조작 금지**
- 네트워크 연결 안정성 확인
- MedDRA-DB 사이트 접근 권한 확인

---

## 고급 기능

### Gemini AI 재정렬 (선택 사항)

더 정확한 검색 결과를 위해 Google Gemini AI 사용 가능

#### 설정 방법

1. `.env` 파일 편집
2. Gemini API 키 입력:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
3. API 키 발급: https://makersuite.google.com/app/apikey
4. 서버 재시작

#### 사용

검색 시 AI가 자동으로 관련성 높은 결과를 우선 표시

---

## 문제 해결

### PDF 업로드 실패

**원인**:
- PDF 파일 손상
- 지원하지 않는 형식
- 파일 크기 과다 (>10MB)

**해결**:
- PDF 뷰어로 파일 열기 확인
- PDF 재저장 후 재시도
- 파일 크기 확인

### 검색 결과 없음

**확인 사항**:
- 검색어 철자 확인
- 유사 용어로 재검색
- 비활성 용어 포함 옵션 활성화

### DB 자동 입력 실패

**체크리스트**:
- [ ] Playwright 브라우저 설치 확인
- [ ] 인터넷 연결 확인
- [ ] MedDRA-DB 사이트 접속 가능 확인
- [ ] 로그인 정보 정확성

**수동 재시도**:
```bash
# Mac/Linux
source venv/bin/activate
npx playwright install chromium

# Windows
venv\Scripts\activate.bat
npx playwright install chromium
```

### 서버 응답 없음

**확인**:
1. 서버 실행 중인지 확인 (콘솔 창)
2. 포트 8000 충돌 확인
3. 방화벽 설정 확인
4. 다른 포트로 재시작

---

## 단축키

| 기능 | 단축키 |
|------|--------|
| 검색 실행 | Enter |
| 업로드 영역 클릭 | Ctrl+U |
| 다크 모드 토글 | Ctrl+D |
| 검색창 포커스 | Ctrl+K |

---

## 팁과 요령

### 효율적인 검색

- **구체적인 용어 사용**: "통증" 대신 "두통", "복통" 등
- **영문 용어**: 한글보다 영문 검색이 정확할 수 있음
- **동의어 활용**: 여러 표현으로 검색 시도

### 데이터 정확성

- PDF 데이터 추출 후 수동 확인 권장
- 중요 정보는 MedDRA-DB에서 최종 확인

### 성능 최적화

- 브라우저 캐시 주기적 삭제
- 불필요한 탭/창 닫기
- 서버 재시작 (장시간 사용 후)

---

## 지원 및 문의

문제 발생 시:
1. 이 매뉴얼의 문제 해결 섹션 확인
2. `INSTALL_GUIDE.md`의 문제 해결 참고
3. 오류 메시지 스크린샷 촬영
4. 시스템 정보 수집 후 문의
```

---

## 배포 패키지 생성

이제 모든 파일이 준비되었으므로 배포 패키지를 생성합니다:

```bash
#!/bin/bash
# create_package.sh - 배포 패키지 생성 스크립트

echo "📦 배포 패키지 생성 중..."

# 패키지 디렉터리 이름
PACKAGE_NAME="MedDRA_CIOMS_Tool_v1"
PACKAGE_DIR="./${PACKAGE_NAME}"

# 기존 패키지 디렉터리 삭제
if [ -d "$PACKAGE_DIR" ]; then
    rm -rf "$PACKAGE_DIR"
fi

# 패키지 디렉터리 생성
mkdir -p "$PACKAGE_DIR"

# 필수 파일 복사
echo "📄 필수 파일 복사 중..."
cp -r ascii-281 "$PACKAGE_DIR/"
cp index.html main.html script.js "$PACKAGE_DIR/"
cp meddra_server.py meddra_lookup.py gemini_client.py "$PACKAGE_DIR/"
cp db_autofill.js "$PACKAGE_DIR/"

# 설정 파일 복사
echo "⚙️  설정 파일 복사 중..."
cp requirements.txt package.json .env.example .gitignore "$PACKAGE_DIR/"

# 스크립트 복사
echo "🔧 스크립트 복사 중..."
cp setup.sh setup.bat start.sh start.bat "$PACKAGE_DIR/"
chmod +x "$PACKAGE_DIR"/*.sh

# 문서 복사
echo "📚 문서 복사 중..."
cp INSTALL_GUIDE.md USER_MANUAL.md "$PACKAGE_DIR/"
cp DEPLOYMENT_LOCAL_INSTALL.md "$PACKAGE_DIR/README.md"

# 압축
echo "🗜️  압축 중..."
ZIP_NAME="${PACKAGE_NAME}.zip"
zip -r "$ZIP_NAME" "$PACKAGE_DIR" -q

# 정리
rm -rf "$PACKAGE_DIR"

echo "✅ 배포 패키지 생성 완료: $ZIP_NAME"
echo ""
echo "📊 패키지 정보:"
ls -lh "$ZIP_NAME"
```

이 스크립트를 실행하면 배포 준비가 완료된 ZIP 파일이 생성됩니다.

---

## 테스트 절차

### 1. 깨끗한 환경에서 테스트

```bash
# 가상 머신 또는 새 시스템에서 테스트
# 1. Python, Node.js만 설치된 상태
# 2. ZIP 파일 압축 해제
# 3. setup 스크립트 실행
# 4. start 스크립트로 서버 실행
# 5. 전체 워크플로우 테스트
```

### 2. 다양한 환경 테스트

- Windows 10, Windows 11
- macOS (Intel, M1/M2)
- Ubuntu 20.04, 22.04

### 3. 기능 테스트 체크리스트

- [ ] 서버 시작
- [ ] 웹 인터페이스 접속
- [ ] 로그인
- [ ] PDF 업로드
- [ ] CIOMS 데이터 추출
- [ ] MedDRA 검색
- [ ] 자동 검색
- [ ] DB 자동 입력
- [ ] 다크 모드
- [ ] 로그아웃

---

## 배포 및 지원

### 배포 방법

1. **이메일 배포**:
   - ZIP 파일 첨부
   - INSTALL_GUIDE.md 링크 제공
   - 설치 지원 일정 안내

2. **클라우드 스토리지**:
   - Google Drive, Dropbox 등에 업로드
   - 다운로드 링크 공유

3. **내부 네트워크**:
   - 조직 내 파일 서버에 업로드
   - 네트워크 경로 공유

### 사용자 교육

**권장 교육 프로그램**:
1. **설치 세션** (30분)
   - 화면 공유로 설치 과정 시연
   - 실시간 문제 해결

2. **사용법 교육** (1시간)
   - 전체 워크플로우 데모
   - 실습 시간
   - Q&A

3. **고급 기능** (30분, 선택)
   - Gemini AI 설정
   - 커스터마이징
   - 문제 해결

### 지원 체계

1. **1차 지원**: FAQ 및 문서
2. **2차 지원**: 이메일/채팅
3. **3차 지원**: 원격 지원

---

## 체크리스트

배포 전 최종 확인:

- [ ] 모든 파일 포함 확인
- [ ] 스크립트 실행 권한 확인
- [ ] 문서 오타 및 링크 확인
- [ ] 3가지 OS에서 테스트 완료
- [ ] 지원 연락처 포함
- [ ] 라이센스 정보 명시
- [ ] 버전 번호 표시
- [ ] 릴리즈 노트 작성

배포 완료!
