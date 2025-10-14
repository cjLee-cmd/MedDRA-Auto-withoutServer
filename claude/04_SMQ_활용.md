# SMQ (Standardised MedDRA Queries) 활용 가이드

## SMQ란?

**SMQ (Standardised MedDRA Queries)**는 특정 의학적 관심 영역과 관련된 MedDRA 용어들을 미리 정의해 놓은 표준화된 쿼리 세트입니다.

### 주요 특징

- **230개의 표준 쿼리** (버전 28.1 기준)
- 의학적으로 중요한 주제별 용어 그룹화
- 임상 전문가들이 검증한 용어 조합
- 약물감시 신호 탐지에 최적화

### 사용 목적

1. **신호 탐지**: 특정 부작용 패턴 조기 발견
2. **안전성 모니터링**: 중요 안전성 이슈 추적
3. **규제 보고**: 표준화된 보고서 작성
4. **데이터 마이닝**: 대량 데이터에서 특정 이벤트 추출

---

## SMQ 파일 구조

### 1. SMQ 목록: smq_list.asc

**구조:**
```
smq_code$smq_name$smq_level$smq_description$smq_source$smq_note$smq_version$smq_status$smq_algorithm$
```

**필드 설명:**
- `smq_code`: SMQ 고유 코드 (20000001~)
- `smq_name`: SMQ 이름
- `smq_level`: 계층 레벨 (1=최상위, 2~4=하위 SMQ)
- `smq_description`: 의학적 정의 및 배경
- `smq_source`: 참고 문헌
- `smq_note`: 특별 주의사항
- `smq_version`: 버전
- `smq_status`: 상태 (A=Active)
- `smq_algorithm`: 알고리즘 플래그 (N=No)

**예시:**
```bash
grep "^20000005\$" ascii-281/smq_list.asc | cut -d'$' -f1-3
```

**결과:**
```
20000005$간 장애(SMQ)$1
```

### 2. SMQ 내용: smq_content.asc

**구조:**
```
smq_code$term_code$term_level$term_scope$term_category$term_weight$term_status$term_addition_version$term_last_modified_version$
```

**필드 설명:**
- `smq_code`: SMQ 코드
- `term_code`: PT 또는 LLT 코드
- `term_level`: 용어 레벨 (0=하위 SMQ, 4=PT, 5=LLT)
- `term_scope`: 검색 범위
  - **1 = Broad (확장 검색)**: 관련 가능성 있는 모든 용어
  - **2 = Narrow (축소 검색)**: 매우 관련성 높은 용어만
- `term_category`: A=Active
- `term_weight`: 가중치 (0=표준)
- `term_status`: 상태 (I=Initial, A=Added)

**예시:**
```bash
head -5 ascii-281/smq_content.asc
```

**결과:**
```
20000001$10081980$4$1$A$0$I$22.0$23.1$
20000001$10082515$5$1$A$0$A$22.0$22.0$
   ↑        ↑      ↑  ↑
 SMQ코드  PT코드  PT Broad
```

---

## SMQ 계층 구조

### Level 1: 최상위 SMQ
가장 포괄적인 의학적 주제

**예시:**
- 간 장애(SMQ) - 20000005
- 심부전(SMQ) - 20000004
- 급성 신부전(SMQ) - 20000003

### Level 2-4: 하위 SMQ
상위 SMQ를 세분화한 특정 주제

**예시: 간 장애 계층**
```
Level 1: 간 장애(SMQ) - 20000005
  ├─ Level 2: 약물 관련 간 장애 - 포괄적 검색(SMQ) - 20000006
  ├─ Level 3: 약물 관련 간 장애 - 중증 사례만(SMQ) - 20000007
  ├─ Level 3: 간 관련 임상 검사, 징후 및 증상(SMQ) - 20000008
  └─ Level 4: 비감염성 간염(SMQ) - 20000010
```

---

## SMQ 검색 전략

### 1. Narrow vs Broad 검색

#### Narrow Search (축소 검색)
- **목적**: 높은 정밀도 (Precision)
- **사용 시기**: 명확한 케이스만 찾고 싶을 때
- **장점**: False positive 감소
- **단점**: 일부 관련 케이스 누락 가능

#### Broad Search (확장 검색)
- **목적**: 높은 재현율 (Recall)
- **사용 시기**: 가능한 모든 케이스를 찾고 싶을 때
- **장점**: 관련 케이스 최대한 포함
- **단점**: False positive 증가

### 2. 검색 범위 선택 가이드

| 상황 | 권장 범위 | 이유 |
|------|-----------|------|
| 초기 신호 탐지 | **Broad** | 잠재적 신호 놓치지 않기 위해 |
| 규제 보고서 작성 | **Narrow** | 명확한 케이스만 보고 |
| 안전성 데이터베이스 구축 | **Broad** | 포괄적 데이터 수집 |
| 임상시험 중간 분석 | **Narrow** | 명확한 부작용만 집계 |

---

## 실전 SMQ 활용

### 예제 1: 간 장애 관련 모든 용어 찾기

#### Step 1: SMQ 코드 확인

```bash
grep "간 장애" ascii-281/smq_list.asc | grep "^\$1\$" | cut -d'$' -f1,2
```

**결과:**
```
20000005$간 장애(SMQ)
```

#### Step 2: Narrow 검색 (명확한 케이스만)

```bash
# term_scope=2 (Narrow) + term_level=4 (PT만)
grep "^20000005\$" ascii-281/smq_content.asc | grep "\$4\$2\$"
```

#### Step 3: PT 정보 조회

```bash
grep "^20000005\$" ascii-281/smq_content.asc | grep "\$4\$2\$" | cut -d'$' -f2 | while read pt_code; do
    grep "^${pt_code}\$" ascii-281/pt.asc | cut -d'$' -f1,2
done | head -10
```

### 예제 2: 심장 관련 부작용 모니터링

#### 시나리오
신약 임상시험에서 심장 관련 부작용을 포괄적으로 모니터링하려고 합니다.

#### Step 1: 관련 SMQ 찾기

```bash
grep "심장\|심실\|심부전" ascii-281/smq_list.asc | cut -d'$' -f1,2,3
```

**결과:**
```
20000001$염전성 심실 빈맥/QT 연장(SMQ)$1
20000004$심부전(SMQ)$1
20000022$심근경색(SMQ)$1
20000023$부정맥(SMQ)$1
...
```

#### Step 2: 여러 SMQ 통합 검색

```bash
# 심부전 (20000004) Broad 검색
grep "^20000004\$" ascii-281/smq_content.asc | grep "\$4\$1\$" | cut -d'$' -f2

# 부정맥 (20000023) Broad 검색
grep "^20000023\$" ascii-281/smq_content.asc | grep "\$4\$1\$" | cut -d'$' -f2
```

#### Step 3: 환자 데이터와 매칭

```python
# 가상 환자 부작용 코드
patient_ae_codes = [10019211, 10013573, 10013963, 10001314]

# 심부전 SMQ PT 목록
heart_failure_pts = [10001314, 10002383, 10007554, ...]

# 매칭 확인
matched = [code for code in patient_ae_codes if code in heart_failure_pts]
# 결과: [10001314] → 이 환자는 심부전 관련 부작용 있음
```

---

## 주요 SMQ 카탈로그

### 간/담도 관련

| SMQ 코드 | SMQ 이름 | 레벨 |
|----------|----------|------|
| 20000005 | 간 장애(SMQ) | 1 |
| 20000006 | 약물 관련 간 장애 - 포괄적 검색(SMQ) | 2 |
| 20000007 | 약물 관련 간 장애 - 중증 사례만(SMQ) | 3 |

### 심혈관 관련

| SMQ 코드 | SMQ 이름 | 레벨 |
|----------|----------|------|
| 20000001 | 염전성 심실 빈맥/QT 연장(SMQ) | 1 |
| 20000004 | 심부전(SMQ) | 1 |
| 20000022 | 심근경색(SMQ) | 1 |
| 20000023 | 부정맥(SMQ) | 1 |

### 신장 관련

| SMQ 코드 | SMQ 이름 | 레벨 |
|----------|----------|------|
| 20000003 | 급성 신부전(SMQ) | 1 |
| 20000002 | 횡문근 융해/근병증(SMQ) | 1 |

### 신경계 관련

| SMQ 코드 | SMQ 이름 | 레벨 |
|----------|----------|------|
| 20000032 | 경련(SMQ) | 1 |
| 20000033 | 치매(SMQ) | 1 |

---

## SMQ 활용 패턴

### 패턴 1: 단일 SMQ 조회

```bash
# 특정 SMQ의 모든 PT (Broad)
function get_smq_pts_broad() {
    local smq_code=$1
    grep "^${smq_code}\$" ascii-281/smq_content.asc | \
        grep "\$4\$1\$" | \
        cut -d'$' -f2
}

# 사용 예
get_smq_pts_broad 20000005 > liver_pts_broad.txt
```

### 패턴 2: Narrow + Broad 비교

```bash
# Narrow 검색
grep "^20000005\$" ascii-281/smq_content.asc | grep "\$4\$2\$" | wc -l
# 결과: 50개

# Broad 검색
grep "^20000005\$" ascii-281/smq_content.asc | grep "\$4\$1\$" | wc -l
# 결과: 150개

# Broad가 Narrow보다 3배 더 많은 용어 포함
```

### 패턴 3: 계층적 SMQ 탐색

```bash
# Level 1 SMQ 찾기
grep "\$1\$" ascii-281/smq_list.asc | cut -d'$' -f1,2

# 특정 Level 1의 하위 SMQ 찾기
grep "^20000005\$" ascii-281/smq_content.asc | grep "\$0\$" | cut -d'$' -f2
# term_level=0은 하위 SMQ를 의미
```

---

## 고급 활용 사례

### 사례 1: 약물 X의 간독성 신호 탐지

```python
# 1. 간 장애 SMQ의 모든 PT 수집 (Broad)
liver_pts = get_smq_pts('20000005', scope='broad')

# 2. 약물 X 부작용 데이터베이스 쿼리
drug_x_aes = query_database("SELECT pt_code FROM adverse_events WHERE drug='X'")

# 3. 간 장애 관련 부작용 개수 세기
liver_ae_count = len([pt for pt in drug_x_aes if pt in liver_pts])

# 4. 통계적 유의성 검정
if liver_ae_count > expected_threshold:
    generate_signal_alert()
```

### 사례 2: 중증 부작용 자동 플래그

```python
SERIOUS_SMQ_CODES = [
    '20000003',  # 급성 신부전
    '20000004',  # 심부전
    '20000005',  # 간 장애
    '20000022',  # 심근경색
]

def is_serious_ae(pt_code):
    """PT 코드가 중증 SMQ에 포함되는지 확인"""
    for smq_code in SERIOUS_SMQ_CODES:
        smq_pts = get_smq_pts(smq_code, scope='narrow')
        if pt_code in smq_pts:
            return True
    return False

# 사용
if is_serious_ae('10001314'):
    trigger_urgent_review()
```

### 사례 3: SMQ 기반 부작용 프로파일

```python
def get_ae_profile_by_smq(pt_codes):
    """
    부작용 코드 리스트를 SMQ별로 분류
    """
    profile = {}

    # 주요 SMQ 목록
    major_smqs = {
        '20000005': '간 장애',
        '20000004': '심부전',
        '20000003': '신부전',
        '20000032': '경련',
    }

    for smq_code, smq_name in major_smqs.items():
        smq_pts = get_smq_pts(smq_code, scope='narrow')
        matched = [pt for pt in pt_codes if pt in smq_pts]
        if matched:
            profile[smq_name] = len(matched)

    return profile

# 결과 예시:
# {
#   '간 장애': 3,
#   '심부전': 1,
#   '신부전': 0,
#   '경련': 0
# }
```

---

## SMQ 사용 시 주의사항

### 1. 하위 SMQ 중복

하위 SMQ의 용어가 상위 SMQ에 이미 포함되어 있으므로 중복 카운팅 주의

**해결 방법:**
```python
# 최상위 SMQ만 사용하거나
# 중복 제거 후 집계
unique_pts = set()
for smq_code in smq_list:
    pts = get_smq_pts(smq_code)
    unique_pts.update(pts)
```

### 2. LLT vs PT

SMQ는 주로 PT 레벨에서 작동하지만, 일부 LLT도 포함

**확인 방법:**
```bash
# term_level=4: PT
# term_level=5: LLT
grep "^20000005\$" ascii-281/smq_content.asc | cut -d'$' -f3 | sort | uniq -c
```

### 3. 버전별 변경사항

SMQ는 버전마다 업데이트되므로 사용 버전 명시 필요

```python
SMQ_VERSION = "28.1"  # 항상 명시
```

---

## SMQ 검색 알고리즘 예시

### Python 구현

```python
class SMQSearch:
    def __init__(self, smq_list_file, smq_content_file):
        self.smq_list = self._load_smq_list(smq_list_file)
        self.smq_content = self._load_smq_content(smq_content_file)

    def search(self, smq_code, scope='narrow', term_level='pt'):
        """
        SMQ 검색 수행

        Args:
            smq_code: SMQ 코드
            scope: 'narrow' 또는 'broad'
            term_level: 'pt', 'llt', 또는 'all'

        Returns:
            List of term codes
        """
        scope_code = '2' if scope == 'narrow' else '1'
        level_codes = {'pt': '4', 'llt': '5', 'all': ['4', '5']}

        results = []
        for entry in self.smq_content:
            if entry['smq_code'] == smq_code and entry['term_scope'] == scope_code:
                if term_level == 'all':
                    if entry['term_level'] in level_codes['all']:
                        results.append(entry['term_code'])
                else:
                    if entry['term_level'] == level_codes[term_level]:
                        results.append(entry['term_code'])

        return results

    def get_smq_info(self, smq_code):
        """SMQ 상세 정보 조회"""
        return self.smq_list.get(smq_code)
```

---

## 다음 단계

데이터 추출 및 프로그래밍 구현은 [05_데이터_추출.md](05_데이터_추출.md)를 참조하세요.
