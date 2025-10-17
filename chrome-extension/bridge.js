/**
 * MedDRA DB AutoFill - Bridge Script (GitHub Pages용)
 *
 * 역할:
 * 1. GitHub Pages (main.html)에서 window.postMessage 수신
 * 2. Background script로 메시지 전달
 * 3. Background의 응답을 GitHub Pages로 전달
 */

console.log('[MedDRA AutoFill Bridge] Loaded on GitHub Pages');

// GitHub Pages와의 window.postMessage 통신 리스너
window.addEventListener('message', (event) => {
  // 같은 윈도우에서 온 메시지만 처리
  if (event.source !== window) return;

  // MEDDRA_AUTOFILL_REQUEST 메시지 처리
  if (event.data.type === 'MEDDRA_AUTOFILL_REQUEST') {
    console.log('[Bridge] Received postMessage request from page:', event.data);

    // Background script로 메시지 전달
    chrome.runtime.sendMessage({
      action: event.data.action,
      ciomsData: event.data.ciomsData
    }, (response) => {
      console.log('[Bridge] Background response:', response);

      // GitHub Pages로 응답 전송
      window.postMessage({
        type: 'MEDDRA_AUTOFILL_RESPONSE',
        messageId: event.data.messageId,
        success: response?.success || false,
        message: response?.message || '',
        error: response?.error || null
      }, '*');
    });
  }
});

console.log('[Bridge] Message listener ready');
