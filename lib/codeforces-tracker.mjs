import { parseContestReference, summarizeStandings, latestSubmission, CodeforcesError } from './codeforces.mjs';

const accessErrors = new Set(['CONTEST_ACCESS', 'API_KEY', 'SIGNATURE', 'MISSING_CREDENTIALS']);
export class CodeforcesTracker {
  constructor(connection, onUpdate, { now = Date.now, minimumDelayMs = 1000 } = {}) {
    this.connection = connection; this.onUpdate = onUpdate; this.now = now; this.minimumDelayMs = minimumDelayMs;
    this.entries = new Map(); this.snapshots = new Map(); this.closed = false;
  }
  publish(groupId, value) { if (!this.closed) { this.snapshots.set(groupId, value); this.onUpdate(value); } }
  current(entry) { return !this.closed && !entry.controller.signal.aborted && this.entries.get(entry.groupId) === entry; }
  cancel(groupId) { const entry = this.entries.get(groupId); if (entry) { clearTimeout(entry.timer); entry.controller.abort(); this.entries.delete(groupId); } }
  reconcile(config) {
    for (const [groupId, group] of Object.entries(config.groups)) {
      const settings = group.codeforces || { enabled: false };
      const members = config.candidates.filter(c => c.group === groupId && c.enabled && c.codeforcesHandle);
      const signature = JSON.stringify([config.demo, settings.enabled, settings.url, settings.asManager, settings.refreshSeconds, members.map(c => [c.id, c.codeforcesHandle.toLowerCase(), c.codeforcesParticipation]), this.connection.revision, this.connection.status().configured]);
      if (this.entries.get(groupId)?.signature === signature) continue;
      this.cancel(groupId);
      const base = { groupId, status: 'disabled', message: 'Chưa bật thành tích Codeforces.', participants: {}, checkedAt: null, fetching: false, source: settings.url || '', asManager: settings.asManager === true };
      if (!settings.enabled || config.demo) { this.publish(groupId, base); continue; }
      if (!members.length) { this.publish(groupId, { ...base, status: 'waiting', message: 'Nhập handle Codeforces cho thí sinh rồi lưu.' }); continue; }
      const contest = parseContestReference(settings.url);
      if (contest.kind === 'gym' && !this.connection.status().configured) { this.publish(groupId, { ...base, status: 'credentials', message: 'Kết nối API Key để đọc bảng điểm Gym.' }); continue; }
      const entry = { groupId, settings: { ...settings, asManager: contest.kind === 'gym' && settings.asManager === true }, contest, members: structuredClone(members), signature, controller: new AbortController(), failures: 0, running: false, timer: null };
      this.entries.set(groupId, entry);
      this.publish(groupId, { ...base, status: 'connecting', fetching: true, message: 'Đang nhận bảng điểm Codeforces…' });
      void this.poll(entry);
    }
  }
  async readStandings(entry, handles) {
    const options = { handles, asManager: entry.settings.asManager, signal: entry.controller.signal };
    try { return { raw: await this.connection.standings(entry.contest, options), invalid: new Set() }; }
    catch (error) {
      if (error.code !== 'HANDLE_NOT_FOUND' || handles.length < 2) throw error;
      // One mistyped handle must not prevent the rest of a broadcast group from updating.
      let raw; const invalid = new Set();
      for (const handle of handles) {
        if (!this.current(entry)) throw new CodeforcesError('CANCELLED', 'Đã dừng lần cập nhật này.');
        try { const part = await this.connection.standings(entry.contest, { ...options, handles: [handle] }); if (!raw) raw = { ...part, rows: [] }; raw.rows.push(...part.rows); }
        catch (error) { if (error.code !== 'HANDLE_NOT_FOUND') throw error; invalid.add(handle.toLowerCase()); }
      }
      if (!raw) throw new CodeforcesError('HANDLE_NOT_FOUND', 'Codeforces không tìm thấy các handle đã nhập.');
      return { raw, invalid };
    }
  }
  async poll(entry) {
    if (!this.current(entry) || entry.running) return;
    entry.running = true;
    const started = this.now(), previous = this.snapshots.get(entry.groupId);
    if (previous && previous.status !== 'connecting') this.publish(entry.groupId, { ...previous, fetching: true, nextCheckAt: null });
    try {
      const handles = [...new Map(entry.members.map(c => [c.codeforcesHandle.toLowerCase(), c.codeforcesHandle])).values()];
      const { raw, invalid } = await this.readStandings(entry, handles);
      if (!this.current(entry)) return;
      const participants = {};
      let contest;
      for (const candidate of entry.members) {
        const normalized = summarizeStandings(raw, entry.contest.id, candidate.codeforcesHandle, candidate.codeforcesParticipation || 'auto');
        contest = normalized.contest;
        const participant = normalized.participant;
        participants[candidate.id] = participant ? { ...participant, status: 'live', checkedAt: this.now(), lastSubmission: null } : { handle: candidate.codeforcesHandle, status: 'not_found', message: invalid.has(candidate.codeforcesHandle.toLowerCase()) ? 'Không tìm thấy handle Codeforces.' : candidate.codeforcesParticipation === 'MANAGER' && !entry.settings.asManager ? 'Dòng quản lý cần bật quyền quản lý contest.' : 'Chưa thấy handle trong phiên thi đã chọn.' };
      }
      let snapshot = { groupId: entry.groupId, source: entry.contest.url, asManager: entry.settings.asManager, status: 'live', message: 'Bảng điểm đã đồng bộ.', contest, participants, checkedAt: this.now(), fetching: true, nextCheckAt: null, submissionWarning: false };
      this.publish(entry.groupId, snapshot);
      const submissionCache = new Map();
      if (!contest.frozen || entry.settings.asManager) for (const candidate of entry.members) {
        if (!this.current(entry)) return;
        const participant = participants[candidate.id];
        if (participant.status !== 'live') continue;
        const key = participant.handle.toLowerCase();
        try {
          if (!submissionCache.has(key)) submissionCache.set(key, await this.connection.submissions(entry.contest, { handle: participant.handle, asManager: entry.settings.asManager, signal: entry.controller.signal }));
          if (!this.current(entry)) return;
          participant.lastSubmission = latestSubmission(submissionCache.get(key), entry.contest.id, participant);
        } catch (error) {
          if (!this.current(entry)) return;
          if (accessErrors.has(error.code)) throw error;
          participant.submissionStale = true; snapshot.submissionWarning = true;
          const prior = previous?.participants?.[candidate.id];
          if (prior?.handle?.toLowerCase() === key && prior.type === participant.type) participant.lastSubmission = prior.lastSubmission || null;
        }
        snapshot = { ...snapshot, participants: structuredClone(participants) };
        this.publish(entry.groupId, snapshot);
      }
      entry.failures = 0;
      const nextCheckAt = Math.max(this.now() + this.minimumDelayMs, started + entry.settings.refreshSeconds * 1000);
      this.publish(entry.groupId, { ...snapshot, fetching: false, nextCheckAt });
      this.schedule(entry, nextCheckAt - this.now());
    } catch (error) {
      if (!this.current(entry)) return;
      entry.failures++;
      const keep = !accessErrors.has(error.code) && Boolean(previous?.contest && previous?.checkedAt);
      const retryMs = Math.min(180000, Math.max(15000, entry.settings.refreshSeconds * 1000) * 2 ** Math.min(entry.failures - 1, 3));
      this.publish(entry.groupId, { groupId: entry.groupId, source: entry.contest.url, asManager: entry.settings.asManager, ...(keep ? { contest: previous.contest, participants: previous.participants, checkedAt: previous.checkedAt } : { participants: {}, checkedAt: null }), status: keep ? 'stale' : 'error', message: error instanceof CodeforcesError ? error.message : 'Chưa cập nhật được Codeforces. Sẽ tự thử lại.', fetching: false, nextCheckAt: this.now() + retryMs });
      this.schedule(entry, retryMs);
    } finally { entry.running = false; }
  }
  schedule(entry, ms) { if (this.current(entry)) { clearTimeout(entry.timer); entry.timer = setTimeout(() => void this.poll(entry), Math.max(this.minimumDelayMs, ms)); entry.timer.unref?.(); } }
  refresh(groupId) { const entry = this.entries.get(groupId); if (!entry) return false; if (!entry.running) { clearTimeout(entry.timer); void this.poll(entry); } return true; }
  close() { this.closed = true; for (const id of this.entries.keys()) this.cancel(id); }
}
