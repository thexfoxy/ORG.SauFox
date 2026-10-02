import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const context = {};
runInNewContext(await readFile(new URL('../js/library-view.js', import.meta.url), 'utf8'), context);
const ui = context.SauFoxLibrary;
test('download selection picks the newest owned-work file per platform regardless of response order', () => {
  const rows = [
    { id: 'old', work_id: 'game', platform: 'windows', created_at: '2026-01-01' },
    { id: 'other', work_id: 'not-owned', platform: 'windows', created_at: '2026-09-01' },
    { id: 'linux', work_id: 'game', platform: 'linux', created_at: '2026-02-01' },
    { id: 'latest', work_id: 'game', platform: 'windows', created_at: '2026-03-01' },
  ];
  assert.equal(ui.latestBuilds(rows, 'game').map(x => x.id).join(','), 'linux,latest');
});
test('search handles Persian and Arabic forms and combines with availability filters', () => {
  const entry = { work: { title: 'The CandleWood', title_fa: 'شمعک' }, pending: false, available: true };
  assert.equal(ui.matches(entry, { query: '  CANDLE ', filter: 'ready' }), true);
  assert.equal(ui.matches(entry, { query: 'شمعك', filter: 'all' }), true);
  assert.equal(ui.matches(entry, { query: '', filter: 'preorder' }), false);
  assert.equal(ui.matches(entry, { query: 'missing', filter: 'ready' }), false);
});
test('library errors and unavailable downloads have Persian copy', () => {
  for (const key of ['failed', 'filesFailed', 'pending', 'noFiles']) assert.match(ui.text(key, 'fa'), /[آ-ی]/);
});
