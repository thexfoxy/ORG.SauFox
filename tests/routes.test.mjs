import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const window = {};
const context = vm.createContext({ window, URL });
vm.runInContext(await readFile(new URL('../js/work-paths.js', import.meta.url), 'utf8'), context);
vm.runInContext(await readFile(new URL('../js/routes.js', import.meta.url), 'utf8'), context);
const routes = window.SauFoxRoutes;

test('old work links retain options and review anchors when canonicalized', () => {
  assert.equal(routes.canonical('/work.html?id=the-candlewood&lang=fa&edition=deluxe#reviews'), '/works/the-candlewood?lang=fa&edition=deluxe#reviews');
  assert.equal(routes.workId('/works/the-candlewood?edition=deluxe&id=another'), 'the-candlewood');
  assert.equal(routes.canonical('/works/the-candlewood.html?lang=en'), '/works/the-candlewood?lang=en');
  assert.equal(routes.canonical('/works/the-candlewood/'), '/works/the-candlewood');
});

test('new works keep a working legacy link until their static page is published', () => {
  assert.equal(routes.workUrl('new-game'), '/work?id=new-game');
  assert.equal(routes.canonical('/work?id=new-game'), null);
  assert.equal(routes.workId('/checkout?id=the-candlewood'), null);
  assert.equal(routes.workUrl('__proto__'), '/work?id=__proto__');
});

test('login returns to nested work pages without allowing external redirects', () => {
  assert.equal(routes.loginReturn('/works/the-candlewood?lang=fa#reviews'), '/works/the-candlewood?lang=fa#reviews');
  assert.equal(routes.loginReturn('work.html?id=the-candlewood'), 'work.html?id=the-candlewood');
  for (const next of ['//evil.test', 'https://evil.test/', '/\\evil.test', '/works/../login', '/%2f%2fevil.test', null]) assert.equal(routes.loginReturn(next), '/');
});

test('every registered work has a real HTML page, a root base and canonical metadata', async () => {
  for (const [id, path] of Object.entries(window.SAUFOX_WORK_PATHS)) {
    const html = await readFile(new URL(`../works/${id}.html`, import.meta.url), 'utf8');
    assert.ok(html.includes('<base href="/">'));
    assert.ok(html.includes(`href="https://saufoxentertainment.ir${path}"`));
    assert.ok(html.includes('/js/routes.js?v=102'));
    assert.ok(html.includes('class="title-page"'));
  }
});
