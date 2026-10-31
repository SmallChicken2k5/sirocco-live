export function changedPosition(delta, newText) {
  let offset = 0, changed = 0;
  for (const part of delta) {
    if (part.retain) offset += part.retain;
    if (typeof part.insert === 'string') { offset += part.insert.length; changed = offset; }
    if (part.delete) changed = offset;
  }
  return Math.max(0, Math.min(changed, newText.length));
}
export function lineAt(text, offset) {
  return text.slice(0, Math.max(0, Math.min(offset, text.length))).split('\n').length;
}
export function textChange(before, after) {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let endA = before.length, endB = after.length;
  while (endA > start && endB > start && before[endA - 1] === after[endB - 1]) { endA--; endB--; }
  return { from: start, to: endA, insert: after.slice(start, endB) };
}
