import { readFile, readdir } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const load = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const numbers = await load('js/numbers.js');
const dictionary = await load('js/fa.js');
const main = await load('js/main.js');
const language = main.slice(main.indexOf('const LANG ='), main.indexOf('(function translatePage()'));
function helpers(lang) {
  const context = { window: {}, document: { documentElement: { lang } } };
  return runInNewContext(`${numbers}\nconst SauFoxNumbers = window.SauFoxNumbers;\n${dictionary}\n${language}\n({ digits, num, money, t, FA, isolate: SauFoxNumbers.isolate })`, context);
}
const fa = helpers('fa');
const en = helpers('en');
const ltr = (s) => `\u2066${s}\u2069`;

test('Persian formatted prices, scores, phone numbers and ratios stay in their original order', () => {
  assert.equal(fa.num(1234567), ltr('۱٬۲۳۴٬۵۶۷'));
  assert.equal(fa.num(8.5, 1), ltr('۸٫۵'));
  assert.equal(fa.money.IRR(1234567), `${ltr('۱٬۲۳۴٬۵۶۷')} ریال`);
  assert.equal(fa.digits('09'), ltr('۰۹'));
  assert.equal(fa.digits('16+'), ltr('۱۶+'));
  assert.equal(fa.isolate('شماره: ۰۹۱۲ ۳۴۵ ۶۷۸۹'), `شماره: ${ltr('۰۹۱۲ ۳۴۵ ۶۷۸۹')}`);
  assert.equal(fa.isolate('امتیاز: ۸٫۵/۱۰'), `امتیاز: ${ltr('۸٫۵/۱۰')}`);
  assert.equal(fa.isolate('تخفیف: ۲۰٪'), `تخفیف: ${ltr('۲۰٪')}`);
  assert.equal(fa.t(`Save ${fa.num(20)}% against monthly`), `${ltr('۲۰٪')} صرفه‌جویی نسبت به پرداخت ماهانه`);
});

test('repeated translation is stable and English identifiers are preserved', () => {
  const once = fa.t('Show all 12');
  assert.equal(once, `نمایش همهٔ ${ltr('۱۲')} نفر`);
  assert.equal(fa.t(once), once);
  assert.equal(fa.isolate(fa.isolate(once)), once);
  assert.equal(fa.isolate('name123@example.com https://example.com/2026'), 'name123@example.com https://example.com/2026');
  assert.equal(en.num(1234567), '1,234,567');
  assert.equal(en.digits('09'), '09');
  assert.equal(en.t('Show all 12'), 'Show all 12');
});

test('all Persian translations retain the exact variable placeholders', () => {
  const slots = (s) => (s.match(/\{\w+\}/g) || []).sort();
  for (const [key, value] of Object.entries(fa.FA)) assert.deepEqual(slots(value), slots(key), key);
});

test('every HTML page loads number formatting before the translated application', async () => {
  const pages = (await readdir(new URL('../', import.meta.url))).filter(name => name.endsWith('.html'));
  pages.push('works/the-candlewood.html');
  for (const page of pages) {
    const html = await load(page);
    const formatting = html.indexOf('js/numbers.js?');
    assert.ok(formatting >= 0 && formatting < html.indexOf('js/main.js?'), page);
  }
});
