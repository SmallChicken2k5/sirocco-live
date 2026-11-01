import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseVnojContest, parseVnojParticipation, summarizeVnoj, VnojClient, VnojError } from '../lib/vnoj.mjs';
import { VnojTracker } from '../lib/vnoj-tracker.mjs';
import { ContestTracker } from '../lib/contest-tracker.mjs';
import { defaultConfig, normalizeConfig } from '../lib/config.mjs';
import { createStudio } from '../server.mjs';

const reference = parseVnojContest('https://oj.vnoi.info/contest/fixture_vnoj');
const row = (id, virtual, score, tries = 1) => ({ id, virtual, score, cumtime: score ? 25 : 0, rank: score ? 8 : 90, is_disqualified: false, user: { username: 'fixture_user' }, format_data: score ? { 101: { points: 1, tries, time: 300 } } : {} });
const raw = () => ({ contest: { key: reference.id, format: 'icpc', ended: true, is_frozen: false }, problems: [{ id: 101, label: 'A', name: 'Fixture A', points: 1 }, { id: 102, label: 'B', points: 1 }], participations: [row(501, 1, 4), row(502, 2, 0)] });
function config() {
  const c = defaultConfig(); c.groups.icpc.codeforces = { provider: 'vnoj', enabled: true, url: reference.url, asManager: false, refreshSeconds: 15, showOnLive: true };
  c.candidates = [{ id: 'one', name: 'Fixture', group: 'icpc', enabled: true, vnojUsername: 'fixture_user', vnojParticipationId: 502 }];
  return normalizeConfig(c);
}
async function waitFor(predicate) { const until = Date.now() + 3000; while (!predicate()) { if (Date.now() > until) throw new Error('Timed out waiting for fixture'); await new Promise(r => setTimeout(r, 5)); } }

test('VNOJ links reject arbitrary destinations and normalize the public ranking URL', () => {
  assert.equal(parseVnojContest(reference.url + '/ranking/?show_virtual=true').url, reference.url);
  for (const u of ['http://oj.vnoi.info/contest/test', 'https://127.0.0.1/contest/test', 'https://oj.vnoi.info.evil.test/contest/test', 'https://user:pass@oj.vnoi.info/contest/test', 'https://oj.vnoi.info:123/contest/test', 'https://oj.vnoi.info/contest/test/submissions/']) assert.throws(() => parseVnojContest(u));
  assert.equal(parseVnojParticipation('502'), 502); assert.equal(parseVnojParticipation(''), null);
  for (const v of [-1, 0, 1.5, '1e3', '9007199254740992']) assert.throws(() => parseVnojParticipation(v));
});
test('pinned virtual zero-score session stays separate from a higher scoring older attempt', () => {
  const data = raw(), s = summarizeVnoj(data, reference, 'FIXTURE_USER', 502);
  assert.equal(s.participant.status, 'live'); assert.equal(s.participant.points, 0); assert.equal(s.participant.virtual, 2); assert.equal(s.participant.participationId, 502);
  assert.equal(s.participant.sessionLabel, 'Thi ảo #2'); assert.equal(s.participant.problems[0].points, 0); assert.equal(s.participant.sessions.length, 2);
  assert.equal(summarizeVnoj(data, reference, 'fixture_user').participant.status, 'needs_selection');
  data.participations.pop(); assert.equal(summarizeVnoj(data, reference, 'fixture_user', 502).participant.status, 'not_found');
});
test('VNOJ maps ICPC attempts and frozen data without inventing submission verdicts', () => {
  const data = raw(); data.contest.is_frozen = true; data.participations[0] = row(501, 1, 1, 4); data.participations[0].format_data[102] = { points: 0, tries: 2 };
  const s = summarizeVnoj(data, reference, 'fixture_user', 501);
  assert.equal(s.contest.frozen, true); assert.equal(s.participant.problems[0].rejectedAttempts, 3); assert.equal(s.participant.problems[1].rejectedAttempts, 2); assert.equal(s.participant.lastSubmission, null);
  data.participations[0].is_disqualified = true; assert.equal(summarizeVnoj(data, reference, 'fixture_user', 501).participant.status, 'disqualified');
  data.contest.format = 'unknown'; assert.throws(() => summarizeVnoj(data, reference, 'fixture_user', 501), /thể thức ICPC/);
});
test('VNOJ client reads public JSON without credentials and handles access errors and size limits', async () => {
  let options, requested;
  const client = new VnojClient({ fetchImpl: async (u, o) => { requested = u; options = o; return new Response(JSON.stringify(raw()), { headers: { 'content-type': 'application/json' } }); } });
  await client.standings(reference);
  assert.equal(String(requested), reference.url + '/ranking/?show_virtual=true&data'); assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, undefined); assert.equal(options.headers.Cookie, undefined);
  await assert.rejects(new VnojClient({ fetchImpl: async () => new Response('', { status: 403 }) }).standings(reference), e => e.code === 'ACCESS');
  await assert.rejects(new VnojClient({ maxBytes: 5, fetchImpl: async () => new Response(JSON.stringify(raw()), { headers: { 'content-type': 'application/json' } }) }).standings(reference), /giới hạn/);
});
test('VNOJ configuration import preserves pinned sessions and discards credentials', () => {
  const c = config(); c.groups.icpc.codeforces.apiSecret = 'fixture-private'; c.groups.icpc.codeforces.asManager = true;
  const n = normalizeConfig(JSON.parse(JSON.stringify(c)));
  assert.equal(n.candidates[0].vnojParticipationId, 502); assert.equal(n.groups.icpc.codeforces.provider, 'vnoj'); assert.equal(n.groups.icpc.codeforces.asManager, false); assert.equal(n.groups.icpc.codeforces.apiSecret, undefined);
});
test('VNOJ tracker updates the selected attempt, retains stale points, and clears them on access loss', async t => {
  const data = raw(); let error;
  const tracker = new VnojTracker(() => {}, { client: { standings: async () => { if (error) throw error; return data; } } }); t.after(() => tracker.close());
  tracker.reconcile(config()); await waitFor(() => tracker.snapshots.get('icpc')?.status === 'live');
  assert.equal(tracker.snapshots.get('icpc').participants.one.points, 0);
  data.participations[1] = row(502, 2, 1, 3); tracker.refresh('icpc'); await waitFor(() => tracker.snapshots.get('icpc').participants.one.points === 1);
  assert.equal(tracker.snapshots.get('icpc').participants.one.virtual, 2);
  error = new VnojError('NETWORK', 'Fixture network'); tracker.refresh('icpc'); await waitFor(() => tracker.snapshots.get('icpc').status === 'stale'); assert.equal(tracker.snapshots.get('icpc').participants.one.points, 1);
  error = new VnojError('ACCESS', 'Fixture access'); tracker.refresh('icpc'); await waitFor(() => tracker.snapshots.get('icpc').status === 'error'); assert.deepEqual(tracker.snapshots.get('icpc').participants, {});
});
test('provider switches abort pending VNOJ work and cannot overwrite Codeforces state', async t => {
  let release, signal;
  const tracker = new ContestTracker({ revision: 0, status: () => ({ configured: false }) }, () => {}, { client: { standings: (_r, o) => { signal = o.signal; return new Promise(r => release = r); } } }); t.after(() => tracker.close());
  const c = config(); tracker.reconcile(c); await waitFor(() => !!release);
  c.groups.icpc.codeforces = { provider: 'codeforces', enabled: false, url: '', refreshSeconds: 30 }; tracker.reconcile(c);
  assert.equal(signal.aborted, true); release(raw()); await new Promise(r => setTimeout(r, 10));
  assert.equal(tracker.snapshots.get('icpc').provider, 'codeforces'); assert.equal(tracker.snapshots.get('icpc').status, 'disabled');
});
test('server publishes VNOJ sessions through normal state and generic refresh, without API credentials', async t => {
  const dir = await mkdtemp(path.join(tmpdir(), 'sirocco-vnoj-')); const app = await createStudio({ dataDir: dir, port: 0, vnojOptions: { client: { standings: async () => raw() } } });
  t.after(async () => { await app.close(); await rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${app.port}`;
  const saved = await fetch(base + '/api/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(config()) }); assert.equal(saved.status, 200);
  await waitFor(() => app.contests.get('icpc')?.status === 'live');
  const state = await (await fetch(base + '/api/state')).json(); assert.equal(state.contests.icpc.participants.one.participationId, 502); assert.equal(state.contests.icpc.provider, 'vnoj');
  assert.equal((await fetch(base + '/api/contest/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupId: 'icpc' }) })).status, 200);
});
test('paired companion supplies exact lower-score events only to the pinned participant and cannot bypass origin/token checks', async t => {
  const data=raw();data.contest.format='ioi';data.problems.forEach(p=>p.points=100);
  const dir=await mkdtemp(path.join(tmpdir(),'sirocco-bridge-'));const app=await createStudio({dataDir:dir,port:0,vnojOptions:{client:{standings:async()=>data}}});
  t.after(async()=>{await app.close();await rm(dir,{recursive:true,force:true});});const base=`http://127.0.0.1:${app.port}`;
  const c=config();c.groups.icpc.codeforces.style='IOI';await fetch(base+'/api/config',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(c)});await waitFor(()=>app.contests.get('icpc')?.status==='live');
  const pair=await(await fetch(base+'/api/vnoj/pair',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).json();assert.match(pair.token,/^[a-f0-9]{48}$/);
  const headers={'content-type':'application/json',origin:'chrome-extension://'+'a'.repeat(32),'x-sirocco-pair':pair.token};
  const payload={contest:reference.id,username:'fixture_user',participationId:502,submissions:[{id:100,index:'A',verdict:'PARTIAL',points:70}]};
  const send=async(p=payload,h=headers)=>fetch(base+'/api/vnoj/bridge',{method:'POST',headers:h,body:JSON.stringify(p)});
  assert.equal((await send(payload,{...headers,origin:'https://evil.test'})).status,403);assert.equal((await send(payload,{...headers,'x-sirocco-pair':'wrong'})).status,403);assert.equal((await send({...payload,participationId:999})).status,400);
  assert.equal((await send()).status,200);await waitFor(()=>app.contests.get('icpc').participants.one.resultMode==='exact');assert.equal(app.contests.get('icpc').participants.one.resultEvents.length,0);
  payload.submissions.push({id:101,index:'A',verdict:'PARTIAL',points:20});await send();await waitFor(()=>app.contests.get('icpc').participants.one.resultEvents.length===1);
  const event=app.contests.get('icpc').participants.one.resultEvents[0];assert.equal(event.label,'Giảm điểm');assert.equal(event.tone,'failure');assert.equal(event.previousPoints,70);
  await fetch(base+'/api/vnoj/unpair',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal((await send()).status,403);
});
