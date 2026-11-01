import { $, $$, esc, icon, api, toast, options, time } from './common.js';

export const PARTICIPATIONS = { auto: 'Tự chọn phiên', CONTESTANT: 'Chính thức', OUT_OF_COMPETITION: 'Ngoài cuộc thi', VIRTUAL: 'Thi ảo', MANAGER: 'Quản lý', PRACTICE: 'Luyện tập' };
const pointFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
export const points = value => Number.isFinite(value) ? pointFormat.format(value) : '—';
export function verdictText(submission) {
  if (!submission) return '';
  const labels = { OK: 'AC', PARTIAL: 'Một phần', WRONG_ANSWER: 'WA', TIME_LIMIT_EXCEEDED: 'TLE', MEMORY_LIMIT_EXCEEDED: 'MLE', RUNTIME_ERROR: 'RE', COMPILATION_ERROR: 'CE', TESTING: 'Đang chấm', SUBMITTED: 'Đang chờ', SKIPPED: 'Bỏ qua', REJECTED: 'Từ chối', FAILED: 'Lỗi chấm', CHALLENGED: 'Bị hack' };
  return `${submission.index} · ${labels[submission.verdict] || submission.verdict}${Number.isFinite(submission.points) ? ` · ${points(submission.points)}đ` : ''}`;
}

export function contestControls(settings) {
  return `<section class="contest-controls" aria-label="Thành tích Codeforces">
    <div class="contest-controls-heading"><div class="contest-section-name">${icon('chart-line')}<div><strong>Thành tích Codeforces</strong><small id="contest-state">Chọn contest cho nhóm này</small></div></div><div class="contest-control-actions"><button class="text-button" id="contest-api-settings">${icon('key')} Kết nối API</button><label class="switch"><input id="contest-enabled" type="checkbox" aria-label="Theo dõi thành tích Codeforces" ${settings.enabled ? 'checked' : ''}><span></span></label></div></div>
    <div class="contest-fields ${settings.enabled ? '' : 'hidden'}" id="contest-fields">
      <div class="contest-fields-grid"><label>Contest của nhóm<input id="contest-url" placeholder="https://codeforces.com/gym/…" value="${esc(settings.url)}" spellcheck="false"></label><label>Nhịp cập nhật<select id="contest-refresh">${options([[15,'15 giây'],[30,'30 giây'],[60,'1 phút'],[120,'2 phút'],[180,'3 phút']], settings.refreshSeconds)}</select></label><button class="button" id="refresh-contest" title="Cập nhật điểm ngay">${icon('arrows-clockwise')} Cập nhật</button></div>
      <div class="contest-toggles"><label class="check-label"><input id="contest-show-live" type="checkbox" ${settings.showOnLive ? 'checked' : ''}> Hiện điểm trên live</label><label class="check-label"><input id="contest-manager" type="checkbox" ${settings.asManager ? 'checked' : ''}> Dùng quyền quản lý Gym</label><span class="contest-access-note ${settings.asManager ? '' : 'hidden'}" id="contest-access-note">Có thể bao gồm kết quả ẩn khỏi thí sinh.</span></div>
      <div class="contest-feed" id="contest-feed" aria-live="polite"></div>
    </div>
  </section>`;
}
export function candidateContestFields(candidate) {
  return `<div class="candidate-contest-fields"><label class="cf-handle-label"><span>CODEFORCES</span><input class="candidate-cf-handle" aria-label="Handle Codeforces của ${esc(candidate.name)}" maxlength="24" spellcheck="false" autocapitalize="none" placeholder="handle thí sinh" value="${esc(candidate.codeforcesHandle || '')}"></label><select class="candidate-cf-participation" aria-label="Phiên thi Codeforces của ${esc(candidate.name)}">${options(Object.entries(PARTICIPATIONS), candidate.codeforcesParticipation || 'auto')}</select></div><div class="candidate-contest-result" data-contest-result-id="${candidate.id}"></div>`;
}
export function bindContestControls(owner) {
  const settings = owner.config.groups[owner.group].codeforces;
  $('#contest-api-settings').onclick = () => owner.openCodeforces();
  $('#contest-enabled').onchange = event => { settings.enabled = event.target.checked; $('#contest-fields').classList.toggle('hidden', !settings.enabled); owner.changed(true); };
  $('#contest-url').oninput = event => { settings.url = event.target.value.trim(); owner.changed(true); };
  $('#contest-refresh').onchange = event => { settings.refreshSeconds = Number(event.target.value); owner.changed(); };
  $('#contest-manager').onchange = event => { settings.asManager = event.target.checked; $('#contest-access-note').classList.toggle('hidden', !settings.asManager); owner.changed(); };
  $('#contest-show-live').onchange = event => { settings.showOnLive = event.target.checked; owner.changed(true); };
  $('#refresh-contest').onclick = async () => {
    if (owner.dirty && !await owner.save()) return;
    try { await api('/api/codeforces/refresh', { groupId: owner.group }); toast('Đang cập nhật bảng điểm.'); } catch (error) { toast(error.message, true); }
  };
  $$('.participant-row').forEach(row => {
    const candidate = owner.config.candidates.find(c => c.id === row.dataset.id);
    $('.candidate-cf-handle', row).oninput = event => { candidate.codeforcesHandle = event.target.value.trim(); owner.changed(); };
    $('.candidate-cf-participation', row).onchange = event => { candidate.codeforcesParticipation = event.target.value; owner.changed(); };
  });
}
export function updateContestControls(owner) {
  const settings = owner.config.groups[owner.group].codeforces, snapshot = owner.state.contests?.[owner.group];
  const status = $('#contest-state');
  const text = !settings.enabled ? 'Gắn handle để theo dõi điểm từng thí sinh.' : snapshot?.fetching ? 'Đang cập nhật bảng điểm…' : snapshot?.message || 'Lưu cấu hình để bắt đầu đồng bộ.';
  if (status) { status.textContent = text; status.dataset.status = snapshot?.status || 'waiting'; }
  const feed = $('#contest-feed');
  if (feed) {
    const signature = JSON.stringify([snapshot?.status, snapshot?.checkedAt, snapshot?.contest?.name, snapshot?.contest?.frozen, snapshot?.asManager, snapshot?.fetching, snapshot?.submissionWarning]);
    if (feed.dataset.signature !== signature) {
      feed.dataset.signature = signature;
      feed.innerHTML = snapshot?.contest ? `<div><span class="feed-status-dot" data-status="${snapshot.status}"></span><strong>${esc(snapshot.contest.name)}</strong><span class="feed-type">${esc(snapshot.contest.type)}</span>${snapshot.asManager ? '<span class="feed-access">Quyền quản lý</span>' : ''}${snapshot.contest.frozen ? '<span class="feed-frozen">BXH đóng băng</span>' : ''}<time>${snapshot.checkedAt ? time(snapshot.checkedAt) : ''}</time></div>${snapshot.status === 'stale' ? '<p>Đang giữ điểm lần cập nhật cuối; sẽ tự thử kết nối lại.</p>' : snapshot.submissionWarning ? '<p>Điểm đã cập nhật; dữ liệu lần nộp mới nhất đang chờ kết nối lại.</p>' : '<p>Điểm lấy từ bảng standings; kết quả nộp không được cộng trùng.</p>'}` : '<p>Nhập handle ở danh sách thí sinh. Key/Secret được cấu hình riêng bằng nút Kết nối API.</p>';
    }
  }
  $$('[data-contest-result-id]').forEach(node => {
    const candidate = owner.config.candidates.find(c => c.id === node.dataset.contestResultId), participant = snapshot?.participants?.[candidate.id];
    const value = !candidate.codeforcesHandle ? 'Chưa gắn handle.' : !settings.enabled ? 'Chưa bật theo dõi contest.' : participant?.status === 'live' ? `${points(participant.points)} điểm${participant.rank ? ` · Hạng #${participant.rank}` : ` · ${PARTICIPATIONS[participant.type] || 'Ngoài BXH'}`}${participant.lastSubmission ? ` · ${verdictText(participant.lastSubmission)}` : ''}${snapshot?.status === 'stale' ? ' · Dữ liệu cũ' : ''}` : participant?.message || snapshot?.message || 'Lưu để nhận điểm.';
    node.textContent = value; node.dataset.status = snapshot?.status === 'stale' ? 'stale' : participant?.status || snapshot?.status || 'waiting';
  });
}

export function renderTileContest(panel, candidate, settings, snapshot) {
  const node = $('.tile-contest', panel.node);
  const visible = settings?.enabled && settings.showOnLive !== false && Boolean(candidate.codeforcesHandle);
  node.classList.toggle('hidden', !visible);
  if (!visible) return;
  const matchesSource = snapshot && (settings.url === snapshot.source || settings.url === String(snapshot.contest?.id));
  const participant = matchesSource ? snapshot.participants?.[candidate.id] : null;
  const signature = JSON.stringify([candidate.codeforcesHandle, candidate.codeforcesParticipation, participant, matchesSource && snapshot.status, matchesSource && snapshot.contest?.type, matchesSource && snapshot.contest?.frozen]);
  if (signature === panel.contestSignature) return;
  panel.contestSignature = signature;
  node.dataset.status = snapshot?.status || 'waiting';
  if (participant?.status !== 'live') {
    node.innerHTML = `<div class="tile-contest-identity"><span class="cf-monogram">CF</span><strong>${esc(candidate.codeforcesHandle)}</strong></div><span class="tile-contest-pending">${esc(participant?.message || (matchesSource ? snapshot?.message : 'Chờ áp dụng contest') || 'Đang nhận điểm…')}</span>`;
    return;
  }
  const scoreChanged = Number.isFinite(panel.lastContestPoints) && panel.lastContestPoints !== participant.points;
  panel.lastContestPoints = participant.points;
  const contestType = snapshot.contest.type;
  const latest = participant.lastSubmission;
  node.innerHTML = `<div class="tile-contest-top"><div class="tile-contest-identity"><span class="cf-monogram">CF</span><strong>${esc(participant.handle)}</strong><span class="tile-contest-rank">${participant.rank ? `#${participant.rank}` : esc(PARTICIPATIONS[participant.type] || 'Ngoài BXH')}</span></div><div class="tile-contest-total"><strong>${points(participant.points)}</strong><span>${contestType === 'ICPC' ? 'bài' : 'điểm'}</span>${contestType === 'ICPC' ? `<small>Phạt ${points(participant.penalty)}</small>` : ''}</div></div>
    <div class="tile-contest-bottom"><div class="tile-contest-problems">${participant.problems.map(p => `<span data-scored="${p.points > 0}" data-rejected="${!(p.points > 0) && p.rejectedAttempts > 0}" title="Bài ${esc(p.index)}: ${points(p.points)} điểm${p.rejectedAttempts ? `, ${p.rejectedAttempts} lần sai` : ''}"><b>${esc(p.index)}</b>${p.points > 0 ? points(p.points) : p.rejectedAttempts > 0 ? `−${p.rejectedAttempts}` : '—'}</span>`).join('')}</div><span class="tile-contest-latest" data-verdict="${latest?.verdict || ''}" title="${latest ? `Lần nộp mới nhất nhận được${latest.submittedAt ? ` · ${time(latest.submittedAt)}` : ''}` : ''}">${snapshot.status === 'stale' ? 'Điểm cập nhật cuối' : snapshot.contest.frozen && !snapshot.asManager ? 'BXH đóng băng' : latest ? esc(verdictText(latest)) + (participant.submissionStale ? ' · cũ' : '') : 'Chưa có dữ liệu lượt nộp'}</span></div>`;
  if (scoreChanged && !matchMedia('(prefers-reduced-motion: reduce)').matches) $('.tile-contest-total', node).animate([{ opacity: .5, transform: 'translateY(2px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
}
