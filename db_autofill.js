const { chromium } = require('playwright');

/**
 * MedDRA-DB 사이트에 CIOMS 데이터를 자동으로 입력하는 스크립트
 *
 * 사용법:
 * node db_autofill.js
 */

async function dbAutoFill() {
  console.log('🚀 MedDRA-DB 자동 입력 시작...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500 // 동작을 천천히 실행하여 관찰 가능하게 함
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 }
  });

  const page = await context.newPage();

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

    // 샘플 CIOMS 데이터 (실제로는 script.js의 autoSearchState.ciomsData에서 가져옴)
    const sampleData = {
      manufacturer_control_no: 'ACUZEN-2024-001',
      date_received: '2024-01-15',
      patient_initials: 'J.S.',
      patient_country: 'KR',
      patient_age: '45',
      patient_sex: 'M',
      reaction_en_1: 'Anemia',
      reaction_ko_1: '빈혈',
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

    // 각 필드에 데이터 입력
    for (const [fieldName, value] of Object.entries(sampleData)) {
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

// 스크립트 실행
dbAutoFill().catch(console.error);
