/**
 * MedDRA-DB 자동 입력 수신 스크립트
 *
 * 이 파일을 MedDRA-DB 저장소의 form-edit.html에 추가하세요.
 *
 * 사용 방법:
 * 1. MedDRA-DB 저장소의 form-edit.html 파일을 엽니다
 * 2. </body> 태그 직전에 다음 라인을 추가합니다:
 *    <script src="meddra_db_autofill_receiver.js"></script>
 * 3. 이 파일을 MedDRA-DB 저장소 루트에 복사합니다
 * 4. Git으로 commit & push합니다
 */

(function() {
  'use strict';

  console.log('[AutoFill] 자동 입력 수신 스크립트 로드됨');

  // 페이지 로드 완료 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoFill);
  } else {
    initAutoFill();
  }

  function initAutoFill() {
    // sessionStorage에서 CIOMS 데이터 확인
    const dataKey = 'cioms_data_transfer';
    const storedData = sessionStorage.getItem(dataKey);

    if (!storedData) {
      console.log('[AutoFill] 전송된 데이터 없음');
      return;
    }

    try {
      const transferData = JSON.parse(storedData);
      console.log('[AutoFill] 데이터 수신:', transferData);

      // 데이터가 5분 이상 오래되었으면 무시
      const fiveMinutes = 5 * 60 * 1000;
      if (Date.now() - transferData.timestamp > fiveMinutes) {
        console.log('[AutoFill] 데이터 만료됨 (5분 경과)');
        sessionStorage.removeItem(dataKey);
        return;
      }

      // 사용 후 즉시 삭제 (중복 입력 방지)
      sessionStorage.removeItem(dataKey);

      // 자동 입력 시작
      performAutoFill(transferData.data);

    } catch (error) {
      console.error('[AutoFill] 데이터 파싱 오류:', error);
      sessionStorage.removeItem(dataKey);
    }
  }

  async function performAutoFill(ciomsData) {
    console.log('[AutoFill] 자동 입력 시작...');

    // 진행 상황 오버레이 표시
    showProgressOverlay();
    updateProgress('자동 입력 시작...', 1, 7);

    try {
      // 1. 데이터베이스 로딩 대기
      updateProgress('데이터베이스 로딩 대기 중...', 2, 7);
      await waitForDatabaseReady();

      // 2. 기본 정보 입력
      updateProgress('기본 정보 입력 중...', 3, 7);
      fillBasicInfo(ciomsData);

      await sleep(500);

      // 3. 환자 정보 입력
      updateProgress('환자 정보 입력 중...', 4, 7);
      fillPatientInfo(ciomsData);

      await sleep(500);

      // 4. 유해 반응 입력
      const reactionCount = ciomsData.반응_정보?.Adverse_Reactions?.length || 0;
      updateProgress(`유해 반응 ${reactionCount}개 입력 중...`, 5, 7);
      await fillReactions(ciomsData);

      await sleep(500);

      // 5. 의심 약물 입력
      const drugCount = ciomsData.의심_약물_정보?.length || 0;
      updateProgress(`의심 약물 ${drugCount}개 입력 중...`, 6, 7);
      await fillDrugs(ciomsData);

      await sleep(500);

      // 6. 완료
      updateProgress('자동 입력 완료!', 7, 7);
      await sleep(1000);
      hideProgressOverlay();

      // 완료 알림
      alert(
        '✅ 자동 입력 완료!\n\n' +
        '입력된 데이터:\n' +
        `- 제조업체 관리번호: ${ciomsData.보고서_정보?.Manufacturer_Control_No || 'N/A'}\n` +
        `- 환자 정보: ${ciomsData.환자_정보?.Initials || 'N/A'}\n` +
        `- 유해 반응: ${reactionCount}개\n` +
        `- 의심 약물: ${drugCount}개\n\n` +
        '입력된 내용을 확인하신 후 저장 버튼을 눌러주세요.'
      );

    } catch (error) {
      console.error('[AutoFill] 자동 입력 오류:', error);
      hideProgressOverlay();
      alert(
        '❌ 자동 입력 중 오류 발생\n\n' +
        `오류: ${error.message}\n\n` +
        '일부 데이터만 입력되었을 수 있습니다.\n' +
        '누락된 항목을 직접 입력해주세요.'
      );
    }
  }

  // 데이터베이스 준비 대기
  function waitForDatabaseReady() {
    return new Promise((resolve) => {
      // IndexedDB 로딩 오버레이가 사라질 때까지 대기
      const checkInterval = setInterval(() => {
        const loadingOverlay = document.querySelector('.loading-overlay');
        if (!loadingOverlay || loadingOverlay.style.display === 'none' || loadingOverlay.hidden) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);

      // 최대 30초 대기
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 30000);
    });
  }

  // 기본 정보 입력
  function fillBasicInfo(ciomsData) {
    const reportInfo = ciomsData.보고서_정보 || {};

    // 제조업체 관리번호
    const controlNoInput = document.querySelector('input[placeholder*="관리번호"], input[name*="control"], input[id*="control"]');
    if (controlNoInput && reportInfo.Manufacturer_Control_No) {
      controlNoInput.value = reportInfo.Manufacturer_Control_No;
      controlNoInput.dispatchEvent(new Event('input', { bubbles: true }));
      controlNoInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 접수일 (DD/MM/YYYY → YYYY-MM-DD 변환)
    const dateInput = document.querySelector('input[type="date"], input[placeholder*="접수일"], input[name*="date"]');
    if (dateInput && reportInfo.Date_Received_by_Manufacturer) {
      const dateStr = reportInfo.Date_Received_by_Manufacturer;
      if (dateStr.includes('/')) {
        const [day, month, year] = dateStr.split('/');
        const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        dateInput.value = isoDate;
      } else {
        dateInput.value = dateStr;
      }
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // 환자 정보 입력
  function fillPatientInfo(ciomsData) {
    const patientInfo = ciomsData.환자_정보 || {};

    // 환자 이니셜
    const initialsInput = document.querySelector('input[placeholder*="이니셜"], input[name*="initials"], input[id*="initials"]');
    if (initialsInput && patientInfo.Initials) {
      initialsInput.value = patientInfo.Initials;
      initialsInput.dispatchEvent(new Event('input', { bubbles: true }));
      initialsInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 국가
    const countryInput = document.querySelector('input[placeholder*="국가"], input[name*="country"], input[id*="country"]');
    if (countryInput && patientInfo.Country) {
      countryInput.value = patientInfo.Country;
      countryInput.dispatchEvent(new Event('input', { bubbles: true }));
      countryInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 나이 (예: "62 Years" → "62")
    const ageInput = document.querySelector('input[placeholder*="나이"], input[name*="age"], input[id*="age"]');
    if (ageInput && patientInfo.Age) {
      const ageStr = patientInfo.Age.toString().replace(/\s*Years?/i, '').trim();
      ageInput.value = ageStr;
      ageInput.dispatchEvent(new Event('input', { bubbles: true }));
      ageInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 성별
    const sexSelect = document.querySelector('select[name*="sex"], select[id*="sex"], select[placeholder*="성별"]');
    if (sexSelect && patientInfo.Sex) {
      const sexValue = patientInfo.Sex.toUpperCase();
      // M → 남성, F → 여성
      const options = Array.from(sexSelect.options);
      for (const option of options) {
        if (option.value.includes(sexValue) || option.textContent.includes(sexValue)) {
          sexSelect.value = option.value;
          sexSelect.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }
      }
    }
  }

  // 유해 반응 입력
  async function fillReactions(ciomsData) {
    const reactions = ciomsData.반응_정보?.Adverse_Reactions || [];
    if (reactions.length === 0) return;

    // 첫 번째 반응 입력란 찾기
    const firstReactionEN = document.querySelector('input[placeholder*="NAUSEA"], input[placeholder*="반응명"][placeholder*="영어"]');
    const firstReactionKO = document.querySelector('input[placeholder*="오심"], input[placeholder*="반응명"][placeholder*="한글"]');

    if (!firstReactionEN || !firstReactionKO) {
      console.warn('[AutoFill] 반응 입력란을 찾을 수 없습니다');
      return;
    }

    // 첫 번째 반응 입력
    if (reactions[0]) {
      firstReactionEN.value = reactions[0].english || '';
      firstReactionKO.value = reactions[0].korean || '';
      firstReactionEN.dispatchEvent(new Event('input', { bubbles: true }));
      firstReactionKO.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // 나머지 반응들 추가
    for (let i = 1; i < reactions.length; i++) {
      await sleep(200);

      // 부작용 추가 버튼 찾기
      const addButton = document.querySelector('button[type="button"]');
      const addButtons = Array.from(document.querySelectorAll('button[type="button"]'));
      const reactionAddBtn = addButtons.find(btn =>
        btn.textContent.includes('부작용 추가') || btn.textContent.includes('반응 추가')
      );

      if (reactionAddBtn) {
        reactionAddBtn.click();
        await sleep(300);

        // 새로 추가된 입력란 찾기
        const allReactionInputs = document.querySelectorAll('input[placeholder*="반응명"]');
        const reactionEN = allReactionInputs[i * 2];
        const reactionKO = allReactionInputs[i * 2 + 1];

        if (reactionEN && reactionKO) {
          reactionEN.value = reactions[i].english || '';
          reactionKO.value = reactions[i].korean || '';
          reactionEN.dispatchEvent(new Event('input', { bubbles: true }));
          reactionKO.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }
  }

  // 의심 약물 입력
  async function fillDrugs(ciomsData) {
    const suspectedDrugs = ciomsData.의심_약물_정보 || [];
    const concomitantDrugs = ciomsData.병용_약물_정보 || [];
    const allDrugs = [...suspectedDrugs, ...concomitantDrugs];

    if (allDrugs.length === 0) return;

    // 첫 번째 약물 입력란 찾기
    const firstDrugEN = document.querySelector('input[placeholder*="Aspirin"], input[placeholder*="약물명"][placeholder*="영어"]');
    const firstDrugKO = document.querySelector('input[placeholder*="아스피린"], input[placeholder*="약물명"][placeholder*="한글"]');
    const firstIndicationEN = document.querySelector('input[placeholder*="Pain relief"], input[placeholder*="적응증"][placeholder*="영어"]');
    const firstIndicationKO = document.querySelector('input[placeholder*="진통"], input[placeholder*="적응증"][placeholder*="한글"]');

    if (!firstDrugEN || !firstDrugKO) {
      console.warn('[AutoFill] 약물 입력란을 찾을 수 없습니다');
      return;
    }

    // 첫 번째 약물 입력
    if (allDrugs[0]) {
      const drug = allDrugs[0];
      firstDrugEN.value = drug.drug_name?.english || '';
      firstDrugKO.value = drug.drug_name?.korean || '';
      firstDrugEN.dispatchEvent(new Event('input', { bubbles: true }));
      firstDrugKO.dispatchEvent(new Event('input', { bubbles: true }));

      if (firstIndicationEN && drug.indication) {
        firstIndicationEN.value = drug.indication.english || '';
        firstIndicationEN.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (firstIndicationKO && drug.indication) {
        firstIndicationKO.value = drug.indication.korean || '';
        firstIndicationKO.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // 의심 약물 vs 병용 약물 선택
      const firstTypeSelect = document.querySelector('select[name*="type"], select[name*="구분"]');
      if (firstTypeSelect) {
        const isSuspected = suspectedDrugs.includes(drug);
        firstTypeSelect.value = isSuspected ? '의심 약물' : '병용 약물';
        firstTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // 나머지 약물들 추가
    for (let i = 1; i < allDrugs.length; i++) {
      await sleep(200);

      // 약물 추가 버튼 찾기
      const addButtons = Array.from(document.querySelectorAll('button[type="button"]'));
      const drugAddBtn = addButtons.find(btn =>
        btn.textContent.includes('약물 추가')
      );

      if (drugAddBtn) {
        drugAddBtn.click();
        await sleep(300);

        // 새로 추가된 입력란 찾기
        const allDrugInputs = document.querySelectorAll('input[placeholder*="약물명"]');
        const drugEN = allDrugInputs[i * 2];
        const drugKO = allDrugInputs[i * 2 + 1];

        if (drugEN && drugKO) {
          const drug = allDrugs[i];
          drugEN.value = drug.drug_name?.english || '';
          drugKO.value = drug.drug_name?.korean || '';
          drugEN.dispatchEvent(new Event('input', { bubbles: true }));
          drugKO.dispatchEvent(new Event('input', { bubbles: true }));

          // 적응증 입력
          const allIndicationInputs = document.querySelectorAll('input[placeholder*="적응증"]');
          const indicationEN = allIndicationInputs[i * 2];
          const indicationKO = allIndicationInputs[i * 2 + 1];

          if (indicationEN && drug.indication) {
            indicationEN.value = drug.indication.english || '';
            indicationEN.dispatchEvent(new Event('input', { bubbles: true }));
          }
          if (indicationKO && drug.indication) {
            indicationKO.value = drug.indication.korean || '';
            indicationKO.dispatchEvent(new Event('input', { bubbles: true }));
          }

          // 의심 약물 vs 병용 약물 선택
          const typeSelects = document.querySelectorAll('select[name*="type"], select[name*="구분"]');
          const typeSelect = typeSelects[i];
          if (typeSelect) {
            const isSuspected = suspectedDrugs.includes(drug);
            typeSelect.value = isSuspected ? '의심 약물' : '병용 약물';
            typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      }
    }
  }

  // 진행 상황 오버레이 표시
  function showProgressOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'cioms-autofill-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
    `;

    overlay.innerHTML = `
      <div style="
        background: white;
        border-radius: 12px;
        padding: 2rem;
        max-width: 500px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        text-align: center;
      ">
        <div id="spinner" style="
          width: 48px;
          height: 48px;
          margin: 0 auto 1rem;
          font-size: 48px;
          animation: spin 2s linear infinite;
        ">⟳</div>
        <h2 style="
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: #1a1a1a;
        ">CIOMS 데이터 자동 입력</h2>
        <p id="progress-message" style="
          margin: 0 0 1.5rem 0;
          font-size: 1rem;
          color: #666;
        ">준비 중...</p>
        <div style="
          width: 100%;
          height: 8px;
          background: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
        ">
          <div id="progress-bar" style="
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #4f46e5, #7c3aed);
            transition: width 0.3s ease;
          "></div>
        </div>
        <p id="progress-percent" style="
          margin: 0.5rem 0 0 0;
          font-size: 0.875rem;
          color: #999;
        ">0 / 7 단계</p>
      </div>
      <style>
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>
    `;

    document.body.appendChild(overlay);
  }

  // 진행 상황 업데이트
  function updateProgress(message, step, total) {
    const messageEl = document.getElementById('progress-message');
    const barEl = document.getElementById('progress-bar');
    const percentEl = document.getElementById('progress-percent');

    if (messageEl) messageEl.textContent = message;
    if (barEl) {
      const percentage = Math.round((step / total) * 100);
      barEl.style.width = `${percentage}%`;
    }
    if (percentEl) percentEl.textContent = `${step} / ${total} 단계`;

    console.log(`[AutoFill] ${message} (${step}/${total})`);
  }

  // 진행 상황 오버레이 숨기기
  function hideProgressOverlay() {
    const overlay = document.getElementById('cioms-autofill-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s ease';
      setTimeout(() => overlay.remove(), 300);
    }
  }

  // 유틸리티: sleep
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

})();
