import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { database, restore, seed, as, A, B, C, SA, SB, SC } from './database.mjs';
let db;
before(async () => { db = await database(); await restore(db); });
beforeEach(async () => {
  await seed(db);
  await db.exec(`reset role; truncate public.friendships, public.play_sessions, public.profiles, public.messages, public.blocks;
    insert into public.profiles(id,name,handle,visibility) values
      ('${A}','Alice Real','alice','public'),('${B}','Bob Real','bob','friends'),('${C}','Carol Real','carol','private');`);
  await as(db);
});
after(async () => db?.close());
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const profile = async (handle) => (await one('select public_profile($1) as p', [handle])).p;

test('friend requests: send, accept by asking back, list, remove', async () => {
  assert.equal((await one('select friend_request($1) as r', ['BOB'])).r, 'sent');
  assert.equal((await one('select friend_request($1) as r', ['bob'])).r, 'pending');
  assert.equal((await one('select friend_request($1) as r', ['alice'])).r, 'self');
  assert.equal((await one('select friend_request($1) as r', ['nobody'])).r, 'not_found');
  assert.equal((await one('select relation from my_friends()')).relation, 'sent');
  await as(db, B, SB);
  assert.equal((await one('select relation from my_friends()')).relation, 'received');
  assert.equal((await one('select friend_request($1) as r', ['alice'])).r, 'accepted');
  assert.equal((await one('select relation from my_friends()')).relation, 'friend');
  await db.query('select friend_remove($1)', [A]);
  assert.equal((await db.query('select * from my_friends()')).rows.length, 0);
});

test('declining a request removes it; only the receiver can accept', async () => {
  await db.query('select friend_request($1)', ['bob']);
  await db.query('select friend_respond($1,true)', [B]); // Alice can't accept her own request
  assert.equal((await one('select relation from my_friends()')).relation, 'sent');
  await as(db, B, SB);
  await db.query('select friend_respond($1,false)', [A]);
  assert.equal((await db.query('select * from my_friends()')).rows.length, 0);
});

test('heartbeat records playtime only for owned games, and presence only via heartbeat', async () => {
  await db.query('select heartbeat($1)', ['test-game']);
  await db.query("select heartbeat($1)", ['not-owned']);
  await db.exec(`reset role; update public.play_sessions set started_at = now() - interval '90 minutes'`);
  await as(db);
  const mine = (await db.query('select * from my_playtime()')).rows;
  assert.equal(mine.length, 1);
  assert.equal(mine[0].work_id, 'test-game');
  // A direct update can't fake presence.
  await db.query("update profiles set playing_work_id='test-game', last_seen_at=now() - interval '1 day' where id=$1", [A]);
  await db.exec('reset role');
  const row = await one('select playing_work_id, last_seen_at > now() - interval \'1 minute\' as fresh from public.profiles where id=$1', [A]);
  assert.equal(row.playing_work_id, null);
  assert.equal(row.fresh, true);
});

test('a stalled session is closed at its last heartbeat and a new one starts', async () => {
  await db.query('select heartbeat($1)', ['test-game']);
  await db.exec(`reset role; update public.play_sessions set started_at = now() - interval '2 hours', last_beat_at = now() - interval '1 hour'`);
  await as(db);
  await db.query('select heartbeat($1)', ['test-game']);
  await db.exec('reset role');
  const rows = (await db.query('select ended_at is not null as closed from public.play_sessions order by started_at')).rows;
  assert.deepEqual(rows.map(r => r.closed), [true, false]);
  await as(db);
  assert.equal(Number((await one('select minutes from my_playtime()')).minutes), 60);
});

test('profile visibility: public, friends-only and private', async () => {
  await as(db, B, SB);
  const alice = await profile('alice');
  assert.equal(alice.hidden, false);
  assert.equal(alice.games.length, 1);
  assert.equal(alice.name, undefined); // real names never leave the database
  await as(db, A, SA);
  assert.equal((await profile('bob')).hidden, true);
  await db.query('select friend_request($1)', ['bob']);
  await as(db, B, SB); await db.query('select friend_request($1)', ['alice']);
  await as(db, A, SA);
  assert.equal((await profile('bob')).hidden, false);
  assert.equal((await profile('carol')).hidden, true);
  await as(db, C, SC);
  assert.equal((await profile('carol')).hidden, false);
  assert.equal((await profile('carol')).relation, 'self');
});

test('presence is shown to friends only', async () => {
  await db.query('select heartbeat($1)', ['test-game']);
  await as(db, B, SB);
  assert.equal((await profile('alice')).online, true); // public profile shows status
  await db.query('select friend_request($1)', ['alice']);
  const pending = await one('select online, playing_title from my_friends()');
  assert.equal(pending.online, false);
  await as(db, A, SA); await db.query('select friend_respond($1,true)', [B]);
  await as(db, B, SB);
  const friend = await one('select online, playing_title from my_friends()');
  assert.equal(friend.online, true);
  assert.equal(friend.playing_title, 'Test game');
});

test('handles are unique regardless of case and must be well formed', async () => {
  await assert.rejects(db.query("update profiles set handle='ALICE' where id=$1", [A]).then(() => db.query("update profiles set handle='Bob' where id=$1", [A])), /duplicate|unique/);
  await assert.rejects(db.query("update profiles set handle='a b' where id=$1", [A]), /handle_format/);
});

test('signed-out visitors can read public profiles but not use friends', async () => {
  await db.exec("reset role; select set_config('request.jwt.claims','{\"role\":\"anon\"}',false); set role anon");
  assert.equal((await profile('alice')).hidden, false);
  assert.equal((await profile('alice')).relation, 'none');
  await assert.rejects(db.query('select * from my_friends()'), /permission denied/);
});
