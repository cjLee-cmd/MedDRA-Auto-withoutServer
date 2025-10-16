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
    slowMo: 500 // 동작을 천천히 실행하여 관찰 가능하게 함
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 }
  });

  // MedDRA-DB 사이트용 페이지 (오른쪽)
  const page = await context.newPage();

  // 로컬 앱용 페이지 (왼쪽) - 나란히 배치를 위해
  const localPage = await context.newPage();

  // 브라우저 창 위치 조정 (나란히 배치)
  const screenWidth = 1920; // 일반적인 모니터 너비
  const halfWidth = Math.floor(screenWidth / 2);

  // 로컬 앱을 왼쪽에 배치
  await localPage.setViewportSize({ width: halfWidth, height: 1000 });
  await localPage.goto('http://127.0.0.1:8000/main.html');

  try {
    // Step 1: MedDRA-DB 사이트 접속
    console.log('📄 MedDRA-DB 사이트 접속...');
    await page.goto('https://cjlee-cmd.github.io/MedDRA-DB/');
    await page.waitForTimeout(2000);

    // Step 2: 로그인
    console.log('🔐 로그인 중...');
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

    await page.waitForTimeout(3000);

    // Step 3: '새 폼 추가' 링크 클릭하여 form-edit.html로 이동
    console.log('\n📝 새 폼 작성 페이지로 이동...');
    const newFormLink = await page.locator('a[href="form-edit.html"], a:has-text("새 폼 추가")').first();

    if (await newFormLink.isVisible()) {
      await newFormLink.click();
      console.log('  ✓ 새 폼 추가 링크 클릭');
      await page.waitForTimeout(2000);
    } else {
      // 직접 URL로 이동
      await page.goto('https://cjlee-cmd.github.io/MedDRA-DB/form-edit.html');
      console.log('  ✓ form-edit.html로 직접 이동');
      await page.waitForTimeout(2000);
    }

    // Step 4: 폼 필드에 데이터 입력
    console.log('\n📋 폼 필드 입력 중...\n');

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

    // Step 4.5: 여러 반응 입력 처리
    if (formData.reactions && formData.reactions.length > 0) {
      console.log('\n📋 반응 정보 입력 중...\n');

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
            await page.waitForTimeout(500);
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

        await page.waitForTimeout(300);
      }

      console.log(`\n  ✅ 총 ${formData.reactions.length}개 반응 입력 완료\n`);
    }

    // Step 5: 저장 버튼 클릭
    console.log('\n💾 저장 중...');
    const saveButton = await page.locator('button:has-text("저장")').last(); // "임시 저장"이 아닌 "저장" 버튼

    if (await saveButton.isVisible()) {
      await saveButton.click();
      console.log('  ✓ 저장 버튼 클릭');
      await page.waitForTimeout(3000);
    } else {
      console.log('  ⚠️ 저장 버튼을 찾을 수 없습니다');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ DB 자동 입력 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⏰ 5분 후 자동으로 종료됩니다');
    console.log('   (수동으로 닫아도 됩니다)\n');

    // 5분 대기 (결과 확인을 위해)
    await page.waitForTimeout(300000);

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.log('\n스택 트레이스:');
    console.log(error.stack);
  } finally {
    await browser.close();
    console.log('\n👋 브라우저를 닫았습니다.');
  }
}

/**
 * CIOMS 데이터를 MedDRA-DB 폼 필드 형식으로 변환
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
  formData.patient_sex = patientInfo.성별 || ''; // M, F, U

  // 유해 반응 정보 (모든 반응 처리)
  const reactions = ciomsData.반응_정보?.Adverse_Reactions || [];
  formData.reactions = reactions.map(reaction => ({
    en: reaction.영어 || reaction.korean || '',
    ko: reaction.korean || reaction.영어 || ''
  }));

  // 의약품 정보 (첫 번째 약물만 사용)
  const drugs = ciomsData.의약품_정보?.약물_목록 || [];
  if (drugs.length > 0) {
    const firstDrug = drugs[0];
    formData.drug_name_en_1 = firstDrug.약물명_영어 || firstDrug.약물명 || '';
    formData.drug_name_ko_1 = firstDrug.약물명 || firstDrug.약물명_영어 || '';
    formData.indication_en_1 = firstDrug.적응증_영어 || firstDrug.적응증 || '';
    formData.indication_ko_1 = firstDrug.적응증 || firstDrug.적응증_영어 || '';

    // 의심 약물 여부 (S: Suspected, C: Concomitant)
    formData.is_suspected_1 = firstDrug.의심약물 === true ? 'S' : 'C';
  }

  // 인과성 평가 정보
  const causality = ciomsData.인과성_평가 || {};
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
