import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { database, restore, seed, as, A, B, C, SA, SB, SC } from './database.mjs';
let db;
before(async () => { db = await database(); await restore(db); });
beforeEach(async () => {
  await seed(db);
  await db.exec(`reset role; truncate public.friendships, public.play_sessions, public.profiles, public.messages, public.blocks;
    insert into public.profiles(id,name,handle) values ('${A}','A','alice'),('${B}','B','bob'),('${C}','C','carol');
    insert into public.friendships(user_id,friend_id,status,accepted_at) values ('${A}','${B}','accepted',now());`);
  await as(db);
});
after(async () => db?.close());
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const send = (to, body) => db.query('select * from send_message($1,$2)', [to, body]);

test('friends can message each other; history, inbox, unread and read', async () => {
  await send(B, '  hi bob  ');
  await send(B, 'second');
  await as(db, B, SB);
  const inbox = (await db.query('select * from inbox(0)')).rows;
  assert.deepEqual(inbox.map(m => m.body), ['hi bob', 'second']);
  assert.equal((await one('select unread from my_friends()')).unread, 2);
  await db.query('select mark_read($1)', [A]);
  assert.equal((await one('select unread from my_friends()')).unread, 0);
  await send(A, 'hey');
  const history = (await db.query('select body from chat_history($1)', [A])).rows;
  assert.deepEqual(history.map(m => m.body), ['hey', 'second', 'hi bob']);
  assert.equal((await db.query('select * from inbox($1)', [inbox[1].id])).rows.length, 1);
});

test('no messages to non-friends, empty or too long ones', async () => {
  await assert.rejects(send(C, 'hello'), /only message friends/);
  await assert.rejects(send(B, '   '), /empty or too long/);
  await assert.rejects(send(B, 'x'.repeat(2001)), /empty or too long/);
});

test('others cannot read a conversation or write as someone else', async () => {
  await send(B, 'private');
  await as(db, C, SC);
  assert.equal((await db.query('select * from chat_history($1)', [A])).rows.length, 0);
  assert.equal((await db.query('select * from messages')).rows.length, 0);
  assert.equal((await db.query('select * from inbox(0)')).rows.length, 0);
  await assert.rejects(db.query(`insert into messages(sender_id,recipient_id,body) values ('${A}','${B}','fake')`), /permission denied/);
  await db.query('select mark_read($1)', [A]); // no effect on others' messages
  await db.exec('reset role');
  assert.equal((await one('select read_at from public.messages')).read_at, null);
});

test('sending is rate limited', async () => {
  for (let i = 0; i < 30; i++) await send(B, `m${i}`);
  await assert.rejects(send(B, 'one too many'), /Slow down/);
});

test('blocking ends the friendship and stops requests and messages both ways', async () => {
  await send(B, 'before');
  await as(db, B, SB);
  await db.query('select block_user($1)', [A]);
  assert.equal((await db.query('select * from my_friends()')).rows.length, 0);
  assert.equal((await db.query('select * from my_blocks()')).rows[0].handle, 'alice');
  await as(db, A, SA);
  await assert.rejects(send(B, 'after'), /only message friends/);
  assert.equal((await one('select friend_request($1) as r', ['bob'])).r, 'not_found');
  await as(db, B, SB);
  await db.query('select unblock_user($1)', [A]);
  assert.equal((await one('select friend_request($1) as r', ['alice'])).r, 'sent');
});

test('pending friend requests are capped', async () => {
  await db.exec(`reset role; insert into auth.users(id,email) select gen_random_uuid(), 'u'||g||'@x.test' from generate_series(1,31) g;
    insert into public.profiles(id,name,handle) select id, 'n', 'user'||row_number() over () from auth.users where email like 'u%@x.test';`);
  await as(db, C, SC);
  for (let i = 1; i <= 30; i++) assert.equal((await one('select friend_request($1) as r', [`user${i}`])).r, 'sent');
  assert.equal((await one('select friend_request($1) as r', ['user31'])).r, 'limit');
});

test('reserved usernames and outside pictures are refused', async () => {
  await assert.rejects(db.query("update profiles set handle='SauFox_Team' where id=$1", [A]), /reserved/);
  await assert.rejects(db.query("update profiles set handle='admin' where id=$1", [A]), /reserved/);
  await assert.rejects(db.query("update profiles set avatar_url='https://evil.test/p.png' where id=$1", [A]), /avatar_own_storage/);
  await db.query("update profiles set avatar_url='https://gwyqkzhhnspfadqefmix.supabase.co/storage/v1/object/public/avatars/a.webp' where id=$1", [A]);
});

test('profiles give the id only to signed-in viewers and show a block', async () => {
  const p = (await one('select public_profile($1) as p', ['carol'])).p;
  assert.equal(p.user_id, C);
  await db.query('select block_user($1)', [C]);
  assert.equal((await one('select public_profile($1) as p', ['carol'])).p.relation, 'blocked');
  await db.exec("reset role; select set_config('request.jwt.claims','{\"role\":\"anon\"}',false); set role anon");
  assert.equal((await one('select public_profile($1) as p', ['carol'])).p.user_id, null);
});
