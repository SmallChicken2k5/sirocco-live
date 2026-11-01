import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CodeforcesClient, parseContestReference, parseCodeforcesHandle, signedCodeforcesUrl, summarizeStandings } from '../lib/codeforces.mjs';
import { CodeforcesCredentialStore } from '../lib/codeforces-credentials.mjs';
import { createCodeforcesConnection } from '../lib/codeforces-connection.mjs';

const credentials = { apiKey: 'fixture-key-only', apiSecret: 'fixture-secret-only' };
const standings = () => ({ contest: { id: 123456, name: 'Fixture Gym', type: 'IOI', phase: 'FINISHED', frozen: false }, problems: [{ index: 'A', name: 'Alpha', points: 100 }, { index: 'B', name: 'Beta', points: 100 }], rows: [{ party: { members: [{ handle: 'fixture_user' }], participantType: 'MANAGER' }, rank: 1, points: 145, penalty: 0, problemResults: [{ points: 100, rejectedAttemptCount: 1 }, { points: 45, rejectedAttemptCount: 2 }] }] });
const ok = result => new Response(JSON.stringify({ status: 'OK', result }), { status: 200 });
async function directory(t) { const dir = await mkdtemp(path.join(tmpdir(), 'sirocco-cf-')); t.after(() => rm(dir, { recursive: true, force: true })); return dir; }

test('Codeforces parses only supported contest references and valid handles', () => {
  assert.deepEqual(parseContestReference('123456'), { id: 123456, kind: 'gym', url: 'https://codeforces.com/gym/123456' });
  assert.equal(parseContestReference('https://codeforces.com/contest/1234').kind, 'contest');
  assert.equal(parseContestReference('https://codeforces.com/gym/123456/standings').id, 123456);
  assert.equal(parseCodeforcesHandle(' fixture_user '), 'fixture_user');
  for (const v of ['https://codeforces.com.evil.test/gym/123456', 'https://user:pass@codeforces.com/gym/123456', 'http://codeforces.com/gym/123456', 'https://codeforces.com:9000/gym/123456', 'https://codeforces.com/api/contest.status', '0', '-1']) assert.throws(() => parseContestReference(v));
  assert.throws(() => parseCodeforcesHandle('bad&handle'));
});

test('Codeforces signature matches an independently specified canonical string and never puts the secret in a URL', () => {
  const url = signedCodeforcesUrl('contest.standings', { showUnofficial: true, handles: 'fixture_user;second_user', contestId: 123456 }, credentials, { now: 1700000000000, nonce: '123456' });
  const canonical = '123456/contest.standings?apiKey=fixture-key-only&contestId=123456&handles=fixture_user;second_user&showUnofficial=true&time=1700000000#fixture-secret-only';
  assert.equal(url.searchParams.get('apiSig'), '123456' + createHash('sha512').update(canonical).digest('hex'));
  assert.equal(url.searchParams.get('handles'), 'fixture_user;second_user');
  assert.equal(url.origin, 'https://codeforces.com');
  assert.ok(!url.toString().includes(credentials.apiSecret));
  assert.ok(!url.searchParams.has('apiSecret'));
  assert.throws(() => signedCodeforcesUrl('user.friends', {}, credentials));
});

test('signed Gym requests are paced, and a failed request does not poison the queue', async () => {
  const calls = [];
  const client = new CodeforcesClient({ intervalMs: 30, fetchImpl: async url => { calls.push({ at: Date.now(), url }); return calls.length === 1 ? new Response(JSON.stringify({ status: 'FAILED', comment: 'Incorrect signature with fixture-secret-only' }), { status: 400 }) : ok(standings()); } });
  const first = client.standings(parseContestReference('123456'), { credentials, handle: 'fixture_user' });
  const second = client.standings(parseContestReference('123456'), { credentials, handle: 'fixture_user' });
  await assert.rejects(first, error => !error.message.includes(credentials.apiSecret) && error.code === 'SIGNATURE');
  assert.equal((await second).contest.id, 123456);
  assert.ok(calls[1].at - calls[0].at >= 25);
  assert.ok(calls[0].url.searchParams.has('apiSig'));
});

test('regular public standings use the exact anonymous contestId-only API mode', async () => {
  let requested;
  const client = new CodeforcesClient({ intervalMs: 0, fetchImpl: async url => { requested = url; return ok(standings()); } });
  await client.standings(parseContestReference('https://codeforces.com/contest/123456'), { credentials, handle: 'fixture_user', asManager: true });
  assert.equal(requested.search, '?contestId=123456');
});

test('score normalization preserves partial points, official totals, freeze state and manager rank absence', () => {
  const raw = standings(); raw.contest.frozen = true;
  const result = summarizeStandings(raw, 123456, 'FIXTURE_USER');
  assert.equal(result.participant.points, 145);
  assert.deepEqual(result.participant.problems.map(p => p.points), [100, 45]);
  assert.equal(result.participant.rank, null);
  assert.equal(result.contest.frozen, true);
  raw.rows[0].party.participantType = 'CONTESTANT'; raw.rows[0].rank = 7;
  assert.equal(summarizeStandings(raw, 123456, 'fixture_user').participant.rank, 7);
  assert.equal(summarizeStandings(raw, 123456, 'other_user').participant, null);
  assert.throws(() => summarizeStandings(raw, 999, 'fixture_user'));
});

test('API transport maps Cloudflare HTML and network errors without exposing signed URLs', async () => {
  for (const fetchImpl of [async () => new Response('<html>Just a moment</html>', { status: 403 }), async url => { throw new Error(url.toString()); }]) {
    const client = new CodeforcesClient({ intervalMs: 0, fetchImpl });
    await assert.rejects(client.standings(parseContestReference('123456'), { credentials }), e => !e.message.includes(credentials.apiKey) && !e.message.includes(credentials.apiSecret) && !e.message.includes('apiSig'));
  }
});

test('local credential storage persists across restart, redacts status and protects Windows values with DPAPI', async t => {
  const dir = await directory(t), store = new CodeforcesCredentialStore(dir);
  assert.equal((await store.load()).configured, false);
  await store.save(credentials);
  assert.deepEqual(store.get(), credentials);
  assert.ok(!JSON.stringify(store.status()).includes(credentials.apiKey));
  const saved = await readFile(store.file, 'utf8');
  if (process.platform === 'win32') { assert.ok(!saved.includes(credentials.apiSecret)); assert.equal(JSON.parse(saved).protection, 'windows-dpapi'); }
  else assert.equal((await stat(store.file)).mode & 0o777, 0o600);
  const second = new CodeforcesCredentialStore(dir); await second.load();
  assert.deepEqual(second.get(), credentials);
  await second.clear();
  assert.equal((await new CodeforcesCredentialStore(dir).load()).configured, false);
});

test('connection persists only validated Gym credentials and keeps the prior valid key after a failed replacement', async t => {
  const dir = await directory(t); let fail = true;
  const connection = await createCodeforcesConnection(dir, { intervalMs: 0, fetchImpl: async () => fail ? new Response(JSON.stringify({ status: 'FAILED', comment: 'Invalid apiKey fixture-key-only' }), { status: 400 }) : ok(standings()) });
  const input = { ...credentials, contest: '123456', handle: 'fixture_user' };
  await assert.rejects(connection.check(input)); assert.equal(connection.status().configured, false);
  fail = false; const result = await connection.check(input);
  assert.equal(result.configured, true); assert.equal(result.lastCheck.participant.points, 145);
  assert.ok(!JSON.stringify(result).includes(credentials.apiKey));
  fail = true; await assert.rejects(connection.check({ ...input, apiKey: 'replacement-fake-key' }));
  assert.equal(connection.status().configured, true);
  const store = new CodeforcesCredentialStore(dir); await store.load(); assert.deepEqual(store.get(), credentials);
});
