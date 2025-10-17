const LLT_FIELD_COUNT = 12;
const PT_FIELD_COUNT = 12;
const MDHIER_FIELD_COUNT = 13;

const LLT_SYNONYM_HINTS = {
  '빈혈': ['피가 모자람', '피가 모자름', '피 부족', '피부족', '혈액 부족', '혈액부족'],
};

const MIN_OVERLAY_MS = 600;

const dataset = {
  loaded: false,
  llt: [],
  pt: new Map(),
  hier: new Map(),
};

let datasetPromise = null;
let currentMode = 'exact';
let isProcessingFile = false;

// 자동 검색 상태 관리
const autoSearchState = {
  isRunning: false,
  currentIndex: 0,
  terms: [],
  resultsByTerm: new Map(),
  totalSearched: 0,
  totalResults: 0,
  ciomsData: null
};

const form = document.getElementById('search-form');
const results = document.getElementById('results');
const queryInput = document.getElementById('q');
const limitInput = document.getElementById('limit');
const inactiveInput = document.getElementById('inactive');
const aiSearchButton = document.getElementById('ai-search');
const uploadZone = document.getElementById('upload-zone');
const fileUpload = document.getElementById('file-upload');
const selectedDocument = document.getElementById('selected-document');
const documentName = document.getElementById('document-name');
const documentStatus = document.getElementById('document-status');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingProgressTrack = document.getElementById('loading-progress-track');
const loadingProgressBar = document.getElementById('loading-progress');
const loadingStatus = document.getElementById('loading-status');
const reportModal = document.getElementById('report-modal');
const modalContent = document.getElementById('modal-content');
const modalClose = document.getElementById('modal-close');

if (results) {
  results.innerHTML = '<p>증상 또는 용어를 입력한 후 검색을 눌러주세요.</p>';
}

// 모달 닫기 이벤트
if (modalClose) {
  modalClose.addEventListener('click', () => {
    closeReportModal();
  });
}

// 모달 배경 클릭으로 닫기
if (reportModal) {
  reportModal.addEventListener('click', (event) => {
    if (event.target === reportModal || event.target.classList.contains('modal-backdrop')) {
      closeReportModal();
    }
  });
}

function showLoadingOverlay(message = '데이터 로딩 중...', percent = 0) {
  if (!loadingOverlay) { return; }
  loadingOverlay.removeAttribute('hidden');
  updateLoadingOverlay(message, percent);
}

function updateLoadingOverlay(message, percent) {
  if (typeof percent === 'number' && loadingProgressBar) {
    const clamped = Math.max(0, Math.min(100, percent));
    loadingProgressBar.style.width = `${clamped}%`;
    if (loadingProgressTrack) {
      loadingProgressTrack.setAttribute('aria-valuenow', String(Math.round(clamped)));
    }
  }
  if (message && loadingStatus) {
    loadingStatus.textContent = message;
  }
}

function hideLoadingOverlay() {
  if (!loadingOverlay) { return; }
  loadingOverlay.setAttribute('hidden', '');
  if (loadingProgressBar) {
    loadingProgressBar.style.width = '0%';
  }
  if (loadingProgressTrack) {
    loadingProgressTrack.setAttribute('aria-valuenow', '0');
  }
  if (loadingStatus) {
    loadingStatus.textContent = '준비 중...';
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  runSearch({ approximate: false });
});

aiSearchButton.addEventListener('click', (event) => {
  event.preventDefault();
  runSearch({ approximate: true });
});

// 파일 선택 버튼 클릭 이벤트
const uploadButton = document.getElementById('upload-button');
if (uploadButton) {
  uploadButton.addEventListener('click', () => {
    if (isProcessingFile) {
      return;
    }
    fileUpload.click();
  });
}

uploadZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', (event) => {
  event.preventDefault();
  uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (event) => {
  event.preventDefault();
  uploadZone.classList.remove('drag-over');

  if (isProcessingFile) {
    return;
  }

  const files = event.dataTransfer.files;
  if (files.length > 0) {
    fileUpload.files = files;
    const changeEvent = new Event('change', { bubbles: true });
    fileUpload.dispatchEvent(changeEvent);
  }
});

// PDF 텍스트 추출 함수
async function extractTextFromPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  } catch (error) {
    console.error('PDF 텍스트 추출 실패:', error);
    throw new Error('PDF 파일을 읽을 수 없습니다');
  }
}

// 증상 키워드 추출 함수
function extractSymptoms(text) {
  const symptoms = [];
  const lines = text.split('\n');

  // 증상 관련 키워드 패턴
  const symptomKeywords = ['증상', '소견', '진단', '호소', '불편', '통증', '이상', '질환'];
  const symptomPatterns = [
    /증상\s*[:：]\s*([^\n]+)/gi,
    /주호소\s*[:：]\s*([^\n]+)/gi,
    /현병력\s*[:：]\s*([^\n]+)/gi,
    /진단명\s*[:：]\s*([^\n]+)/gi,
  ];

  // 패턴 기반 추출
  for (const pattern of symptomPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        symptoms.push(match[1].trim());
      }
    }
  }

  // 줄 단위로 증상 키워드 찾기
  for (const line of lines) {
    for (const keyword of symptomKeywords) {
      if (line.includes(keyword)) {
        const cleaned = line.replace(/[0-9\.\-\(\)]/g, '').trim();
        if (cleaned.length > 2 && cleaned.length < 50) {
          symptoms.push(cleaned);
        }
      }
    }
  }

  // 중복 제거 및 정리
  const uniqueSymptoms = [...new Set(symptoms)];
  return uniqueSymptoms.slice(0, 5); // 최대 5개까지
}

// CIOMS 보고서 데이터 추출 함수
function extractCIOMSData(text) {
  const data = {
    보고서_정보: {},
    환자_정보: {},
    반응_정보: {},
    의심_약물_정보: [],
    병용_약물_정보: [],
    인과관계_평가: {},
    주요_검사실_결과: []
  };

  // 보고서 유형 추출
  if (text.includes('SUSPECT ADVERSE REACTION REPORT')) {
    data.보고서_정보.Report_Type = 'SUSPECT ADVERSE REACTION REPORT (의심되는 유해 반응 보고서)';
  }

  // 제조사 관리번호 추출
  const mfrControlMatch = text.match(/Manufacturer.*?Control.*?No[.:]?\s*([A-Z0-9\-]+)/i);
  if (mfrControlMatch) {
    data.보고서_정보.Manufacturer_Control_No = mfrControlMatch[1];
  }

  // 날짜 추출 (DD/MM/YYYY 형식)
  const datePattern = /(\d{2}\/\d{2}\/\d{4})/g;
  const dates = text.match(datePattern) || [];
  if (dates.length > 0) {
    data.보고서_정보.Date_Received_by_Manufacturer = dates[0];
  }

  // 환자 정보 추출
  const initialMatch = text.match(/Initials?[:\s]+([A-Z]{1,3})/i);
  if (initialMatch) {
    data.환자_정보.Initials = initialMatch[1];
  }

  const countryMatch = text.match(/Country[:\s]+([A-Z]+)/i);
  if (countryMatch) {
    data.환자_정보.Country = countryMatch[1];
  }

  const dobMatch = text.match(/Date.*?Birth[:\s]+(\d{2}\/\d{2}\/\d{4})/i);
  if (dobMatch) {
    data.환자_정보.Date_of_Birth = dobMatch[1];
  }

  const ageMatch = text.match(/(\d+)\s*Years?/i);
  if (ageMatch) {
    data.환자_정보.Age = `${ageMatch[1]} Years`;
  }

  const sexMatch = text.match(/Sex[:\s]+(M|F|Male|Female)/i);
  if (sexMatch) {
    data.환자_정보.Sex = sexMatch[1];
  }

  // 유해 반응 추출 (한글/영문 매핑)
  const reactionMap = {
    'PARALYTIC ILEUS': '마비성 장폐색',
    'HYPOVOLEMIC SHOCK': '저혈량성 쇼크',
    'ACUTE RENAL FAILURE': '급성 신부전',
    'RENAL FAILURE': '신부전',
    'SHOCK': '쇼크',
    'ILEUS': '장폐색'
  };

  data.반응_정보.Adverse_Reactions = [];

  for (const [englishTerm, koreanTerm] of Object.entries(reactionMap)) {
    const pattern = new RegExp(englishTerm, 'i');
    if (pattern.test(text)) {
      // 이미 추가된 반응인지 확인 (중복 방지)
      const alreadyExists = data.반응_정보.Adverse_Reactions.some(
        r => r.english === englishTerm || r.korean === koreanTerm
      );

      if (!alreadyExists) {
        data.반응_정보.Adverse_Reactions.push({
          english: englishTerm,
          korean: koreanTerm
        });
      }
    }
  }

  // 의심 약물 추출 (한글/영문 매핑)
  const xelodaMatch = text.match(/Xeloda|Capecitabine/i);
  if (xelodaMatch) {
    data.의심_약물_정보.push({
      drug_name: {
        english: 'Xeloda [Capecitabine]',
        korean: '젤로다 [카페시타빈]'
      },
      indication: {
        english: 'RECTAL CANCER',
        korean: '직장암'
      }
    });
  }

  const oxaliplatinMatch = text.match(/Eloxatin|Oxaliplatin/i);
  if (oxaliplatinMatch) {
    data.의심_약물_정보.push({
      drug_name: {
        english: 'Eloxatin [Oxaliplatin]',
        korean: '엘록사틴 [옥살리플라틴]'
      },
      indication: {
        english: 'RECTAL CANCER',
        korean: '직장암'
      }
    });
  }

  return data;
}

// CIOMS 데이터를 JSON 파일로 저장하는 함수
function downloadCIOMSJson(data, originalFileName) {
  // 원본 파일명에서 확장자를 제거하고 .json 추가
  const baseFileName = originalFileName.replace(/\.[^/.]+$/, '');
  const jsonFileName = `${baseFileName}.json`;

  // JSON 문자열로 변환 (들여쓰기 2칸)
  const jsonString = JSON.stringify(data, null, 2);

  // Blob 생성
  const blob = new Blob([jsonString], { type: 'application/json' });

  // 다운로드 링크 생성
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = jsonFileName;

  // 다운로드 트리거
  document.body.appendChild(a);
  a.click();

  // 정리
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`✓ JSON 파일 저장 완료: ${jsonFileName}`);
}

// CIOMS 보고서 모달 표시 함수
function showReportModal(data) {
  if (!reportModal || !modalContent) return;

  // CIOMS 데이터 저장
  autoSearchState.ciomsData = data;

  // 모달 컨텐츠 렌더링
  const html = renderCIOMSData(data);
  modalContent.innerHTML = html;

  // 자동 검색 버튼 추가 (유해 반응이 있는 경우)
  const hasReactions = data.반응_정보?.Adverse_Reactions?.length > 0;
  if (hasReactions) {
    addAutoSearchButton();
  }

  // 모달 표시
  reportModal.removeAttribute('hidden');
}

// CIOMS 보고서 모달 닫기 함수
function closeReportModal() {
  if (!reportModal) return;
  reportModal.setAttribute('hidden', '');

  // 모달 닫을 때 파일 입력 초기화
  if (fileUpload) {
    fileUpload.value = '';
  }
}

// CIOMS 데이터 HTML 렌더링 함수
function renderCIOMSData(data) {
  let html = '';

  // 보고서 정보
  if (Object.keys(data.보고서_정보).length > 0) {
    html += '<div class="info-section">';
    html += '<h3 class="section-title">📋 보고서 정보</h3>';
    html += '<div class="info-grid">';
    for (const [key, value] of Object.entries(data.보고서_정보)) {
      if (value) {
        html += `<div class="info-item">
          <div class="info-label">${key.replace(/_/g, ' ')}</div>
          <div class="info-value">${escapeHtml(value)}</div>
        </div>`;
      }
    }
    html += '</div></div>';
  }

  // 환자 정보
  if (Object.keys(data.환자_정보).length > 0) {
    html += '<div class="info-section">';
    html += '<h3 class="section-title">👤 환자 정보</h3>';
    html += '<div class="info-grid">';
    for (const [key, value] of Object.entries(data.환자_정보)) {
      if (value) {
        html += `<div class="info-item">
          <div class="info-label">${key.replace(/_/g, ' ')}</div>
          <div class="info-value">${escapeHtml(value)}</div>
        </div>`;
      }
    }
    html += '</div></div>';
  }

  // 반응 정보
  if (data.반응_정보.Adverse_Reactions && data.반응_정보.Adverse_Reactions.length > 0) {
    html += '<div class="info-section">';
    html += '<h3 class="section-title">⚠️ 유해 반응 정보</h3>';
    html += '<div class="reaction-list">';
    for (const reaction of data.반응_정보.Adverse_Reactions) {
      html += `<div class="reaction-card">
        <div class="card-header">${escapeHtml(reaction.korean)}</div>
        <div class="card-body">
          <div class="card-row">
            <div class="card-row-label">영문</div>
            <div class="card-row-value">${escapeHtml(reaction.english)}</div>
          </div>
          ${reaction.Outcome ? `<div class="card-row">
            <div class="card-row-label">결과</div>
            <div class="card-row-value">${escapeHtml(reaction.Outcome)}</div>
          </div>` : ''}
        </div>
      </div>`;
    }
    html += '</div></div>';
  }

  // 의심 약물 정보
  if (data.의심_약물_정보.length > 0) {
    html += '<div class="info-section">';
    html += '<h3 class="section-title">💊 의심 약물 정보</h3>';
    html += '<div class="drug-list">';
    for (const drug of data.의심_약물_정보) {
      html += `<div class="drug-card">`;

      // 약물명 (한글/영문)
      if (drug.drug_name) {
        html += `<div class="card-header">${escapeHtml(drug.drug_name.korean)}</div>
        <div class="card-body">`;
        html += `<div class="card-row">
          <div class="card-row-label">영문</div>
          <div class="card-row-value">${escapeHtml(drug.drug_name.english)}</div>
        </div>`;
      }

      // 적응증 (한글/영문)
      if (drug.indication) {
        html += `<div class="card-row">
          <div class="card-row-label">적응증</div>
          <div class="card-row-value">${escapeHtml(drug.indication.korean)}</div>
        </div>`;
        html += `<div class="card-row">
          <div class="card-row-label">영문 적응증</div>
          <div class="card-row-value">${escapeHtml(drug.indication.english)}</div>
        </div>`;
      }

      // 일일 용량 (있는 경우)
      if (drug.daily_dose) {
        html += `<div class="card-row">
          <div class="card-row-label">일일 용량</div>
          <div class="card-row-value">`;
        if (typeof drug.daily_dose === 'object') {
          html += `${escapeHtml(drug.daily_dose.korean)} (${escapeHtml(drug.daily_dose.english)})`;
        } else {
          html += escapeHtml(drug.daily_dose);
        }
        html += `</div></div>`;
      }

      // 투여 경로 (있는 경우)
      if (drug.route) {
        html += `<div class="card-row">
          <div class="card-row-label">투여 경로</div>
          <div class="card-row-value">`;
        if (typeof drug.route === 'object') {
          html += `${escapeHtml(drug.route.korean)} (${escapeHtml(drug.route.english)})`;
        } else {
          html += escapeHtml(drug.route);
        }
        html += `</div></div>`;
      }

      // 투여 기간 (있는 경우)
      if (drug.therapy_dates) {
        html += `<div class="card-row">
          <div class="card-row-label">투여 기간</div>
          <div class="card-row-value">${escapeHtml(drug.therapy_dates)}</div>
        </div>`;
      }

      html += '</div></div>';
    }
    html += '</div></div>';
  }

  // 데이터가 없을 경우
  if (html === '') {
    html = '<p style="text-align: center; color: #7a8ac7; padding: 2rem;">추출된 CIOMS 데이터가 없습니다.</p>';
  }

  return html;
}

fileUpload.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  // 파일 처리 중 플래그 설정
  isProcessingFile = true;

  try {
    showLoadingOverlay(`${file.name} 파일 로딩 중...`, 10);

    const extension = file.name.split('.').pop().toLowerCase();
    let text = '';

    if (!['asc', 'txt', 'csv', 'xlsx', 'xls', 'pdf'].includes(extension)) {
      documentName.textContent = file.name;
      documentStatus.textContent = '⚠️ 미지원';
      documentStatus.style.color = '#b91c1c';
      documentStatus.style.background = 'rgba(185, 28, 28, 0.08)';
      selectedDocument.hidden = false;
      hideLoadingOverlay();
      fileUpload.value = '';
      isProcessingFile = false;
      return;
    }

    if (extension === 'pdf') {
      updateLoadingOverlay('PDF 텍스트 추출 중...', 30);

      // PDF에서 텍스트 추출
      const fullText = await extractTextFromPDF(file);

      updateLoadingOverlay('증상 키워드 분석 중...', 60);

      // 증상 키워드 추출
      const symptoms = extractSymptoms(fullText);

      updateLoadingOverlay('CIOMS 보고서 분석 중...', 70);

      // CIOMS 데이터 추출
      const ciomsData = extractCIOMSData(fullText);

      // JSON 파일 저장
      downloadCIOMSJson(ciomsData, file.name);

      updateLoadingOverlay('검색창에 입력 중...', 90);

      // 반응 정보에서 증상 개수 가져오기
      const symptomCount = ciomsData.반응_정보?.Adverse_Reactions?.length || 0;

      if (symptoms.length > 0) {
        // 추출된 첫 번째 증상을 검색창에 자동 입력
        queryInput.value = symptoms[0];
      }

      // 증상 개수 표시
      documentName.textContent = file.name;
      if (symptomCount > 0) {
        documentStatus.textContent = `✓ ${symptomCount}개 증상`;
        documentStatus.style.color = '#1c7c54';
        documentStatus.style.background = 'rgba(28, 124, 84, 0.08)';
      } else {
        documentStatus.textContent = '⚠️ 증상 없음';
        documentStatus.style.color = '#f59e0b';
        documentStatus.style.background = 'rgba(245, 158, 11, 0.08)';
      }

      selectedDocument.hidden = false;

      updateLoadingOverlay('완료!', 100);
      await sleep(300);
      hideLoadingOverlay();

      // 파일 입력 초기화
      if (fileUpload) {
        fileUpload.value = '';
      }
      isProcessingFile = false;

      // 유해 반응이 있으면 바로 자동 검색 시작
      const hasReactions = ciomsData.반응_정보?.Adverse_Reactions?.length > 0;
      if (hasReactions) {
        // CIOMS 데이터 저장
        autoSearchState.ciomsData = ciomsData;
        // 자동 검색 시작
        await startAutoSearch();
      } else {
        // 유해 반응이 없으면 기존처럼 모달 표시
        showReportModal(ciomsData);
        queryInput.focus();
      }

      return;
    }

    text = await file.text();

    updateLoadingOverlay('데이터 해석 중...', 50);

    dataset.llt = [];
    dataset.pt.clear();
    dataset.hier.clear();

    if (extension === 'asc' || extension === 'txt') {
      const lines = text.split(/\r?\n/);
      if (lines.length > 0 && lines[0].includes('$')) {
        parseLlt(text);
      } else {
        throw new Error('지원되지 않는 파일 형식입니다');
      }
    } else if (extension === 'csv') {
      throw new Error('CSV 형식은 현재 지원되지 않습니다');
    } else if (extension === 'xlsx' || extension === 'xls') {
      throw new Error('Excel 형식은 현재 지원되지 않습니다');
    } else {
      throw new Error('지원되지 않는 파일 형식입니다');
    }

    updateLoadingOverlay('로딩 완료!', 100);
    dataset.loaded = true;
    documentName.textContent = file.name;
    documentStatus.textContent = '✓ 로드됨';
    documentStatus.style.color = '#1c7c54';
    documentStatus.style.background = 'rgba(28, 124, 84, 0.08)';
    selectedDocument.hidden = false;

    await sleep(300);
    hideLoadingOverlay();
    isProcessingFile = false;
  } catch (error) {
    hideLoadingOverlay();
    documentName.textContent = file.name;
    documentStatus.textContent = '❌ 실패';
    documentStatus.style.color = '#b91c1c';
    documentStatus.style.background = 'rgba(185, 28, 28, 0.08)';
    selectedDocument.hidden = false;
    fileUpload.value = '';
    isProcessingFile = false;
  }
});

results.addEventListener('click', (event) => {
  const summary = event.target.closest('.card-summary');
  if (!summary || !results.contains(summary)) { return; }
  const card = summary.closest('.result-card');
  const details = card ? card.querySelector('.card-details') : null;
  if (!details) { return; }
  const expanded = summary.getAttribute('aria-expanded') === 'true';
  summary.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  details.hidden = expanded;
});

async function runSearch({ approximate }) {
  const rawQuery = queryInput.value.trim();
  if (!rawQuery) {
    queryInput.focus();
    return;
  }
  const limit = enforceLimit(limitInput.value);
  const includeInactive = inactiveInput.checked;
  let overlayShown = false;
  let overlayStart = 0;
  if (!dataset.loaded) {
    overlayShown = true;
    showLoadingOverlay('MedDRA 데이터 내려받는 중...', 5);
    overlayStart = performance.now();
    await nextFrame();
  }
  results.innerHTML = '<p>데이터를 불러오고 있습니다...</p>';
  try {
    await ensureDataset();
  } catch (error) {
    if (overlayShown) {
      hideLoadingOverlay();
    }
    results.innerHTML = `<p>데이터 로딩 실패: ${escapeHtml(error.message || error)}</p>`;
    return;
  }
  if (overlayShown) {
    const elapsed = performance.now() - overlayStart;
    if (elapsed < MIN_OVERLAY_MS) {
      await sleep(MIN_OVERLAY_MS - elapsed);
    }
    updateLoadingOverlay('로딩 완료!', 100);
    await sleep(150);
    hideLoadingOverlay();
  }
  const searchResult = approximate
    ? searchApproximate(rawQuery, limit, includeInactive)
    : searchExact(rawQuery, limit, includeInactive);
  if (!searchResult.results.length) {
    results.innerHTML = '<p>검색 결과가 없습니다.</p>';
    return;
  }
  renderResults(searchResult);
}

function enforceLimit(value) {
  const parsed = parseInt(value, 10);
  const limited = Math.max(1, Math.min(parsed || 10, 50));
  limitInput.value = limited;
  return limited;
}

async function ensureDataset() {
  if (dataset.loaded) {
    return;
  }
  if (!datasetPromise) {
    datasetPromise = loadDataset()
      .then(() => {
        dataset.loaded = true;
      })
      .catch((error) => {
        datasetPromise = null;
        throw error;
      });
  }
  return datasetPromise;
}

async function loadDataset() {
  updateLoadingOverlay('LLT 파일 다운로드 중...', 10);
  const lltText = await fetchText('ascii-281/llt.asc');
  updateLoadingOverlay('LLT 데이터 해석 중...', 30);
  parseLlt(lltText);

  updateLoadingOverlay('PT 파일 다운로드 중...', 45);
  const ptText = await fetchText('ascii-281/pt.asc');
  updateLoadingOverlay('PT 데이터 해석 중...', 60);
  parsePt(ptText);

  updateLoadingOverlay('계층 파일 다운로드 중...', 75);
  const hierText = await fetchText('ascii-281/mdhier.asc');
  updateLoadingOverlay('계층 데이터 해석 중...', 90);
  parseHierarchy(hierText);

  updateLoadingOverlay('로딩 완료!', 100);
}

async function fetchText(path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`${path} 로딩 실패 (${response.status})`);
  }
  return response.text();
}

function parseLlt(text) {
  dataset.llt = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line) { continue; }
    const row = padFields(line.split('$'), LLT_FIELD_COUNT);
    const code = row[0];
    const name = row[1];
    const ptCode = row[2];
    const active = (row[9] || '').toUpperCase() === 'Y';
    if (!code || !name || !ptCode) { continue; }
    dataset.llt.push({
      code,
      name,
      ptCode,
      active,
      nameLower: name.toLocaleLowerCase('ko-KR'),
      nameNormalized: normalizeText(name),
    });
  }
}

function parsePt(text) {
  dataset.pt.clear();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line) { continue; }
    const row = padFields(line.split('$'), PT_FIELD_COUNT);
    const code = row[0];
    const name = row[1];
    const primarySoc = row[3];
    if (!code || !name) { continue; }
    dataset.pt.set(code, {
      code,
      name,
      primarySocCode: primarySoc,
    });
  }
}

function parseHierarchy(text) {
  dataset.hier.clear();
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line) { continue; }
    const row = padFields(line.split('$'), MDHIER_FIELD_COUNT);
    const entry = {
      pt_code: row[0],
      hlt_code: row[1],
      hlgt_code: row[2],
      soc_code: row[3],
      pt_name: row[4],
      hlt_name: row[5],
      hlgt_name: row[6],
      soc_name: row[7],
      soc_abbrev: row[8],
      primary: (row[11] || '').toUpperCase() === 'Y',
    };
    if (!entry.pt_code) { continue; }
    if (!dataset.hier.has(entry.pt_code)) {
      dataset.hier.set(entry.pt_code, []);
    }
    dataset.hier.get(entry.pt_code).push(entry);
  }
}

function padFields(values, expected) {
  const row = values.slice();
  while (row.length < expected) {
    row.push('');
  }
  return row;
}

function searchExact(query, limit, includeInactive) {
  const queryLower = query.toLocaleLowerCase('ko-KR');
  const pts = dataset.pt;
  const hierMap = dataset.hier;
  const results = [];
  for (const record of dataset.llt) {
    if (!includeInactive && !record.active) { continue; }
    if (!record.nameLower.includes(queryLower)) { continue; }
    const pt = pts.get(record.ptCode);
    if (!pt) { continue; }
    const hierList = hierMap.get(pt.code) || [];
    const hier = selectPrimary(hierList);
    const hierarchies = buildHierarchyPayload(hierList);
    const score = computeScore(queryLower, record.name, record.active);
    results.push(buildResult(record, pt, hier, hierarchies, score));
  }
  results.sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (scoreDiff !== 0) { return scoreDiff; }
    if (a.active !== b.active) {
      return a.active === 'Y' ? -1 : 1;
    }
    return a.llt_name.localeCompare(b.llt_name, 'ko');
  });
  return { results: results.slice(0, limit), approximateUsed: false, mode: 'exact' };
}

function searchApproximate(query, limit, includeInactive) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return { results: [], approximateUsed: false, mode: 'approximate' };
  }
  const pts = dataset.pt;
  const hierMap = dataset.hier;
  const scored = [];
  for (const record of dataset.llt) {
    if (!includeInactive && !record.active) { continue; }
    const pt = pts.get(record.ptCode);
    if (!pt) { continue; }
    const variants = [];
    if (record.nameNormalized) {
      variants.push(record.nameNormalized);
    }
    const hints = LLT_SYNONYM_HINTS[record.name];
    if (Array.isArray(hints)) {
      for (const hint of hints) {
        const normalized = normalizeText(hint);
        if (normalized) {
          variants.push(normalized);
        }
      }
    }
    let ratio = 0;
    for (const variant of variants) {
      if (!variant) { continue; }
      let current = sequenceRatio(normalizedQuery, variant);
      if (variant.includes(normalizedQuery)) {
        current += 0.15;
      } else if (variant.startsWith(normalizedQuery) || normalizedQuery.startsWith(variant)) {
        current += 0.1;
      }
      ratio = Math.max(ratio, current);
    }
    if (ratio < 0.25) { continue; }
    const score = Math.min(100, ratio * 100 + (record.active ? 5 : 0));
    const hierList = hierMap.get(pt.code) || [];
    const hier = selectPrimary(hierList);
    const hierarchies = buildHierarchyPayload(hierList);
    scored.push(buildResult(record, pt, hier, hierarchies, score));
  }
  scored.sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (scoreDiff !== 0) { return scoreDiff; }
    if (a.active !== b.active) {
      return a.active === 'Y' ? -1 : 1;
    }
    return a.llt_name.length - b.llt_name.length;
  });
  return { results: scored.slice(0, limit), approximateUsed: true, mode: 'approximate' };
}

function selectPrimary(hierList) {
  let fallback = null;
  for (const item of hierList) {
    if (!fallback) {
      fallback = item;
    }
    if (item.primary) {
      return item;
    }
  }
  return fallback;
}

function buildHierarchyPayload(hierList) {
  return hierList.map((item) => ({
    primary: item.primary ? 'Y' : 'N',
    hlt_code: item.hlt_code,
    hlt_name: item.hlt_name,
    hlgt_code: item.hlgt_code,
    hlgt_name: item.hlgt_name,
    soc_code: item.soc_code,
    soc_name: item.soc_name,
  }));
}

function buildResult(record, pt, hier, hierarchies, score) {
  const result = {
    llt_code: record.code,
    llt_name: record.name,
    pt_code: pt.code,
    pt_name: pt.name,
    active: record.active ? 'Y' : 'N',
    soc_code: hier ? hier.soc_code : pt.primarySocCode,
    soc_name: hier ? hier.soc_name : '',
    hlgt_name: hier ? hier.hlgt_name : '',
    hlt_name: hier ? hier.hlt_name : '',
    soc_abbrev: hier ? hier.soc_abbrev : '',
    primary_soc: hier ? (hier.primary ? 'Y' : 'N') : '',
    hierarchies,
  };
  if (typeof score === 'number') {
    result.score = parseFloat(score.toFixed(2));
  }
  return result;
}

function computeScore(queryLower, candidate, active) {
  const candidateLower = candidate.toLocaleLowerCase('ko-KR');
  const position = candidateLower.indexOf(queryLower);
  if (position < 0) { return 0; }
  const lengthDiff = Math.abs(candidateLower.length - queryLower.length);
  const positionPenalty = Math.min(position * 6, 45);
  const lengthPenalty = Math.min(lengthDiff * 2, 35);
  const inactivePenalty = active ? 0 : 20;
  const base = 100;
  return Math.max(5, base - positionPenalty - lengthPenalty - inactivePenalty);
}

function normalizeText(value) {
  return value ? value.toLocaleLowerCase('ko-KR').replace(/\s+/g, '') : '';
}

function sequenceRatio(a, b) {
  if (a === b) {
    return 1;
  }
  if (!a.length || !b.length) {
    return 0;
  }
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - distance / maxLen;
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function renderResults(data) {
  currentMode = data.mode || 'exact';
  const html = data.results.map((item, index) => createResultCard(item, index)).join('');
  const summaryParts = [];
  if (currentMode === 'approximate') {
    summaryParts.push('유사 검색 적용');
  }
  if (data.approximateUsed) {
    summaryParts.push('유사어 매칭 결과 포함');
  }
  const summary = summaryParts.length ? `<p class="ai-summary">${summaryParts.join(' · ')}</p>` : '';
  results.innerHTML = summary + html;
}

function createResultCard(item, index) {
  const isActive = item.active === 'Y';
  const hierarchies = Array.isArray(item.hierarchies) ? item.hierarchies : [];
  const hierarchyMarkup = hierarchies.length ? hierarchies.map(renderHierarchyCard).join('') : '<p class="empty-hierarchy">등록된 계층 정보가 없습니다.</p>';
  const showScore = typeof item.score === 'number';
  const scoreValue = showScore ? Math.round(item.score) : 0;
  const scoreBadge = showScore ? `<span class="score-badge">관련지수 ${scoreValue}</span>` : '';
  const reasonMarkup = item.ai_reason ? `<p class="ai-reason">AI 근거: ${escapeHtml(item.ai_reason)}</p>` : '';
  return `
    <article class="result-card" data-index="${index}">
      <button class="card-summary" type="button" aria-expanded="false">
        <span class="chip chip-llt">LLT</span>
        <div class="llt-summary">
          <div class="llt-top-row">
            <span class="term-name">${escapeHtml(item.llt_name)}</span>
            <span class="status-indicator ${isActive ? '' : 'off'}">${isActive ? '활성' : '비활성'}</span>
          </div>
          <span class="term-code">${item.llt_code}</span>
        </div>
        ${scoreBadge}
      </button>
      <div class="card-details" hidden>
        ${renderPTBlock(item)}
        ${reasonMarkup}
        ${hierarchyMarkup}
      </div>
    </article>
  `;
}

function renderPTBlock(item) {
  return `
    <div class="pt-block">
      <div class="llt-top-row">
        <span class="chip chip-pt">PT</span>
        <span class="term-name">${escapeHtml(item.pt_name)}</span>
      </div>
      <span class="pt-meta">코드 ${item.pt_code}</span>
    </div>
  `;
}

function renderHierarchyCard(hier) {
  const primaryBadge = hier.primary === 'Y' ? '<span class="badge-primary">Primary</span>' : '';
  return `
    <div class="hierarchy-card ${hier.primary === 'Y' ? 'is-primary' : ''}">
      ${primaryBadge}
      <div class="hierarchy-flow">
        <div class="node-rail">
          <span class="node-point hlt"></span>
          <span class="node-connector"></span>
          <span class="node-point hlgt"></span>
          <span class="node-connector"></span>
          <span class="node-point soc"></span>
        </div>
        <div class="node-content">
          <div class="node-row">
            <span class="chip chip-hlt">HLT</span>
            <div class="node-texts">
              <span class="level-name">${escapeHtml(hier.hlt_name || '-')}</span>
              <span class="level-code">${escapeHtml(hier.hlt_code || '-')}</span>
            </div>
          </div>
          <div class="node-row">
            <span class="chip chip-hlgt">HLGT</span>
            <div class="node-texts">
              <span class="level-name">${escapeHtml(hier.hlgt_name || '-')}</span>
              <span class="level-code">${escapeHtml(hier.hlgt_code || '-')}</span>
            </div>
          </div>
          <div class="node-row">
            <span class="chip chip-soc">SOC</span>
            <div class="node-texts">
              <span class="level-name">${escapeHtml(hier.soc_name || '-')}</span>
              <span class="level-code">${escapeHtml(hier.soc_code || '-')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// === 자동 검색 기능 ===

// 자동 검색 버튼 추가
function addAutoSearchButton() {
  const modalHeader = reportModal.querySelector('.modal-header');
  if (!modalHeader) return;

  // 기존 버튼이 있으면 제거
  const existingBtn = document.getElementById('start-auto-search');
  if (existingBtn) {
    existingBtn.remove();
  }

  // h2와 닫기 버튼 사이에 자동 검색 버튼 추가
  const modalTitle = modalHeader.querySelector('h2');
  const closeButton = modalHeader.querySelector('.modal-close');

  if (modalTitle && closeButton) {
    const autoSearchBtn = document.createElement('button');
    autoSearchBtn.type = 'button';
    autoSearchBtn.id = 'start-auto-search';
    autoSearchBtn.className = 'btn-auto-search';
    autoSearchBtn.innerHTML = '🔍 자동 검색 시작';

    autoSearchBtn.addEventListener('click', () => {
      closeReportModal();
      startAutoSearch();
    });

    modalHeader.insertBefore(autoSearchBtn, closeButton);
  }
}

// 자동 검색 시작
async function startAutoSearch() {
  if (!autoSearchState.ciomsData) return;

  const reactions = autoSearchState.ciomsData.반응_정보?.Adverse_Reactions;
  if (!reactions || reactions.length === 0) return;

  // 파일 입력 초기화 (자동 검색 시작 시)
  if (fileUpload) {
    fileUpload.value = '';
  }

  // 초기화
  autoSearchState.isRunning = true;
  autoSearchState.currentIndex = 0;
  autoSearchState.terms = reactions.map(reaction => ({
    korean: reaction.korean,
    english: reaction.english,
    status: 'pending'
  }));
  autoSearchState.resultsByTerm = new Map();
  autoSearchState.totalSearched = 0;
  autoSearchState.totalResults = 0;

  // 분할 패널 활성화
  enableSplitMode();
  renderSearchTermPanel();
  renderEmptyResultsPanel();

  // 순차 검색 시작
  await searchNextTerm();
}

// 분할 패널 활성화
function enableSplitMode() {
  results.classList.add('split-mode');
  results.innerHTML = '';
}

// 분할 패널 비활성화
function disableSplitMode() {
  results.classList.remove('split-mode');
  results.innerHTML = '<p>증상 또는 용어를 입력한 후 검색을 눌러주세요.</p>';
}

// 검색어 패널 렌더링
function renderSearchTermPanel() {
  const panel = document.createElement('div');
  panel.className = 'search-term-panel';
  panel.innerHTML = `
    <div class="panel-header">
      <div style="width: 100%;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <h3>검색 진행 상태</h3>
          <div class="progress-summary">0 / ${autoSearchState.terms.length} 완료</div>
        </div>
        <div class="panel-progress-bar">
          <div class="panel-progress-fill" id="panel-progress-fill"></div>
        </div>
      </div>
    </div>
    <div class="term-list">
      ${autoSearchState.terms.map((term, index) => `
        <div class="term-item status-${term.status}" data-index="${index}">
          <span class="term-icon">${getTermIcon(term.status)}</span>
          <span class="term-text">${escapeHtml(term.korean)}</span>
          <span class="term-count">${getTermCountText(term.status)}</span>
        </div>
      `).join('')}
    </div>
  `;
  results.appendChild(panel);
}

// 빈 결과 패널 렌더링
function renderEmptyResultsPanel() {
  const panel = document.createElement('div');
  panel.className = 'results-panel';
  results.appendChild(panel);
}

// 검색어 상태 아이콘
function getTermIcon(status) {
  switch (status) {
    case 'pending': return '○';
    case 'searching': return '<span class="spinner">⟳</span>';
    case 'completed': return '✓';
    case 'error': return '✗';
    default: return '○';
  }
}

// 검색어 카운트 텍스트
function getTermCountText(status) {
  switch (status) {
    case 'pending': return '대기중';
    case 'searching': return '검색중...';
    case 'error': return '실패';
    default: return '';
  }
}

// 순차 검색 실행
async function searchNextTerm() {
  // 종료 조건
  if (autoSearchState.currentIndex >= autoSearchState.terms.length) {
    finishAutoSearch();
    return;
  }

  const termObj = autoSearchState.terms[autoSearchState.currentIndex];

  // 상태 업데이트: searching
  termObj.status = 'searching';
  updateTermStatus(autoSearchState.currentIndex, 'searching');

  try {
    // 데이터셋 로딩
    await ensureDataset();

    // 검색 실행
    const limit = 10;
    const includeInactive = false;
    const searchResult = searchExact(termObj.korean, limit, includeInactive);

    // 결과 저장
    autoSearchState.resultsByTerm.set(termObj.korean, searchResult.results);
    autoSearchState.totalSearched++;
    autoSearchState.totalResults += searchResult.results.length;

    // 상태 업데이트: completed
    termObj.status = 'completed';
    updateTermStatus(autoSearchState.currentIndex, 'completed', searchResult.results.length);

    // 결과 패널에 추가
    addResultGroup(termObj.korean, termObj.english, searchResult.results);

  } catch (error) {
    console.error(`검색 실패: ${termObj.korean}`, error);
    termObj.status = 'error';
    updateTermStatus(autoSearchState.currentIndex, 'error', 0);
  }

  // 다음 검색어로 이동
  autoSearchState.currentIndex++;

  // 약간의 딜레이 (UX 개선)
  await sleep(300);

  // 재귀 호출
  await searchNextTerm();
}

// 검색어 상태 업데이트
function updateTermStatus(index, status, resultCount = 0) {
  const termItem = document.querySelector(`.term-item[data-index="${index}"]`);
  if (!termItem) return;

  // 상태 클래스 업데이트
  termItem.className = `term-item status-${status}`;

  // 아이콘 및 카운트 업데이트
  const iconEl = termItem.querySelector('.term-icon');
  const countEl = termItem.querySelector('.term-count');

  if (iconEl) {
    iconEl.innerHTML = getTermIcon(status);
  }

  if (countEl) {
    if (status === 'completed') {
      countEl.textContent = `${resultCount}개`;
    } else if (status === 'error') {
      countEl.textContent = '실패';
    } else {
      countEl.textContent = getTermCountText(status);
    }
  }

  // 진행률 업데이트
  updateProgressSummary();

  // 완료된 항목은 클릭 가능하도록 이벤트 추가
  if (status === 'completed') {
    termItem.style.cursor = 'pointer';
    termItem.addEventListener('click', () => {
      scrollToResultGroup(autoSearchState.terms[index].korean);
    });
  }
}

// 진행률 업데이트
function updateProgressSummary() {
  const progressEl = document.querySelector('.progress-summary');
  if (!progressEl) return;

  const completed = autoSearchState.terms.filter(t => t.status === 'completed').length;
  progressEl.textContent = `${completed} / ${autoSearchState.terms.length} 완료`;

  // 프로그레스 바 업데이트
  const progressFill = document.getElementById('panel-progress-fill');
  if (progressFill) {
    const percentage = (completed / autoSearchState.terms.length) * 100;
    progressFill.style.width = `${percentage}%`;
  }
}

// 결과 그룹 추가
function addResultGroup(koreanTerm, englishTerm, results) {
  const resultsPanel = document.querySelector('.results-panel');
  if (!resultsPanel) return;

  const groupDiv = document.createElement('div');
  groupDiv.className = 'result-group';
  groupDiv.setAttribute('data-term', koreanTerm);

  const headerHtml = `
    <div class="group-header">
      <h4 class="group-term">${escapeHtml(koreanTerm)}</h4>
      <span class="group-subtitle">${escapeHtml(englishTerm)}</span>
      <span class="group-count">${results.length}개 결과</span>
      <button class="group-toggle" type="button" aria-expanded="true">−</button>
    </div>
  `;

  const resultsHtml = results.length === 0
    ? '<div class="group-results"><p class="no-results">검색 결과가 없습니다.</p></div>'
    : `<div class="group-results">${results.map((item, index) => createResultCard(item, index)).join('')}</div>`;

  groupDiv.innerHTML = headerHtml + resultsHtml;
  resultsPanel.appendChild(groupDiv);

  // 토글 버튼 이벤트
  const toggleBtn = groupDiv.querySelector('.group-toggle');
  const groupResults = groupDiv.querySelector('.group-results');

  if (toggleBtn && groupResults) {
    toggleBtn.addEventListener('click', () => {
      const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      toggleBtn.setAttribute('aria-expanded', !isExpanded);
      toggleBtn.textContent = isExpanded ? '+' : '−';
      groupResults.hidden = isExpanded;
    });
  }
}

// 결과 그룹으로 스크롤
function scrollToResultGroup(koreanTerm) {
  const targetGroup = document.querySelector(`.result-group[data-term="${koreanTerm}"]`);
  if (!targetGroup) return;

  targetGroup.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });

  // 하이라이트 효과
  targetGroup.classList.add('highlight');
  setTimeout(() => {
    targetGroup.classList.remove('highlight');
  }, 1500);
}

// 자동 검색 완료
function finishAutoSearch() {
  autoSearchState.isRunning = false;

  // 완료 메시지 추가
  const resultsPanel = document.querySelector('.results-panel');
  if (resultsPanel) {
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'auto-search-summary';
    summaryDiv.innerHTML = `
      <p>✅ 자동 검색이 완료되었습니다.</p>
      <p>총 ${autoSearchState.terms.length}개 검색어에서 ${autoSearchState.totalResults}개 결과를 찾았습니다.</p>
    `;
    resultsPanel.insertBefore(summaryDiv, resultsPanel.firstChild);
  }
}

// === 자동 검색 기능 끝 ===

// === DB 자동 입력 기능 시작 ===

// DB 자동 입력 버튼 이벤트 리스너
const dbAutofillButton = document.getElementById('db-autofill-button');
if (dbAutofillButton) {
  dbAutofillButton.addEventListener('click', async () => {
    // CIOMS 데이터가 있는지 확인
    if (!autoSearchState.ciomsData) {
      alert('먼저 PDF 파일을 업로드하여 CIOMS 데이터를 추출해주세요.');
      return;
    }

    // 확인 메시지
    const confirmed = confirm(
      'MedDRA-DB 사이트에 CIOMS 데이터를 자동으로 입력하시겠습니까?\n\n' +
      '브라우저 창이 열리고 자동으로 폼이 작성됩니다.'
    );

    if (!confirmed) return;

    try {
      // Playwright MCP를 통해 자동 입력 수행
      await performDBAutoFill(autoSearchState.ciomsData);
    } catch (error) {
      console.error('DB 자동 입력 오류:', error);
      alert(`DB 자동 입력 중 오류가 발생했습니다:\n${error.message}`);
    }
  });
}

// DB 자동 입력 수행 함수
async function performDBAutoFill(ciomsData) {
  try {
    // 로딩 표시
    showLoadingOverlay();
    updateLoadingOverlay('DB 자동 입력 중...', 0);

    // Chrome 확장 프로그램 ID (설치 후 업데이트 필요)
    const EXTENSION_ID = 'YOUR_EXTENSION_ID_HERE'; // TODO: 실제 확장 ID로 교체

    // Chrome 확장이 설치되어 있는지 확인
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      hideLoadingOverlay();
      alert(
        '❌ Chrome 확장 프로그램이 설치되지 않았습니다.\n\n' +
        '1. chrome-extension 폴더를 Chrome에 로드하세요\n' +
        '2. chrome://extensions/로 이동\n' +
        '3. "개발자 모드" 활성화\n' +
        '4. "압축해제된 확장 로드" 클릭\n' +
        '5. chrome-extension 폴더 선택'
      );
      return;
    }

    // Chrome 확장에 메시지 전송
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        action: 'dbAutofill',
        ciomsData: ciomsData
      },
      (response) => {
        hideLoadingOverlay();

        if (chrome.runtime.lastError) {
          console.error('Chrome 확장 통신 오류:', chrome.runtime.lastError);
          alert(
            '❌ Chrome 확장과 통신할 수 없습니다.\n\n' +
            `오류: ${chrome.runtime.lastError.message}\n\n` +
            '확장이 올바르게 설치되어 있는지 확인해주세요.'
          );
          return;
        }

        if (response && response.success) {
          alert(
            '✅ DB 자동 입력 시작!\n\n' +
            'MedDRA-DB 사이트가 새 탭에서 열렸습니다.\n' +
            '자동으로 폼이 입력됩니다.\n\n' +
            '자동 입력 데이터:\n' +
            `- 환자 정보: ${ciomsData.환자_정보?.환자_이니셜 || 'N/A'}\n` +
            `- 유해 반응 수: ${ciomsData.반응_정보?.Adverse_Reactions?.length || 0}\n` +
            `- 약물 수: ${ciomsData.의약품_정보?.약물_목록?.length || 0}`
          );
        } else {
          alert(
            '❌ DB 자동 입력 실패\n\n' +
            `오류: ${response?.error || '알 수 없는 오류'}\n\n` +
            'Chrome 확장이 올바르게 설치되어 있는지 확인해주세요.'
          );
        }
      }
    );

    updateLoadingOverlay('Chrome 확장에 요청 전송 중...', 50);

  } catch (error) {
    hideLoadingOverlay();
    console.error('DB 자동 입력 오류:', error);
    alert(
      '❌ DB 자동 입력 실패\n\n' +
      `오류: ${error.message}\n\n` +
      'Chrome 확장이 설치되어 있는지 확인해주세요.'
    );
    throw error;
  }
}

// === DB 자동 입력 기능 끝 ===

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
