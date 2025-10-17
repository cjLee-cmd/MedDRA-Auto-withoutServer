# Chrome 확장 프로그램 개발 계획서

## 프로젝트 개요

**목표**: Python 서버 없이 GitHub Pages에서 MedDRA DB 자동입력 기능을 작동시키기 위한 Chrome 확장 프로그램 개발

**브랜치**: `feature/chrome-extension`

**예상 소요 시간**: 2-3시간 (개발 + 테스트)

---

## 아키텍처 변경

### 현재 (Python 서버 기반)
```
[Browser: script.js]
    ↓ fetch('/db-autofill')
[Python Server: meddra_server.py]
    ↓ subprocess.Popen(['node', 'db_autofill.js'])
[Playwright: 브라우저 자동화]
```

### 변경 후 (Chrome 확장)
```
[Browser: script.js]
    ↓ chrome.runtime.sendMessage()
[Chrome Extension: background.js]
    ↓ chrome.tabs.create()
[Chrome Extension: content.js]
    ↓ DOM 조작으로 폼 자동입력
```

---

## 개발 단계

### Phase 1: 환경 설정 ✅
- [x] Git 브랜치 생성: `feature/chrome-extension`
- [x] 개발 계획서 작성: `CHROME_EXTENSION_DEVELOPMENT.md`
- [ ] 확장 프로그램 디렉토리 생성: `chrome-extension/`

### Phase 2: 핵심 파일 작성 (40-50분)
- [ ] **Task 1**: `manifest.json` 작성 (3분)
  - Manifest V3 형식
  - 권한 설정: tabs, activeTab, storage
  - Content scripts 및 background 설정

- [ ] **Task 2**: `background.js` 작성 (5분)
  - 메시지 리스너 설정
  - 새 탭 생성 로직
  - Content script로 데이터 전달

- [ ] **Task 3**: `content.js` 작성 (20-30분) ⭐ 가장 복잡
  - `db_autofill.js`의 Playwright 코드 분석
  - DOM 선택자로 변환
  - 비동기 대기 로직 구현
  - 폼 입력 자동화

- [ ] **Task 4**: `script.js` 수정 (5분)
  - `fetch('/db-autofill')` 제거
  - `chrome.runtime.sendMessage()` 추가
  - 확장 설치 여부 확인 로직

### Phase 3: 문서화 (10-15분)
- [ ] **Task 5**: 설치 가이드 작성
  - 개발자 모드 설치 방법
  - Chrome Web Store 배포 방법

- [ ] **Task 6**: 테스트 체크리스트 작성
  - 기능 테스트 항목
  - 예상 에러 및 해결 방법

### Phase 4: 테스트 및 검증 (사용자 협업)
- [ ] **Task 7**: 초기 테스트 (사용자)
  - 확장 로드
  - 기본 동작 확인
  - 에러 로그 수집

- [ ] **Task 8**: 버그 수정 (1-2회 반복)
  - 타이밍 이슈 해결
  - DOM 선택자 조정
  - 에러 처리 강화

- [ ] **Task 9**: 최종 검증 (사용자)
  - 다양한 시나리오 테스트
  - 엣지 케이스 확인
  - 성능 확인

---

## 파일 구조

```
MedDRA_28_1_Korean_Auto_Noserver_v2/
├── chrome-extension/              # 새로 생성
│   ├── manifest.json              # 확장 설정
│   ├── background.js              # 백그라운드 스크립트
│   ├── content.js                 # 컨텐츠 스크립트
│   ├── icons/                     # 확장 아이콘 (선택)
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   └── README.md                  # 설치 가이드
├── script.js                      # 수정 필요
├── db_autofill.js                 # 참고용 (변환 대상)
└── CHROME_EXTENSION_DEVELOPMENT.md  # 이 문서
```

---

## 기술 스택

### 제거되는 요소
- ❌ Python 서버 (`meddra_server.py`)
- ❌ Node.js + Playwright (`db_autofill.js`)
- ❌ HTTP API (`/db-autofill` 엔드포인트)

### 추가되는 요소
- ✅ Chrome Extension API
  - `chrome.runtime` (메시지 통신)
  - `chrome.tabs` (탭 관리)
  - `chrome.storage` (데이터 저장)
- ✅ DOM 조작 API
  - `document.querySelector()`
  - `MutationObserver` (동적 요소 대기)
  - `Event` dispatch

---

## 코드 변환 매핑

| Playwright API | Chrome Extension 대체 | 난이도 |
|---------------|---------------------|-------|
| `chromium.launch()` | `chrome.tabs.create()` | 쉬움 |
| `page.goto(url)` | `chrome.tabs.update()` | 쉬움 |
| `page.locator(selector)` | `document.querySelector()` | 쉬움 |
| `input.fill(value)` | `element.value = value` | 쉬움 |
| `button.click()` | `element.click()` | 쉬움 |
| `page.waitForSelector()` | `MutationObserver` | 보통 |
| `page.waitForTimeout()` | `setTimeout()` / `Promise` | 쉬움 |

---

## 예상 이슈 및 해결 방안

### 이슈 1: 타이밍 문제
**문제**: DOM 요소가 아직 로드되지 않았을 때 접근 시도
**해결**: MutationObserver를 사용한 커스텀 대기 함수 구현

### 이슈 2: 이벤트 핸들러 미실행
**문제**: `element.value = ...`만으로는 이벤트가 발생하지 않음
**해결**: `dispatchEvent(new Event('input'))` 추가

### 이슈 3: CORS 문제
**문제**: GitHub Pages와 MedDRA-DB 간 도메인 다름
**해결**: Content script는 페이지 컨텍스트에서 실행되므로 CORS 문제 없음

### 이슈 4: 권한 경고
**문제**: 확장 설치 시 "모든 웹사이트 데이터 접근" 경고
**해결**: `host_permissions`를 특정 도메인으로 제한

---

## 테스트 시나리오

### 기본 테스트
1. GitHub Pages 접속
2. CIOMS 데이터 추출
3. "MedDRA-DB에 자동입력" 버튼 클릭
4. 새 탭이 열리고 MedDRA-DB 사이트 접속
5. 자동으로 로그인
6. 폼에 데이터 자동 입력
7. 저장 완료

### 엣지 케이스
- 반응이 1개, 3개, 5개일 때
- CIOMS 데이터가 불완전할 때
- 네트워크 오류 시
- MedDRA-DB 사이트가 느릴 때

---

## 배포 방법

### 개발자 모드 (즉시 사용)
1. Chrome → `chrome://extensions/`
2. 개발자 모드 활성화
3. "압축해제된 확장 로드" 클릭
4. `chrome-extension/` 폴더 선택

### Chrome Web Store (공식 배포)
1. 개발자 등록 ($5 1회 비용)
2. 확장 패키징 (ZIP)
3. Chrome Web Store에 업로드
4. 심사 대기 (1-3일)
5. 배포 승인 후 자동 업데이트 가능

---

## 성공 기준

- ✅ GitHub Pages에서 버튼 클릭 시 작동
- ✅ 서버 실행 불필요
- ✅ 현재 기능과 동일한 자동화 수행
- ✅ 에러 처리 및 사용자 피드백
- ✅ 명확한 설치 가이드 제공

---

## 다음 단계

1. ✅ 이 문서 작성 완료
2. → `chrome-extension/` 디렉토리 생성
3. → `manifest.json` 작성 시작
4. → 핵심 파일 작성
5. → 사용자 테스트 요청

---

**작성일**: 2025-01-17
**브랜치**: `feature/chrome-extension`
**개발자**: Claude Code CLI
