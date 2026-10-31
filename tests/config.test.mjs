import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfig, normalizeConfig, parseShareLink, publicConfig } from '../lib/config.mjs';
import { changedPosition, lineAt, textChange } from '../lib/position.mjs';

test('USACO link parsing keeps share fragment and maps the current leading-dash file ID', () => {
  const parsed = parseShareLink(' https://ide.usaco.guide/example_file_12345#shared ');
  assert.equal(parsed.fileId, '-example_file_12345');
  assert.ok(parsed.url.endsWith('#shared'));
  assert.equal(parseShareLink('https://ide.usaco.guide/-abcdefg').fileId, '-abcdefg');
});
test('rejects arbitrary hosts, credentials, non-file URLs and URL script schemes', () => {
  for (const link of ['javascript:alert(1)', 'https://example.com/abcdefg', 'https://ide.usaco.guide.evil.test/abcdefg', 'https://ide.usaco.guide/', 'https://ide.usaco.guide/new', 'https://user:pass@ide.usaco.guide/abcdefg', 'https://ide.usaco.guide:8080/abcdefg', 'https://ide.usaco.guide/abcdefg/extra']) assert.throws(() => parseShareLink(link));
});
test('normalizes import sizes and values, rejects duplicates, removes source links from public state', () => {
  const raw = defaultConfig(); raw.candidates = [{ id: 'one', name: '  An  ', url: 'https://ide.usaco.guide/abcdefg', group: 'nonpro', enabled: true }];
  raw.groups.nonpro.fontSize = 900; raw.groups.pro.rotationSeconds = -10;
  const next = normalizeConfig(raw);
  assert.equal(next.groups.nonpro.fontSize, 40); assert.equal(next.groups.pro.rotationSeconds, 8);
  assert.equal(next.groups.nonpro.showInput, true); assert.equal(next.groups.nonpro.inputPosition, 'right');
  assert.equal(next.candidates[0].name, 'An'); assert.equal(next.candidates[0].language, 'auto');
  assert.equal(publicConfig(next).candidates[0].url, undefined);
  assert.throws(() => normalizeConfig({ ...raw, candidates: [...raw.candidates, ...raw.candidates] }), /trùng/);
});
test('follows inserted and deleted text at the correct resulting line', () => {
  assert.equal(changedPosition([{ retain: 4 }, { insert: 'x\ny' }], 'abc\nx\ny'), 7);
  assert.equal(lineAt('abc\nx\ny', 7), 3);
  assert.equal(changedPosition([{ retain: 4 }, { delete: 999 }], 'abc\n'), 4);
  assert.equal(changedPosition([{insert: 'abcdef'}], 'abc'), 3);
});
test('minimal viewer changes preserve exact source text for insert, delete, Unicode and replace', () => {
  for(const [before,after] of [['abc','abXYc'],['abc','ac'],['đang viết','đang sửa'],['a\nb\nc','a\nC'],['','code'],['code',''],['same','same']]) {
    const change = textChange(before, after);
    assert.equal(before.slice(0,change.from) + change.insert + before.slice(change.to),after);
  }
});

test('small-font and Input choices survive a save/import round trip', () => {
  const raw=defaultConfig();raw.groups.nonpro.fontSize=10;raw.groups.nonpro.showInput=false;raw.groups.pro.inputPosition='bottom';
  const roundTrip=normalizeConfig(JSON.parse(JSON.stringify(normalizeConfig(raw))));
  assert.equal(roundTrip.groups.nonpro.fontSize,10);assert.equal(roundTrip.groups.nonpro.showInput,false);assert.equal(roundTrip.groups.pro.inputPosition,'bottom');
});
