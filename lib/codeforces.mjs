import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const API_ORIGIN = 'https://codeforces.com';
const allowedMethods = new Set(['contest.standings', 'contest.status']);
export const PARTICIPATION_TYPES = ['CONTESTANT', 'OUT_OF_COMPETITION', 'VIRTUAL', 'MANAGER', 'PRACTICE'];
export class CodeforcesError extends Error {
  constructor(code, message, status = 400) { super(message); this.name = 'CodeforcesError'; this.code = code; this.status = status; }
}

export function parseContestReference(value) {
  const text = String(value ?? '').trim();
  let id, kind = 'gym';
  if (/^\d{1,9}$/.test(text)) id = Number(text);
  else {
    let url;
    try { url = new URL(text); } catch { throw new CodeforcesError('INVALID_CONTEST', 'Nhập ID hoặc link contest Codeforces đầy đủ.'); }
    if (url.protocol !== 'https:' || url.hostname !== 'codeforces.com' || url.username || url.password || url.port) throw new CodeforcesError('INVALID_CONTEST', 'Chỉ nhận link https://codeforces.com/gym/… hoặc /contest/….');
    const match = url.pathname.match(/^\/(gym|contest)\/(\d{1,9})(?:\/|$)/);
    if (!match) throw new CodeforcesError('INVALID_CONTEST', 'Link chưa trỏ đến một contest Codeforces.');
    kind = match[1]; id = Number(match[2]);
  }
  if (!Number.isSafeInteger(id) || id < 1) throw new CodeforcesError('INVALID_CONTEST', 'ID contest không hợp lệ.');
  return { id, kind, url: `${API_ORIGIN}/${kind}/${id}` };
}
export function parseCodeforcesHandle(value) {
  const handle = String(value ?? '').trim();
  if (handle && !/^[A-Za-z0-9_.-]{3,24}$/.test(handle)) throw new CodeforcesError('INVALID_HANDLE', 'Handle Codeforces cần từ 3–24 ký tự: chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.');
  return handle;
}
export function validateCredentials(value) {
  const apiKey = typeof value?.apiKey === 'string' ? value.apiKey.trim() : '';
  const apiSecret = typeof value?.apiSecret === 'string' ? value.apiSecret.trim() : '';
  if (![apiKey, apiSecret].every(s => s.length >= 6 && s.length <= 512 && /^[\x21-\x7e]+$/.test(s))) throw new CodeforcesError('MISSING_CREDENTIALS', 'Nhập đầy đủ API Key và API Secret của Codeforces.');
  return { apiKey, apiSecret };
}

// Codeforces hashes sorted, decoded parameter values; URL encoding is applied afterwards.
export function signedCodeforcesUrl(method, params, credentials, { now = Date.now(), nonce = randomBytes(3).toString('hex') } = {}) {
  if (!allowedMethods.has(method)) throw new CodeforcesError('METHOD_NOT_ALLOWED', 'Phương thức Codeforces không được hỗ trợ.');
  if (!/^[A-Za-z0-9]{6}$/.test(nonce)) throw new Error('Invalid signature nonce');
  const { apiKey, apiSecret } = validateCredentials(credentials);
  const entries = Object.entries({ ...params, apiKey, time: Math.floor(now / 1000) }).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]).sort(([a, av], [b, bv]) => a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0);
  const canonical = entries.map(([key, value]) => `${key}=${value}`).join('&');
  const signature = nonce + createHash('sha512').update(`${nonce}/${method}?${canonical}#${apiSecret}`).digest('hex');
  const url = new URL(`/api/${method}`, API_ORIGIN);
  url.search = new URLSearchParams([...entries, ['apiSig', signature]]).toString();
  return url;
}
function upstreamFailure(comment = '') {
  if (/call limit|too many|rate limit/i.test(comment)) return new CodeforcesError('RATE_LIMIT', 'Codeforces đang giới hạn số lần gọi. Chờ vài giây rồi thử lại.', 429);
  if (/signature|time.*(?:invalid|limit|difference)|(?:invalid|incorrect).*time/i.test(comment)) return new CodeforcesError('SIGNATURE', 'Chữ ký API chưa hợp lệ. Kiểm tra Secret và giờ hệ thống trên máy bạn.');
  if (/api.?key/i.test(comment)) return new CodeforcesError('API_KEY', 'Codeforces chưa chấp nhận API Key. Kiểm tra lại key và trạng thái của nó.');
  if (/handle.*not found|user.*not found/i.test(comment)) return new CodeforcesError('HANDLE_NOT_FOUND', 'Codeforces không tìm thấy handle này. Kiểm tra lại tên trên trang profile.');
  if (/contest.*not found|access denied|not allowed|permission|not authorized/i.test(comment)) return new CodeforcesError('CONTEST_ACCESS', 'Tài khoản của API Key chưa đọc được contest này. Kiểm tra ID contest và quyền xem Gym.');
  return new CodeforcesError('API_FAILED', 'Codeforces chưa trả được dữ liệu hợp lệ cho contest này.');
}
export class CodeforcesClient {
  constructor({ fetchImpl = fetch, intervalMs = 2100, timeoutMs = 12000 } = {}) {
    this.fetchImpl = fetchImpl; this.intervalMs = intervalMs; this.timeoutMs = timeoutMs;
    this.queue = Promise.resolve(); this.nextRequestAt = 0;
  }
  call(method, params, credentials, { signal } = {}) {
    if (!allowedMethods.has(method)) return Promise.reject(new CodeforcesError('METHOD_NOT_ALLOWED', 'Phương thức Codeforces không được hỗ trợ.'));
    const task = this.queue.then(async () => {
      if (signal?.aborted) throw new CodeforcesError('CANCELLED', 'Đã dừng lần cập nhật này.');
      const wait = this.nextRequestAt - Date.now(); if (wait > 0) await delay(wait, undefined, { signal });
      this.nextRequestAt = Date.now() + this.intervalMs;
      const url = credentials ? signedCodeforcesUrl(method, params, credentials) : new URL(`/api/${method}?${new URLSearchParams(params)}`, API_ORIGIN);
      let response, result;
      try {
        response = await this.fetchImpl(url, { redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(this.timeoutMs)]) : AbortSignal.timeout(this.timeoutMs), headers: { Accept: 'application/json', 'User-Agent': 'Sirocco-Live' } });
        if (response.status === 429) throw new CodeforcesError('RATE_LIMIT', 'Codeforces đang giới hạn số lần gọi. Chờ vài giây rồi thử lại.', 429);
        const text = await response.text();
        if (text.length > 8 * 1024 * 1024) throw new CodeforcesError('RESPONSE_SIZE', 'Phản hồi Codeforces quá lớn. Hãy lọc theo handle.');
        try { result = JSON.parse(text); } catch { throw new CodeforcesError('NON_JSON', 'Codeforces trả về trang web thay vì dữ liệu API; có thể đang có bước xác minh truy cập.', 502); }
      } catch (error) {
        if (signal?.aborted) throw new CodeforcesError('CANCELLED', 'Đã dừng lần cập nhật này.');
        if (error instanceof CodeforcesError) throw error;
        throw new CodeforcesError('NETWORK', 'Chưa kết nối được API Codeforces. Kiểm tra mạng rồi thử lại.', 502);
      }
      if (result.status !== 'OK') throw upstreamFailure(String(result.comment || ''));
      if (!response.ok || !result.result) throw new CodeforcesError('API_RESPONSE', 'Phản hồi API Codeforces chưa đầy đủ.', 502);
      return result.result;
    });
    this.queue = task.catch(() => {});
    return task;
  }
  standings(contest, { handle = '', handles = [], asManager = false, credentials, signal } = {}) {
    if (contest.kind === 'contest') return this.call('contest.standings', { contestId: contest.id }, undefined, { signal });
    if (!credentials) throw new CodeforcesError('MISSING_CREDENTIALS', 'Gym cần API Key và Secret của tài khoản được quyền xem contest.');
    const selected = handles.length ? handles.join(';') : handle;
    return this.call('contest.standings', { contestId: contest.id, showUnofficial: true, ...(selected ? { handles: selected } : { from: 1, count: 1 }), ...(asManager ? { asManager: true } : {}) }, credentials, { signal });
  }
  submissions(contest, { handle, asManager = false, credentials, signal } = {}) {
    if (contest.kind === 'gym' && !credentials) throw new CodeforcesError('MISSING_CREDENTIALS', 'Gym cần API Key và Secret của tài khoản được quyền xem contest.');
    return this.call('contest.status', { contestId: contest.id, handle, from: 1, count: 50, ...(contest.kind === 'gym' && asManager ? { asManager: true } : {}) }, contest.kind === 'gym' ? credentials : undefined, { signal });
  }
}

const finite = value => Number.isFinite(value) ? value : null;
export function summarizeStandings(result, contestId, handle = '', participation = 'auto') {
  if (result?.contest?.id !== contestId || !Array.isArray(result.problems) || !Array.isArray(result.rows)) throw new CodeforcesError('DATA_SHAPE', 'Dữ liệu bảng điểm không khớp contest đã chọn.', 502);
  const problems = result.problems.slice(0, 300).map(p => ({ index: String(p.index || ''), name: String(p.name || ''), maxPoints: finite(p.points) }));
  const rows = result.rows.filter(r => (!handle || r.party?.members?.some(m => m.handle.toLowerCase() === handle.toLowerCase())) && (participation === 'auto' || r.party?.participantType === participation));
  rows.sort((a, b) => (PARTICIPATION_TYPES.indexOf(a.party.participantType) - PARTICIPATION_TYPES.indexOf(b.party.participantType)) || (Number(b.party.startTimeSeconds || 0) - Number(a.party.startTimeSeconds || 0)));
  const row = rows[0];
  return {
    contest: { id: contestId, name: String(result.contest.name || ''), type: String(result.contest.type || ''), phase: String(result.contest.phase || ''), frozen: result.contest.frozen === true, problems },
    participant: row ? { handle: row.party.members.find(m => !handle || m.handle.toLowerCase() === handle.toLowerCase())?.handle || handle, type: String(row.party.participantType || ''), partyStartTimeSeconds: finite(row.party.startTimeSeconds), points: finite(row.points), rank: ['MANAGER', 'PRACTICE'].includes(row.party.participantType) || !(row.rank > 0) ? null : finite(row.rank), penalty: finite(row.penalty), problems: problems.map((p, i) => ({ index: p.index, maxPoints: p.maxPoints, points: finite(row.problemResults?.[i]?.points), rejectedAttempts: finite(row.problemResults?.[i]?.rejectedAttemptCount), bestTimeSeconds: row.problemResults?.[i]?.bestSubmissionTimeSeconds >= 2147483647 ? null : finite(row.problemResults?.[i]?.bestSubmissionTimeSeconds) })) } : null,
    checkedAt: Date.now(),
  };
}

export function matchingSubmissions(submissions, contestId, participant) {
  if (!Array.isArray(submissions) || !participant) return [];
  const matches = submissions.filter(s => s.contestId === contestId && s.author?.members?.some(m => m.handle.toLowerCase() === participant.handle.toLowerCase()) && s.author?.participantType === participant.type && (participant.type !== 'VIRTUAL' || !participant.partyStartTimeSeconds || s.author.startTimeSeconds === participant.partyStartTimeSeconds));
  matches.sort((a, b) => b.id - a.id);
  return matches.map(s => {
  const verdict = String(s.verdict || 'SUBMITTED');
  return { id: s.id, index: String(s.problem?.index || ''), verdict, points: finite(s.points), submittedAt: Number.isFinite(s.creationTimeSeconds) ? s.creationTimeSeconds * 1000 : null, testing: ['TESTING', 'SUBMITTED'].includes(verdict) };
  });
}
export function latestSubmission(submissions, contestId, participant) { return matchingSubmissions(submissions, contestId, participant)[0] || null; }
