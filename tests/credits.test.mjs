import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const context = vm.createContext({window:{}, FA:{}});
vm.runInContext(await readFile(new URL('../js/credits.js', import.meta.url),'utf8'), context);
const taxonomy = context.window.SauFoxCredits;
const main = await readFile(new URL('../js/main.js', import.meta.url),'utf8');
const readers = main.slice(main.indexOf('const creditTaxonomy ='), main.indexOf('\nconst toWork ='));
vm.runInContext(`const SauFoxCredits = window.SauFoxCredits; ${readers}; globalThis.read = readCredit;`,context);

test('legacy credit formats and characters survive the expanded taxonomy', () => {
  const old = context.read({name:'MATT',group:'cast',role:'Arthur',photo:'/matt.png'});
  assert.equal(old.name,'MATT'); assert.equal(old.character,'Arthur'); assert.equal(old.photo,'/matt.png');
  assert.deepEqual(Array.from(old.roles),['Actor']);
  assert.equal(taxonomy.department(context.read({group:'director_writer'})),'direction');
  const mixed = context.read({roles:['Voice actor','Programmer'],character:'Arthur',department:'engineering'});
  assert.equal(mixed.character,'Arthur'); assert.equal(taxonomy.department(mixed),'engineering');
});

test('known Persian roles and legacy aliases normalize without losing custom roles', () => {
  const roles = taxonomy.unique(['Level design','Level designer','طراح مرحله','My custom specialty']);
  assert.deepEqual(Array.from(roles),['Level designer','My custom specialty']);
  assert.equal(taxonomy.normalize('DOP'),'Cinematographer');
  assert.equal(taxonomy.normalize('Sound design'),'Sound designer');
  assert.equal(taxonomy.department({roles:['Unlisted specialty']}),'other');
});

test('game AI programming, human performances and AI assistants have separate categories', () => {
  assert.equal(taxonomy.department({roles:['AI programmer']}),'engineering');
  assert.equal(taxonomy.department({roles:['AI assistant','Programmer']}),'ai');
  for (const role of ['Narrator','Motion capture performer','Stunt double','Voice actress']) assert.equal(taxonomy.plays(role),true);
  for (const role of ['Voice director','Casting director','Motion capture technician','Programmer']) assert.equal(taxonomy.plays(role),false);
});

test('explicit public departments override inference and unknown departments are ignored', () => {
  assert.equal(taxonomy.department({roles:['Director','Composer'],department:'sound'}),'sound');
  assert.equal(taxonomy.isLead({roles:['Director','Composer'],department:'sound'}),false);
  assert.equal(taxonomy.isLead({roles:['Game director','Programmer']}),true);
  assert.equal(taxonomy.department({roles:['QA tester'],department:'invalid'}),'qa');
});

test('the catalogue has unique translated roles and every page loads it before main', async () => {
  assert.ok(taxonomy.roles.length >= 200);
  assert.equal(new Set(taxonomy.roles.map(r=>r.en)).size,taxonomy.roles.length);
  for (const role of taxonomy.roles) {
    assert.ok(role.fa && role.en.length <= 60);
    assert.equal(taxonomy.info(role.fa).group,role.group);
  }
  for (const page of ['admin','index','work','status','404']) {
    const html = await readFile(new URL(`../${page}.html`,import.meta.url),'utf8');
    assert.ok(html.indexOf('js/credits.js?v=103') < html.indexOf('js/main.js?v=103'));
    assert.ok(html.includes('js/credits.js?v=103'));
  }
});
