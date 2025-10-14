// MedDRA 검색 애플리케이션
class MedDRASearch {
    constructor() {
        this.data = null;
        this.lltIndex = new Map();
        this.ptIndex = new Map();
        this.hierarchyIndex = new Map();
        this.init();
    }

    async init() {
        this.showLoading(true);
        await this.loadData();
        this.setupEventListeners();
        this.showLoading(false);
    }

    async loadData() {
        try {
            console.log('🔄 JSON 파일 로딩 시작...');
            const response = await fetch('meddra_data.json');
            console.log('📥 응답 상태:', response.status, response.statusText);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log('🔄 JSON 파싱 중... (21MB, 약 2-3초 소요)');
            this.data = await response.json();

            console.log('🔄 인덱스 생성 중...');
            this.buildIndexes();

            console.log('✅ MedDRA 데이터 로드 완료');
            console.log(`📊 LLT: ${this.data.llt.length}, PT: ${this.data.pt.length}`);

            // 로딩 완료 메시지 표시
            const loadingIndicator = document.getElementById('loadingIndicator');
            loadingIndicator.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #10b981;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">✅</div>
                    <h3>데이터 로드 완료!</h3>
                    <p>검색창에 증상을 입력하세요.</p>
                </div>
            `;
            setTimeout(() => {
                this.showLoading(false);
            }, 1000);

        } catch (error) {
            console.error('❌ 데이터 로드 실패:', error);
            console.error('에러 상세:', error.message, error.stack);

            const loadingIndicator = document.getElementById('loadingIndicator');
            loadingIndicator.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #ef4444;">
                    <div style="font-size: 3rem; margin-bottom: 15px;">❌</div>
                    <h3>데이터 로드 실패</h3>
                    <p style="margin: 10px 0;">${error.message}</p>
                    <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer;">
                        페이지 새로고침
                    </button>
                </div>
            `;
        }
    }

    buildIndexes() {
        // LLT 인덱스 생성 (LLT 이름 → LLT 객체)
        this.data.llt.forEach(llt => {
            this.lltIndex.set(llt.llt_name.toLowerCase(), llt);
        });

        // PT 인덱스 생성 (PT 코드 → PT 객체)
        this.data.pt.forEach(pt => {
            this.ptIndex.set(pt.pt_code, pt);
        });

        // 계층 인덱스 생성 (PT 코드 → 계층 정보 배열)
        this.data.hierarchy.forEach(hier => {
            if (!this.hierarchyIndex.has(hier.pt_code)) {
                this.hierarchyIndex.set(hier.pt_code, []);
            }
            this.hierarchyIndex.get(hier.pt_code).push(hier);
        });
    }

    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const closeDetailBtn = document.getElementById('closeDetail');

        searchBtn.addEventListener('click', () => this.performSearch());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        closeDetailBtn.addEventListener('click', () => this.hideDetail());
    }

    performSearch() {
        const searchInput = document.getElementById('searchInput');
        const query = searchInput.value.trim();

        if (!query) {
            alert('검색어를 입력해주세요.');
            return;
        }

        if (!this.data) {
            alert('데이터가 아직 로드되지 않았습니다.');
            return;
        }

        const results = this.search(query);
        this.displayResults(results, query);
    }

    search(symptom) {
        const searchTerm = symptom.toLowerCase();
        const results = [];

        // LLT에서 검색 (부분 일치)
        for (const [lltName, llt] of this.lltIndex) {
            if (lltName.includes(searchTerm)) {
                const pt = this.ptIndex.get(llt.pt_code);
                if (!pt) continue;

                const hierarchies = this.hierarchyIndex.get(llt.pt_code) || [];
                const primaryHierarchy = hierarchies.find(h => h.primary_soc_flag === 'Y') || hierarchies[0];

                if (primaryHierarchy) {
                    results.push({
                        llt: llt,
                        pt: pt,
                        hierarchy: primaryHierarchy
                    });
                }
            }
        }

        return results;
    }

    displayResults(results, query) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsContainer = document.getElementById('resultsContainer');
        const showRelated = document.getElementById('showRelated').checked;

        resultsSection.style.display = 'block';
        this.hideDetail();

        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <div class="no-results-icon">🔍</div>
                    <p>"${query}"에 대한 검색 결과가 없습니다.</p>
                    <p>다른 검색어를 시도해보세요.</p>
                </div>
            `;
            return;
        }

        resultsContainer.innerHTML = `
            <div style="margin-bottom: 20px; color: var(--text-secondary);">
                총 <strong>${results.length}</strong>개의 결과를 찾았습니다.
            </div>
        `;

        results.forEach(result => {
            const resultItem = this.createResultItem(result, showRelated);
            resultsContainer.appendChild(resultItem);
        });

        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    createResultItem(result, showRelated) {
        const div = document.createElement('div');
        div.className = 'result-item';

        const relatedSymptoms = showRelated ? this.getRelatedSymptoms(result.pt.pt_code, 5) : [];

        div.innerHTML = `
            <div class="result-header">
                <div>
                    <div class="result-title">${result.pt.pt_name}</div>
                    <div class="result-llt">LLT: ${result.llt.llt_name}</div>
                </div>
                <div class="result-code">PT: ${result.pt.pt_code}</div>
            </div>

            <div class="hierarchy">
                <div class="hierarchy-item">
                    <span class="hierarchy-label">SOC:</span>
                    <span class="hierarchy-value">${result.hierarchy.soc_name}</span>
                    <span class="hierarchy-code">(${result.hierarchy.soc_code})</span>
                </div>
                <div class="hierarchy-item">
                    <span class="hierarchy-label">HLGT:</span>
                    <span class="hierarchy-value">${result.hierarchy.hlgt_name}</span>
                    <span class="hierarchy-code">(${result.hierarchy.hlgt_code})</span>
                </div>
                <div class="hierarchy-item">
                    <span class="hierarchy-label">HLT:</span>
                    <span class="hierarchy-value">${result.hierarchy.hlt_name}</span>
                    <span class="hierarchy-code">(${result.hierarchy.hlt_code})</span>
                </div>
            </div>

            ${showRelated && relatedSymptoms.length > 0 ? `
                <div class="related-symptoms">
                    <div class="related-title">관련 증상 (${relatedSymptoms.length}개)</div>
                    <div class="related-list">
                        ${relatedSymptoms.map(s => `
                            <span class="related-tag" data-pt-code="${s.pt_code}">${s.pt_name}</span>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;

        // 클릭 이벤트 - 상세 정보 표시
        div.addEventListener('click', (e) => {
            if (!e.target.classList.contains('related-tag')) {
                this.showDetail(result.pt.pt_code);
            }
        });

        // 관련 증상 태그 클릭 이벤트
        if (showRelated) {
            div.querySelectorAll('.related-tag').forEach(tag => {
                tag.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const ptCode = tag.dataset.ptCode;
                    this.showDetail(ptCode);
                });
            });
        }

        return div;
    }

    getRelatedSymptoms(ptCode, limit = 5) {
        const hierarchies = this.hierarchyIndex.get(ptCode) || [];
        const primaryHierarchy = hierarchies.find(h => h.primary_soc_flag === 'Y') || hierarchies[0];

        if (!primaryHierarchy) return [];

        const related = [];
        const hltCode = primaryHierarchy.hlt_code;

        // 같은 HLT를 가진 다른 PT 찾기
        for (const [code, hiers] of this.hierarchyIndex) {
            if (code === ptCode) continue;

            const hier = hiers.find(h => h.hlt_code === hltCode);
            if (hier) {
                const pt = this.ptIndex.get(code);
                if (pt) {
                    related.push(pt);
                    if (related.length >= limit) break;
                }
            }
        }

        return related;
    }

    showDetail(ptCode) {
        const pt = this.ptIndex.get(ptCode);
        if (!pt) return;

        const hierarchies = this.hierarchyIndex.get(ptCode) || [];
        const detailSection = document.getElementById('detailSection');
        const detailContainer = document.getElementById('detailContainer');

        let hierarchyHTML = '';
        hierarchies.forEach((hier, index) => {
            const isPrimary = hier.primary_soc_flag === 'Y';
            hierarchyHTML += `
                <div style="margin-bottom: 30px; padding: 20px; background: ${isPrimary ? '#eff6ff' : 'white'}; border-radius: 8px; border: ${isPrimary ? '2px solid var(--primary-color)' : '1px solid var(--border-color)'};">
                    <h3 style="margin-bottom: 15px; color: var(--primary-color);">
                        ${isPrimary ? '🔹 Primary SOC' : `Secondary SOC ${index}`}
                    </h3>
                    <div class="detail-row">
                        <div class="detail-label">SOC</div>
                        <div class="detail-value">${hier.soc_name} (${hier.soc_code})</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">HLGT</div>
                        <div class="detail-value">${hier.hlgt_name} (${hier.hlgt_code})</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">HLT</div>
                        <div class="detail-value">${hier.hlt_name} (${hier.hlt_code})</div>
                    </div>
                </div>
            `;
        });

        // PT와 연결된 모든 LLT 찾기
        const lltList = [];
        for (const llt of this.data.llt) {
            if (llt.pt_code === ptCode) {
                lltList.push(llt);
            }
        }

        detailContainer.innerHTML = `
            <div class="detail-content">
                <div class="detail-row">
                    <div class="detail-label">PT 코드</div>
                    <div class="detail-value" style="font-family: 'Courier New', monospace; font-weight: 600;">${pt.pt_code}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">PT 이름</div>
                    <div class="detail-value" style="font-size: 1.2rem; font-weight: 600;">${pt.pt_name}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">연결된 LLT</div>
                    <div class="detail-value">${lltList.length}개</div>
                </div>
            </div>

            <h3 style="margin: 30px 0 15px 0; color: var(--text-primary);">계층 구조</h3>
            ${hierarchyHTML}

            ${lltList.length > 0 ? `
                <h3 style="margin: 30px 0 15px 0; color: var(--text-primary);">연결된 LLT 목록 (${lltList.length}개)</h3>
                <div style="display: grid; gap: 10px;">
                    ${lltList.slice(0, 20).map(llt => `
                        <div style="padding: 12px; background: var(--bg-color); border-radius: 6px; border-left: 3px solid var(--primary-color);">
                            <div style="font-weight: 600;">${llt.llt_name}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); font-family: 'Courier New', monospace;">LLT: ${llt.llt_code}</div>
                        </div>
                    `).join('')}
                    ${lltList.length > 20 ? `
                        <div style="text-align: center; color: var(--text-secondary); padding: 10px;">
                            ... 그 외 ${lltList.length - 20}개의 LLT
                        </div>
                    ` : ''}
                </div>
            ` : ''}
        `;

        detailSection.style.display = 'block';
        detailSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    hideDetail() {
        const detailSection = document.getElementById('detailSection');
        detailSection.style.display = 'none';
    }

    showLoading(show) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        loadingIndicator.style.display = show ? 'block' : 'none';
    }
}

// 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', () => {
    new MedDRASearch();
});
