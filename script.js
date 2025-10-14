const LLT_FIELD_COUNT = 12;
const PT_FIELD_COUNT = 12;
const MDHIER_FIELD_COUNT = 13;

const LLT_SYNONYM_HINTS = {
  '빈혈': ['피가 모자람', '피가 모자름', '피 부족', '피부족', '혈액 부족', '혈액부족'],
};

const dataset = {
  loaded: false,
  llt: [],
  pt: new Map(),
  hier: new Map(),
};

let datasetPromise = null;
let currentMode = 'exact';

const form = document.getElementById('search-form');
const results = document.getElementById('results');
const queryInput = document.getElementById('q');
const limitInput = document.getElementById('limit');
const inactiveInput = document.getElementById('inactive');
const approxButton = document.getElementById('approx-search');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingProgressTrack = document.getElementById('loading-progress-track');
const loadingProgressBar = document.getElementById('loading-progress');
const loadingStatus = document.getElementById('loading-status');

if (results) {
  results.innerHTML = '<p>증상 또는 용어를 입력한 후 검색을 눌러주세요.</p>';
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

form.addEventListener('submit', (event) => {
  event.preventDefault();
  runSearch({ approximate: false });
});

approxButton.addEventListener('click', (event) => {
  event.preventDefault();
  runSearch({ approximate: true });
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
  if (!dataset.loaded) {
    overlayShown = true;
    showLoadingOverlay('MedDRA 데이터 내려받는 중...', 5);
    await sleep(75);
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
  const lines = text.split(/?
/);
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
  const lines = text.split(/?
/);
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
  const lines = text.split(/?
/);
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
