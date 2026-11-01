import { $, api, icon, esc, time } from './common.js';

export class CodeforcesSettings {
  constructor({ onApply, onChange } = {}) {
    this.onApply = onApply; this.onChange = onChange;
    this.dialog = document.createElement('dialog'); this.dialog.id = 'codeforces-dialog';
    this.dialog.setAttribute('aria-labelledby', 'cf-dialog-title');
    this.dialog.innerHTML = `<div class="dialog-heading"><div><div class="eyebrow">KẾT NỐI DỮ LIỆU</div><h2 id="cf-dialog-title">Codeforces Gym</h2></div><button type="button" class="icon-button" id="cf-close" aria-label="Đóng kết nối Codeforces">${icon('x')}</button></div>
      <p class="cf-intro">Kiểm tra quyền đọc bảng điểm bằng API của tài khoản BTC. Thông tin đăng nhập Chrome không thay thế API Key.</p>
      <div class="cf-connection-status" id="cf-status" role="status">Đang kiểm tra cấu hình…</div>
      <form id="cf-connect-form" autocomplete="off">
        <details class="cf-key-settings" id="cf-key-settings" open><summary>Tài khoản API & khoá kết nối</summary><div class="cf-step-title"><span>01</span> Tài khoản có quyền xem Gym</div>
        <div class="cf-credential-grid"><label for="cf-api-key">API Key<input id="cf-api-key" name="apiKey" type="password" autocomplete="new-password" spellcheck="false" autocapitalize="none" maxlength="512" placeholder="Nhập trực tiếp trên máy bạn"></label><label for="cf-api-secret">API Secret<input id="cf-api-secret" name="apiSecret" type="password" autocomplete="new-password" spellcheck="false" autocapitalize="none" maxlength="512" placeholder="Secret đi kèm API Key"></label></div>
        <p class="cf-key-help" id="cf-key-help">Key chỉ được lưu sau khi truy cập Gym thành công. Trên Windows, khoá được bảo vệ bằng tài khoản Windows hiện tại.</p>
        <a class="text-button cf-api-link" href="https://codeforces.com/settings/api" target="_blank" rel="noopener noreferrer">Mở trang API Codeforces ${icon('arrow-up-right')}</a>
        </details>
        <div class="cf-step-title"><span>02</span> Kiểm tra contest và thí sinh</div>
        <div class="cf-probe-grid"><label for="cf-contest">Link hoặc ID contest<input id="cf-contest" name="contest" required spellcheck="false" placeholder="https://codeforces.com/gym/…"></label><label for="cf-handle">Handle cần kiểm tra<input id="cf-handle" name="handle" spellcheck="false" autocapitalize="none" maxlength="24" placeholder="Handle trên trang profile"></label></div>
        <label class="check-label cf-manager-option"><input id="cf-as-manager" name="asManager" type="checkbox"> Đọc bằng quyền quản lý contest</label>
        <p class="setting-help">Chỉ bật khi cần xem dữ liệu quản lý. Quyền này có thể đọc kết quả bị ẩn khỏi thí sinh.</p>
        <div class="cf-result hidden" id="cf-result" aria-live="polite"></div>
        <button type="button" class="button cf-apply-contest hidden" id="cf-apply-contest">${icon('arrow-right')} Dùng contest cho nhóm hiện tại</button>
        <div class="cf-dialog-actions"><button type="button" class="text-button" id="cf-disconnect" hidden>Xoá khoá đã lưu</button><button class="button primary" id="cf-check" type="submit">${icon('plugs-connected')} Lưu & kiểm tra truy cập</button></div>
      </form>`;
    document.body.append(this.dialog);
    $('#cf-apply-contest', this.dialog).onclick = () => { if(this.lastCheck){this.onApply?.(this.lastCheck);this.dialog.close();} };
    $('#cf-close', this.dialog).onclick = () => this.dialog.close();
    this.dialog.addEventListener('click', event => { if (event.target === this.dialog) this.dialog.close(); });
    this.dialog.addEventListener('close', () => this.clearSecretInputs());
    $('#cf-connect-form', this.dialog).onsubmit = event => { event.preventDefault(); this.check(); };
    $('#cf-disconnect', this.dialog).onclick = async () => {
      if (this.busy) return;
      try { const status = await api('/api/codeforces/disconnect', {}); this.clearSecretInputs(); this.status(status); $('#cf-result', this.dialog).classList.add('hidden'); }
      catch (error) { this.resultError(error.message); }
    };
    api('/api/codeforces/connection').then(value=>this.status(value)).catch(()=>{});
  }
  clearSecretInputs() { $('#cf-api-key', this.dialog).value = ''; $('#cf-api-secret', this.dialog).value = ''; }
  async open(context = {}) {
    if (this.dialog.open) return;
    this.dialog.showModal();
    this.context = context;
    if(context.contest)$('#cf-contest',this.dialog).value=context.contest;
    if(context.handle)$('#cf-handle',this.dialog).value=context.handle;
    $('#cf-as-manager',this.dialog).checked=context.asManager===true;
    $('#cf-apply-contest',this.dialog).innerHTML=`${icon('arrow-right')} Dùng contest cho ${esc(context.groupTitle||'nhóm hiện tại')}`;
    try { this.status(await api('/api/codeforces/connection')); } catch (error) { this.resultError(error.message); }
  }
  status(value) {
    this.configured = value.configured;
    this.onChange?.(value);
    $('#cf-key-settings', this.dialog).open = !value.configured;
    const node = $('#cf-status', this.dialog);
    node.dataset.connected = String(value.configured);
    node.textContent = value.configured ? 'Đã có API Key được xác minh trên máy này.' : value.error || 'Chưa kết nối. Nhập API Key và Secret để kiểm tra quyền xem Gym.';
    $('#cf-disconnect', this.dialog).hidden = !value.configured;
    $('#cf-check', this.dialog).innerHTML = `${icon('plugs-connected')} ${value.configured ? 'Kiểm tra bằng khoá đã lưu' : 'Lưu & kiểm tra truy cập'}`;
    $('#cf-key-help', this.dialog).textContent = value.configured ? 'Để trống hai ô để dùng khoá đã lưu. Nhập đủ hai ô nếu muốn thay khoá.' : 'Khoá chỉ được lưu sau khi truy cập Gym thành công. Khoá không có trong file xuất cấu hình hoặc nguồn live.';
    if (value.lastCheck) {
      $('#cf-contest', this.dialog).value ||= value.lastCheck.source;
      $('#cf-handle', this.dialog).value ||= value.lastCheck.participant?.handle || '';
      this.showResult(value.lastCheck);
    } else { this.lastCheck=null;$('#cf-apply-contest',this.dialog).classList.add('hidden'); }
  }
  async check() {
    if (this.busy) return;
    this.busy = true;
    const button = $('#cf-check', this.dialog); button.disabled = true; button.innerHTML = `${icon('circle-notch')} Đang kiểm tra…`; button.classList.add('is-saving');
    const payload = { contest: $('#cf-contest', this.dialog).value, handle: $('#cf-handle', this.dialog).value, asManager: $('#cf-as-manager', this.dialog).checked, apiKey: $('#cf-api-key', this.dialog).value, apiSecret: $('#cf-api-secret', this.dialog).value };
    try { const value = await api('/api/codeforces/check', payload); this.clearSecretInputs(); this.status(value); this.showResult(value.lastCheck); }
    catch (error) { this.resultError(error.message); }
    finally { payload.apiKey = ''; payload.apiSecret = ''; this.busy = false; button.disabled = false; button.classList.remove('is-saving'); if (button.textContent.includes('Đang kiểm tra')) button.innerHTML = `${icon('plugs-connected')} ${this.configured ? 'Kiểm tra bằng khoá đã lưu' : 'Lưu & kiểm tra truy cập'}`; }
  }
  resultError(message) { this.lastCheck=null;$('#cf-apply-contest',this.dialog).classList.add('hidden');const node = $('#cf-result', this.dialog); node.classList.remove('hidden'); node.dataset.error = 'true'; node.textContent = message; }
  showResult(result) {
    if (!result) return;
    const node = $('#cf-result', this.dialog), p = result.participant;
    this.lastCheck=result;$('#cf-apply-contest',this.dialog).classList.remove('hidden');
    node.dataset.error = 'false'; node.classList.remove('hidden');
    node.innerHTML = `<div class="cf-result-heading">${icon('check-circle')}<strong>Đã đọc được bảng điểm</strong><time>${time(result.checkedAt)}</time></div><p>${esc(result.contest.name)}</p>${p ? `<div class="cf-probe-participant"><strong>${esc(p.handle)}</strong><span>${p.points ?? '—'} điểm</span><span>${p.rank ? `Hạng #${p.rank}` : 'Không có hạng chính thức'}</span></div><div class="cf-problem-preview">${p.problems.map(r=>`<span><b>${esc(r.index)}</b>${r.points ?? '—'}</span>`).join('')}</div>` : '<p>Quyền truy cập hợp lệ; chưa thấy handle trong bảng điểm này. Nếu đây là tài khoản quản lý, hãy bật quyền quản lý contest rồi kiểm tra lại.</p>'}<p class="setting-help">${result.contest.frozen ? 'Bảng điểm đang đóng băng. ' : ''}${result.asManager ? 'Đang dùng quyền quản lý. ' : ''}Chọn contest cho nhóm, gắn handle ở từng thí sinh rồi lưu để tự cập nhật điểm trên live.</p>`;
  }
}
