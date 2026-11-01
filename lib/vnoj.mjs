export class VnojError extends Error {
  constructor(code, message) { super(message); this.name = 'VnojError'; this.code = code; }
}
export function parseVnojContest(value) {
  let u;
  try { u = new URL(String(value).trim()); } catch { throw new VnojError('URL', 'Hãy nhập link https://oj.vnoi.info/contest/…'); }
  const match = /^\/contest\/([a-zA-Z0-9_-]{1,80})(?:\/ranking\/?)?\/?$/.exec(u.pathname);
  if (u.protocol !== 'https:' || u.hostname !== 'oj.vnoi.info' || u.port || u.username || u.password || !match) throw new VnojError('URL', 'Chỉ nhận link contest HTTPS từ oj.vnoi.info.');
  return { id: match[1], url: `https://oj.vnoi.info/contest/${match[1]}` };
}
export function parseVnojUsername(value) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || !/^[\p{L}\p{N}_@.+-]{1,150}$/u.test(value.trim())) throw new VnojError('USERNAME', 'Username VNOJ không hợp lệ.');
  return value.trim();
}
export function parseVnojParticipation(value) {
  if (value == null || value === '') return null;
  const id = Number(value);
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(id) || id < 1) throw new VnojError('SESSION', 'Mã phiên VNOJ phải là số nguyên dương.');
  return id;
}
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
export function summarizeVnoj(raw, reference, username, participationId = null) {
  if (raw?.contest?.key !== reference.id || !Array.isArray(raw.problems) || !Array.isArray(raw.participations)) throw new VnojError('DATA', 'VNOJ trả về bảng điểm không hợp lệ.');
  if (!['icpc','ioi','legacy_ioi'].includes(raw.contest.format)) throw new VnojError('FORMAT', 'Bản tích hợp VNOJ hỗ trợ thể thức ICPC và IOI.');
  const problems = raw.problems.map(p => ({ id: String(p.id), index: String(p.label), name: String(p.name || ''), maxPoints: finite(p.points, 1) }));
  const contest = { id: reference.id, name: `VNOJ · ${reference.id}`, type: raw.contest.format === 'icpc' ? 'ICPC' : 'IOI', phase: raw.contest.ended ? 'FINISHED' : 'CODING', frozen: raw.contest.is_frozen === true, problems };
  const rows = raw.participations.filter(p => p.user?.username?.toLowerCase() === username.toLowerCase());
  const sessions = rows.map(p => ({ id: p.id, virtual: p.virtual, points: finite(p.score), penalty: finite(p.cumtime), rank: Number.isFinite(p.rank) ? p.rank : null, disqualified: p.is_disqualified === true }));
  const row = participationId ? rows.find(p => p.id === participationId) : rows.length === 1 ? rows[0] : null;
  if (!row) return { contest, participant: { handle: username, status: rows.length && !participationId ? 'needs_selection' : 'not_found', sessions, message: participationId ? 'Chưa thấy phiên đã ghim trong BXH công khai; không chuyển sang phiên khác.' : rows.length ? 'Có nhiều phiên VNOJ. Chọn đúng lượt thi rồi lưu.' : 'Chưa thấy username trong BXH công khai, kể cả thi ảo.' } };
  if (row.is_disqualified) return { contest, participant: { handle: username, status: 'disqualified', sessions, message: 'Phiên này đã bị loại khỏi bảng điểm.' } };
  if (![row.score, row.cumtime].every(Number.isFinite) || !row.format_data || typeof row.format_data !== 'object') throw new VnojError('DATA', 'Thiếu dữ liệu điểm của phiên VNOJ.');
  return { contest, participant: {
    handle: row.user.username, status: 'live', type: row.virtual > 0 ? 'VIRTUAL' : 'CONTESTANT', participationId: row.id, virtual: row.virtual,
    sessionLabel: row.virtual > 0 ? `Thi ảo #${row.virtual}` : 'Chính thức', rank: Number.isFinite(row.rank) ? row.rank : null, rankScope: 'BXH công khai gồm thi ảo',
    points: row.score, penalty: row.cumtime, sessions, lastSubmission: null,
    problems: problems.map(p => { const d = row.format_data[p.id] || {}; const points = Math.max(0, finite(d.points)); return { index: p.index, points, maxPoints: p.maxPoints, rejectedAttempts: Math.max(0, finite(d.tries) - (points > 0 ? 1 : 0)), pending: d.pending === true }; })
  } };
}
export class VnojClient {
  constructor({ fetchImpl = fetch, timeoutMs = 15000, maxBytes = 16 * 1024 * 1024 } = {}) { this.fetchImpl = fetchImpl; this.timeoutMs = timeoutMs; this.maxBytes = maxBytes; }
  async standings(reference, { signal } = {}) {
    const url = new URL(`${parseVnojContest(reference.url).url}/ranking/`); url.search = 'show_virtual=true&data';
    let response;
    try { response = await this.fetchImpl(url, { signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(this.timeoutMs)]), redirect: 'error', headers: { Accept: 'application/json', 'User-Agent': 'Sirocco-Live/1.5' } }); }
    catch (error) { if (signal?.aborted) throw error; throw new VnojError('NETWORK', 'Chưa kết nối được VNOJ. Sẽ tự thử lại.'); }
    if ([401, 403].includes(response.status)) throw new VnojError('ACCESS', 'VNOJ chưa cho phép đọc bảng điểm công khai này.');
    if (!response.ok) throw new VnojError('NETWORK', `VNOJ trả lỗi HTTP ${response.status}.`);
    if (!response.headers.get('content-type')?.includes('application/json')) throw new VnojError('ACCESS', 'VNOJ chưa trả dữ liệu JSON công khai; có thể cần đăng nhập.');
    let text = '', size = 0; const decoder = new TextDecoder();
    for await (const chunk of response.body) { size += chunk.byteLength; if (size > this.maxBytes) throw new VnojError('DATA', 'Bảng điểm VNOJ vượt giới hạn dữ liệu.'); text += decoder.decode(chunk, { stream: true }); }
    text += decoder.decode();
    try { return JSON.parse(text); } catch { throw new VnojError('DATA', 'VNOJ trả JSON không hợp lệ.'); }
  }
}
