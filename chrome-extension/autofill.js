/**
 * MedDRA DB AutoFill - AutoFill Script (MedDRA-DB용)
 *
 * 역할:
 * 1. chrome.storage에서 CIOMS 데이터 읽기
 * 2. MedDRA-DB 사이트에 자동 로그인
 * 3. 새 폼 작성 페이지로 이동
 * 4. 폼 필드에 데이터 자동 입력
 * 5. 저장
 */

console.log('[MedDRA AutoFill] Autofill script loaded on MedDRA-DB');

// 페이지 로드 완료 시 자동 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function init() {
  console.log('[AutoFill] Initializing...');

  // storage에서 CIOMS 데이터 확인
  const result = await chrome.storage.local.get(['pendingCiomsData', 'timestamp']);

  if (!result.pendingCiomsData) {
    console.log('[AutoFill] No pending CIOMS data found');
    return;
  }

  // 데이터가 5분 이상 오래되었으면 무시
  const age = Date.now() - (result.timestamp || 0);
  if (age > 5 * 60 * 1000) {
    console.log('[AutoFill] CIOMS data too old, ignoring');
    await chrome.storage.local.remove(['pendingCiomsData', 'timestamp']);
    return;
  }

  console.log('[AutoFill] Found CIOMS data, starting autofill');

  // 자동 입력 시작
  try {
    await dbAutoFill(result.pendingCiomsData);

    // 성공 후 storage 정리
    await chrome.storage.local.remove(['pendingCiomsData', 'timestamp']);

  } catch (error) {
    console.error('[AutoFill] Autofill failed:', error);
    alert(`자동 입력 실패: ${error.message}`);
  }
}

/**
 * DB 자동 입력 메인 함수
 */
async function dbAutoFill(ciomsData) {
  console.log('🚀 MedDRA-DB 자동 입력 시작...\n');

  try {
    // Step 1: 데이터베이스 로딩 대기
    console.log('📄 MedDRA-DB 사이트 로딩 중...');
    await waitForElementHidden('.loading-overlay', 30000);
    console.log('  ✓ 데이터베이스 로딩 완료');
    await sleep(2000);

    // Step 2: 로그인
    console.log('🔐 로그인 중...');
    await performLogin();
    await sleep(3000);

    // Step 3: 새 폼 추가 페이지로 이동
    console.log('\n📝 새 폼 작성 페이지로 이동...');
    await navigateToNewForm();
    await sleep(2000);

    // Step 4: 폼 필드에 데이터 입력
    console.log('\n📋 폼 필드 입력 중...\n');
    const formData = mapCiomsDataToFormFields(ciomsData);
    await fillFormFields(formData);

    // Step 5: 저장
    console.log('\n💾 저장 중...');
    await saveForm();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ DB 자동 입력 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    throw error;
  }
}

/**
 * 로그인 수행
 */
async function performLogin() {
  const usernameInput = await waitForElement('input[type="text"], input[name*="user"], input[id*="user"]', 10000);
  const passwordInput = await waitForElement('input[type="password"]', 10000);

  if (usernameInput && usernameInput.offsetParent !== null) {
    setInputValue(usernameInput, 'acuzen');
    console.log('  ✓ 아이디 입력');
  }

  if (passwordInput && passwordInput.offsetParent !== null) {
    setInputValue(passwordInput, 'acuzen');
    console.log('  ✓ 비밀번호 입력');
  }

  const loginButton = await waitForElement('button[type="submit"], button:has-text("로그인"), input[type="submit"]', 5000);
  if (loginButton && loginButton.offsetParent !== null) {
    loginButton.click();
    console.log('  ✓ 로그인 버튼 클릭');
  }
}

/**
 * 새 폼 작성 페이지로 이동
 */
async function navigateToNewForm() {
  // 방법 1: 링크 클릭 시도
  const newFormLink = document.querySelector('a[href="form-edit.html"], a:has-text("새 폼 추가")');

  if (newFormLink && newFormLink.offsetParent !== null) {
    newFormLink.click();
    console.log('  ✓ 새 폼 추가 링크 클릭');
  } else {
    // 방법 2: 직접 URL 이동
    window.location.href = 'https://cjlee-cmd.github.io/MedDRA-DB/form-edit.html';
    console.log('  ✓ form-edit.html로 직접 이동');
  }
}

/**
 * 폼 필드 입력
 */
async function fillFormFields(formData) {
  // 기본 필드 입력 (반응 제외)
  const { reactions, ...basicFields } = formData;

  for (const [fieldName, value] of Object.entries(basicFields)) {
    try {
      const input = document.querySelector(`[name="${fieldName}"], #${fieldName}`);

      if (!input || input.offsetParent === null) {
        console.log(`  ⚠️ ${fieldName}: 필드를 찾을 수 없습니다`);
        continue;
      }

      const tagName = input.tagName.toLowerCase();

      if (tagName === 'select') {
        // Select 요소
        const options = Array.from(input.options).map(opt => ({ value: opt.value, text: opt.text }));
        const matchingOption = options.find(opt =>
          opt.value === value || opt.text === value || opt.value.includes(value)
        );

        if (matchingOption) {
          input.value = matchingOption.value;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`  ✓ ${fieldName}: ${matchingOption.text || matchingOption.value} (선택)`);
        } else {
          console.log(`  ⚠️ ${fieldName}: ${value} 옵션 없음`);
        }

      } else {
        // Input 또는 Textarea
        setInputValue(input, value);
        const displayValue = value.length > 30 ? value.substring(0, 30) + '...' : value;
        console.log(`  ✓ ${fieldName}: ${displayValue}`);
      }

      await sleep(300);

    } catch (error) {
      console.log(`  ⚠️ ${fieldName}: 입력 실패 - ${error.message}`);
    }
  }

  // 반응 정보 입력
  if (formData.reactions && formData.reactions.length > 0) {
    console.log('\n📋 반응 정보 입력 중...\n');

    for (let i = 0; i < formData.reactions.length; i++) {
      const reaction = formData.reactions[i];
      const index = i + 1;

      console.log(`  반응 ${index}:`);

      // 첫 번째 반응이 아니면 "부작용 추가" 버튼 클릭
      if (i > 0) {
        const addButton = document.querySelector('button:contains("+ 부작용 추가")');
        if (addButton && addButton.offsetParent !== null) {
          console.log(`    → 부작용 추가 버튼 클릭`);
          addButton.click();
          await sleep(500);
        }
      }

      // 영어 반응명 입력
      const reactionEnField = document.querySelector(`[name="reaction_en_${index}"]`);
      if (reactionEnField && reactionEnField.offsetParent !== null) {
        setInputValue(reactionEnField, reaction.en || '');
        console.log(`    ✓ 영어: ${reaction.en || 'N/A'}`);
      }

      // 한글 반응명 입력
      const reactionKoField = document.querySelector(`[name="reaction_ko_${index}"]`);
      if (reactionKoField && reactionKoField.offsetParent !== null) {
        setInputValue(reactionKoField, reaction.ko || '');
        console.log(`    ✓ 한글: ${reaction.ko || 'N/A'}`);
      }

      await sleep(300);
    }

    console.log(`\n  ✅ 총 ${formData.reactions.length}개 반응 입력 완료\n`);
  }
}

/**
 * 폼 저장
 */
async function saveForm() {
  const saveButton = Array.from(document.querySelectorAll('button')).find(btn =>
    btn.textContent.includes('저장') && !btn.textContent.includes('임시')
  );

  if (saveButton && saveButton.offsetParent !== null) {
    saveButton.click();
    console.log('  ✓ 저장 버튼 클릭');
    await sleep(3000);
  } else {
    console.log('  ⚠️ 저장 버튼을 찾을 수 없습니다');
  }
}

/**
 * CIOMS 데이터를 폼 필드 형식으로 변환
 */
function mapCiomsDataToFormFields(ciomsData) {
  const formData = {};

  // 기본 정보
  const basicInfo = ciomsData.기본_정보 || {};
  formData.manufacturer_control_no = basicInfo.제조업체_관리번호 || '';
  formData.date_received = basicInfo.접수일 || formatDate(new Date());

  // 환자 정보
  const patientInfo = ciomsData.환자_정보 || {};
  formData.patient_initials = patientInfo.환자_이니셜 || '';
  formData.patient_country = patientInfo.국가 || 'KR';
  formData.patient_age = patientInfo.나이 || '';
  formData.patient_sex = patientInfo.성별 || '';

  // 유해 반응 정보
  const reactions = ciomsData.반응_정보?.Adverse_Reactions || [];
  formData.reactions = reactions.map(reaction => ({
    en: reaction.영어 || reaction.korean || '',
    ko: reaction.korean || reaction.영어 || ''
  }));

  // 의약품 정보
  const drugs = ciomsData.의약품_정보?.약물_목록 || [];
  if (drugs.length > 0) {
    const firstDrug = drugs[0];
    formData.drug_name_en_1 = firstDrug.약물명_영어 || firstDrug.약물명 || '';
    formData.drug_name_ko_1 = firstDrug.약물명 || firstDrug.약물명_영어 || '';
    formData.indication_en_1 = firstDrug.적응증_영어 || firstDrug.적응증 || '';
    formData.indication_ko_1 = firstDrug.적응증 || firstDrug.적응증_영어 || '';
    formData.is_suspected_1 = firstDrug.의심약물 === true ? 'S' : 'C';
  }

  // 인과성 평가
  const causality = ciomsData.인과성_평가 || {};
  formData.causality_method = causality.평가방법 || 'WHO-UMC';
  formData.causality_category = causality.평가결과 || '';
  formData.causality_reason = causality.평가근거 || '';
  formData.causality_assessed_by = causality.평가자 || '';
  formData.causality_assessed_date = causality.평가일 || formatDate(new Date());

  return formData;
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 요소가 DOM에 나타날 때까지 대기
 */
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

/**
 * 요소가 숨겨질 때까지 대기
 */
function waitForElementHidden(selector, timeout = 10000) {
  return new Promise((resolve) => {
    const checkHidden = () => {
      const element = document.querySelector(selector);
      if (!element || element.offsetParent === null) {
        return true;
      }
      return false;
    };

    if (checkHidden()) {
      resolve();
      return;
    }

    const observer = new MutationObserver(() => {
      if (checkHidden()) {
        observer.disconnect();
        clearTimeout(timer);
        resolve();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      resolve();
    }, timeout);
  });
}

/**
 * Input 값 설정 (이벤트 트리거 포함)
 */
function setInputValue(element, value) {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Sleep 함수
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 날짜 포맷 (YYYY-MM-DD)
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// :contains() 선택자 폴리필 (querySelector에서 사용 불가하므로 별도 구현)
Element.prototype.matches = Element.prototype.matches || Element.prototype.msMatchesSelector;
