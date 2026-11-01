import { $, $$, esc, icon, api, toast, options, time } from './common.js';
import { resultStyle, problemLabel, problemAccepted } from '../lib/results.mjs';
import { ResultAudio } from './result-effects.js';

const testAudio = new ResultAudio();

export const PARTICIPATIONS = { auto: 'Tự chọn phiên', CONTESTANT: 'Chính thức', OUT_OF_COMPETITION: 'Ngoài cuộc thi', VIRTUAL: 'Thi ảo', MANAGER: 'Quản lý', PRACTICE: 'Luyện tập' };
const pointFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
export const points = value => Number.isFinite(value) ? pointFormat.format(value) : '—';
export function verdictText(submission, style = 'IOI') {
  if (!submission) return '';
  const labels = { OK: 'AC', PARTIAL: 'Một phần', WRONG_ANSWER: 'WA', TIME_LIMIT_EXCEEDED: 'TLE', MEMORY_LIMIT_EXCEEDED: 'MLE', RUNTIME_ERROR: 'RE', COMPILATION_ERROR: 'CE', TESTING: 'Đang chấm', SUBMITTED: 'Đang chờ', SKIPPED: 'Bỏ qua', REJECTED: 'Từ chối', FAILED: 'Lỗi chấm', NOT_AC: 'Chưa AC', RTE: 'RE', CHALLENGED: 'Bị hack' };
  return `${submission.index} · ${labels[submission.verdict] || submission.verdict}${style !== 'ICPC' && Number.isFinite(submission.points) ? ` · ${points(submission.points)}đ` : ''}`;
}

export function contestControls(settings) {
  const vnoj = settings.provider === 'vnoj';
  return `<section class="contest-controls" id="contest-controls" aria-label="Thành tích thi đấu">
    <div class="contest-controls-heading"><div class="contest-section-name">${icon('chart-line')}<div><strong>Thành tích ${vnoj ? 'VNOJ' : 'Codeforces'}</strong><small id="contest-state">Chọn contest cho nhóm này</small></div></div><div class="contest-control-actions"><button class="text-button ${vnoj ? 'hidden' : ''}" id="contest-api-settings">${icon('key')} Kết nối API</button><label class="switch"><input id="contest-enabled" type="checkbox" aria-label="Theo dõi thành tích thi đấu" ${settings.enabled ? 'checked' : ''}><span></span></label></div></div>
    <div class="contest-provider-row"><label>Nguồn điểm<select id="contest-provider">${options([['codeforces','Codeforces'],['vnoj','VNOJ · ICPC / IOI']],settings.provider || 'codeforces')}</select></label><span>${vnoj ? 'BXH công khai gồm thi ảo · ghim riêng từng phiên' : 'Contest và Gym · tài khoản BTC cho bảng điểm cần quyền'}</span></div>
    <div class="contest-style-row"><label>Kiểu hiển thị<select id="contest-style">${options([['auto','Theo contest'],['ICPC','ICPC · AC / số bài'],['IOI','IOI · điểm số']],settings.style || 'auto')}</select></label><span>Kiểu hiển thị và hiệu ứng; không đổi cách chấm của website thi.</span></div>
    <div class="contest-effects-controls"><label class="check-label"><input id="contest-effects" type="checkbox" ${settings.effects !== false ? 'checked' : ''}> Hiệu ứng kết quả</label><label class="check-label"><input id="contest-sound" type="checkbox" ${settings.sound ? 'checked' : ''}> Sound effect</label><label class="effect-volume">Âm lượng<input id="contest-volume" type="range" min="0" max="100" value="${settings.volume ?? 35}"></label><button class="tiny-button" id="test-success">Thử xanh / AC</button><button class="tiny-button" id="test-failure">Thử đỏ</button></div>
    ${vnoj ? '<div class="vnoj-companion-note"><span>Kết nối phiên đang thi để nhận cả lượt nộp thấp điểm hơn.</span><button class="text-button" id="vnoj-pair">VNOJ Companion ↗</button></div>' : ''}
    <div class="contest-fields ${settings.enabled ? '' : 'hidden'}" id="contest-fields">
      <div class="contest-fields-grid"><label>Contest của nhóm<input id="contest-url" placeholder="${vnoj ? 'https://oj.vnoi.info/contest/…' : 'https://codeforces.com/gym/…'}" value="${esc(settings.url)}" spellcheck="false"></label><label>Nhịp cập nhật<select id="contest-refresh">${options([[15,'15 giây'],[30,'30 giây'],[60,'1 phút'],[120,'2 phút'],[180,'3 phút']], settings.refreshSeconds)}</select></label><button class="button" id="refresh-contest" title="Cập nhật điểm ngay">${icon('arrows-clockwise')} Cập nhật</button></div>
      <div class="contest-toggles"><label class="check-label"><input id="contest-show-live" type="checkbox" ${settings.showOnLive ? 'checked' : ''}> Hiện điểm trên live</label><label class="check-label ${vnoj ? 'hidden' : ''}"><input id="contest-manager" type="checkbox" ${settings.asManager ? 'checked' : ''}> Dùng quyền quản lý Gym</label><span class="contest-access-note ${settings.asManager && !vnoj ? '' : 'hidden'}" id="contest-access-note">Có thể bao gồm kết quả ẩn khỏi thí sinh.</span></div>
      <div class="contest-feed" id="contest-feed" aria-live="polite"></div>
    </div>
  </section>`;
}
export function candidateContestFields(candidate, settings) {
  const real = `<label class="real-name-field"><span>REAL NAME</span><input class="candidate-real-name" aria-label="Real Name của ${esc(candidate.name)}" maxlength="80" placeholder="Họ tên hiển thị trên live" value="${esc(candidate.realName || '')}"></label>`;
  if (settings?.provider === 'vnoj') return `<div class="candidate-contest-fields"><label class="cf-handle-label"><span>NICKNAME</span><input class="candidate-vnoj-username" aria-label="Username VNOJ của ${esc(candidate.name)}" maxlength="150" spellcheck="false" autocapitalize="none" placeholder="username thí sinh" value="${esc(candidate.vnojUsername || '')}"></label>${real}<select class="candidate-vnoj-session" aria-label="Phiên VNOJ của ${esc(candidate.name)}"><option value="">Lưu username để tìm phiên</option>${candidate.vnojParticipationId ? `<option value="${candidate.vnojParticipationId}" selected>Phiên đã ghim · ${candidate.vnojParticipationId}</option>` : ''}</select></div><div class="candidate-contest-result" data-contest-result-id="${candidate.id}"></div>`;
  return `<div class="candidate-contest-fields"><label class="cf-handle-label"><span>NICKNAME</span><input class="candidate-cf-handle" aria-label="Handle Codeforces của ${esc(candidate.name)}" maxlength="24" spellcheck="false" autocapitalize="none" placeholder="handle thí sinh" value="${esc(candidate.codeforcesHandle || '')}"></label>${real}<select class="candidate-cf-participation" aria-label="Phiên thi Codeforces của ${esc(candidate.name)}">${options(Object.entries(PARTICIPATIONS), candidate.codeforcesParticipation || 'auto')}</select></div><div class="candidate-contest-result" data-contest-result-id="${candidate.id}"></div>`;
}
export function bindContestControls(owner) {
  const settings = owner.config.groups[owner.group].codeforces;
  $('#contest-style').onchange = event => { settings.style=event.target.value; owner.changed(true); };
  $('#contest-effects').onchange = event => { settings.effects=event.target.checked; owner.changed(true); };
  $('#contest-sound').onchange = event => { settings.sound=event.target.checked; owner.changed(true); };
  $('#contest-volume').oninput = event => { settings.volume=Number(event.target.value); owner.changed(true); };
  for (const tone of ['success','failure']) $(`#test-${tone}`).onclick = async () => {
    if(!owner.config.candidates.some(c=>c.group===owner.group&&c.enabled)){toast('Thêm thí sinh vào khung để thử hiệu ứng.');return;}
    const frame = $('.preview-frame iframe'); frame?.contentWindow.postMessage({type:'sirocco-effect-test',group:owner.group,tone},location.origin);
    if (settings.sound) { if(await testAudio.enable()){testAudio.play(tone,settings.volume);toast('Đã phát thử hình ảnh và âm thanh.');}else toast('Trình duyệt chưa cho phép phát âm thanh.',true); }
  };
  if ($('#vnoj-pair')) $('#vnoj-pair').onclick = async () => {
    try {
      const {token} = await api('/api/vnoj/pair',{}), dialog=document.createElement('dialog');
      dialog.innerHTML=`<div class="dialog-heading"><h2>Kết nối phiên VNOJ</h2><button class="icon-button close-pair" aria-label="Đóng">${icon('x')}</button></div><p>Tiện ích nằm trong thư mục <code>companion/vnoj</code> của ứng dụng. Mở chrome://extensions, bật Chế độ dành cho nhà phát triển, chọn “Tải tiện ích đã giải nén” rồi chọn thư mục này.</p><p>Nhập mã dưới vào tiện ích trên trình duyệt thí sinh, cùng máy đang chạy Sirocco Live. Mở tab contest VNOJ đang thi ảo và giữ tab mở. Tiện ích chỉ gửi kết quả về máy này; không xuất cookie hoặc code.</p><label class="group-name-label">Mã ghép nối<input readonly value="${token}" aria-label="Mã ghép nối VNOJ"></label><p>Mã đổi sau khi khởi động lại ứng dụng. Chỉ gửi kết quả cho username và mã phiên đã ghim.</p><div class="group-dialog-actions"><button class="text-button unpair">Thu hồi kết nối</button><button class="button copy-pair">Sao chép mã</button><button class="button primary close-pair">Xong</button></div>`;
      document.body.append(dialog);dialog.addEventListener('close',()=>setTimeout(()=>dialog.remove(),450),{once:true});dialog.querySelectorAll('.close-pair').forEach(b=>b.onclick=()=>dialog.close());dialog.querySelector('.copy-pair').onclick=()=>navigator.clipboard.writeText(token);dialog.querySelector('.unpair').onclick=async()=>{await api('/api/vnoj/unpair',{});dialog.close();toast('Đã thu hồi kết nối VNOJ Companion.');};dialog.showModal();
    } catch(e) { toast(e.message,true); }
  };
  $('#contest-provider').onchange = event => { settings.provider = event.target.value; settings.url = ''; settings.asManager = false; owner.changed(true); owner.render(); };
  $('#contest-api-settings').onclick = () => owner.openCodeforces();
  $('#contest-enabled').onchange = event => { settings.enabled = event.target.checked; $('#contest-fields').classList.toggle('hidden', !settings.enabled); owner.changed(true); };
  $('#contest-url').oninput = event => { settings.url = event.target.value.trim(); owner.changed(true); };
  $('#contest-refresh').onchange = event => { settings.refreshSeconds = Number(event.target.value); owner.changed(); };
  $('#contest-manager').onchange = event => { settings.asManager = event.target.checked; $('#contest-access-note').classList.toggle('hidden', !settings.asManager); owner.changed(); };
  $('#contest-show-live').onchange = event => { settings.showOnLive = event.target.checked; owner.changed(true); };
  $('#refresh-contest').onclick = async () => {
    if (owner.dirty && !await owner.save()) return;
    try { await api('/api/contest/refresh', { groupId: owner.group }); toast('Đang cập nhật bảng điểm.'); } catch (error) { toast(error.message, true); }
  };
  $$('.participant-row').forEach(row => {
    const candidate = owner.config.candidates.find(c => c.id === row.dataset.id);
    $('.candidate-real-name',row).oninput=event=>{candidate.realName=event.target.value;owner.changed(true);};
    if (settings.provider === 'vnoj') {
      $('.candidate-vnoj-username', row).oninput = event => { candidate.vnojUsername = event.target.value.trim(); candidate.vnojParticipationId = null; owner.changed(); };
      $('.candidate-vnoj-session', row).onchange = event => { candidate.vnojParticipationId = event.target.value ? Number(event.target.value) : null; owner.changed(); };
      return;
    }
    $('.candidate-cf-handle', row).oninput = event => { candidate.codeforcesHandle = event.target.value.trim(); owner.changed(); };
    $('.candidate-cf-participation', row).onchange = event => { candidate.codeforcesParticipation = event.target.value; owner.changed(); };
  });
}
export function updateContestControls(owner) {
  const settings = owner.config.groups[owner.group].codeforces, vnoj = settings.provider === 'vnoj';
  const current = owner.state.contests?.[owner.group];
  const snapshot = current?.source === settings.url && (current.provider || 'codeforces') === (settings.provider || 'codeforces') ? current : null;
  const status = $('#contest-state');
  const text = !settings.enabled ? 'Gắn handle để theo dõi điểm từng thí sinh.' : snapshot?.fetching ? 'Đang cập nhật bảng điểm…' : snapshot?.message || 'Lưu cấu hình để bắt đầu đồng bộ.';
  if (status) { status.textContent = text; status.dataset.status = snapshot?.status || 'waiting'; }
  const feed = $('#contest-feed');
  if (feed) {
    const signature = JSON.stringify([snapshot?.status, snapshot?.checkedAt, snapshot?.contest?.name, snapshot?.contest?.frozen, snapshot?.asManager, snapshot?.fetching, snapshot?.submissionWarning]);
    if (feed.dataset.signature !== signature) {
      feed.dataset.signature = signature;
      feed.innerHTML = snapshot?.contest ? `<div><span class="feed-status-dot" data-status="${snapshot.status}"></span><strong>${esc(snapshot.contest.name)}</strong><span class="feed-type">${esc(snapshot.contest.type)}</span>${snapshot.asManager ? '<span class="feed-access">Quyền quản lý</span>' : ''}${snapshot.contest.frozen ? '<span class="feed-frozen">BXH đóng băng</span>' : ''}<time>${snapshot.checkedAt ? time(snapshot.checkedAt) : ''}</time></div>${snapshot.status === 'stale' ? '<p>Đang giữ điểm lần cập nhật cuối; sẽ tự thử kết nối lại.</p>' : snapshot.submissionWarning ? '<p>Điểm đã cập nhật; dữ liệu lần nộp mới nhất đang chờ kết nối lại.</p>' : vnoj ? '<p>Hạng theo BXH công khai gồm thi ảo. Companion nhận kết quả từng lần nộp trong phiên đang thi; nếu chưa nối, hiệu ứng chỉ theo thay đổi BXH.</p>' : '<p>Điểm lấy từ bảng standings; kết quả nộp không được cộng trùng.</p>'}` : vnoj ? '<p>Nhập username, lưu để tìm các phiên, sau đó chọn đúng phiên VNOJ và lưu lại. Không cần khoá API cho BXH công khai.</p>' : '<p>Nhập handle ở danh sách thí sinh. Key/Secret được cấu hình riêng bằng nút Kết nối API.</p>';
    }
  }
  $$('[data-contest-result-id]').forEach(node => {
    const candidate = owner.config.candidates.find(c => c.id === node.dataset.contestResultId), participant = snapshot?.participants?.[candidate.id];
    if (vnoj) {
      const select = $(`.participant-row[data-id="${candidate.id}"] .candidate-vnoj-session`);
      const sessions = participant?.handle?.toLowerCase() === candidate.vnojUsername?.toLowerCase() ? participant.sessions || [] : [];
      if (select) {
        const entries = [['', sessions.length ? 'Chọn phiên thi' : 'Lưu username để tìm phiên'], ...sessions.map(s => [s.id, `${s.virtual > 0 ? `Thi ảo #${s.virtual}` : 'Chính thức'} · ${points(s.points)} ${snapshot?.contest?.type==='IOI'?'điểm':'bài'} · ${s.id}`])];
        if (candidate.vnojParticipationId && !sessions.some(s => s.id === candidate.vnojParticipationId)) entries.push([candidate.vnojParticipationId, `Phiên đã ghim · ${candidate.vnojParticipationId}`]);
        const signature = JSON.stringify([entries, candidate.vnojParticipationId]);
        if (select.dataset.signature !== signature) { select.innerHTML = options(entries, candidate.vnojParticipationId || ''); select.dataset.signature = signature; }
      }
    }
    const mode = vnoj && participant?.status==='live' ? participant.resultMode==='exact' ? ' · Kết quả từng lượt nộp' : ' · Theo thay đổi BXH' : '';
    const value = !(vnoj ? candidate.vnojUsername : candidate.codeforcesHandle) ? 'Chưa gắn tài khoản.' : !settings.enabled ? 'Chưa bật theo dõi contest.' : participant?.status === 'live' ? `${points(resultStyle(settings,snapshot.contest)==='ICPC'?participant.problems.filter(p=>problemAccepted(p,snapshot.contest)).length:participant.points)} ${resultStyle(settings,snapshot.contest) === 'ICPC' ? 'bài' : 'điểm'}${participant.sessionLabel ? ` · ${participant.sessionLabel}` : ''}${participant.rank ? ` · Hạng #${participant.rank}` : ` · ${PARTICIPATIONS[participant.type] || 'Ngoài BXH'}`}${vnoj ? ` · Phạt ${points(participant.penalty)}` : ''}${participant.lastSubmission ? ` · ${verdictText(participant.lastSubmission,resultStyle(settings,snapshot.contest))}` : ''}${snapshot?.status === 'stale' ? ' · Dữ liệu cũ' : ''}` : participant?.message || snapshot?.message || 'Lưu để nhận điểm.';
    node.textContent = value + mode; node.dataset.status = snapshot?.status === 'stale' ? 'stale' : participant?.status || snapshot?.status || 'waiting';
  });
}

export function renderTileContest(panel, candidate, settings, snapshot) {
  const node = $('.tile-contest', panel.node);
  const vnoj = settings?.provider === 'vnoj', handle = vnoj ? candidate.vnojUsername : candidate.codeforcesHandle;
  const visible = settings?.enabled && settings.showOnLive !== false && Boolean(handle);
  node.classList.toggle('hidden', !visible);
  node.setAttribute('aria-label', `Thành tích ${vnoj ? 'VNOJ' : 'Codeforces'} của ${candidate.name}`);
  if (!visible) return;
  const matchesSource = snapshot && (snapshot.provider || 'codeforces') === (settings.provider || 'codeforces') && (settings.url === snapshot.source || settings.url === String(snapshot.contest?.id));
  const participant = matchesSource ? snapshot.participants?.[candidate.id] : null;
  const signature = JSON.stringify([handle, vnoj, candidate.vnojParticipationId, candidate.codeforcesParticipation, candidate.realName, settings.style, participant, matchesSource && snapshot.status, matchesSource && snapshot.contest?.type, matchesSource && snapshot.contest?.frozen]);
  if (signature === panel.contestSignature) return;
  panel.contestSignature = signature;
  node.dataset.status = snapshot?.status || 'waiting';
  if (participant?.status !== 'live') {
    node.innerHTML = `<div class="tile-contest-identity"><span class="cf-monogram">${vnoj ? 'VNOJ' : 'CF'}</span><strong>${esc(handle)}</strong></div><span class="tile-contest-pending">${esc(participant?.message || (matchesSource ? snapshot?.message : 'Chờ áp dụng contest') || 'Đang nhận điểm…')}</span>`;
    return;
  }
  const scoreChanged = Number.isFinite(panel.lastContestPoints) && panel.lastContestPoints !== participant.points;
  panel.lastContestPoints = participant.points;
  const contestType = resultStyle(settings,snapshot.contest);
  const total = contestType === 'ICPC' ? participant.problems.filter(p=>problemAccepted(p,snapshot.contest)).length : participant.points;
  const latest = participant.lastSubmission;
  node.innerHTML = `<div class="tile-contest-summary"><div class="tile-contest-identity"><span class="cf-monogram">${vnoj ? 'VNOJ' : 'CF'}</span><strong>${esc(participant.handle)}</strong>${candidate.realName ? `<span class="tile-real-name">${esc(candidate.realName)}</span>` : ''}<span class="tile-contest-rank">${vnoj ? esc(participant.sessionLabel) + (participant.rank ? ` · #${participant.rank}` : '') : participant.rank ? `#${participant.rank}` : esc(PARTICIPATIONS[participant.type] || 'Ngoài BXH')}</span></div>
    <div class="tile-contest-problems">${participant.problems.map(p => `<span data-scored="${p.points > 0}" data-rejected="${!(p.points > 0) && p.rejectedAttempts > 0}" title="Bài ${esc(p.index)}: ${points(p.points)} điểm${p.rejectedAttempts ? `, ${p.rejectedAttempts} lần sai` : ''}"><b>${esc(p.index)}</b>${esc(contestType==='ICPC'?problemLabel({...p,points:problemAccepted(p,snapshot.contest)?1:0},contestType):points(p.points))}</span>`).join('')}</div></div>
    <div class="tile-contest-score"><div class="tile-contest-total"><strong>${points(total)}</strong><span>${contestType === 'ICPC' ? 'bài' : 'điểm'}</span>${contestType === 'ICPC' ? `<small>Phạt ${points(participant.penalty)}</small>` : ''}</div><span class="tile-contest-latest" data-verdict="${latest?.verdict || ''}" title="${latest ? `Lần nộp mới nhất nhận được${latest.submittedAt ? ` · ${time(latest.submittedAt)}` : ''}` : ''}">${snapshot.status === 'stale' ? 'Điểm cập nhật cuối' : snapshot.contest.frozen && !snapshot.asManager ? 'BXH đóng băng' : latest ? esc(verdictText(latest,contestType)) + (participant.submissionStale ? ' · cũ' : '') : vnoj ? 'BXH gồm thi ảo' : 'Chưa có dữ liệu lượt nộp'}</span></div>`;
  if (scoreChanged) $('.tile-contest-total', node).classList.add('score-updated');
}
