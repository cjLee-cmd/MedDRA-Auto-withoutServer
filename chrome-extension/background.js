/**
 * MedDRA DB AutoFill - Background Service Worker
 *
 * 역할:
 * 1. GitHub Pages (main.html)에서 메시지 수신
 * 2. MedDRA-DB 사이트를 새 탭으로 열기
 * 3. Content script로 CIOMS 데이터 전달
 */

console.log('[MedDRA AutoFill] Background service worker started');

// GitHub Pages에서 오는 메시지 리스너
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received external message:', request);

  if (request.action === 'dbAutofill') {
    handleDbAutofill(request.ciomsData, sendResponse);
    return true; // 비동기 응답을 위해 true 반환
  }
});

// 내부 메시지 리스너 (content script와 통신)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received internal message:', request);

  if (request.action === 'dbAutofill') {
    handleDbAutofill(request.ciomsData, sendResponse);
    return true;
  }
});

/**
 * DB 자동입력 처리
 */
async function handleDbAutofill(ciomsData, sendResponse) {
  try {
    console.log('[Background] Starting DB autofill with data:', ciomsData);

    // 유효성 검사
    if (!ciomsData || Object.keys(ciomsData).length === 0) {
      sendResponse({
        success: false,
        error: 'CIOMS 데이터가 비어있습니다.'
      });
      return;
    }

    // 데이터를 chrome.storage에 임시 저장 (content script가 읽을 수 있도록)
    await chrome.storage.local.set({
      pendingCiomsData: ciomsData,
      timestamp: Date.now()
    });

    console.log('[Background] CIOMS data saved to storage');

    // MedDRA-DB 사이트를 새 탭으로 열기
    const tab = await chrome.tabs.create({
      url: 'https://cjlee-cmd.github.io/MedDRA-DB/',
      active: true // 새 탭을 활성화
    });

    console.log('[Background] New tab created:', tab.id);

    // Content script가 로드될 때까지 대기 후 메시지 전송
    // (content script는 자동으로 storage에서 데이터를 읽음)

    sendResponse({
      success: true,
      message: 'MedDRA-DB 사이트가 새 탭에서 열렸습니다. 자동 입력이 시작됩니다.',
      tabId: tab.id
    });

  } catch (error) {
    console.error('[Background] Error:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

// 확장 설치 시 초기화
chrome.runtime.onInstalled.addListener(() => {
  console.log('[MedDRA AutoFill] Extension installed/updated');

  // 기존 storage 정리
  chrome.storage.local.clear();
});
