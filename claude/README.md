# MedDRA 28.1 Korean - 사용 가이드

환자 증상을 MedDRA 표준 코드로 변환하는 약물감시(Pharmacovigilance) 시스템 구축을 위한 완전한 참조 문서입니다.

## 📚 문서 목록

### [00_개요.md](00_개요.md)
**MedDRA 전체 시스템 개요**
- MedDRA란 무엇인가?
- 5단계 계층 구조 (SOC → HLGT → HLT → PT → LLT)
- 증상 검색 워크플로우
- 데이터 파일 구조
- 핵심 개념 이해

### [01_용어_검색.md](01_용어_검색.md)
**LLT/PT 검색 방법**
- LLT(최하위 용어) 검색 전략
- PT(선호 용어) 조회
- 검색 알고리즘 및 개선 전략
- 검색 결과 필터링
- 자주 검색하는 증상 목록

### [02_계층_탐색.md](02_계층_탐색.md)
**계층 구조 탐색**
- mdhier.asc 완전한 계층 정보 활용
- 단계별 계층 파일 (SOC-HLGT, HLGT-HLT, HLT-PT)
- 상향 탐색 (PT → SOC)
- 하향 탐색 (SOC → PT)
- Primary vs Secondary SOC
- SOC 약어 코드 목록

### [03_실전_예제.md](03_실전_예제.md)
**실무 활용 사례**
- 환자 증상 입력 → 코드 검색
- 모호한 증상 처리
- 여러 증상 동시 코딩
- 부작용 보고서 작성
- 검사 결과 이상 코딩
- 관련 증상 찾기
- 약물별 부작용 통계
- 버전 변경 추적

### [04_SMQ_활용.md](04_SMQ_활용.md)
**표준화된 MedDRA 쿼리**
- SMQ란 무엇인가?
- Narrow vs Broad 검색 전략
- SMQ 계층 구조
- 주요 SMQ 카탈로그 (간/심장/신장/신경계)
- 고급 활용 사례 (신호 탐지, 자동 플래그)
- SMQ 검색 알고리즘

### [05_데이터_추출.md](05_데이터_추출.md)
**프로그래밍 구현**
- 파일 파싱 기본
- Python 구현 예제
  - LLT/PT/계층 데이터 로더
  - 통합 검색 시스템
  - SMQ 데이터 로더
- 성능 최적화 (인덱스, SQLite)
- REST API 서버 예제

---

## 🚀 빠른 시작

### 1. 증상으로 코드 찾기

```bash
# "두통" 검색
grep "두통" ascii-281/llt.asc | grep "Y\$\$$"
# 결과: 10019211$두통$10019211$$$$$$$Y$$
```

**결과 해석:**
- LLT 코드: 10019211
- LLT명: 두통
- PT 코드: 10019211 (동일하므로 이 용어가 PT임)

### 2. 전체 계층 정보 확인

```bash
grep "^10019211\$" ascii-281/mdhier.asc
```

**결과:**
```
10019211$10019233$10019231$10029205$두통$두통 NEC$각종 두통$각종 신경계 장애$Nerv$$10029205$Y$
```

**계층 경로:**
```
SOC:  각종 신경계 장애 (10029205)
  ↓
HLGT: 각종 두통 (10019231)
  ↓
HLT:  두통 NEC (10019233)
  ↓
PT:   두통 (10019211)
```

### 3. Python으로 검색

```python
from meddra_search import MedDRASearch

# 검색 시스템 초기화
search = MedDRASearch('ascii-281')

# 증상 검색
results = search.search_symptom('두통')

for r in results:
    print(f"PT: {r['pt_name']} ({r['pt_code']})")
    print(f"SOC: {r['soc_name']}")
```

---

## 📊 데이터 통계

| 항목 | 개수 |
|------|------|
| **SOC** (기관계) | 27개 |
| **HLGT** (상위 그룹) | 337개 |
| **HLT** (상위 용어) | 1,739개 |
| **PT** (선호 용어) | 27,163개 |
| **LLT** (최하위 용어) | 90,471개 |
| **SMQ** (표준 쿼리) | 230개 |

---

## 🔑 핵심 개념

### 5단계 계층

```
1. SOC (System Organ Class)
   - 가장 넓은 범주 (27개)
   - 예: "각종 신경계 장애"

2. HLGT (High Level Group Term)
   - SOC 내 중분류 (337개)
   - 예: "각종 두통"

3. HLT (High Level Term)
   - 임상적 소분류 (1,739개)
   - 예: "두통 NEC"

4. PT (Preferred Term) ⭐
   - 표준 코딩 레벨 (27,163개)
   - 예: "두통"

5. LLT (Lowest Level Term) ⭐
   - 검색 및 매칭용 (90,471개)
   - 예: "머리 아픔", "두통", "두통 NOS"
```

### 검색 워크플로우

```
사용자 입력 → LLT 검색 → PT 매핑 → 계층 조회 → 결과 반환
```

---

## 📁 파일 구조

```
MedDRA_28_1_Korean/
├── ascii-281/                     # 핵심 데이터 파일
│   ├── llt.asc                   # 최하위 용어 (검색 시작점)
│   ├── pt.asc                    # 선호 용어 (표준 코드)
│   ├── hlt.asc                   # 상위 용어
│   ├── hlgt.asc                  # 상위 그룹 용어
│   ├── soc.asc                   # 기관계 분류
│   ├── mdhier.asc                # 전체 계층 관계 ⭐ 가장 중요
│   ├── hlt_pt.asc                # HLT-PT 관계
│   ├── hlgt_hlt.asc              # HLGT-HLT 관계
│   ├── soc_hlgt.asc              # SOC-HLGT 관계
│   ├── smq_list.asc              # SMQ 목록
│   ├── smq_content.asc           # SMQ 내용
│   ├── meddra_history_korean.asc # 변경 이력
│   └── meddra_release.asc        # 버전 정보
├── seq-281/                       # 변경 추적 파일
├── claude/                        # 사용 가이드 (이 폴더)
│   ├── README.md                 # 이 파일
│   ├── 00_개요.md
│   ├── 01_용어_검색.md
│   ├── 02_계층_탐색.md
│   ├── 03_실전_예제.md
│   ├── 04_SMQ_활용.md
│   └── 05_데이터_추출.md
└── *.pdf                          # 원본 문서들
```

---

## 🎯 주요 사용 사례

### 1. 부작용 보고서 작성
환자 증상 → MedDRA 코드 → 규제기관 보고

### 2. 약물감시 데이터베이스
임상시험 부작용 데이터 표준화 및 저장

### 3. 신호 탐지
SMQ 기반 특정 부작용 패턴 조기 발견

### 4. 안전성 모니터링
특정 기관계 또는 중증 부작용 추적

---

## 💡 실전 팁

### 검색 우선순위
1. **정확한 일치** (exact match) - 가장 우선
2. **부분 일치** (partial match)
3. **유사어 검색** (synonym search)

### 코딩 체크리스트
- ✅ LLT currency = Y 확인
- ✅ Primary SOC 확인
- ✅ 다중 증상 시 각각 코딩
- ✅ 심각한 부작용 시 SMQ 확인

### 자주 사용하는 코드

| 증상 | PT 코드 | SOC |
|------|---------|-----|
| 두통 | 10019211 | 신경계 |
| 복통 | 10000081 | 위장관 |
| 오심 | 10028813 | 위장관 |
| 발열 | 10037660 | 전신 |
| 어지러움 | 10013573 | 신경계 |
| 피로 | 10016256 | 전신 |
| 구토 | 10047700 | 위장관 |
| 설사 | 10012735 | 위장관 |

---

## 📖 참고 자료

### 원본 문서
- `dist_file_format_28_1_Korean.pdf` - 파일 형식 상세 설명
- `intguide_28_1_Korean.pdf` - MedDRA 입문 가이드
- `SMQ_intguide_28_1_Korean.pdf` - SMQ 가이드
- `whatsnew_28_1_Korean.pdf` - 버전 28.1 변경사항

### 버전 정보
- **버전**: 28.1
- **릴리스**: 2025년 9월
- **언어**: 한국어 (UTF-8)
- **관리기관**: ICH (International Council for Harmonisation)

---

## 🔧 기술 스펙

### 파일 형식
- **구분자**: `$` (달러 기호)
- **인코딩**: UTF-8
- **라인 종료**: Unix-style (LF)
- **헤더**: 없음

### 권장 개발 환경
- **Python**: 3.7+
- **데이터베이스**: SQLite, PostgreSQL, MySQL
- **웹 프레임워크**: Flask, FastAPI, Django

---

## 📞 지원

### MedDRA 공식 지원
- **이메일**: mssohelp@meddra.org
- **웹사이트**: https://www.meddra.org

### 이 가이드 관련
문의사항이나 개선 제안은 프로젝트 관리자에게 연락하세요.

---

## 📜 라이선스

MedDRA®는 ICH의 등록 상표입니다.

본 데이터는 저작권 보호를 받으며, 사용 시 MedDRA 가입자 라이선스 조항을 준수해야 합니다.

---

**마지막 업데이트**: 2025년 10월 (MedDRA 버전 28.1 기준)
