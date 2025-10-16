const { chromium } = require('playwright');

/**
 * DB 자동 입력 통합 테스트 스크립트
 *
 * 전체 워크플로우 테스트:
 * 1. 로그인
 * 2. PDF 업로드 및 CIOMS 데이터 추출
 * 3. DB 자동 입력 버튼 클릭
 * 4. 백엔드 API 호출 및 Playwright 자동화 실행
 */

(async () => {
  console.log('🚀 DB 자동 입력 통합 테스트 시작...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 }
  });

  const page = await context.newPage();

  try {
    console.log('Step 1: 로그인 페이지 접속...');
    await page.goto('http://127.0.0.1:8000/index.html?nocache=' + Date.now());

    console.log('Step 2: 로그인 중...');
    await page.fill('#username', 'acuzen');
    await page.fill('#password', 'acuzen');
    await page.click('button[type="submit"]');

    console.log('Step 3: 메인 페이지 로딩...');
    await page.waitForTimeout(3000);

    console.log('Step 4: PDF 파일 업로드...');
    const pdfPath = '/Users/cjlee/Downloads/MedDRA_28_1_Korean/docs/CIOMS-I-Form_example 1.pdf';

    const fileInput = await page.locator('#file-upload');
    await fileInput.setInputFiles(pdfPath);

    console.log('Step 5: PDF 분석 및 자동 검색 대기...');
    await page.waitForTimeout(20000);

    console.log('\nStep 6: DB 자동 입력 버튼 찾기...');
    const dbButton = await page.locator('#db-autofill-button');

    if (await dbButton.isVisible()) {
      console.log('  ✓ DB 자동 입력 버튼 확인');

      // Alert 핸들링 (확인 메시지)
      page.on('dialog', async dialog => {
        console.log(`\n📬 Alert: ${dialog.type()}`);
        console.log(`   메시지: "${dialog.message().substring(0, 100)}..."`);
        await dialog.accept();
      });

      console.log('\nStep 7: DB 자동 입력 버튼 클릭...');
      await dbButton.click();

      console.log('Step 8: 백엔드 처리 대기 중...');
      console.log('  → 백엔드 API 호출');
      console.log('  → Playwright 스크립트 실행');
      console.log('  → MedDRA-DB 사이트 자동 입력');

      // 충분한 시간 대기 (Playwright 자동화 완료 대기)
      await page.waitForTimeout(60000); // 1분

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ 통합 테스트 완료!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n확인 사항:');
      console.log('  1. PDF가 정상적으로 업로드되었는지');
      console.log('  2. CIOMS 데이터가 추출되었는지');
      console.log('  3. DB 자동 입력 버튼이 동작했는지');
      console.log('  4. 백엔드 API가 호출되었는지');
      console.log('  5. Playwright 자동화가 실행되었는지');
      console.log('  6. MedDRA-DB 사이트에 데이터가 입력되었는지');

    } else {
      console.log('  ❌ DB 자동 입력 버튼을 찾을 수 없습니다');
    }

    console.log('\n⏰ 2분 후 자동으로 종료됩니다');
    console.log('   (수동으로 닫아도 됩니다)\n');

    // 2분 대기
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
