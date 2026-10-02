import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const main = await readFile(new URL('../js/main.js', import.meta.url), 'utf8');
const keyUI = main.slice(main.indexOf('  const keyLine ='), main.indexOf('  const showLibrary ='));
const secret = 'SFOX-TEST-ONLY-FAKE-0000';
function render(writeText) {
  const timers = [];
  const document = { createElement(tag) { return { tag, attributes: {}, children: [], setAttribute(k, v) { this.attributes[k] = v; }, addEventListener(k, fn) { this[k] = fn; }, append(...nodes) { this.children.push(...nodes); } }; } };
  const view = runInNewContext(`${keyUI}\nkeyLine(secret)`, { document, secret, t: s => s, navigator: { clipboard: { writeText } }, setTimeout: fn => timers.push(fn) });
  return { view, button: view.children[0], timers };
}
test('library keys stay out of DOM text and attributes before and after copying', async () => {
  let copied;
  const { view, button, timers } = render(async value => { copied = value; });
  assert.equal(button.textContent, 'Copy key');
  assert.equal(JSON.stringify(view).includes(secret), false);
  await button.click();
  assert.equal(copied, secret);
  assert.equal(button.textContent, 'Copied');
  assert.equal(JSON.stringify(view).includes(secret), false);
  timers[0]();
  assert.equal(button.textContent, 'Copy key');
});
test('clipboard failure never reveals or selects the key', async () => {
  const { view, button } = render(async () => { throw new Error('denied'); });
  await button.click();
  assert.equal(button.textContent, 'Try again');
  assert.equal(JSON.stringify(view).includes(secret), false);
});
test('the key redemption field masks typed and pasted keys', async () => {
  const page = await readFile(new URL('../profile.html', import.meta.url), 'utf8');
  assert.match(page, /name="code" type="password"/);
});
