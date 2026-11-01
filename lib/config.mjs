import { randomUUID } from 'node:crypto';
import { parseContestReference, parseCodeforcesHandle, PARTICIPATION_TYPES } from './codeforces.mjs';
import { DEFAULT_GROUPS, MAX_GROUPS, validGroupId, groupDefaults } from './groups.mjs';

export const LANGUAGES = ['cpp', 'py', 'java'];
export function parseShareLink(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Link USACO IDE không hợp lệ.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Hãy dán đầy đủ link https://ide.usaco.guide/…'); }
  if (url.hostname !== 'ide.usaco.guide' || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('Chỉ nhận link từ ide.usaco.guide.');
  const id = url.pathname.replace(/^\//, '').replace(/\/$/, '');
  if (!/^[A-Za-z0-9_-]{6,100}$/.test(id) || ['settings', 'dashboard'].includes(id)) throw new Error('Link phải trỏ đến một file USACO IDE, không phải trang chủ.');
  return { fileId: id.startsWith('-') ? id : `-${id}`, url: `https://ide.usaco.guide/${id}${url.search}${url.hash}` };
}
const integer = (v, fallback, min, max) => Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Math.round(Number(v)))) : fallback;
const label = (v, fallback, max = 80) => typeof v === 'string' ? v.trim().slice(0, max) || fallback : fallback;
const defaultContest = () => ({ enabled: false, url: '', asManager: false, refreshSeconds: 30, showOnLive: true });
export function defaultConfig() {
  return { version: 2, title: 'Sirocco Cup', demo: false, candidates: [], groups: Object.fromEntries(Object.entries(DEFAULT_GROUPS).map(([id, title]) => [id, groupDefaults(title, id)])) };
}
export function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Cấu hình phải là một đối tượng JSON.');
  const base = defaultConfig();
  if (raw.groups != null && (typeof raw.groups !== 'object' || Array.isArray(raw.groups))) throw new Error('Danh sách khung không hợp lệ.');
  const inputGroups = { ...(raw.groups || base.groups) };
  // Version 1 had exactly two sources. Add ICPC once, without overwriting saved settings.
  if (raw.version !== 2 && !Object.hasOwn(inputGroups, 'icpc')) inputGroups.icpc = base.groups.icpc;
  const ids = Object.keys(inputGroups);
  if (!ids.length || ids.length > MAX_GROUPS) throw new Error(`Cần từ 1 đến ${MAX_GROUPS} khung phát.`);
  if (ids.some(id => !validGroupId(id))) throw new Error('ID khung không hợp lệ hoặc trùng đường dẫn dành riêng.');
  if (!Array.isArray(raw.candidates)) throw new Error('Thiếu danh sách thí sinh.');
  if (raw.candidates.length > 16) throw new Error('Tối đa 16 thí sinh trong một phiên.');
  const seen = new Set();
  const candidates = raw.candidates.map((c, index) => {
    if (!c || typeof c !== 'object') throw new Error('Thông tin thí sinh không hợp lệ.');
    const id = typeof c.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(c.id) ? c.id : randomUUID();
    if (seen.has(id)) throw new Error('ID thí sinh bị trùng.');
    seen.add(id);
    const url = c.url ? parseShareLink(c.url).url : '';
    return { id, name: label(c.name, `Thí sinh ${index + 1}`), group: ids.includes(c.group) ? c.group : ids[0], url, language: LANGUAGES.includes(c.language) ? c.language : 'auto', enabled: c.enabled !== false, codeforcesHandle: parseCodeforcesHandle(c.codeforcesHandle), codeforcesParticipation: PARTICIPATION_TYPES.includes(c.codeforcesParticipation) ? c.codeforcesParticipation : 'auto' };
  });
  const groups = {};
  for (const id of ids) {
    const g = inputGroups[id] || {}, defaults = groupDefaults(DEFAULT_GROUPS[id] || 'Khung mới', id);
    const cf = g.codeforces || defaultContest();
    const contestUrl = cf.url ? parseContestReference(cf.url).url : '';
    if (cf.enabled && !contestUrl) throw new Error(`Nhóm ${label(g.title, defaults.title)} chưa có link contest Codeforces.`);
    groups[id] = { title: label(g.title, defaults.title), fontSize: integer(g.fontSize, defaults.fontSize, 10, 40), layout: ['grid', 'columns', 'spotlight', 'rotate'].includes(g.layout) ? g.layout : defaults.layout,
      follow: ['edits', 'cursor', 'off'].includes(g.follow) ? g.follow : 'edits', wrap: g.wrap !== false, showHeader: g.showHeader !== false,
      showInput: g.showInput !== false, inputPosition: ['right', 'bottom'].includes(g.inputPosition) ? g.inputPosition : 'right',
      rotationSeconds: integer(g.rotationSeconds, 25, 8, 180), focusId: typeof g.focusId === 'string' && candidates.some(c => c.id === g.focusId && c.group === id && c.enabled) ? g.focusId : null,
      codeforces: { enabled: cf.enabled === true, url: contestUrl, asManager: cf.asManager === true, refreshSeconds: integer(cf.refreshSeconds, 30, 15, 180), showOnLive: cf.showOnLive !== false } };
  }
  return { version: 2, title: label(raw.title, base.title), demo: raw.demo === true, candidates, groups };
}
export function publicConfig(config) {
  return { ...config, candidates: config.candidates.map(({ url, ...c }) => c) };
}
