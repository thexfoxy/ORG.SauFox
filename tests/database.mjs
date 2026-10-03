import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

export const baseline = JSON.parse(await readFile(new URL('../database/baseline-20260930.json', import.meta.url)));
const q = x => '"' + x.replaceAll('"','""') + '"';
export async function database() {
  if (process.env.DATABASE_URL) {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    return { query: (s,p) => client.query(s,p), exec: s => client.query(s), close: () => client.end() };
  }
  return new PGlite();
}
export async function restore(db) {
  // Only for an EMPTY disposable database. Deliberately refuses an existing SauFox schema.
  const existing = await db.query("select to_regclass('public.licenses') as existing");
  if (existing.rows[0].existing) throw Error('Refusing to seed a non-empty database');
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private; create schema extensions;
    create table auth.users(id uuid primary key,email text,banned_until timestamptz,raw_user_meta_data jsonb default '{}');
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));
    create table auth.refresh_tokens(user_id text);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub','')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
    grant usage on schema auth,public,private to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;
    set check_function_bodies=off;
  `);
  for (const t of baseline.tables) {
    const cols=t.columns.map(c=>`${q(c.name)} ${c.type}${c.identity ? ' generated '+(c.identity==='a'?'always':'by default')+' as identity' : c.default ? ' default '+c.default : ''}${c.not_null?' not null':''}`);
    await db.exec(`create table ${q(t.schema)}.${q(t.name)} (${cols.join(',')});`);
  }
  for (const f of baseline.functions) {
    await db.exec(f.definition);
    if (f.acl !== null) {
      const signature = `${q(f.schema)}.${q(f.name)}(${f.identity})`;
      await db.exec(`revoke all on function ${signature} from public;`);
      for (const acl of f.acl.replace(/[{}]/g,'').split(',')) {
        const [role, rights] = acl.split('=');
        if (rights.startsWith('X') && role !== 'postgres')
          await db.exec(`grant execute on function ${signature} to ${role ? q(role) : 'public'};`);
      }
    }
  }
  // Keys must exist before foreign keys regardless of catalog ordering.
  for (const kind of [false,true]) for (const t of baseline.tables) for (const c of t.constraints||[]) {
    if ((c.type==='f')!==kind) continue;
    await db.exec(`alter table ${q(t.schema)}.${q(t.name)} add constraint ${q(c.name)} ${c.definition};`);
  }
  for(const t of baseline.tables) if(t.rls) await db.exec(`alter table public.${q(t.name)} enable row level security;`);
  const constraints = new Set(baseline.tables.flatMap(t => (t.constraints || []).map(c => c.name)));
  for (const index of baseline.indexes) if (!constraints.has(index.indexname)) await db.exec(index.indexdef);
  for (const p of baseline.policies.filter(p=>p.schemaname==='public')) {
    const roles = Array.isArray(p.roles)? p.roles : p.roles.replace(/[{}]/g,'').split(',');
    await db.exec(`create policy ${q(p.policyname)} on public.${q(p.tablename)} for ${p.cmd} to ${roles.map(q).join(',')}${p.qual?' using ('+p.qual+')':''}${p.with_check?' with check ('+p.with_check+')':''};`);
  }
  for (const t of baseline.triggers.filter(t=>t.schema==='public')) await db.exec(t.definition);
  for (const grant of baseline.grants) if (['anon','authenticated','service_role'].includes(grant.grantee))
    await db.exec(`grant ${grant.privilege_type} on ${q(grant.table_schema)}.${q(grant.table_name)} to ${q(grant.grantee)};`);
  await db.exec('grant usage,select on all sequences in schema public to authenticated,service_role;');
  await db.exec(await readFile(new URL('../supabase/migrations/20260930174628_purchase_install_reliability.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261003120000_social_profiles_friends.sql',import.meta.url),'utf8'));
}
export const A='10000000-0000-4000-8000-000000000001', B='10000000-0000-4000-8000-000000000002', C='10000000-0000-4000-8000-000000000003';
export const SA='20000000-0000-4000-8000-000000000001', SB='20000000-0000-4000-8000-000000000002', SC='20000000-0000-4000-8000-000000000003';
export const O='30000000-0000-4000-8000-000000000001', L='40000000-0000-4000-8000-000000000001';
export async function as(db,user=A,session=SA,role='authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,email:'a@example.test',session_id:session,role,amr:[{method:'otp'}]})]);
  await db.exec(`set role ${role}`);
}
export async function seed(db) {
  await db.exec(`reset role; set session_replication_role=replica;
    truncate public.license_devices,public.licenses,public.builds,public.orders,public.ticket_messages,public.tickets,public.admins,public.works,auth.sessions,auth.users,private.payment_attempts,private.ticket_email_outbox cascade;
    insert into auth.users(id,email) values('${A}','a@example.test'),('${B}','b@example.test'),('${C}','c@example.test');
    insert into auth.sessions values('${SA}','${A}'),('${SB}','${B}'),('${SC}','${C}');
    insert into public.works(id,title,kind,status,published,price_irr) values('test-game','Test game','Game','released',true,100000);
    insert into public.orders(id,user_id,work_id,title,amount_irr,name,email,phone,status) values('${O}','${A}','test-game','Test game',100000,'Test','a@example.test','09123456789','paid');
    insert into public.licenses(id,code,work_id,order_id,user_id,delivered_at,max_devices) values('${L}','SFOX-AAAA-BBBB-CCCC-DDDD','test-game','${O}','${A}',now(),1);
    insert into public.builds(work_id,version,file_key,file_name,size_bytes,sha256,entrypoint,published) values('test-game','1','test/game.zip','game.zip',4,repeat('a',64),'Game.exe',true);
    set session_replication_role=origin;`);
  await as(db);
}
