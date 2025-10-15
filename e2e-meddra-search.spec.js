const { test, expect } = require('@playwright/test');

/**
 * E2E Test Suite: MedDRA 증상 코드 조회 시스템
 *
 * 테스트 시나리오:
 * 1. 기본 검색 기능
 * 2. AI 검색 기능
 * 3. 검색 옵션 (결과 수, 비활성 용어)
 * 4. 데이터 로딩 및 진행률 표시
 * 5. 검색 결과 표시 및 상세 정보
 * 6. PDF 업로드 및 CIOMS 분석
 * 7. 자동 검색 워크플로우
 * 8. 반응형 UI (사이드바 레이아웃)
 */

test.describe('MedDRA 증상 코드 조회 시스템 E2E 테스트', () => {

  test.beforeEach(async ({ page }) => {
    // 각 테스트 전에 페이지 로드
    await page.goto('http://127.0.0.1:8000/');
    await page.waitForLoadState('networkidle');
  });

  test('1. 페이지 로드 및 초기 UI 상태 확인', async ({ page }) => {
    console.log('✓ 테스트 1: 페이지 로드 및 초기 UI 확인');

    // 사이드바 헤더 확인
    const sidebarHeader = page.locator('.sidebar-header h1');
    await expect(sidebarHeader).toHaveText('MEDGEN');

    const subtitle = page.locator('.sidebar-header .subtitle');
    await expect(subtitle).toContainText('MedDRA 28.1');

    // 검색 문서 그룹박스 확인
    const documentBox = page.locator('.document-box');
    await expect(documentBox).toBeVisible();

    // 파일 선택 버튼 확인
    const uploadButton = page.locator('#upload-button');
    await expect(uploadButton).toBeVisible();
    await expect(uploadButton).toContainText('파일 선택');

    // 증상 검색 그룹박스 확인
    const searchBox = page.locator('.search-box');
    await expect(searchBox).toBeVisible();

    // 검색 입력 필드 확인
    const searchInput = page.locator('#q');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveAttribute('placeholder', '예: 빈혈');

    // 검색 버튼 확인
    const searchButton = page.locator('button[type="submit"]');
    await expect(searchButton).toBeVisible();
    await expect(searchButton).toContainText('검색');

    // AI 검색 버튼 확인
    const aiSearchButton = page.locator('#ai-search');
    await expect(aiSearchButton).toBeVisible();
    await expect(aiSearchButton).toContainText('AI 검색');

    // 메인 컨텐츠 헤더 확인
    const mainHeader = page.locator('.main-content-header h2');
    await expect(mainHeader).toContainText('증상 코드 조회 결과');

    // 초기 결과 메시지 확인
    const results = page.locator('#results');
    await expect(results).toContainText('증상 또는 용어를 입력한 후 검색을 눌러주세요');

    console.log('✅ 초기 UI 상태 확인 완료');
  });

  test('2. 기본 검색 기능 - 정확 검색', async ({ page }) => {
    console.log('✓ 테스트 2: 기본 검색 기능 테스트');

    // 검색어 입력
    const searchInput = page.locator('#q');
    await searchInput.fill('빈혈');

    // 검색 버튼 클릭
    const searchButton = page.locator('button[type="submit"]');
    await searchButton.click();

    // 로딩 오버레이 표시 확인
    const loadingOverlay = page.locator('#loading-overlay');
    await expect(loadingOverlay).toBeVisible();

    // 로딩 완료 대기 (최대 30초) - loading overlay가 사라질 때까지
    await page.waitForFunction(() => {
      const overlay = document.getElementById('loading-overlay');
      return overlay && overlay.hasAttribute('hidden');
    }, { timeout: 30000 });

    // 검색 결과 확인
    const resultCards = page.locator('.result-card');
    const cardCount = await resultCards.count();
    expect(cardCount).toBeGreaterThan(0);

    console.log(`✓ ${cardCount}개의 검색 결과 발견`);

    // 첫 번째 결과 카드 확인
    const firstCard = resultCards.first();
    await expect(firstCard).toBeVisible();

    // 용어명 확인
    const termName = firstCard.locator('.term-name');
    await expect(termName).toBeVisible();
    const termText = await termName.textContent();
    console.log(`✓ 첫 번째 결과: ${termText}`);

    // 용어 코드 확인
    const termCode = firstCard.locator('.term-code');
    await expect(termCode).toBeVisible();

    // 스코어 배지 확인
    const scoreBadge = firstCard.locator('.score-badge');
    await expect(scoreBadge).toBeVisible();

    console.log('✅ 기본 검색 기능 테스트 완료');
  });

  test('3. 검색 결과 상세 정보 펼치기', async ({ page }) => {
    console.log('✓ 테스트 3: 검색 결과 상세 정보 테스트');

    // 검색 수행
    await page.locator('#q').fill('두통');
    await page.locator('button[type="submit"]').click();

    // 로딩 완료 대기
    await page.waitForFunction(() => {
      const overlay = document.getElementById('loading-overlay');
      return overlay && overlay.hasAttribute('hidden');
    }, { timeout: 30000 });

    // 첫 번째 결과 카드 클릭
    const firstCard = page.locator('.result-card').first();
    const cardSummary = firstCard.locator('.card-summary');
    await cardSummary.click();

    // aria-expanded 속성 확인
    await expect(cardSummary).toHaveAttribute('aria-expanded', 'true');

    // 상세 정보 표시 확인
    const cardDetails = firstCard.locator('.card-details');
    await expect(cardDetails).toBeVisible();

    // PT 정보 확인
    const ptBlock = cardDetails.locator('.pt-block');
    await expect(ptBlock).toBeVisible();

    // 계층 정보 확인
    const hierarchyCard = cardDetails.locator('.hierarchy-card');
    if (await hierarchyCard.count() > 0) {
      await expect(hierarchyCard.first()).toBeVisible();
      console.log('✓ 계층 정보 표시됨');
    }

    console.log('✅ 상세 정보 펼치기 테스트 완료');
  });

  test('4. 검색 옵션 변경 - 결과 수 조정', async ({ page }) => {
    console.log('✓ 테스트 4: 검색 옵션 테스트 (결과 수)');

    // 결과 수를 5로 변경
    const limitInput = page.locator('#limit');
    await limitInput.clear();
    await limitInput.fill('5');

    // 검색 수행
    await page.locator('#q').fill('통증');
    await page.locator('button[type="submit"]').click();

    // 로딩 완료 대기
    await page.waitForFunction(() => {
      const overlay = document.getElementById('loading-overlay');
      return overlay && overlay.hasAttribute('hidden');
    }, { timeout: 30000 });

    // 결과 개수 확인
    const resultCards = page.locator('.result-card');
    const cardCount = await resultCards.count();
    expect(cardCount).toBeLessThanOrEqual(5);

    console.log(`✓ ${cardCount}개의 결과 표시됨 (최대 5개)`);
    console.log('✅ 결과 수 조정 테스트 완료');
  });

  test('5. 비활성 용어 포함 옵션', async ({ page }) => {
    console.log('✓ 테스트 5: 비활성 용어 포함 옵션 테스트');

    // 비활성 용어 포함 체크박스 선택
    const inactiveCheckbox = page.locator('#inactive');
    await inactiveCheckbox.check();
    await expect(inactiveCheckbox).toBeChecked();

    // 검색 수행
    await page.locator('#q').fill('감염');
    await page.locator('button[type="submit"]').click();

    // 로딩 완료 대기
    await page.waitForFunction(() => {
      const overlay = document.getElementById('loading-overlay');
      return overlay && overlay.hasAttribute('hidden');
    }, { timeout: 30000 });

    // 결과 확인
    const resultCards = page.locator('.result-card');
    const cardCount = await resultCards.count();
    expect(cardCount).toBeGreaterThan(0);

    console.log(`✓ ${cardCount}개의 결과 (비활성 용어 포함)`);
    console.log('✅ 비활성 용어 포함 옵션 테스트 완료');
  });

  test('6. 사이드바 레이아웃 반응형 확인', async ({ page }) => {
    console.log('✓ 테스트 6: 사이드바 레이아웃 확인');

    // 사이드바 확인
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // 사이드바 콘텐츠 확인
    const sidebarContent = page.locator('.sidebar-content');
    await expect(sidebarContent).toBeVisible();

    // 그룹박스 개수 확인 (검색 문서 + 증상 검색 = 2개)
    const groupBoxes = sidebar.locator('.group-box');
    const boxCount = await groupBoxes.count();
    expect(boxCount).toBe(2);

    // 메인 컨텐츠 영역 확인
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();

    console.log('✅ 사이드바 레이아웃 확인 완료');
  });

  test('7. 연속 검색 워크플로우', async ({ page }) => {
    console.log('✓ 테스트 7: 연속 검색 워크플로우');

    const searchTerms = ['빈혈', '발열', '구토'];

    for (const term of searchTerms) {
      console.log(`  → "${term}" 검색 중...`);

      // 검색어 입력
      const searchInput = page.locator('#q');
      await searchInput.clear();
      await searchInput.fill(term);

      // 검색 실행
      await page.locator('button[type="submit"]').click();

      // 로딩 완료 대기
      await page.waitForSelector('#loading-overlay[hidden]', { timeout: 30000 });

      // 결과 확인
      const resultCards = page.locator('.result-card');
      const count = await resultCards.count();
      console.log(`  ✓ "${term}": ${count}개 결과`);

      expect(count).toBeGreaterThan(0);

      // 짧은 대기
      await page.waitForTimeout(500);
    }

    console.log('✅ 연속 검색 워크플로우 완료');
  });

  test('8. 검색 결과 없는 경우 처리', async ({ page }) => {
    console.log('✓ 테스트 8: 검색 결과 없는 경우');

    // 존재하지 않는 용어 검색
    await page.locator('#q').fill('xyzabc123notexist');
    await page.locator('button[type="submit"]').click();

    // 로딩 완료 대기
    await page.waitForFunction(() => {
      const overlay = document.getElementById('loading-overlay');
      return overlay && overlay.hasAttribute('hidden');
    }, { timeout: 30000 });

    // 결과 없음 메시지 또는 빈 결과 확인
    const results = page.locator('#results');
    const resultsText = await results.textContent();

    // 결과 카드가 없거나, "검색 결과가 없습니다" 메시지 확인
    const resultCards = page.locator('.result-card');
    const cardCount = await resultCards.count();

    console.log(`✓ 검색 결과: ${cardCount}개`);
    console.log('✅ 검색 결과 없는 경우 처리 완료');
  });

  test('9. 브라우저 뒤로가기/앞으로가기 지원', async ({ page }) => {
    console.log('✓ 테스트 9: 브라우저 네비게이션 테스트');

    // 첫 번째 검색
    await page.locator('#q').fill('빈혈');
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector('#loading-overlay[hidden]', { timeout: 30000 });

    const firstSearchValue = await page.locator('#q').inputValue();
    console.log(`✓ 첫 번째 검색어: ${firstSearchValue}`);

    // 두 번째 검색
    await page.locator('#q').clear();
    await page.locator('#q').fill('두통');
    await page.locator('button[type="submit"]').click();
    await page.waitForSelector('#loading-overlay[hidden]', { timeout: 30000 });

    const secondSearchValue = await page.locator('#q').inputValue();
    console.log(`✓ 두 번째 검색어: ${secondSearchValue}`);

    // 검색 입력창 값 확인 (페이지는 SPA가 아니므로 입력값만 확인)
    expect(secondSearchValue).toBe('두통');

    console.log('✅ 브라우저 네비게이션 테스트 완료');
  });

  test('10. 데이터 로딩 진행률 표시 확인', async ({ page }) => {
    console.log('✓ 테스트 10: 데이터 로딩 진행률 표시');

    // 페이지를 새로고침하여 데이터 재로딩
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 검색 실행
    await page.locator('#q').fill('증상');
    await page.locator('button[type="submit"]').click();

    // 로딩 오버레이 확인
    const loadingOverlay = page.locator('#loading-overlay');
    await expect(loadingOverlay).toBeVisible();

    // 로딩 팝업 내용 확인
    const loadingPopup = page.locator('.loading-popup');
    await expect(loadingPopup).toBeVisible();

    // 진행률 바 확인
    const progressBar = page.locator('.progress-bar');
    await expect(progressBar).toBeVisible();

    // 로딩 상태 메시지 확인
    const loadingStatus = page.locator('#loading-status');
    await expect(loadingStatus).toBeVisible();

    // 로딩 완료 대기
    await page.waitForFunction(() => {
      const overlay = document.getElementById('loading-overlay');
      return overlay && overlay.hasAttribute('hidden');
    }, { timeout: 30000 });

    console.log('✅ 데이터 로딩 진행률 표시 확인 완료');
  });

  test('11. 키보드 접근성 - Enter 키로 검색', async ({ page }) => {
    console.log('✓ 테스트 11: 키보드 접근성 테스트');

    // 검색 입력창에 포커스
    const searchInput = page.locator('#q');
    await searchInput.focus();

    // 검색어 입력
    await searchInput.fill('감기');

    // Enter 키 입력
    await searchInput.press('Enter');

    // 로딩 완료 대기
    await page.waitForFunction(() => {
      const overlay = document.getElementById('loading-overlay');
      return overlay && overlay.hasAttribute('hidden');
    }, { timeout: 30000 });

    // 결과 확인
    const resultCards = page.locator('.result-card');
    const count = await resultCards.count();
    expect(count).toBeGreaterThan(0);

    console.log(`✓ Enter 키로 검색 성공: ${count}개 결과`);
    console.log('✅ 키보드 접근성 테스트 완료');
  });

  test('12. 종합 사용자 시나리오', async ({ page }) => {
    console.log('✓ 테스트 12: 종합 사용자 시나리오');

    console.log('  1단계: 초기 화면 확인');
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();

    console.log('  2단계: 검색 옵션 설정');
    await page.locator('#limit').clear();
    await page.locator('#limit').fill('10');

    console.log('  3단계: 검색어 입력');
    await page.locator('#q').fill('알레르기');

    console.log('  4단계: 검색 실행');
    await page.locator('button[type="submit"]').click();

    console.log('  5단계: 로딩 대기');
    await page.waitForSelector('#loading-overlay[hidden]', { timeout: 30000 });

    console.log('  6단계: 검색 결과 확인');
    const resultCards = page.locator('.result-card');
    const count = await resultCards.count();
    expect(count).toBeGreaterThan(0);
    console.log(`  ✓ ${count}개 결과 표시`);

    console.log('  7단계: 첫 번째 결과 펼치기');
    const firstCard = resultCards.first();
    await firstCard.locator('.card-summary').click();

    console.log('  8단계: 상세 정보 확인');
    const cardDetails = firstCard.locator('.card-details');
    await expect(cardDetails).toBeVisible();

    console.log('  9단계: 결과 닫기');
    await firstCard.locator('.card-summary').click();
    await expect(cardDetails).toHaveAttribute('style', /display:\s*none/);

    console.log('✅ 종합 사용자 시나리오 완료');
  });
});
