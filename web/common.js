export const VERSION = '1.4.0';
export const icon = name => `<svg class="ui-icon" aria-hidden="true" viewBox="0 0 256 256"><use href="/assets/icons.svg#${name}"></use></svg>`;
export const LANGUAGES = { auto: 'Tự nhận', cpp: 'C++', py: 'Python', java: 'Java' };
export const STATUS = { live: 'Đồng bộ', demo: 'Minh hoạ', connecting: 'Đang kết nối', reconnecting: 'Đang nối lại', waiting: 'Chờ link', error: 'Cần kiểm tra', disabled: 'Đang ẩn' };
export const $ = (selector, parent = document) => parent.querySelector(selector);
export const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sourceUrl = group => `${location.origin}/view/${group}`;
export const time = value => value ? new Date(value).toLocaleTimeString('vi-VN', { hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
export function toast(message, error = false, action) {
  const node = $('#toast'); node.replaceChildren();
  const text = document.createElement('span'); text.textContent = message; node.append(text);
  if (action) { const button = document.createElement('button'); button.textContent = action.label; button.onclick = () => { action.run(); node.classList.remove('visible'); }; node.append(button); }
  node.classList.toggle('error', error); node.classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove('visible'), action ? 8000 : 4200);
}
export async function api(url, data) {
  const response = await fetch(url, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Không thực hiện được yêu cầu.');
  return result;
}
export async function copy(value) {
  try { await navigator.clipboard.writeText(value); toast('Đã sao chép link nguồn phát.'); }
  catch { toast(value); }
}
export const options = (items, selected) => items.map(([value, title]) => `<option value="${esc(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${esc(title)}</option>`).join('');
