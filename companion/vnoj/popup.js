const token = document.querySelector('#token'), status = document.querySelector('#status');
chrome.storage.local.get(['lastStatus','pairToken']).then(v=>{status.textContent=v.lastStatus || (v.pairToken ? 'Đã lưu mã. Mở tab contest VNOJ để đồng bộ.' : 'Chưa ghép nối.');});
document.querySelector('#save').onclick=async()=>{if(!/^[a-f0-9]{48}$/.test(token.value.trim())){status.textContent='Mã cần đúng 48 ký tự, sao chép từ Sirocco Live.';return;}await chrome.storage.local.set({pairToken:token.value.trim()});token.value='';status.textContent='Đã lưu. Mở hoặc tải lại trang contest VNOJ.';};
document.querySelector('#remove').onclick=async()=>{await chrome.storage.local.remove(['pairToken','lastStatus']);token.value='';status.textContent='Đã ngắt kết nối.';};
