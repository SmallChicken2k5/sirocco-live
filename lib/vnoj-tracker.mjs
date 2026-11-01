import { parseVnojContest, summarizeVnoj, VnojClient } from './vnoj.mjs';
import { ResultJournal, BoardJournal, resultStyle } from './results.mjs';

export class VnojTracker {
  constructor(onUpdate, { client = new VnojClient(), now = Date.now, minimumDelayMs = 1000 } = {}) {
    this.client = client; this.onUpdate = onUpdate; this.now = now; this.minimumDelayMs = minimumDelayMs; this.entries = new Map(); this.snapshots = new Map(); this.closed = false; this.bridges = new Map();
  }
  current(e) { return !this.closed && this.entries.get(e.groupId) === e && !e.controller.signal.aborted; }
  publish(e, value) { if (this.current(e)) { const s = { groupId: e.groupId, provider: 'vnoj', source: e.contest.url, asManager: false, ...value }; this.snapshots.set(e.groupId, s); this.onUpdate(s); } }
  cancel(id) { const e = this.entries.get(id); if (e) { clearTimeout(e.timer); e.controller.abort(); this.entries.delete(id); } }
  reconcile(config) {
    for (const id of this.entries.keys()) if (!config.groups[id] || config.groups[id].codeforces?.provider !== 'vnoj' || !config.groups[id].codeforces.enabled || config.demo) { this.cancel(id); this.snapshots.delete(id); }
    for (const [groupId, group] of Object.entries(config.groups)) {
      const settings = group.codeforces;
      if (settings?.provider !== 'vnoj' || !settings.enabled || config.demo) continue;
      const members = config.candidates.filter(c => c.group === groupId && c.enabled && c.vnojUsername);
      const signature = JSON.stringify([settings.url, settings.refreshSeconds, settings.style, members.map(c => [c.id, c.vnojUsername, c.vnojParticipationId])]);
      if (this.entries.get(groupId)?.signature === signature) continue;
      this.cancel(groupId);
      const entry = { groupId, contest: parseVnojContest(settings.url), settings: structuredClone(settings), members: structuredClone(members), signature, controller: new AbortController(), running: false, failures: 0 };
      entry.journals = new Map(); entry.resultModes = new Map(); this.entries.set(groupId, entry); this.snapshots.delete(groupId);
      this.publish(entry, { status: members.length ? 'connecting' : 'waiting', message: members.length ? 'Đang đọc BXH VNOJ gồm thi ảo…' : 'Nhập username VNOJ rồi lưu để tìm phiên thi.', participants: {}, checkedAt: null, fetching: members.length > 0 });
      if (members.length) void this.poll(entry);
    }
  }
  async poll(entry) {
    if (!this.current(entry) || entry.running) return;
    entry.running = true;
    const previous = this.snapshots.get(entry.groupId), started = this.now();
    if (previous?.contest) this.publish(entry, { ...previous, fetching: true });
    try {
      const raw = await this.client.standings(entry.contest, { signal: entry.controller.signal });
      if (!this.current(entry)) return;
      let contest; const participants = {};
      for (const c of entry.members) {
        const normalized = summarizeVnoj(raw, entry.contest, c.vnojUsername, c.vnojParticipationId); contest = normalized.contest;
        const participant = { ...normalized.participant, checkedAt: this.now(), resultEvents: [] };
        if (participant.status === 'live' && !contest.frozen) {
          const key = JSON.stringify([entry.contest.id, participant.handle.toLowerCase(), participant.participationId]);
          const bridge = this.bridges.get(key), exact = bridge && this.now() - bridge.receivedAt < 90000;
          const journalKey = `${c.id}:${participant.participationId}:${exact ? 'exact' : 'board'}`;
          if (entry.resultModes.get(c.id) !== journalKey) { for (const k of entry.journals.keys()) if (k.startsWith(c.id + ':')) entry.journals.delete(k); entry.resultModes.set(c.id,journalKey); }
          if (!entry.journals.has(journalKey)) entry.journals.set(journalKey, exact ? new ResultJournal() : new BoardJournal());
          const journal = entry.journals.get(journalKey);
          const submissions = exact ? bridge.submissions.filter(s=>contest.problems.some(p=>p.index===s.index)) : [];
          participant.resultEvents = exact ? journal.consume(submissions, resultStyle(entry.settings, contest), contest.problems, this.now(), participant.problems) : journal.consume(participant, resultStyle(entry.settings, contest), this.now());
          participant.resultMode = exact ? 'exact' : 'scoreboard';
          if (exact) participant.lastSubmission = [...submissions].sort((a,b)=>b.id-a.id)[0] || null;
        } else { for (const k of entry.journals.keys()) if (k.startsWith(c.id + ':')) entry.journals.delete(k); entry.resultModes.delete(c.id); }
        participants[c.id] = participant;
      }
      entry.failures = 0; const nextCheckAt = Math.max(this.now() + this.minimumDelayMs, started + entry.settings.refreshSeconds * 1000);
      this.publish(entry, { status: 'live', message: 'BXH VNOJ đã đồng bộ. Phiên đã chọn được giữ cố định.', contest, participants, checkedAt: this.now(), fetching: false, nextCheckAt });
      this.schedule(entry, nextCheckAt - this.now());
    } catch (error) {
      if (!this.current(entry)) return;
      const keep = error.code !== 'ACCESS' && !!previous?.contest;
      const retryMs = Math.min(180000, Math.max(15000, entry.settings.refreshSeconds * 1000) * 2 ** Math.min(entry.failures++, 3));
      this.publish(entry, { status: keep ? 'stale' : 'error', message: error.message || 'Chưa đọc được VNOJ.', ...(keep ? { contest: previous.contest, participants: previous.participants, checkedAt: previous.checkedAt } : { participants: {}, checkedAt: null }), fetching: false, nextCheckAt: this.now() + retryMs });
      this.schedule(entry, retryMs);
    } finally { entry.running = false; }
  }
  schedule(e, ms) { if (this.current(e)) { clearTimeout(e.timer); e.timer = setTimeout(() => void this.poll(e), Math.max(this.minimumDelayMs, ms)); e.timer.unref?.(); } }
  refresh(id) { const e = this.entries.get(id); if (!e || !e.members.length) return false; if (!e.running) { clearTimeout(e.timer); void this.poll(e); } return true; }
  acceptBridge(payload) {
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.submissions) || payload.submissions.length > 5000) return false;
    const matching = [...this.entries.values()].filter(e=>e.contest.id === payload.contest && e.members.some(c=>c.vnojUsername.toLowerCase() === String(payload.username).toLowerCase() && c.vnojParticipationId === payload.participationId));
    if (!matching.length) return false;
    const submissions = payload.submissions.filter(s=>s && Number.isSafeInteger(s.id) && s.id > 0 && typeof s.index === 'string' && /^[A-Za-z0-9_-]{1,30}$/.test(s.index) && typeof s.verdict === 'string' && /^(AC|WA|TLE|MLE|RE|RTE|CE|IE|AB|PARTIAL|NOT_AC|SUBMITTED|TESTING)$/.test(s.verdict) && (s.points == null || Number.isFinite(s.points))).map(s=>({id:s.id,index:s.index,verdict:s.verdict,points:s.points ?? null,testing:s.testing===true,submittedAt:Number.isFinite(s.submittedAt)?s.submittedAt:null}));
    const key = JSON.stringify([payload.contest, String(payload.username).toLowerCase(), payload.participationId]);
    this.bridges.set(key, { submissions, receivedAt: this.now() });
    for (const e of matching) this.refresh(e.groupId);
    return true;
  }
  close() { this.closed = true; for (const id of this.entries.keys()) this.cancel(id); }
}
