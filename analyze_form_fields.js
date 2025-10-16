const { chromium } = require('playwright');

/**
 * MedDRA-DB 폼 필드 상세 분석
 * 특히 나이, 성별 필드의 정확한 구조 파악
 */

(async () => {
  console.log('🔍 MedDRA-DB 폼 필드 상세 분석 시작...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 }
  });

  const page = await context.newPage();

  try {
    console.log('📄 MedDRA-DB 사이트 접속...');
    await page.goto('https://cjlee-cmd.github.io/MedDRA-DB/');
    await page.waitForTimeout(2000);

    console.log('🔐 로그인 중...');
    const usernameInput = await page.locator('input[type="text"], input[name*="user"], input[id*="user"]').first();
    const passwordInput = await page.locator('input[type="password"]').first();

    if (await usernameInput.isVisible()) {
      await usernameInput.fill('acuzen');
    }
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('acuzen');
    }

    const loginButton = await page.locator('button[type="submit"], button:has-text("로그인")').first();
    if (await loginButton.isVisible()) {
      await loginButton.click();
      await page.waitForTimeout(3000);
    }

    console.log('📝 새 폼 작성 페이지로 이동...');
    const newFormLink = await page.locator('a[href="form-edit.html"], a:has-text("새 폼 추가")').first();
    if (await newFormLink.isVisible()) {
      await newFormLink.click();
      await page.waitForTimeout(2000);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 환자 정보 필드 상세 분석');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 나이 필드 분석
    console.log('🔍 나이 필드 분석:');
    const ageFields = await page.locator('[name*="age"], [id*="age"], select[name*="age"]').all();

    for (let i = 0; i < ageFields.length; i++) {
      const field = ageFields[i];
      const tagName = await field.evaluate(el => el.tagName.toLowerCase());
      const name = await field.getAttribute('name');
      const id = await field.getAttribute('id');
      const type = await field.getAttribute('type');

      console.log(`\n  필드 ${i + 1}:`);
      console.log(`    태그: ${tagName}`);
      console.log(`    name: ${name}`);
      console.log(`    id: ${id}`);
      console.log(`    type: ${type}`);

      if (tagName === 'select') {
        const options = await field.evaluate(el =>
          Array.from(el.options).map(opt => ({ value: opt.value, text: opt.text }))
        );
        console.log(`    옵션 개수: ${options.length}`);
        console.log(`    옵션 목록:`);
        options.slice(0, 10).forEach(opt => {
          console.log(`      - value="${opt.value}", text="${opt.text}"`);
        });
        if (options.length > 10) {
          console.log(`      ... (${options.length - 10}개 더)`);
        }
      }
    }

    // 성별 필드 분석
    console.log('\n🔍 성별 필드 분석:');
    const sexFields = await page.locator('[name*="sex"], [id*="sex"], [name*="gender"], select[name*="sex"]').all();

    for (let i = 0; i < sexFields.length; i++) {
      const field = sexFields[i];
      const tagName = await field.evaluate(el => el.tagName.toLowerCase());
      const name = await field.getAttribute('name');
      const id = await field.getAttribute('id');
      const type = await field.getAttribute('type');

      console.log(`\n  필드 ${i + 1}:`);
      console.log(`    태그: ${tagName}`);
      console.log(`    name: ${name}`);
      console.log(`    id: ${id}`);
      console.log(`    type: ${type}`);

      if (tagName === 'select') {
        const options = await field.evaluate(el =>
          Array.from(el.options).map(opt => ({ value: opt.value, text: opt.text }))
        );
        console.log(`    옵션 목록:`);
        options.forEach(opt => {
          console.log(`      - value="${opt.value}", text="${opt.text}"`);
        });
      }
    }

    // 반응 필드 분석 (여러 개 가능한지 확인)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 반응 정보 필드 분석');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const reactionFields = await page.locator('[name*="reaction"], [id*="reaction"]').all();
    console.log(`반응 필드 개수: ${reactionFields.length}\n`);

    for (let i = 0; i < reactionFields.length; i++) {
      const field = reactionFields[i];
      const name = await field.getAttribute('name');
      const id = await field.getAttribute('id');
      console.log(`  ${i + 1}. name="${name}", id="${id}"`);
    }

    // 반응 추가 버튼 찾기
    console.log('\n🔍 반응 추가 버튼 찾기:');
    const addButtons = await page.locator('button:has-text("추가"), button:has-text("Add"), button[id*="add"], button[class*="add"]').all();
    console.log(`추가 버튼 후보 개수: ${addButtons.length}\n`);

    for (let i = 0; i < addButtons.length; i++) {
      const btn = addButtons[i];
      const text = await btn.textContent();
      const id = await btn.getAttribute('id');
      const classes = await btn.getAttribute('class');
      console.log(`  ${i + 1}. text="${text.trim()}", id="${id}", class="${classes}"`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ 분석 완료!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    console.log('\n⏰ 2분 후 자동으로 종료됩니다\n');
    await page.waitForTimeout(120000);

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.log('\n스택 트레이스:');
    console.log(error.stack);
  } finally {
    await browser.close();
    console.log('\n👋 브라우저를 닫았습니다.');
  }
})();
