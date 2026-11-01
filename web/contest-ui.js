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
  const vnoj = settings.provider === 'vnoj';
  return `<section class="contest-controls" id="contest-controls" aria-label="Thành tích thi đấu">
    <div class="contest-controls-heading"><div class="contest-section-name">${icon('chart-line')}<div><strong>Thành tích ${vnoj ? 'VNOJ' : 'Codeforces'}</strong><small id="contest-state">Chọn contest cho nhóm này</small></div></div><div class="contest-control-actions"><button class="text-button ${vnoj ? 'hidden' : ''}" id="contest-api-settings">${icon('key')} Kết nối API</button><label class="switch"><input id="contest-enabled" type="checkbox" aria-label="Theo dõi thành tích thi đấu" ${settings.enabled ? 'checked' : ''}><span></span></label></div></div>
    <div class="contest-provider-row"><label>Nguồn điểm<select id="contest-provider">${options([['codeforces','Codeforces'],['vnoj','VNOJ · ICPC']],settings.provider || 'codeforces')}</select></label><span>${vnoj ? 'BXH công khai gồm thi ảo · ghim riêng từng phiên' : 'Contest và Gym · tài khoản BTC cho bảng điểm cần quyền'}</span></div>
    <div class="contest-fields ${settings.enabled ? '' : 'hidden'}" id="contest-fields">
      <div class="contest-fields-grid"><label>Contest của nhóm<input id="contest-url" placeholder="${vnoj ? 'https://oj.vnoi.info/contest/…' : 'https://codeforces.com/gym/…'}" value="${esc(settings.url)}" spellcheck="false"></label><label>Nhịp cập nhật<select id="contest-refresh">${options([[15,'15 giây'],[30,'30 giây'],[60,'1 phút'],[120,'2 phút'],[180,'3 phút']], settings.refreshSeconds)}</select></label><button class="button" id="refresh-contest" title="Cập nhật điểm ngay">${icon('arrows-clockwise')} Cập nhật</button></div>
      <div class="contest-toggles"><label class="check-label"><input id="contest-show-live" type="checkbox" ${settings.showOnLive ? 'checked' : ''}> Hiện điểm trên live</label><label class="check-label ${vnoj ? 'hidden' : ''}"><input id="contest-manager" type="checkbox" ${settings.asManager ? 'checked' : ''}> Dùng quyền quản lý Gym</label><span class="contest-access-note ${settings.asManager && !vnoj ? '' : 'hidden'}" id="contest-access-note">Có thể bao gồm kết quả ẩn khỏi thí sinh.</span></div>
      <div class="contest-feed" id="contest-feed" aria-live="polite"></div>
    </div>
  </section>`;
}
export function candidateContestFields(candidate, settings) {
  if (settings?.provider === 'vnoj') return `<div class="candidate-contest-fields"><label class="cf-handle-label"><span>VNOJ</span><input class="candidate-vnoj-username" aria-label="Username VNOJ của ${esc(candidate.name)}" maxlength="150" spellcheck="false" autocapitalize="none" placeholder="username thí sinh" value="${esc(candidate.vnojUsername || '')}"></label><select class="candidate-vnoj-session" aria-label="Phiên VNOJ của ${esc(candidate.name)}"><option value="">Lưu username để tìm phiên</option>${candidate.vnojParticipationId ? `<option value="${candidate.vnojParticipationId}" selected>Phiên đã ghim · ${candidate.vnojParticipationId}</option>` : ''}</select></div><div class="candidate-contest-result" data-contest-result-id="${candidate.id}"></div>`;
  return `<div class="candidate-contest-fields"><label class="cf-handle-label"><span>CODEFORCES</span><input class="candidate-cf-handle" aria-label="Handle Codeforces của ${esc(candidate.name)}" maxlength="24" spellcheck="false" autocapitalize="none" placeholder="handle thí sinh" value="${esc(candidate.codeforcesHandle || '')}"></label><select class="candidate-cf-participation" aria-label="Phiên thi Codeforces của ${esc(candidate.name)}">${options(Object.entries(PARTICIPATIONS), candidate.codeforcesParticipation || 'auto')}</select></div><div class="candidate-contest-result" data-contest-result-id="${candidate.id}"></div>`;
}
export function bindContestControls(owner) {
  const settings = owner.config.groups[owner.group].codeforces;
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
      feed.innerHTML = snapshot?.contest ? `<div><span class="feed-status-dot" data-status="${snapshot.status}"></span><strong>${esc(snapshot.contest.name)}</strong><span class="feed-type">${esc(snapshot.contest.type)}</span>${snapshot.asManager ? '<span class="feed-access">Quyền quản lý</span>' : ''}${snapshot.contest.frozen ? '<span class="feed-frozen">BXH đóng băng</span>' : ''}<time>${snapshot.checkedAt ? time(snapshot.checkedAt) : ''}</time></div>${snapshot.status === 'stale' ? '<p>Đang giữ điểm lần cập nhật cuối; sẽ tự thử kết nối lại.</p>' : snapshot.submissionWarning ? '<p>Điểm đã cập nhật; dữ liệu lần nộp mới nhất đang chờ kết nối lại.</p>' : vnoj ? '<p>Hạng theo BXH công khai gồm thi ảo. Điểm thuộc đúng mã phiên đã chọn; không trộn các lần thi.</p>' : '<p>Điểm lấy từ bảng standings; kết quả nộp không được cộng trùng.</p>'}` : vnoj ? '<p>Nhập username, lưu để tìm các phiên, sau đó chọn đúng phiên VNOJ và lưu lại. Không cần khoá API cho BXH công khai.</p>' : '<p>Nhập handle ở danh sách thí sinh. Key/Secret được cấu hình riêng bằng nút Kết nối API.</p>';
    }
  }
  $$('[data-contest-result-id]').forEach(node => {
    const candidate = owner.config.candidates.find(c => c.id === node.dataset.contestResultId), participant = snapshot?.participants?.[candidate.id];
    if (vnoj) {
      const select = $(`.participant-row[data-id="${candidate.id}"] .candidate-vnoj-session`);
      const sessions = participant?.handle?.toLowerCase() === candidate.vnojUsername?.toLowerCase() ? participant.sessions || [] : [];
      if (select) {
        const entries = [['', sessions.length ? 'Chọn phiên thi' : 'Lưu username để tìm phiên'], ...sessions.map(s => [s.id, `${s.virtual > 0 ? `Thi ảo #${s.virtual}` : 'Chính thức'} · ${points(s.points)} bài · ${s.id}`])];
        if (candidate.vnojParticipationId && !sessions.some(s => s.id === candidate.vnojParticipationId)) entries.push([candidate.vnojParticipationId, `Phiên đã ghim · ${candidate.vnojParticipationId}`]);
        const signature = JSON.stringify([entries, candidate.vnojParticipationId]);
        if (select.dataset.signature !== signature) { select.innerHTML = options(entries, candidate.vnojParticipationId || ''); select.dataset.signature = signature; }
      }
    }
    const value = !(vnoj ? candidate.vnojUsername : candidate.codeforcesHandle) ? 'Chưa gắn tài khoản.' : !settings.enabled ? 'Chưa bật theo dõi contest.' : participant?.status === 'live' ? `${points(participant.points)} ${snapshot.contest?.type === 'ICPC' ? 'bài' : 'điểm'}${participant.sessionLabel ? ` · ${participant.sessionLabel}` : ''}${participant.rank ? ` · Hạng #${participant.rank}` : ` · ${PARTICIPATIONS[participant.type] || 'Ngoài BXH'}`}${vnoj ? ` · Phạt ${points(participant.penalty)}` : ''}${participant.lastSubmission ? ` · ${verdictText(participant.lastSubmission)}` : ''}${snapshot?.status === 'stale' ? ' · Dữ liệu cũ' : ''}` : participant?.message || snapshot?.message || 'Lưu để nhận điểm.';
    node.textContent = value; node.dataset.status = snapshot?.status === 'stale' ? 'stale' : participant?.status || snapshot?.status || 'waiting';
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
  const signature = JSON.stringify([handle, vnoj, candidate.vnojParticipationId, candidate.codeforcesParticipation, participant, matchesSource && snapshot.status, matchesSource && snapshot.contest?.type, matchesSource && snapshot.contest?.frozen]);
  if (signature === panel.contestSignature) return;
  panel.contestSignature = signature;
  node.dataset.status = snapshot?.status || 'waiting';
  if (participant?.status !== 'live') {
    node.innerHTML = `<div class="tile-contest-identity"><span class="cf-monogram">${vnoj ? 'VNOJ' : 'CF'}</span><strong>${esc(handle)}</strong></div><span class="tile-contest-pending">${esc(participant?.message || (matchesSource ? snapshot?.message : 'Chờ áp dụng contest') || 'Đang nhận điểm…')}</span>`;
    return;
  }
  const scoreChanged = Number.isFinite(panel.lastContestPoints) && panel.lastContestPoints !== participant.points;
  panel.lastContestPoints = participant.points;
  const contestType = snapshot.contest.type;
  const latest = participant.lastSubmission;
  node.innerHTML = `<div class="tile-contest-summary"><div class="tile-contest-identity"><span class="cf-monogram">${vnoj ? 'VNOJ' : 'CF'}</span><strong>${esc(participant.handle)}</strong><span class="tile-contest-rank">${vnoj ? esc(participant.sessionLabel) + (participant.rank ? ` · #${participant.rank}` : '') : participant.rank ? `#${participant.rank}` : esc(PARTICIPATIONS[participant.type] || 'Ngoài BXH')}</span></div>
    <div class="tile-contest-problems">${participant.problems.map(p => `<span data-scored="${p.points > 0}" data-rejected="${!(p.points > 0) && p.rejectedAttempts > 0}" title="Bài ${esc(p.index)}: ${points(p.points)} điểm${p.rejectedAttempts ? `, ${p.rejectedAttempts} lần sai` : ''}"><b>${esc(p.index)}</b>${p.points > 0 ? points(p.points) : contestType==='ICPC'&&p.rejectedAttempts > 0 ? `−${p.rejectedAttempts}` : '—'}</span>`).join('')}</div></div>
    <div class="tile-contest-score"><div class="tile-contest-total"><strong>${points(participant.points)}</strong><span>${contestType === 'ICPC' ? 'bài' : 'điểm'}</span>${contestType === 'ICPC' ? `<small>Phạt ${points(participant.penalty)}</small>` : ''}</div><span class="tile-contest-latest" data-verdict="${latest?.verdict || ''}" title="${latest ? `Lần nộp mới nhất nhận được${latest.submittedAt ? ` · ${time(latest.submittedAt)}` : ''}` : ''}">${snapshot.status === 'stale' ? 'Điểm cập nhật cuối' : snapshot.contest.frozen && !snapshot.asManager ? 'BXH đóng băng' : vnoj ? 'BXH gồm thi ảo' : latest ? esc(verdictText(latest)) + (participant.submissionStale ? ' · cũ' : '') : 'Chưa có dữ liệu lượt nộp'}</span></div>`;
  if (scoreChanged) $('.tile-contest-total', node).classList.add('score-updated');
}
