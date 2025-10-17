# GitHub Pages 간 자동 입력 설정 가이드

## 개요

이 가이드는 MedDRA 사이트에서 MedDRA-DB 사이트로 CIOMS 데이터를 자동으로 전송하고 폼에 입력하는 기능을 설정하는 방법을 설명합니다.

**기술 방식**: sessionStorage를 통한 브라우저 간 데이터 전송 (Playwright 불필요)

## 시스템 구조

```
┌─────────────────────────────────────────────────┐
│ MedDRA 사이트 (GitHub Pages)                    │
│ https://cjlee-cmd.github.io/MedDRA/             │
│                                                 │
│ 1. PDF 업로드 → CIOMS 데이터 추출               │
│ 2. sessionStorage에 데이터 저장                 │
│ 3. MedDRA-DB 사이트를 새 탭으로 열기            │
└─────────────────────────────────────────────────┘
                    ↓ (새 브라우저 탭)
┌─────────────────────────────────────────────────┐
│ MedDRA-DB 사이트 (GitHub Pages)                 │
│ https://cjlee-cmd.github.io/MedDRA-DB/          │
│                                                 │
│ 1. sessionStorage에서 CIOMS 데이터 읽기         │
│ 2. 폼 필드에 자동으로 데이터 입력               │
│ 3. 완료 알림 표시                               │
└─────────────────────────────────────────────────┘
```

## 필요한 작업

### 1단계: MedDRA 사이트 수정 (이미 완료됨)

✅ `script.js`의 `performDBAutoFill()` 함수가 이미 수정되었습니다.
- sessionStorage에 CIOMS 데이터 저장
- MedDRA-DB 사이트를 새 탭으로 열기

### 2단계: MedDRA-DB 사이트 수정 (작업 필요)

MedDRA-DB GitHub 저장소에서 다음 작업을 수행해야 합니다:

#### A. 수신 스크립트 추가

1. **파일 복사**
   ```bash
   # MedDRA-DB 저장소로 이동
   cd /path/to/MedDRA-DB

   # 수신 스크립트 복사
   cp /Users/cjlee/Documents/Python/acuzen/MedDRA_28_1_Korean_Auto_Noserver_v2/meddra_db_autofill_receiver.js .
   ```

2. **form-edit.html 수정**

   MedDRA-DB 저장소의 `form-edit.html` 파일을 열고, `</body>` 태그 직전에 다음 라인을 추가합니다:

   ```html
   <!-- CIOMS 자동 입력 수신 스크립트 -->
   <script src="meddra_db_autofill_receiver.js"></script>
   </body>
   ```

#### B. Git으로 배포

```bash
# MedDRA-DB 저장소에서
git add meddra_db_autofill_receiver.js form-edit.html
git commit -m "feat: Add CIOMS data auto-fill receiver functionality"
git push origin main
```

#### C. GitHub Pages 배포 확인

1. GitHub에서 MedDRA-DB 저장소로 이동
2. Settings → Pages
3. 배포 상태 확인 (✅ Your site is live at...)
4. 약 1-2분 후 사이트 업데이트 확인

## 작동 방식

### 데이터 전송 흐름

1. **MedDRA 사이트**
   ```javascript
   // CIOMS 데이터를 sessionStorage에 저장
   sessionStorage.setItem('cioms_data_transfer', JSON.stringify({
     timestamp: Date.now(),
     data: ciomsData
   }));

   // MedDRA-DB 사이트를 새 탭으로 열기
   window.open('https://cjlee-cmd.github.io/MedDRA-DB/form-edit.html', '_blank');
   ```

2. **MedDRA-DB 사이트**
   ```javascript
   // 페이지 로드 시 sessionStorage 확인
   const storedData = sessionStorage.getItem('cioms_data_transfer');
   if (storedData) {
     const transferData = JSON.parse(storedData);

     // 5분 이내 데이터만 유효
     if (Date.now() - transferData.timestamp < 5 * 60 * 1000) {
       performAutoFill(transferData.data);
     }

     // 사용 후 즉시 삭제
     sessionStorage.removeItem('cioms_data_transfer');
   }
   ```

### 자동 입력 단계

1. **데이터베이스 로딩 대기** (최대 30초)
   - IndexedDB 초기화 완료 대기

2. **기본 정보 입력**
   - 제조업체 관리번호
   - 접수일 (DD/MM/YYYY → YYYY-MM-DD 변환)

3. **환자 정보 입력**
   - 환자 이니셜
   - 국가
   - 나이 (예: "62 Years" → "62")
   - 성별 (M/F → 드롭다운 선택)

4. **유해 반응 입력**
   - 첫 번째 반응은 기존 입력란 사용
   - 나머지 반응은 "부작용 추가" 버튼으로 동적 추가
   - 영문/한글 동시 입력

5. **의심 약물 입력**
   - 의심 약물과 병용 약물 구분
   - 약물명, 적응증 영문/한글 입력
   - "약물 추가" 버튼으로 동적 추가

6. **완료 알림**
   - 입력된 데이터 요약 표시
   - 사용자 확인 대기

## 브라우저 호환성

### 지원 브라우저

✅ Chrome/Edge (권장)
✅ Firefox
✅ Safari
✅ Opera

### 필수 요구사항

- sessionStorage 지원 (모든 최신 브라우저 지원)
- 팝업 차단 해제 필요 (새 탭 열기)
- JavaScript 활성화 필수

## 보안 고려사항

### 데이터 저장 위치

- **sessionStorage**: 같은 브라우저 탭/창 간 공유
- **자동 만료**: 5분 후 자동 삭제
- **일회성 사용**: 한 번 읽으면 즉시 삭제
- **브라우저 종료 시 삭제**: 세션 종료 시 자동 삭제

### 데이터 보안

- sessionStorage는 HTTPS 연결에서만 전송
- 민감한 개인정보는 브라우저 로컬에만 저장
- 외부 서버 전송 없음
- GitHub Pages는 HTTPS 강제 적용

## 문제 해결

### 1. 팝업이 차단됨

**증상**: MedDRA-DB 사이트가 열리지 않음

**해결방법**:
1. 브라우저 주소창 오른쪽의 팝업 차단 아이콘 클릭
2. "항상 팝업 허용" 선택
3. 페이지 새로고침 후 재시도

### 2. 데이터가 전송되지 않음

**증상**: MedDRA-DB 사이트가 열렸지만 폼이 비어있음

**원인 및 해결방법**:

1. **시간 초과 (5분 경과)**
   - 5분 이내에 버튼을 다시 클릭해주세요

2. **브라우저 캐시 문제**
   ```
   Ctrl/Cmd + Shift + R로 강제 새로고침
   ```

3. **스크립트 미적용**
   - MedDRA-DB의 form-edit.html에 스크립트가 추가되었는지 확인
   - GitHub Pages 배포 완료 확인

### 3. 일부 필드만 입력됨

**증상**: 기본 정보는 입력되었지만 약물 정보가 누락됨

**원인**: 폼 구조 불일치

**해결방법**:
1. 브라우저 콘솔 열기 (F12)
2. Console 탭에서 [AutoFill] 로그 확인
3. 오류 메시지가 있으면 GitHub Issue로 보고

### 4. sessionStorage 오류

**증상**: "데이터 저장 실패: 브라우저 저장 공간이 부족합니다"

**해결방법**:
```javascript
// 브라우저 콘솔에서 실행
sessionStorage.clear();
localStorage.clear();
```

## 테스트 방법

### 로컬 테스트

1. **MedDRA 사이트**
   ```bash
   # 서버 모드로 실행
   python3 meddra_server.py --host 127.0.0.1 --port 8000
   ```

   브라우저에서 `http://127.0.0.1:8000/main.html` 접속

2. **MedDRA-DB 사이트**

   별도 브라우저 탭에서 `form-edit.html` 열기
   - 로컬 서버로 실행하거나
   - GitHub Pages URL 직접 접속

### 프로덕션 테스트

1. https://cjlee-cmd.github.io/MedDRA/main.html 접속
2. PDF 업로드
3. "🚀 MedDRA-DB에 자동 입력" 버튼 클릭
4. 새 탭에서 자동 입력 확인

## 개발자 노트

### 디버깅 로그

브라우저 콘솔(F12)에서 다음 로그를 확인할 수 있습니다:

```javascript
[AutoFill] 자동 입력 수신 스크립트 로드됨
[AutoFill] 데이터 수신: {...}
[AutoFill] 자동 입력 시작...
[AutoFill] 데이터베이스 로딩 대기 중... (1/7)
[AutoFill] 기본 정보 입력 중... (3/7)
...
[AutoFill] 자동 입력 완료! (7/7)
```

### 커스터마이징

필드 매칭 로직을 수정하려면 `meddra_db_autofill_receiver.js`에서 다음 함수를 수정하세요:

- `fillBasicInfo()`: 기본 정보 입력 로직
- `fillPatientInfo()`: 환자 정보 입력 로직
- `fillReactions()`: 유해 반응 입력 로직
- `fillDrugs()`: 약물 정보 입력 로직

### 필드 셀렉터 패턴

```javascript
// 여러 패턴을 시도하여 입력란 찾기
const input = document.querySelector(
  'input[placeholder*="키워드"], ' +
  'input[name*="키워드"], ' +
  'input[id*="키워드"]'
);
```

## 향후 개선 사항

- [ ] URL 파라미터 방식 추가 (sessionStorage 보완)
- [ ] 입력 진행 상황 실시간 시각화
- [ ] 오류 발생 시 자동 재시도
- [ ] 입력 완료 후 자동 저장 옵션
- [ ] 다국어 지원 (영어, 일본어)

## 지원 및 문의

- GitHub Issues: https://github.com/cjlee-cmd/MedDRA/issues
- GitHub Issues: https://github.com/cjlee-cmd/MedDRA-DB/issues
