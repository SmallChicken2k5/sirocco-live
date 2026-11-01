import { CodeforcesTracker } from './codeforces-tracker.mjs';
import { VnojTracker } from './vnoj-tracker.mjs';

export class ContestTracker {
  constructor(connection, onUpdate, vnojOptions) {
    this.snapshots = new Map(); this.providers = new Map();
    const receive = provider => snapshot => { if (this.providers.get(snapshot.groupId) === provider) { const value = { ...snapshot, provider }; this.snapshots.set(snapshot.groupId, value); onUpdate(value); } };
    this.codeforces = new CodeforcesTracker(connection, receive('codeforces'));
    this.vnoj = new VnojTracker(receive('vnoj'), vnojOptions);
  }
  reconcile(config) {
    this.providers = new Map(Object.entries(config.groups).map(([id, g]) => [id, g.codeforces?.provider === 'vnoj' ? 'vnoj' : 'codeforces']));
    for (const id of this.snapshots.keys()) if (!this.providers.has(id)) this.snapshots.delete(id);
    this.codeforces.reconcile({ ...config, groups: Object.fromEntries(Object.entries(config.groups).map(([id, g]) => [id, { ...g, codeforces: { ...g.codeforces, enabled: g.codeforces?.provider !== 'vnoj' && g.codeforces?.enabled } }])) });
    this.vnoj.reconcile(config);
    for (const [id, provider] of this.providers) if (provider === 'vnoj' && (!config.groups[id].codeforces.enabled || config.demo)) {
      const value = { groupId: id, provider, source: config.groups[id].codeforces.url, asManager: false, status: 'disabled', participants: {}, checkedAt: null, fetching: false, message: 'Chưa bật thành tích VNOJ.' }; this.snapshots.set(id, value);
    }
  }
  refresh(id) { return this.providers.get(id) === 'vnoj' ? this.vnoj.refresh(id) : this.codeforces.refresh(id); }
  close() { this.codeforces.close(); this.vnoj.close(); }
}
