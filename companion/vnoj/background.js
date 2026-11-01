chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'sirocco-vnoj' || !sender.tab?.url?.startsWith('https://oj.vnoi.info/contest/')) return;
  (async () => {
    const { pairToken } = await chrome.storage.local.get('pairToken');
    if (!pairToken) return { error: 'Chưa nhập mã ghép nối.' };
    const response = await fetch('http://127.0.0.1:8765/api/vnoj/bridge', { method: 'POST', headers: { 'content-type': 'application/json', 'x-sirocco-pair': pairToken }, body: JSON.stringify(message.payload), signal: AbortSignal.timeout(8000) });
    const result = await response.json();
    await chrome.storage.local.set({ lastStatus: response.ok ? `Đã nối ${message.payload.username} · phiên ${message.payload.participationId}` : result.error, lastAt: Date.now() });
    return result;
  })().then(respond).catch(async () => { await chrome.storage.local.set({ lastStatus: 'Chưa kết nối được Sirocco Live trên máy này.' }); respond({ error: 'Chưa kết nối được ứng dụng.' }); });
  return true;
});
