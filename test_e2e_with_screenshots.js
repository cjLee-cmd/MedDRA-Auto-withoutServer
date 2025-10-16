const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

/**
 * E2E 테스트 with 스크린샷
 * 전체 워크플로우를 단계별로 스크린샷 캡처하며 테스트
 */

(async () => {
  console.log('🚀 E2E 테스트 시작 (스크린샷 포함)...\n');

  // 스크린샷 디렉토리 생성
  const screenshotDir = path.join(__dirname, 'e2e-screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 }
  });

  const page = await context.newPage();

  try {
    // Step 1: 로그인 페이지
    console.log('📸 Step 1: 로그인 페이지 접속');
    await page.goto('http://127.0.0.1:8000/index.html?nocache=' + Date.now());
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(screenshotDir, '01-login-page.png'),
      fullPage: true
    });

    // Step 2: 로그인 수행
    console.log('📸 Step 2: 로그인 수행');
    await page.fill('#username', 'acuzen');
    await page.fill('#password', 'acuzen');
    await page.screenshot({
      path: path.join(screenshotDir, '02-credentials-entered.png'),
      fullPage: true
    });

    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(screenshotDir, '03-main-page-loaded.png'),
      fullPage: true
    });

    // Step 3: PDF 업로드
    console.log('📸 Step 3: PDF 파일 업로드');
    const pdfPath = path.join(__dirname, 'docs', 'CIOMS-I-Form_example 1.pdf');

    if (fs.existsSync(pdfPath)) {
      const fileInput = await page.locator('#file-upload');
      await fileInput.setInputFiles(pdfPath);
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(screenshotDir, '04-pdf-uploading.png'),
        fullPage: true
      });

      // Step 4: PDF 분석 완료 대기
      console.log('📸 Step 4: PDF 분석 중...');
      await page.waitForTimeout(15000); // Wait for CIOMS extraction
      await page.screenshot({
        path: path.join(screenshotDir, '05-pdf-processed.png'),
        fullPage: true
      });

      // Step 5: 검색 결과 확인
      console.log('📸 Step 5: 검색 결과 확인');
      await page.waitForTimeout(5000);
      await page.screenshot({
        path: path.join(screenshotDir, '06-search-results.png'),
        fullPage: true
      });

      // Step 6: DB 자동 입력 버튼 확인
      console.log('📸 Step 6: DB 자동 입력 버튼 확인');
      const dbButton = await page.locator('#db-autofill-button');

      if (await dbButton.isVisible()) {
        // 버튼 하이라이트
        await page.evaluate(() => {
          const button = document.getElementById('db-autofill-button');
          if (button) {
            button.style.border = '3px solid #ff0000';
            button.style.boxShadow = '0 0 20px rgba(255, 0, 0, 0.8)';
          }
        });
        await page.screenshot({
          path: path.join(screenshotDir, '07-db-button-highlighted.png'),
          fullPage: true
        });

        // Step 7: DB 자동 입력 실행
        console.log('📸 Step 7: DB 자동 입력 버튼 클릭');

        // Dialog 핸들러 설정 (confirm)
        page.once('dialog', async dialog => {
          console.log(`  → Confirm 대화상자: "${dialog.message().substring(0, 50)}..."`);
          // Don't take screenshot during dialog - causes timeout
          await dialog.accept();
        });

        await dbButton.click();
        await page.waitForTimeout(2000);

        // Step 8: 백엔드 처리 중
        console.log('📸 Step 8: 백엔드 처리 중...');
        await page.screenshot({
          path: path.join(screenshotDir, '08-backend-processing.png'),
          fullPage: true
        });

        // Step 9: Playwright 자동화 실행 대기
        console.log('📸 Step 9: Playwright 자동화 실행 대기 (30초)...');
        await page.waitForTimeout(30000);

        // Step 10: 최종 상태 확인
        console.log('📸 Step 10: 최종 상태 확인');
        await page.screenshot({
          path: path.join(screenshotDir, '10-final-state.png'),
          fullPage: true
        });

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ E2E 테스트 완료!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n📸 생성된 스크린샷:');
        console.log(`  📁 위치: ${screenshotDir}`);
        console.log('  1. 01-login-page.png - 로그인 페이지');
        console.log('  2. 02-credentials-entered.png - 로그인 정보 입력');
        console.log('  3. 03-main-page-loaded.png - 메인 페이지 로딩');
        console.log('  4. 04-pdf-uploading.png - PDF 업로드');
        console.log('  5. 05-pdf-processed.png - PDF 분석 완료');
        console.log('  6. 06-search-results.png - 검색 결과');
        console.log('  7. 07-db-button-highlighted.png - DB 자동 입력 버튼');
        console.log('  8. 08-backend-processing.png - 백엔드 처리');
        console.log('  9. (Confirm dialog accepted - no screenshot)');
        console.log('  10. 10-final-state.png - 최종 상태');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      } else {
        console.log('  ❌ DB 자동 입력 버튼을 찾을 수 없습니다');
        await page.screenshot({
          path: path.join(screenshotDir, 'error-no-button.png'),
          fullPage: true
        });
      }
    } else {
      console.log(`  ❌ PDF 파일을 찾을 수 없습니다: ${pdfPath}`);
    }

    console.log('\n⏰ 30초 후 자동으로 종료됩니다');
    console.log('   (수동으로 닫아도 됩니다)\n');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    await page.screenshot({
      path: path.join(screenshotDir, 'error-state.png'),
      fullPage: true
    });
    console.log('\n스택 트레이스:');
    console.log(error.stack);
  } finally {
    await browser.close();
    console.log('👋 브라우저를 닫았습니다.');
  }
})();
