export const DEFAULT_GROUPS = { nonpro: 'Không chuyên', pro: 'Chuyên Tin', icpc: 'ICPC' };
export const MAX_GROUPS = 12;
export const validGroupId = id => /^[a-z][a-z0-9_-]{0,47}$/.test(id) && !['candidate', 'constructor', 'prototype', '__proto__'].includes(id);
export function groupDefaults(title, id = '') {
  return { title, fontSize: id === 'pro' ? 17 : 16, layout: id === 'pro' ? 'columns' : 'grid', follow: 'edits', wrap: true, showHeader: true, showInput: true, inputPosition: 'right', rotationSeconds: 25, focusId: null,
    codeforces: { provider: 'codeforces', enabled: false, url: '', style: 'auto', effects: true, sound: false, volume: 35, asManager: false, refreshSeconds: 30, showOnLive: true } };
}
export function newGroupId(title, groups) {
  const stem = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36);
  const base = validGroupId(stem) ? stem : `khung-${stem || 'moi'}`;
  let id = base, n = 2;
  while (Object.hasOwn(groups, id) || !validGroupId(id)) id = `${base}-${n++}`;
  return id;
}
