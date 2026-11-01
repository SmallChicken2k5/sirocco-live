import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CodeforcesTracker } from '../lib/codeforces-tracker.mjs';
import { CodeforcesError, summarizeStandings, latestSubmission } from '../lib/codeforces.mjs';
import { defaultConfig, normalizeConfig, publicConfig } from '../lib/config.mjs';

const member = (id, handle = id, type = 'auto') => ({ id, name: id, group: 'nonpro', enabled: true, url: '', language: 'auto', codeforcesHandle: handle, codeforcesParticipation: type });
const row = (handle, points = 145, type = 'CONTESTANT', start = undefined) => ({ party: { members: [{ handle }], participantType: type, startTimeSeconds: start }, rank: 3, points, penalty: 20, problemResults: [{ points: 100, rejectedAttemptCount: 0 }, { points: points - 100, rejectedAttemptCount: 1 }] });
const raw = (rows = [row('fixture_user')], frozen = false) => ({ contest: { id: 123456, name: 'Fixture Gym', type: 'IOI', phase: 'CODING', frozen }, problems: [{ index: 'A', points: 100 }, { index: 'B', points: 100 }], rows });
function config(members = [member('one', 'fixture_user')]) { const c = defaultConfig(); c.candidates = members; c.groups.nonpro.codeforces = { enabled: true, url: 'https://codeforces.com/gym/123456', asManager: false, refreshSeconds: 30, showOnLive: true }; return c; }
const submission = (id, handle = 'fixture_user', type = 'CONTESTANT', points = 20, start = undefined) => ({ id, contestId: 123456, author: { members: [{ handle }], participantType: type, startTimeSeconds: start }, problem: { index: 'B' }, verdict: 'PARTIAL', points, creationTimeSeconds: 1700000000 });
function connection(overrides = {}) { return { revision: 0, status: () => ({ configured: true }), standings: async () => raw(), submissions: async () => [submission(10)], ...overrides }; }
function tracker(t, source) { const updates = []; const instance = new CodeforcesTracker(source, s => updates.push(structuredClone(s))); t.after(() => instance.close()); return { instance, updates }; }
async function waitFor(predicate) { const deadline = Date.now() + 2500; while (Date.now() < deadline) { if (predicate()) return; await new Promise(r => setTimeout(r, 5)); } throw new Error('Tracker did not reach expected state'); }
const finished = instance => instance.snapshots.get('nonpro')?.status === 'live' && !instance.snapshots.get('nonpro')?.fetching;
test('Codeforces result events come from new final submissions, including a lower score with unchanged standings',async t=>{
  let submissions=[submission(10,'fixture_user','CONTESTANT',70)];
  const {instance}=tracker(t,connection({submissions:async()=>submissions}));const c=config();c.groups.nonpro.codeforces.style='IOI';instance.reconcile(c);await waitFor(()=>finished(instance));assert.equal(instance.snapshots.get('nonpro').participants.one.resultEvents.length,0);
  submissions=[submission(11,'fixture_user','CONTESTANT',20),...submissions];instance.refresh('nonpro');await waitFor(()=>finished(instance)&&instance.snapshots.get('nonpro').participants.one.lastSubmission.id===11);
  const participant=instance.snapshots.get('nonpro').participants.one;assert.equal(participant.points,145);assert.equal(participant.resultEvents[0].tone,'failure');assert.equal(participant.resultEvents[0].previousPoints,70);
});

test('tracker batches standings handles and publishes official partial totals before submission metadata', async t => {
  const calls = [];
  const source = connection({ standings: async (_contest, options) => { calls.push(options.handles); return raw([row('fixture_user'), row('second_user', 170)]); } });
  const { instance, updates } = tracker(t, source);
  instance.reconcile(config([member('one', 'fixture_user'), member('two', 'second_user')]));
  await waitFor(() => finished(instance));
  assert.deepEqual(calls, [['fixture_user', 'second_user']]);
  assert.equal(instance.snapshots.get('nonpro').participants.one.points, 145);
  assert.equal(instance.snapshots.get('nonpro').participants.one.lastSubmission.points, 20);
  assert.equal(instance.snapshots.get('nonpro').participants.two.points, 170);
  assert.ok(updates.some(s => s.status === 'live' && s.fetching && s.participants.one.lastSubmission === null));
  assert.equal(instance.snapshots.get('nonpro').asManager, false);
});

test('removing a custom source aborts its in-flight requests and discards its snapshots',async t=>{
  let release,signal;const {instance}=tracker(t,connection({standings:async(_c,o)=>{signal=o.signal;return new Promise(r=>{release=r;});}}));
  const c=config();c.groups.custom=c.groups.nonpro;c.groups.nonpro={...c.groups.nonpro,codeforces:{enabled:false}};c.candidates[0].group='custom';instance.reconcile(c);
  await waitFor(()=>Boolean(release));delete c.groups.custom;c.candidates[0].group='icpc';instance.reconcile(c);assert.equal(signal.aborted,true);assert.equal(instance.snapshots.has('custom'),false);assert.equal(instance.entries.has('custom'),false);
  release(raw());await new Promise(r=>setTimeout(r,10));assert.equal(instance.snapshots.has('custom'),false);
});
test('refresh keeps matching submission metadata visible while fetching the new verdict',async t=>{
  let release,hold=false;const {instance,updates}=tracker(t,connection({submissions:async()=>hold?new Promise(r=>{release=r;}):[submission(10)]}));
  instance.reconcile(config());await waitFor(()=>finished(instance));hold=true;instance.refresh('nonpro');await waitFor(()=>Boolean(release));
  assert.equal(instance.snapshots.get('nonpro').participants.one.lastSubmission.id,10);assert.equal(updates.at(-1).fetching,true);
  release([submission(11)]);await waitFor(()=>finished(instance));assert.equal(instance.snapshots.get('nonpro').participants.one.lastSubmission.id,11);
});

test('unranked manager data requires explicit manager mode and stays unranked', async t => {
  let sawManager;
  const { instance } = tracker(t, connection({ standings: async (_c, o) => { sawManager = o.asManager; return raw([row('fixture_user', 200, 'MANAGER')]); }, submissions: async () => [submission(10, 'fixture_user', 'MANAGER', 100)] }));
  const c = config([member('one', 'fixture_user', 'MANAGER')]); c.groups.nonpro.codeforces.asManager = true;
  instance.reconcile(c); await waitFor(() => finished(instance));
  const snapshot = instance.snapshots.get('nonpro');
  assert.equal(sawManager, true); assert.equal(snapshot.asManager, true);
  assert.equal(snapshot.participants.one.rank, null); assert.equal(snapshot.participants.one.lastSubmission.verdict, 'PARTIAL');
});

test('participant selection does not mix practice points or different virtual sessions', () => {
  const data = raw([row('fixture_user', 200, 'PRACTICE'), row('fixture_user', 150, 'CONTESTANT'), row('fixture_user', 120, 'VIRTUAL', 100), row('fixture_user', 160, 'VIRTUAL', 200)]);
  assert.equal(summarizeStandings(data, 123456, 'fixture_user').participant.points, 150);
  const virtual = summarizeStandings(data, 123456, 'fixture_user', 'VIRTUAL').participant;
  assert.equal(virtual.points, 160);
  const latest = latestSubmission([submission(99, 'fixture_user', 'PRACTICE'), submission(98, 'fixture_user', 'VIRTUAL', 10, 100), submission(97, 'fixture_user', 'VIRTUAL', 30, 200)], 123456, virtual);
  assert.equal(latest.id, 97);
});

test('network failures preserve the last score as stale, but lost authorization clears it', async t => {
  let failure = null;
  const { instance } = tracker(t, connection({ standings: async () => { if (failure) throw failure; return raw(); } }));
  instance.reconcile(config()); await waitFor(() => finished(instance));
  const at = instance.snapshots.get('nonpro').checkedAt;
  failure = new CodeforcesError('NETWORK', 'Fixture network error'); instance.refresh('nonpro');
  await waitFor(() => instance.snapshots.get('nonpro').status === 'stale');
  assert.equal(instance.snapshots.get('nonpro').participants.one.points, 145);
  assert.equal(instance.snapshots.get('nonpro').checkedAt, at);
  failure = new CodeforcesError('CONTEST_ACCESS', 'Fixture permission error'); instance.refresh('nonpro');
  await waitFor(() => instance.snapshots.get('nonpro').status === 'error');
  assert.deepEqual(instance.snapshots.get('nonpro').participants, {});
});

test('changing contest membership cancels in-flight results from the previous configuration', async t => {
  let release, oldSignal, calls = 0;
  const { instance } = tracker(t, connection({ standings: async (_c, o) => { calls++; if (calls === 1) { oldSignal = o.signal; return new Promise(resolve => { release = resolve; }); } return raw([row('second_user', 180)]); } }));
  const c = config(); instance.reconcile(c); await waitFor(() => Boolean(release));
  c.candidates = [member('two', 'second_user')]; instance.reconcile(c);
  await waitFor(() => finished(instance)); assert.equal(oldSignal.aborted, true);
  release(raw()); await new Promise(r => setTimeout(r, 15));
  assert.equal(instance.snapshots.get('nonpro').participants.two.points, 180);
  assert.equal(instance.snapshots.get('nonpro').participants.one, undefined);
});

test('frozen public standings do not fetch newer submission verdicts', async t => {
  let submissions = 0;
  const { instance } = tracker(t, connection({ standings: async () => raw(undefined, true), submissions: async () => { submissions++; return []; } }));
  instance.reconcile(config()); await waitFor(() => finished(instance));
  assert.equal(instance.snapshots.get('nonpro').contest.frozen, true);
  assert.equal(submissions, 0); assert.equal(instance.snapshots.get('nonpro').participants.one.lastSubmission, null);
});

test('a mistyped handle is isolated while valid participants continue updating', async t => {
  const { instance } = tracker(t, connection({ standings: async (_c, o) => { if (o.handles.length > 1 || o.handles[0] === 'unknown_user') throw new CodeforcesError('HANDLE_NOT_FOUND', 'Fixture invalid handle'); return raw(); } }));
  instance.reconcile(config([member('one', 'fixture_user'), member('two', 'unknown_user')]));
  await waitFor(() => finished(instance));
  assert.equal(instance.snapshots.get('nonpro').participants.one.points, 145);
  assert.equal(instance.snapshots.get('nonpro').participants.two.status, 'not_found');
});

test('credentials removal and demo mode clear live scores and stop polling', async t => {
  let configured = true, calls = 0;
  const source = connection({ status: () => ({ configured }), standings: async () => { calls++; return raw(); } });
  const { instance } = tracker(t, source), c = config();
  instance.reconcile(c); await waitFor(() => finished(instance));
  configured = false; source.revision++; instance.reconcile(c);
  assert.equal(instance.snapshots.get('nonpro').status, 'credentials');
  assert.deepEqual(instance.snapshots.get('nonpro').participants, {});
  configured = true; source.revision++; c.demo = true; instance.reconcile(c);
  assert.equal(instance.snapshots.get('nonpro').status, 'disabled'); assert.equal(calls, 1);
});

test('contest mapping survives configuration import without retaining any credential-shaped fields', () => {
  const c = config([member('one', 'fixture_user', 'MANAGER')]);
  c.groups.nonpro.codeforces.apiSecret = 'fixture-secret-only'; c.groups.nonpro.codeforces.apiKey = 'fixture-key-only';
  c.groups.nonpro.codeforces.refreshSeconds = 1;
  const normalized = normalizeConfig(c);
  assert.equal(normalized.candidates[0].codeforcesHandle, 'fixture_user');
  assert.equal(normalized.candidates[0].codeforcesParticipation, 'MANAGER');
  assert.equal(normalized.groups.nonpro.codeforces.refreshSeconds, 15);
  assert.ok(!JSON.stringify(publicConfig(normalized)).includes('fixture-secret-only'));
  assert.ok(!JSON.stringify(normalized).includes('fixture-key-only'));
});
