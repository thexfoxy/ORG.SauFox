import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { database,restore,seed,as,A,B,C,SA,SB,SC,O,L } from './database.mjs';
let db;
before(async()=>{db=await database();await restore(db);});
beforeEach(async()=>seed(db));
after(async()=>db?.close());
const one=async(sql,params=[]) => (await db.query(sql,params)).rows[0];
test('gift transfers both library and RLS access; old devices are removed',async()=>{
  await db.query('select * from activate_device($1,$2)',[L,'a'.repeat(64)]);
  await as(db,B,SB);
  assert.equal((await db.query('select * from builds')).rows.length,0);
  await db.query('select * from redeem_license($1)',['sfox aaaabbbbccccdddd']);
  assert.equal((await db.query('select * from builds')).rows.length,1);
  assert.equal((await db.query('select * from my_licenses()')).rows.length,1);
  assert.equal((await db.query('select * from license_devices')).rows.length,0);
  await as(db);
  assert.equal((await db.query('select * from builds')).rows.length,0);
  assert.equal((await db.query('select * from my_licenses()')).rows.length,0);
  await assert.rejects(db.query('select * from activate_device($1,$2)',[L,'a'.repeat(64)]),/Not your license/);
});
test('a key is idempotent for its owner and cannot be redeemed by someone else',async()=>{
  assert.equal((await one('select * from redeem_license($1)',['SFOX-AAAA-BBBB-CCCC-DDDD'])).already,false);
  assert.equal((await one('select * from redeem_license($1)',['SFOX-AAAA-BBBB-CCCC-DDDD'])).already,true);
  await as(db,B,SB);await assert.rejects(db.query('select * from redeem_license($1)',['SFOX-AAAA-BBBB-CCCC-DDDD']),/another account/);
});
test('undelivered keys cannot be redeemed before the studio sends them',async()=>{
  await db.exec(`reset role; update licenses set delivered_at=null where id='${L}'`);await as(db);
  await assert.rejects(db.query('select * from redeem_license($1)',['SFOX-AAAA-BBBB-CCCC-DDDD']),/valid/);
});
test('cancellation revokes builds, devices and library; restoration preserves manual revocation',async()=>{
  await db.query('select * from activate_device($1,$2)',[L,'a'.repeat(64)]);
  await as(db,A,SA,'service_role');await db.query("update orders set status='cancelled' where id=$1",[O]);
  await as(db); assert.equal((await db.query('select * from builds')).rows.length,0);
  assert.equal((await db.query('select * from my_licenses()')).rows.length,0);
  await db.exec(`reset role; update licenses set revoked=true where id='${L}'`);
  await as(db,A,SA,'service_role');await db.query("update orders set status='paid' where id=$1",[O]);
  await as(db); assert.equal((await db.query('select * from my_licenses()')).rows.length,0);
});
test('device cap is enforced and releasing a seat allows a replacement',async()=>{
  assert.equal((await one('select * from activate_device($1,$2)',[L,'a'.repeat(64)])).ok,true);
  assert.equal((await one('select * from activate_device($1,$2)',[L,'a'.repeat(64)])).devices,1);
  assert.equal((await one('select * from activate_device($1,$2)',[L,'b'.repeat(64)])).ok,false);
  await db.query('select release_device($1,$2)',[L,'a'.repeat(64)]);
  assert.equal((await one('select * from activate_device($1,$2)',[L,'b'.repeat(64)])).ok,true);
});
test('session revocation and account bans immediately remove access',async()=>{
  assert.equal((await one('select session_valid() as valid')).valid,true);
  await db.exec(`reset role; delete from auth.sessions where id='${SA}'`);await as(db);
  assert.equal((await one('select session_valid() as valid')).valid,false);
  assert.equal((await db.query('select * from builds')).rows.length,0);
  await assert.rejects(db.query('select * from my_licenses()'),/Sign in/);
  await db.exec(`reset role; insert into auth.sessions values('${SA}','${A}'); update auth.users set banned_until='infinity' where id='${A}'`);await as(db);
  assert.equal((await one('select session_valid() as valid')).valid,false);
});
test('payment confirmation commits one license and repeated callbacks do not duplicate it',async()=>{
  await as(db,A,SA,'service_role'); await db.query("update orders set status='awaiting_payment' where id=$1",[O]);
  await db.query('delete from licenses where id=$1',[L]);
  await db.query('select register_payment_attempt($1,$2,$3,$4)',[O,'authority-1',true,100000]);
  const first=await one('select confirm_order_payment($1,$2,$3,$4) as result',[O,'authority-1','123',null]);
  assert.equal(first.result.paid,true);
  assert.deepEqual((await one('select confirm_order_payment($1,$2,$3,$4) as result',[O,'authority-1','123',null])).result,first.result);
  assert.equal(Number((await one('select count(*) as count from licenses')).count),1);
});

test('simultaneous redeemers cannot both acquire a key', {skip:!process.env.DATABASE_URL}, async()=>{
  const other=await database();
  try {
    await as(db,B,SB);await as(other,C,SC);
    await db.exec('begin');
    await db.query('select * from redeem_license($1)',['SFOX-AAAA-BBBB-CCCC-DDDD']);
    const losing=assert.rejects(other.query('select * from redeem_license($1)',['SFOX-AAAA-BBBB-CCCC-DDDD']),/another account/);
    await db.exec('commit'); await losing;
  } finally {await db.exec('rollback');await other.close();}
});

test('simultaneous activations cannot exceed the device cap', {skip:!process.env.DATABASE_URL}, async()=>{
  const other=await database();
  try {
    await as(other);await db.exec('begin');
    assert.equal((await one('select * from activate_device($1,$2)',[L,'a'.repeat(64)])).ok,true);
    const competing=other.query('select * from activate_device($1,$2)',[L,'b'.repeat(64)]);
    await db.exec('commit');assert.equal((await competing).rows[0].ok,false);
    assert.equal((await db.query('select * from license_devices')).rows.length,1);
  } finally {await db.exec('rollback');await other.close();}
});

test('outbox workers skip jobs locked by another transaction', {skip:!process.env.DATABASE_URL}, async()=>{
  const ticket=(await one("insert into tickets(subject,category) values('Help','other') returning id")).id;
  await db.query("insert into ticket_messages(ticket_id,body) values($1,'Please help')",[ticket]);
  const other=await database();
  try {
    await as(db,A,SA,'service_role');await as(other,A,SA,'service_role');
    await db.exec('begin');
    assert.equal((await db.query('select * from claim_ticket_emails()')).rows.length,1);
    assert.equal((await other.query('select * from claim_ticket_emails()')).rows.length,0);
    await db.exec('commit');
  } finally {await db.exec('rollback');await other.close();}
});
test('late payment on a cancelled order is recorded for reconciliation without restoring access',async()=>{
  await as(db,A,SA,'service_role'); await db.query("update orders set status='awaiting_payment' where id=$1",[O]);
  await db.query('select register_payment_attempt($1,$2,$3,$4)',[O,'authority-1',true,100000]);
  await db.query("update orders set status='cancelled' where id=$1",[O]);
  assert.equal((await one('select confirm_order_payment($1,$2,$3,$4) as result',[O,'authority-1','123',null])).result.error,'payment_review');
  assert.equal((await one('select payment_attempt($1,$2) as result',[O,'authority-1'])).result.needs_review,true);
  await as(db); assert.equal((await db.query('select * from builds')).rows.length,0);
});

test('a manually advanced order still records its gateway reference',async()=>{
  await as(db,A,SA,'service_role');await db.query("update orders set status='awaiting_payment' where id=$1",[O]);
  await db.query('select register_payment_attempt($1,$2,$3,$4)',[O,'authority-1',true,100000]);
  await db.query("update orders set status='processing' where id=$1",[O]);
  const {result}=await one('select confirm_order_payment($1,$2,$3,$4) as result',[O,'authority-1','123',null]);
  assert.equal(result.ref_id,'123');
  assert.equal((await one('select status from orders where id=$1',[O])).status,'processing');
  await assert.rejects(db.query('select confirm_order_payment($1,$2,$3,$4)',[O,'authority-1','456',null]),/reference changed/);
});

test('a failed order update rolls back the verified payment attempt',async()=>{
  await as(db,A,SA,'service_role');await db.query("update orders set status='awaiting_payment' where id=$1",[O]);
  await db.query('select register_payment_attempt($1,$2,$3,$4)',[O,'authority-1',true,100000]);
  await db.exec(`reset role;
    create function pg_temp.reject_payment() returns trigger language plpgsql as $$ begin raise exception 'simulated storage failure'; end $$;
    create trigger reject_payment before update on public.orders for each row when(new.status='paid') execute function pg_temp.reject_payment();`);
  try {
    await as(db,A,SA,'service_role');
    await assert.rejects(db.query('select confirm_order_payment($1,$2,$3,$4)',[O,'authority-1','123',null]),/simulated storage failure/);
    assert.equal((await one('select payment_attempt($1,$2) as result',[O,'authority-1'])).result.verified_at,null);
    assert.equal((await one('select status from orders where id=$1',[O])).status,'awaiting_payment');
  } finally { await db.exec('reset role; drop trigger reject_payment on public.orders'); }
});

test('a second paid authority is recorded for review without replacing the first receipt',async()=>{
  await as(db,A,SA,'service_role');await db.query("update orders set status='awaiting_payment' where id=$1",[O]);
  for(const authority of ['first','second']) await db.query('select register_payment_attempt($1,$2,$3,$4)',[O,authority,true,100000]);
  await db.query('select confirm_order_payment($1,$2,$3,$4)',[O,'first','123',null]);
  const {result}=await one('select confirm_order_payment($1,$2,$3,$4) as result',[O,'second','456',null]);
  assert.equal(result.error,'payment_review');
  assert.equal((await one('select ref_id from orders where id=$1',[O])).ref_id,'123');
  assert.equal(Number((await one('select count(*) as count from licenses')).count),1);
});

test('a failed mail lease can retry, and a stale acknowledgment cannot finish a new claim',async()=>{
  const ticket=(await one("insert into tickets(subject,category) values('Help','other') returning id")).id;
  const message=(await one("insert into ticket_messages(ticket_id,body) values($1,'Please help') returning id",[ticket])).id;
  await as(db,A,SA,'service_role');
  const first=(await one('select * from claim_ticket_emails($1)',[message])).claim;
  await db.exec(`reset role; update private.ticket_email_outbox set lease_until=now()-interval '1 second'`);
  await as(db,A,SA,'service_role');
  const next=(await one('select * from claim_ticket_emails($1)',[message])).claim;
  assert.notEqual(first,next);
  await db.query('select finish_ticket_email($1,$2,null)',[message,first]);
  await db.exec('reset role');
  assert.equal((await one('select sent_at from private.ticket_email_outbox')).sent_at,null);
  await as(db,A,SA,'service_role');await db.query('select finish_ticket_email($1,$2,null)',[message,next]);
  assert.equal((await db.query('select * from claim_ticket_emails()')).rows.length,0);
});
test('members cannot call service-only payment or outbox RPCs',async()=>{
  await assert.rejects(db.query('select confirm_order_payment($1,$2,$3,$4)',[O,'a','1',null]),/permission denied/);
  await assert.rejects(db.query('select * from claim_ticket_emails()'),/permission denied/);
});
test('published files require a checksum, size and safe Windows entrypoint',async()=>{
  await as(db,A,SA,'service_role');
  for(const [column,value] of [['sha256',null],['size_bytes',0],['entrypoint','../evil.exe']])
    await assert.rejects(db.query(`update builds set ${column}=$1`,[value]),/check constraint/);
});
test('a committed ticket queues mail once and only one worker can claim it',async()=>{
  const ticket=(await one("insert into tickets(subject,category) values('Help','other') returning id")).id;
  const message=(await one("insert into ticket_messages(ticket_id,body) values($1,'Please help') returning id",[ticket])).id;
  await as(db,A,SA,'service_role');
  const jobs=await db.query('select * from claim_ticket_emails($1)',[message]);assert.equal(jobs.rows.length,1);
  assert.equal((await db.query('select * from claim_ticket_emails($1)',[message])).rows.length,0);
  await db.query('select finish_ticket_email($1,$2,null)',[message,jobs.rows[0].claim]);
  assert.equal((await db.query('select * from claim_ticket_emails($1)',[message])).rows.length,0);
});
