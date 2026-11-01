import { parseVnojContest, summarizeVnoj, VnojClient } from './vnoj.mjs';

export class VnojTracker {
  constructor(onUpdate, { client = new VnojClient(), now = Date.now, minimumDelayMs = 1000 } = {}) {
    this.client = client; this.onUpdate = onUpdate; this.now = now; this.minimumDelayMs = minimumDelayMs; this.entries = new Map(); this.snapshots = new Map(); this.closed = false;
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
      const signature = JSON.stringify([settings.url, settings.refreshSeconds, members.map(c => [c.id, c.vnojUsername, c.vnojParticipationId])]);
      if (this.entries.get(groupId)?.signature === signature) continue;
      this.cancel(groupId);
      const entry = { groupId, contest: parseVnojContest(settings.url), settings: structuredClone(settings), members: structuredClone(members), signature, controller: new AbortController(), running: false, failures: 0 };
      this.entries.set(groupId, entry); this.snapshots.delete(groupId);
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
      for (const c of entry.members) { const normalized = summarizeVnoj(raw, entry.contest, c.vnojUsername, c.vnojParticipationId); contest = normalized.contest; participants[c.id] = { ...normalized.participant, checkedAt: this.now() }; }
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
  close() { this.closed = true; for (const id of this.entries.keys()) this.cancel(id); }
}
