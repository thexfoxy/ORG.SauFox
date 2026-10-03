import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { database, restore, seed, as, A, B, SA, SB } from './database.mjs';
let db;
before(async () => { db = await database(); await restore(db); });
beforeEach(async () => {
  await seed(db);
  await db.exec(`reset role; truncate public.profiles, public.friendships, public.play_sessions;
    insert into public.profiles(id,name,handle) values ('${A}','A','alice'),('${B}','B','bob');
    insert into public.achievements(work_id,key,title,title_fa,description,sort) values
      ('test-game','first_steps','First steps','گام اول','Start the game',1),
      ('test-game','the_end','The end',null,'Finish it',2);
    insert into public.achievements(work_id,key,title,description,hidden,sort) values
      ('test-game','secret','Secret room','Find the room',true,3);`);
  await as(db);
});
after(async () => db?.close());
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const list = async () => (await one('select game_achievements($1) as r', ['test-game'])).r;

test('owners unlock achievements once; the list shows them with rarity', async () => {
  const first = (await one('select unlock_achievement($1,$2) as r', ['test-game', 'first_steps'])).r;
  assert.equal(first.new, true);
  assert.equal(first.title_fa, 'گام اول');
  assert.equal((await one('select unlock_achievement($1,$2) as r', ['test-game', 'first_steps'])).r.new, false);
  const rows = await list();
  assert.deepEqual(rows.map(r => r.key), ['first_steps', 'the_end', 'secret']);
  assert.ok(rows[0].unlocked_at);
  assert.equal(rows[0].percent, 100);
  assert.equal(rows[1].unlocked_at, null);
});

test('hidden achievements stay secret until unlocked', async () => {
  let secret = (await list())[2];
  assert.equal(secret.title, null);
  assert.equal(secret.description, null);
  await db.query('select unlock_achievement($1,$2)', ['test-game', 'secret']);
  secret = (await list())[2];
  assert.equal(secret.title, 'Secret room');
  await as(db, B, SB);
  assert.equal((await list())[2].title, null);
  await as(db, A, SA, 'anon');
  assert.equal((await list())[2].title, null);
});

test('no unlocking games you do not own, unknown ones, or too many at once', async () => {
  await assert.rejects(db.query('select unlock_achievement($1,$2)', ['test-game', 'nope']), /No such achievement/);
  await as(db, B, SB);
  await assert.rejects(db.query('select unlock_achievement($1,$2)', ['test-game', 'first_steps']), /Not your game/);
  await as(db, A, SA, 'anon');
  await assert.rejects(db.query('select unlock_achievement($1,$2)', ['test-game', 'first_steps']), /permission denied/);
  await db.exec(`reset role; insert into public.achievements(work_id,key,title) select 'test-game','a'||g,'A' from generate_series(1,31) g;`);
  await as(db);
  for (let i = 1; i <= 30; i++) await db.query('select unlock_achievement($1,$2)', ['test-game', `a${i}`]);
  await assert.rejects(db.query('select unlock_achievement($1,$2)', ['test-game', 'a31']), /Too many/);
});

test('players cannot write achievements or read others', async () => {
  await db.query('select unlock_achievement($1,$2)', ['test-game', 'first_steps']);
  await assert.rejects(db.query(`insert into user_achievements(user_id,work_id,key) values ('${A}','test-game','the_end')`), /permission denied/);
  await assert.rejects(db.query(`insert into achievements(work_id,key,title) values ('test-game','mine','Mine')`), /row-level security/);
  assert.equal((await db.query('select * from achievements')).rows.length, 0);
  await as(db, B, SB);
  assert.equal((await db.query('select * from user_achievements')).rows.length, 0);
});

test('profiles count achievements', async () => {
  await db.query('select unlock_achievement($1,$2)', ['test-game', 'first_steps']);
  await as(db, B, SB);
  const p = (await one('select public_profile($1) as p', ['alice'])).p;
  assert.equal(p.achievements, 1);
  assert.equal(p.games[0].achievements, 1);
  assert.equal(p.games[0].achievements_total, 3);
});

test('cloud saves: commit and read your own, for games you own', async () => {
  assert.equal((await one('select save_info($1) as r', ['test-game'])).r, null);
  await db.query('select save_commit($1,$2,$3,$4)', ['test-game', 'A'.repeat(64), 1234, 'PC']);
  const info = (await one('select save_info($1) as r', ['test-game'])).r;
  assert.equal(info.sha256, 'a'.repeat(64));
  assert.equal(info.size_bytes, 1234);
  await assert.rejects(db.query('select save_commit($1,$2,$3,$4)', ['test-game', 'zz', 1, 'PC']), /sha256_check/);
  await assert.rejects(db.query('select save_commit($1,$2,$3,$4)', ['test-game', 'b'.repeat(64), 60e6, 'PC']), /size_bytes_check/);
  await as(db, B, SB);
  assert.equal((await one('select save_info($1) as r', ['test-game'])).r, null);
  await assert.rejects(db.query('select save_commit($1,$2,$3,$4)', ['test-game', 'b'.repeat(64), 1, 'PC']), /Not your game/);
  assert.equal((await db.query('select * from cloud_saves')).rows.length, 0);
  await assert.rejects(db.query(`insert into cloud_saves(user_id,work_id,sha256,size_bytes) values ('${B}','test-game','${'c'.repeat(64)}',1)`), /permission denied/);
});
