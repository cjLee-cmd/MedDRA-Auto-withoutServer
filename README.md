# MedDRA 28.1 한국어 데이터 활용 안내

## 1. 개요
MedDRA(Medical Dictionary for Regulatory Activities) 28.1 한국어판 데이터 팩은 약물감시(PV) 업무에서 이상사례 증상과 코드를 연동하는 표준 용어집입니다. 모든 ASCII 파일은 달러(`$`) 구분자와 CRLF 줄바꿈을 사용하며 UTF-8 인코딩으로 제공됩니다. 데이터는 SOC(계통 기관)부터 LLT(최하위 용어)까지 다섯 단계 계층과 SMQ(Standardised MedDRA Query) 정보를 포함합니다.

## 2. 디렉터리 구조
- `ascii-281/` : 정식 배포 테이블. 계층별 용어, 코드 매핑, SMQ 관련 파일이 위치합니다.
- `seq-281/` : 직전 배포본 대비 변경분을 제공하는 증분 파일. 동일한 파일명을 사용하므로 diff 작업에 활용합니다.
- 루트 PDF/XLS : `dist_file_format_28_1_Korean.pdf`(필드 정의), `intguide_28_1_Korean.pdf`(입문서), `SMQ_intguide_28_1_Korean.pdf`, `whatsnew_28_1_Korean.pdf`, `version_report_28_1_Korean.xlsx` 등 레퍼런스 문서입니다.

## 3. MedDRA 계층 요약
- **SOC → HLGT → HLT → PT → LLT** 순으로 세분화됩니다.
- LLT는 가장 상세한 용어이며 PT와 1:1로 연결됩니다.
- 한 PT는 여러 HLTx/SOC에 속할 수 있으며, `mdhier.asc`의 마지막 필드로 Primary SOC(`Y`/`N`)를 확인합니다.

## 4. 주요 데이터 파일
| 파일 | 필드 수 | 주요 키 | 설명 |
| --- | --- | --- | --- |
| `soc.asc` | 11 | SOC_CODE | SOC 코드, 한글/영문 명칭, 정렬 순서 |
| `hlgt.asc` | 10 | HLGT_CODE, SOC_CODE | HLGT 명칭과 소속 SOC |
| `hlgt_hlt.asc` | 3 | HLGT_CODE, HLT_CODE | HLGT와 HLT 매핑 |
| `hlt.asc` | 10 | HLT_CODE, SOC_CODE | HLT 명칭, 관련 SOC |
| `hlt_pt.asc` | 3 | HLT_CODE, PT_CODE | HLT와 PT 연결 |
| `pt.asc` | 12 | PT_CODE, PRIMARY_SOC | PT 명칭, 기본 SOC 코드 |
| `llt.asc` | 12 | LLT_CODE, PT_CODE | LLT 명칭, 연결 PT, 용어 활성 여부(필드 10: `Y`/`N`) |
| `mdhier.asc` | 13 | PT_CODE → SOC | PT 기준 전체 계층 경로와 Primary SOC 플래그 |
| `smq_list.asc` | 10 | SMQ_CODE | SMQ 개요, 상태, 버전 정보 |
| `smq_content.asc` | 10 | SMQ_CODE, TERM_CODE | SMQ에 포함된 PT/LLT 및 범주(필드 5), 옵션(필드 6) |
| `intl_ord.asc` | 3 | SOC_CODE | 국제 순서(International Order) |
| `meddra_history_korean.asc` | 6 | TERM_CODE | 용어 이력: 추가/변경 버전, 현재 상태 |
| `meddra_release.asc` | 6 | VERSION | 배포 버전 메타데이터 |

필드별 상세 정의는 `dist_file_format_28_1_Korean.pdf`를 참고하십시오.

## 5. 증상 → 코드 조회 절차
1. **LLT 검색**: 한국어로 입력한 증상을 `llt.asc`에서 조회합니다.
   ```bash
   rg -n "빈혈" ascii-281/llt.asc
   ```
   출력의 첫 번째 필드는 LLT 코드, 세 번째 필드는 연결된 PT 코드, 열 번째 필드는 활성(`Y`) 여부입니다.
2. **PT 세부 정보 확인**: 대응 PT 코드로 `pt.asc`와 `mdhier.asc`를 조회하여 상위 계층과 Primary SOC를 파악합니다.
   ```bash
   rg "^10002043\$" ascii-281/mdhier.asc
   ```
   결과에서 필드 4는 SOC 코드, 필드 5~8은 한글 계층 명칭, 마지막 필드는 Primary SOC 플래그입니다.
3. **연관 용어 탐색**: 동일 PT에 연결된 다른 LLT를 확인하려면 `rg "\$10002043\$" ascii-281/llt.asc`와 같이 PT 코드를 검색합니다.
4. **코드 활용**: 환자 증상 보고 시 LLT 코드를 사용하고, 규제 보고서나 분석 시 PT/SOC 코드를 병행해 제출합니다.

## 6. SMQ(Standardised MedDRA Query) 활용
- 광범위한 증후군 감시가 필요할 때 `smq_list.asc`에서 SMQ를 선택하고, `smq_content.asc`를 통해 포함된 PT/LLT 목록과 범주(필드 5, `A`=협의, `B`=확장 등)를 확인합니다.
- 필드 6은 해당 용어의 포함 조건(`I`=포함, `E`=제외)을 나타내며, 필드 7~8은 버전별 카테고리 관리 용도로 사용됩니다.

## 7. 버전 관리 및 증분 적용
- `seq-281/` 디렉터리의 파일은 마지막 배포본 이후 변경 사항만 포함합니다. 새로운 릴리스를 적용할 때는 기존 데이터와 머지하거나, `diff -u ascii-281/llt.asc seq-281/llt.seq`로 변경 용어를 검토합니다.
- 변경 유형(`A`=추가, `C`=변경, `D`=삭제)은 각 seq 파일의 마지막 필드에서 확인할 수 있습니다. 변경 사유는 `whatsnew_28_1_Korean.pdf`와 `version_report_28_1_Korean.xlsx`에 기록됩니다.

## 8. 참고 문서와 권장 프로세스
- `intguide_28_1_Korean.pdf`: MedDRA 입문 가이드. 용어 선택 원칙과 보고 기준 설명.
- `dist_file_format_28_1_Korean.pdf`: 각 ASCII/SEQ 필드 정의 및 데이터 타입 규칙.
- `SMQ_intguide_28_1_Korean.pdf`: SMQ 검색 전략.

레퍼런스를 검토하여 조직 내 SOP와 정렬하고, 용어 변경 시 근거 문서를 PR 또는 변경 기록에 첨부하십시오.

## 9. 작업 팁
- **인코딩**: 모든 편집 도구를 UTF-8 + CRLF 모드로 설정해 원본 형식을 유지합니다.
- **무결성 검증**: 수정 전후 `wc -l ascii-281/*.asc`로 레코드 수를 비교하고, `$` 구분자가 예상 개수인지 `awk -F'\$' 'NF!=기대값'` 형태로 점검하십시오.
- **자동화 스크립트**: Python에서 `csv` 모듈을 사용할 때 `delimiter='$'`, `lineterminator='\r\n'`, `encoding='utf-8'`을 지정해 추출 파이프라인을 구성합니다.
- **보안/규제**: MedDRA 라이선스 조건을 준수하고, 내부 배포 시 사용자 계정을 관리하십시오.

## 10. 로컬 조회 서버 실행
`meddra_server.py`는 LLT/PT 검색을 제공하는 간단한 HTTP 서버입니다. 데이터 루트에는 `ascii-281/` 디렉터리가 존재해야 합니다.

```bash
python3 meddra_server.py --host 127.0.0.1 --port 8000
```

- 기본 UI는 리포지토리 루트의 `index.html` 파일을 서빙하며, `--ui` 옵션으로 다른 HTML 경로를 지정할 수 있습니다.
- 서버가 실행되면 브라우저에서 `http://127.0.0.1:8000/`에 접속해 검색할 수 있습니다.
- 동일 포트를 이미 사용하는 프로세스가 있다면 `lsof -nP -iTCP:8000`으로 PID를 확인한 뒤 종료하고 다시 실행하십시오.
- Gemini 기반 AI 검색을 사용하려면 Google Generative Language API 키를 준비하고 루트의 `.env.example`을 복사해 `.env`를 만든 뒤 `GEMINI_API_KEY` 항목에 키를 채워 넣으세요. 실행 전에 `export GEMINI_API_KEY=...`로 지정하거나 명령행에서 `--gemini-key` 옵션으로 직접 전달할 수도 있습니다. 기본 모델은 `gemini-1.5-flash`이며, `--gemini-model` 옵션으로 `gemini-2.5-flash` 등 다른 모델을 선택할 수 있습니다.
- UI 하단의 “API 서버 주소” 입력란 또는 URL의 `?api=` 파라미터로 백엔드 주소를 지정할 수 있습니다. 브라우저에 값이 저장되므로 다른 도메인(예: GitHub Pages)에서 프론트엔드를 배포할 때 별도 수정 없이 동일한 서버를 사용할 수 있습니다.

## 11. GitHub Pages 배포
- 리포지토리 루트가 정적 자산을 모두 포함하므로 GitHub Pages 소스 폴더를 `/ (root)`로 지정할 수 있습니다.
- 기본 진입점은 `index.html`이며, 추가 빌드 없이 바로 퍼블리시됩니다.
- API 서버는 별도로 운영해야 합니다. 페이지에서 `?api=https://your-backend.example.com`과 같이 호출하면 해당 주소가 저장되고 이후 동일한 백엔드를 사용합니다.
- 다른 검색 엔드포인트 경로를 쓰고 싶다면 `?path=/custom-search`를 추가하거나 `window.MEDDRA_API_CONFIG` 객체를 HTML에서 정의해 덮어쓸 수 있습니다.
