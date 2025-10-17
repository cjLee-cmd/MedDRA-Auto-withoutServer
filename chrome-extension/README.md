# MedDRA DB AutoFill - Chrome 확장 프로그램

GitHub Pages 배포 환경에서 Python 서버 없이 MedDRA DB 자동입력 기능을 사용할 수 있도록 하는 Chrome 확장 프로그램입니다.

---

## 📦 설치 방법

### 1. 개발자 모드로 설치 (즉시 사용 가능)

1. **Chrome 확장 프로그램 페이지 열기**
   - 주소창에 `chrome://extensions/` 입력 후 엔터
   - 또는 메뉴 → 도구 더보기 → 확장 프로그램

2. **개발자 모드 활성화**
   - 페이지 우측 상단의 "개발자 모드" 토글 켜기

3. **확장 로드**
   - "압축해제된 확장 프로그램을 로드합니다" 버튼 클릭
   - `chrome-extension` 폴더 선택
   - 확장이 로드되면 ID가 자동으로 생성됨

4. **확장 ID 복사**
   - 로드된 확장의 ID를 복사 (예: `abcdefghijklmnopqrstuvwxyz123456`)

5. **script.js 수정**
   - `script.js` 파일 열기
   - 1485번 줄 근처에서 다음 부분을 찾기:
     ```javascript
     const EXTENSION_ID = 'YOUR_EXTENSION_ID_HERE'; // TODO: 실제 확장 ID로 교체
     ```
   - 복사한 확장 ID로 교체:
     ```javascript
     const EXTENSION_ID = 'abcdefghijklmnopqrstuvwxyz123456';
     ```
   - 파일 저장

6. **GitHub Pages 재배포**
   - 수정된 `script.js`를 GitHub에 푸시
   - GitHub Pages가 자동으로 업데이트됨

---

### 2. Chrome Web Store 배포 (선택사항)

#### 장점
- 사용자가 클릭 한 번으로 설치 가능
- 자동 업데이트 지원
- 공식 인증된 확장 프로그램

#### 단계

1. **Chrome 개발자 등록**
   - [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/) 접속
   - 계정 등록 ($5 일회성 비용)

2. **확장 패키징**
   ```bash
   cd chrome-extension
   zip -r ../meddra-autofill.zip *
   ```

3. **Web Store 업로드**
   - 새 항목 → ZIP 파일 업로드
   - 정보 입력:
     - 이름: MedDRA DB AutoFill
     - 설명: CIOMS 데이터를 MedDRA-DB 사이트에 자동으로 입력
     - 카테고리: 생산성
     - 언어: 한국어
   - 스크린샷 업로드 (선택)
   - 개인정보 처리방침 작성

4. **심사 제출**
   - 초기 심사: 1-3일 소요
   - 승인 후 Chrome Web Store에 게시

5. **확장 ID 확인 및 수정**
   - Web Store에서 확장 ID 확인
   - `script.js`의 `EXTENSION_ID` 업데이트

---

## 🚀 사용 방법

### 1. GitHub Pages 접속
   ```
   https://cjlee-cmd.github.io/MedDRA/main.html
   ```

### 2. PDF 업로드
   - CIOMS 보고서 PDF 파일 드래그 앤 드롭
   - 또는 파일 선택 버튼 클릭

### 3. 자동 입력 시작
   - "MedDRA-DB에 자동입력" 버튼 클릭
   - 새 탭이 열리며 MedDRA-DB 사이트로 이동
   - 자동으로 로그인 및 폼 입력 시작

### 4. 결과 확인
   - 자동 입력 과정을 눈으로 확인 가능
   - 완료되면 저장 버튼 자동 클릭
   - 수동으로 추가 수정 가능

---

## 🔧 문제 해결

### 문제 1: "Chrome 확장이 설치되지 않았습니다" 오류

**원인**: 확장이 설치되지 않았거나 비활성화됨

**해결**:
1. `chrome://extensions/` 접속
2. "MedDRA DB AutoFill" 확장 찾기
3. 활성화 토글이 켜져 있는지 확인
4. 없으면 위의 설치 방법 다시 수행

---

### 문제 2: "Chrome 확장과 통신할 수 없습니다" 오류

**원인**: `script.js`의 확장 ID가 잘못됨

**해결**:
1. `chrome://extensions/` 접속
2. "MedDRA DB AutoFill" 확장의 ID 복사
3. `script.js` 파일 열기
4. 1485번 줄의 `EXTENSION_ID` 값을 실제 ID로 교체
5. 파일 저장 및 GitHub Pages 재배포
6. 페이지 새로고침 (Ctrl+F5 또는 Cmd+Shift+R)

---

### 문제 3: 버튼 클릭 시 아무 반응 없음

**원인**: 확장이 GitHub Pages 도메인에 대한 권한이 없음

**해결**:
1. `manifest.json` 파일 열기
2. `externally_connectable.matches` 확인:
   ```json
   "externally_connectable": {
     "matches": ["https://cjlee-cmd.github.io/*"]
   }
   ```
3. GitHub Pages URL이 일치하는지 확인
4. 확장 다시 로드: `chrome://extensions/` → 새로고침 버튼

---

### 문제 4: 로그인 실패 또는 폼 입력 안됨

**원인**: MedDRA-DB 사이트의 DOM 구조가 변경됨

**해결**:
1. Chrome 개발자 도구 열기 (F12)
2. 콘솔 탭에서 에러 메시지 확인
3. `content.js` 파일의 선택자 수정 필요
4. 이슈 리포트 생성하여 개발자에게 문의

---

### 문제 5: "YOUR_EXTENSION_ID_HERE" 경고

**원인**: `script.js`에서 확장 ID를 아직 교체하지 않음

**해결**:
1. 위의 "설치 방법" 4-5단계 수행
2. 확장 ID를 실제 값으로 교체
3. 파일 저장 및 재배포

---

## 📝 기술 스택

- **Manifest V3**: 최신 Chrome 확장 표준
- **Content Scripts**: MedDRA-DB 사이트 DOM 조작
- **Background Service Worker**: 탭 관리 및 메시지 라우팅
- **Chrome Storage API**: CIOMS 데이터 임시 저장
- **Chrome Tabs API**: 새 탭 생성 및 관리

---

## 🔒 권한 설명

확장이 요청하는 권한:

- **`tabs`**: 새 탭 생성 (MedDRA-DB 사이트 열기)
- **`activeTab`**: 현재 활성화된 탭 접근
- **`storage`**: CIOMS 데이터 임시 저장
- **`https://cjlee-cmd.github.io/*`**: GitHub Pages와 통신

**개인정보 보호**:
- 모든 데이터는 로컬에서만 처리
- 외부 서버로 전송되지 않음
- Chrome Storage는 확장 제거 시 자동 삭제

---

## 🐛 버그 리포트

문제 발생 시 다음 정보와 함께 이슈 제출:

1. Chrome 버전: `chrome://version/`
2. 확장 버전: `chrome://extensions/`
3. 에러 메시지: 콘솔 스크린샷
4. 재현 단계: 상세한 설명

---

## 📄 라이선스

이 프로젝트는 원본 MedDRA 프로젝트와 동일한 라이선스를 따릅니다.

---

## 👥 개발자

- **원본**: MedDRA 28.1 Korean Auto-Coding System
- **Chrome 확장**: Claude Code CLI
- **날짜**: 2025-01-17
