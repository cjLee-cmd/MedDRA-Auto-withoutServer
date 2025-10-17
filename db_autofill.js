const { chromium } = require('playwright');

/**
 * MedDRA-DB 사이트에 CIOMS 데이터를 자동으로 입력하는 스크립트
 *
 * 사용법:
 * node db_autofill.js [cioms_data_json]
 *
 * 예시:
 * node db_autofill.js '{"환자_정보":{"환자_이니셜":"J.S."},...}'
 */

// 명령줄 인자에서 CIOMS 데이터 가져오기
const ciomsDataArg = process.argv[2];
let ciomsData = null;

if (ciomsDataArg) {
  try {
    ciomsData = JSON.parse(ciomsDataArg);
    console.log('✓ CIOMS 데이터를 인자로부터 받았습니다\n');
  } catch (e) {
    console.error('❌ CIOMS 데이터 JSON 파싱 실패:', e.message);
    process.exit(1);
  }
}

async function dbAutoFill(providedCiomsData = null) {
  const finalCiomsData = providedCiomsData || ciomsData;
  console.log('🚀 MedDRA-DB 자동 입력 시작...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300 // 동작을 약간 천천히 실행하여 관찰 가능하게 함
  });

  const context = await browser.newContext({
    viewport: { width: 1200, height: 1000 }
  });

  // MedDRA-DB 사이트용 페이지 먼저 생성
  const page = await context.newPage();

  // 새 탭이 열리는 것을 방지하기 위해 popup 이벤트 차단
  context.on('page', async (newPage) => {
    console.log('  → 불필요한 새 탭 차단');
    await newPage.close();
  });

  // 페이지에 진행 상황 표시 함수 주입
  async function showProgress(message, step, total) {
    await page.evaluate(({msg, s, t}) => {
      let overlay = document.getElementById('autofill-progress-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'autofill-progress-overlay';
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
        document.body.appendChild(overlay);
      }

      const percentage = Math.round((s / t) * 100);

      overlay.innerHTML = `
        <div style="
          background: white;
          border-radius: 12px;
          padding: 40px 60px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          max-width: 500px;
          text-align: center;
        ">
          <div style="
            font-size: 48px;
            margin-bottom: 20px;
            animation: spin 2s linear infinite;
          ">⟳</div>
          <h2 style="
            margin: 0 0 10px 0;
            font-size: 24px;
            color: #2563eb;
          ">자동 입력 진행 중...</h2>
          <p style="
            margin: 0 0 20px 0;
            font-size: 16px;
            color: #64748b;
          ">${msg}</p>
          <div style="
            width: 100%;
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 10px;
          ">
            <div style="
              width: ${percentage}%;
              height: 100%;
              background: linear-gradient(90deg, #3b82f6, #2563eb);
              transition: width 0.3s ease;
            "></div>
          </div>
          <p style="
            margin: 0;
            font-size: 14px;
            color: #94a3b8;
          ">${s} / ${t} 단계 (${percentage}%)</p>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
    }, {msg: message, s: step, t: total});

    console.log(`[${step}/${total}] ${message}`);
  }

  async function hideProgress() {
    await page.evaluate(() => {
      const overlay = document.getElementById('autofill-progress-overlay');
      if (overlay) {
        overlay.remove();
      }
    });
  }

  try {
    const totalSteps = 7; // 총 단계 수
    let currentStep = 0;

    // Step 1: MedDRA-DB 사이트 접속
    currentStep++;
    await showProgress('MedDRA-DB 사이트 접속 중...', currentStep, totalSteps);
    await page.goto('https://cjlee-cmd.github.io/MedDRA-DB/');

    // 데이터베이스 로딩 팝업이 사라질 때까지 대기
    currentStep++;
    await showProgress('데이터베이스 로딩 대기 중...', currentStep, totalSteps);
    try {
      // "데이터베이스를 열고 있습니다" 오버레이가 사라질 때까지 대기 (최대 30초)
      await page.waitForSelector('.loading-overlay', { state: 'hidden', timeout: 30000 });
      console.log('  ✓ 데이터베이스 로딩 완료');
    } catch (timeoutError) {
      console.log('  ⚠️ 로딩 오버레이 타임아웃 (계속 진행)');
    }
    await page.waitForTimeout(1000);

    // Step 3: 로그인
    currentStep++;
    await showProgress('로그인 중...', currentStep, totalSteps);

    const usernameInput = await page.locator('input[type="text"], input[name*="user"], input[id*="user"]').first();
    const passwordInput = await page.locator('input[type="password"]').first();

    if (await usernameInput.isVisible()) {
      await usernameInput.fill('acuzen');
      console.log('  ✓ 아이디 입력');
    }

    if (await passwordInput.isVisible()) {
      await passwordInput.fill('acuzen');
      console.log('  ✓ 비밀번호 입력');
    }

    const loginButton = await page.locator('button[type="submit"], button:has-text("로그인"), input[type="submit"]').first();
    if (await loginButton.isVisible()) {
      await loginButton.click();
      console.log('  ✓ 로그인 버튼 클릭');
    }

    await page.waitForTimeout(2000);

    // Step 4: '새 폼 추가' 링크 클릭하여 form-edit.html로 이동
    currentStep++;
    await showProgress('새 폼 작성 페이지로 이동 중...', currentStep, totalSteps);

    const newFormLink = await page.locator('a[href="form-edit.html"], a:has-text("새 폼 추가")').first();

    if (await newFormLink.isVisible()) {
      await newFormLink.click();
      console.log('  ✓ 새 폼 추가 링크 클릭');
      await page.waitForTimeout(1500);
    } else {
      // 직접 URL로 이동
      await page.goto('https://cjlee-cmd.github.io/MedDRA-DB/form-edit.html');
      console.log('  ✓ form-edit.html로 직접 이동');
      await page.waitForTimeout(1500);
    }

    // Step 5: 폼 필드에 데이터 입력
    currentStep++;
    await showProgress('기본 정보 입력 중...', currentStep, totalSteps);

    // CIOMS 데이터가 있으면 사용, 없으면 샘플 데이터 사용
    let formData;

    if (finalCiomsData) {
      console.log('  ✓ 실제 CIOMS 데이터 사용\n');

      // CIOMS 데이터를 폼 필드 형식으로 변환
      formData = mapCiomsDataToFormFields(finalCiomsData);
    } else {
      console.log('  ⚠️ CIOMS 데이터 없음 - 샘플 데이터 사용\n');

      // 샘플 CIOMS 데이터
      formData = {
        manufacturer_control_no: 'ACUZEN-2024-001',
        date_received: '2024-01-15',
        patient_initials: 'J.S.',
        patient_country: 'KR',
        patient_age: '45',
        patient_sex: 'M',
        reactions: [
          { en: 'Anemia', ko: '빈혈' },
          { en: 'Headache', ko: '두통' },
          { en: 'Nausea', ko: '오심' }
        ],
        drug_name_en_1: 'Aspirin',
        drug_name_ko_1: '아스피린',
        indication_en_1: 'Pain relief',
        indication_ko_1: '통증 완화',
        is_suspected_1: 'S',
        causality_method: 'WHO-UMC',
        causality_category: 'Probable',
        causality_reason: 'Temporal relationship established. No other obvious cause.',
        causality_assessed_by: 'Dr. Kim',
        causality_assessed_date: '2024-01-20'
      };
    }

    // 기본 필드 입력 (반응 제외)
    const { reactions, ...basicFields } = formData;

    for (const [fieldName, value] of Object.entries(basicFields)) {
      try {
        const input = await page.locator(`[name="${fieldName}"], #${fieldName}`).first();

        if (await input.isVisible()) {
          const tagName = await input.evaluate(el => el.tagName.toLowerCase());
          const type = await input.getAttribute('type');

          if (tagName === 'select') {
            // select 요소인 경우 - 실제 사이트의 옵션 확인 후 선택
            try {
              // 먼저 옵션 목록 확인
              const options = await input.evaluate(el =>
                Array.from(el.options).map(opt => ({ value: opt.value, text: opt.text }))
              );

              // value가 옵션에 있는지 확인
              const matchingOption = options.find(opt =>
                opt.value === value || opt.text === value || opt.value.includes(value)
              );

              if (matchingOption) {
                await input.selectOption({ value: matchingOption.value });
                console.log(`  ✓ ${fieldName}: ${matchingOption.text || matchingOption.value} (선택)`);
              } else {
                // 첫 번째 옵션 선택 (기본값)
                if (options.length > 0 && options[0].value) {
                  await input.selectOption({ value: options[0].value });
                  console.log(`  ⚠️ ${fieldName}: ${value} 옵션 없음, 기본값 선택 (${options[0].text})`);
                } else {
                  console.log(`  ⚠️ ${fieldName}: 옵션을 선택할 수 없습니다`);
                }
              }
            } catch (selectError) {
              console.log(`  ⚠️ ${fieldName}: 선택 실패 - ${selectError.message}`);
            }
          } else if (tagName === 'textarea') {
            // textarea 요소인 경우
            await input.fill(value);
            console.log(`  ✓ ${fieldName}: ${value.substring(0, 30)}${value.length > 30 ? '...' : ''}`);
          } else {
            // input 요소인 경우
            await input.fill(value);
            console.log(`  ✓ ${fieldName}: ${value}`);
          }

          await page.waitForTimeout(300); // 각 입력 사이에 짧은 대기
        } else {
          console.log(`  ⚠️ ${fieldName}: 필드를 찾을 수 없습니다`);
        }
      } catch (fieldError) {
        console.log(`  ⚠️ ${fieldName}: 입력 실패 - ${fieldError.message}`);
      }
    }

    // Step 6: 여러 반응 입력 처리
    if (formData.reactions && formData.reactions.length > 0) {
      currentStep++;
      await showProgress(`유해 반응 ${formData.reactions.length}개 입력 중...`, currentStep, totalSteps);

      for (let i = 0; i < formData.reactions.length; i++) {
        const reaction = formData.reactions[i];
        const index = i + 1;

        console.log(`  반응 ${index}:`);

        // 첫 번째 반응이 아니면 "부작용 추가" 버튼 클릭
        if (i > 0) {
          console.log(`    → 부작용 추가 버튼 클릭`);
          const addButton = await page.locator('button:has-text("+ 부작용 추가")').first();
          if (await addButton.isVisible()) {
            await addButton.click();
            await page.waitForTimeout(400);
          }
        }

        // 영어 반응명 입력
        const reactionEnField = await page.locator(`[name="reaction_en_${index}"]`).first();
        if (await reactionEnField.isVisible()) {
          await reactionEnField.fill(reaction.en || '');
          console.log(`    ✓ 영어: ${reaction.en || 'N/A'}`);
        }

        // 한글 반응명 입력
        const reactionKoField = await page.locator(`[name="reaction_ko_${index}"]`).first();
        if (await reactionKoField.isVisible()) {
          await reactionKoField.fill(reaction.ko || '');
          console.log(`    ✓ 한글: ${reaction.ko || 'N/A'}`);
        }

        await page.waitForTimeout(200);
      }

      console.log(`\n  ✅ 총 ${formData.reactions.length}개 반응 입력 완료\n`);
    }

    // Step 7: 저장 버튼 클릭
    currentStep++;
    await showProgress('데이터 저장 중...', currentStep, totalSteps);

    const saveButton = await page.locator('button:has-text("저장")').last(); // "임시 저장"이 아닌 "저장" 버튼

    if (await saveButton.isVisible()) {
      await saveButton.click();
      console.log('  ✓ 저장 버튼 클릭');
      await page.waitForTimeout(2000);
    } else {
      console.log('  ⚠️ 저장 버튼을 찾을 수 없습니다');
    }

    // 진행 상황 오버레이 제거
    await hideProgress();

    // 완료 메시지 표시
    await page.evaluate(() => {
      const successOverlay = document.createElement('div');
      successOverlay.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 20px 30px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif;
        font-size: 16px;
        font-weight: 600;
        animation: slideIn 0.3s ease-out;
      `;
      successOverlay.innerHTML = '✅ 자동 입력 완료!';
      document.body.appendChild(successOverlay);

      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);

      // 5초 후 자동으로 제거
      setTimeout(() => {
        successOverlay.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => successOverlay.remove(), 300);
      }, 5000);

      const slideOutStyle = document.createElement('style');
      slideOutStyle.textContent = `
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(slideOutStyle);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ DB 자동 입력 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 브라우저가 열린 상태로 유지됩니다.');
    console.log('   수동으로 닫거나 추가 작업을 계속하실 수 있습니다.\n');

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.log('\n스택 트레이스:');
    console.log(error.stack);

    // 오류 발생 시에만 브라우저 닫기
    await browser.close();
    console.log('\n👋 오류로 인해 브라우저를 닫았습니다.');
  }
}

/**
 * CIOMS 데이터를 MedDRA-DB 폼 필드 형식으로 변환
 */
function mapCiomsDataToFormFields(ciomsData) {
  const formData = {};

  // 보고서 정보 (Report_Type, Manufacturer_Control_No, Date_Received_by_Manufacturer)
  const reportInfo = ciomsData.보고서_정보 || {};
  formData.manufacturer_control_no = reportInfo.Manufacturer_Control_No || '';

  // 날짜 형식 변환 (DD/MM/YYYY → YYYY-MM-DD)
  const dateReceived = reportInfo.Date_Received_by_Manufacturer || '';
  if (dateReceived && dateReceived.includes('/')) {
    const [day, month, year] = dateReceived.split('/');
    formData.date_received = `${year}-${month}-${day}`;
  } else {
    formData.date_received = dateReceived || formatDate(new Date());
  }

  // 환자 정보 (Initials, Country, Age, Sex)
  const patientInfo = ciomsData.환자_정보 || {};
  formData.patient_initials = patientInfo.Initials || '';
  formData.patient_country = patientInfo.Country || 'KR';

  // 나이 처리 (예: "62 Years" → "62")
  const age = patientInfo.Age || '';
  formData.patient_age = age.replace(/\s*Years?/i, '').trim();

  formData.patient_sex = patientInfo.Sex || ''; // M, F, U

  // 유해 반응 정보 (Adverse_Reactions)
  const reactions = ciomsData.반응_정보?.Adverse_Reactions || [];
  formData.reactions = reactions.map(reaction => ({
    en: reaction.english || reaction.korean || '',
    ko: reaction.korean || reaction.english || ''
  }));

  // 의심 약물 정보 (의심_약물_정보)
  const suspectedDrugs = ciomsData.의심_약물_정보 || [];
  if (suspectedDrugs.length > 0) {
    suspectedDrugs.forEach((drug, index) => {
      const drugNum = index + 1;

      // drug_name은 객체 형태 {english, korean}
      if (drug.drug_name) {
        formData[`drug_name_en_${drugNum}`] = drug.drug_name.english || '';
        formData[`drug_name_ko_${drugNum}`] = drug.drug_name.korean || '';
      }

      // indication도 객체 형태 {english, korean}
      if (drug.indication) {
        formData[`indication_en_${drugNum}`] = drug.indication.english || '';
        formData[`indication_ko_${drugNum}`] = drug.indication.korean || '';
      }

      // 의심 약물은 항상 'S' (Suspected)
      formData[`is_suspected_${drugNum}`] = 'S';
    });
  }

  // 병용 약물 정보 (병용_약물_정보)
  const concomitantDrugs = ciomsData.병용_약물_정보 || [];
  if (concomitantDrugs.length > 0) {
    const startIndex = suspectedDrugs.length + 1;
    concomitantDrugs.forEach((drug, index) => {
      const drugNum = startIndex + index;

      if (drug.drug_name) {
        formData[`drug_name_en_${drugNum}`] = drug.drug_name.english || '';
        formData[`drug_name_ko_${drugNum}`] = drug.drug_name.korean || '';
      }

      if (drug.indication) {
        formData[`indication_en_${drugNum}`] = drug.indication.english || '';
        formData[`indication_ko_${drugNum}`] = drug.indication.korean || '';
      }

      // 병용 약물은 항상 'C' (Concomitant)
      formData[`is_suspected_${drugNum}`] = 'C';
    });
  }

  // 인과성 평가 정보
  const causality = ciomsData.인과관계_평가 || {};
  formData.causality_method = causality.평가방법 || 'WHO-UMC';
  formData.causality_category = causality.평가결과 || '';
  formData.causality_reason = causality.평가근거 || '';
  formData.causality_assessed_by = causality.평가자 || '';
  formData.causality_assessed_date = causality.평가일 || formatDate(new Date());

  return formData;
}

/**
 * 날짜를 YYYY-MM-DD 형식으로 포맷
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 스크립트 실행
dbAutoFill().catch(console.error);
