-- Apply after the recorded production baseline. No customer rows are seeded.
begin;

-- JWT signatures alone do not prove that a session has not been revoked.
create or replace function private.verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select bool_or(m->>'method' <> 'password')
    from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) m), false)
  and exists(select 1 from auth.sessions s join auth.users u on u.id = s.user_id
    where s.id::text = auth.jwt()->>'session_id' and s.user_id = auth.uid()
      and (u.banned_until is null or u.banned_until <= now()));
$$;
revoke all on function private.verified() from public;
grant execute on function private.verified() to anon, authenticated, service_role;
create or replace function public.session_valid() returns boolean
language sql stable security invoker set search_path = '' as $$ select private.verified(); $$;
revoke all on function public.session_valid() from public, anon;
grant execute on function public.session_valid() to authenticated;

alter table public.licenses add column order_revoked boolean not null default false;
-- The baseline already has licenses_one_per_order (unique order_id).
create unique index licenses_normalized_code on public.licenses
  (upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')));
update public.licenses l set order_revoked = true from public.orders o
 where o.id = l.order_id and o.status not in ('paid','processing','completed');
delete from public.license_devices where license_id in (select id from public.licenses where order_revoked);

create or replace function private.can_use_license(p_license uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.verified() and exists(select 1 from public.licenses l
    where l.id = p_license and not l.revoked and not l.order_revoked and l.delivered_at is not null
      and coalesce(l.redeemed_by, l.user_id) = auth.uid()
      and (l.order_id is null or exists(select 1 from public.orders o
        where o.id = l.order_id and o.status in ('paid','processing','completed'))));
$$;
revoke all on function private.can_use_license(uuid) from public;
grant execute on function private.can_use_license(uuid) to authenticated;
create or replace function public.owns_work(p_work text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.licenses l where l.work_id = p_work and private.can_use_license(l.id));
$$;
revoke all on function public.owns_work(text) from public, anon;
grant execute on function public.owns_work(text) to authenticated;

drop policy "Owners read published builds; admins read all" on public.builds;
create policy "License holders read published builds; admins read all" on public.builds
  for select to authenticated using ((select private.is_admin()) or (published and public.owns_work(work_id)));
drop policy "See your devices" on public.license_devices;
create policy "See your devices" on public.license_devices for select to authenticated
  using ((select private.is_admin()) or private.can_use_license(license_id));

create or replace function public.my_licenses()
returns table(license_id uuid, code text, work_id text, title text, cover_url text,
 redeemed_at timestamptz, max_devices integer, devices integer, mine boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.verified() then raise exception 'Sign in first' using errcode='SF030'; end if;
  return query select l.id,l.code,l.work_id,w.title,w.cover_url,l.redeemed_at,l.max_devices,
    (select count(*)::int from public.license_devices d where d.license_id=l.id), l.user_id=auth.uid()
    from public.licenses l join public.works w on w.id=l.work_id
    where private.can_use_license(l.id) order by l.created_at desc;
end; $$;

create or replace function public.redeem_license(p_code text)
returns table(work_id text,title text,already boolean)
language plpgsql security definer set search_path = '' as $$
declare lic public.licenses; clean text := upper(regexp_replace(coalesce(p_code,''),'[^A-Za-z0-9]','','g'));
begin
  if not private.verified() then raise exception 'Sign in first' using errcode='SF030'; end if;
  select * into lic from public.licenses l
    where upper(regexp_replace(l.code,'[^A-Za-z0-9]','','g'))=clean for update;
  if not found or lic.revoked or lic.order_revoked or lic.delivered_at is null
    or (lic.order_id is not null and not exists(select 1 from public.orders o
      where o.id=lic.order_id and o.status in ('paid','processing','completed'))) then
    raise exception 'That key isn''t valid' using errcode='SF031';
  end if;
  if lic.redeemed_by is not null and lic.redeemed_by<>auth.uid() then
    raise exception 'That key is already on another account' using errcode='SF032';
  end if;
  if lic.redeemed_by is null then
    update public.licenses set redeemed_by=auth.uid(),redeemed_at=now() where id=lic.id;
    -- A gift transfers the active seats as well as the entitlement.
    if lic.user_id<>auth.uid() then delete from public.license_devices where license_id=lic.id; end if;
  end if;
  return query select w.id,w.title,(lic.redeemed_by is not null) from public.works w where w.id=lic.work_id;
end; $$;

create or replace function public.activate_device(p_license uuid,p_device_hash text,p_device_name text default null)
returns table(ok boolean,devices integer,max_devices integer)
language plpgsql security definer set search_path = '' as $$
declare lic public.licenses; used int;
begin
  if not private.verified() then raise exception 'Sign in first' using errcode='SF030'; end if;
  if p_device_hash is null or p_device_hash !~ '^[a-fA-F0-9]{64}$' then
    raise exception 'Bad device id' using errcode='SF033'; end if;
  select * into lic from public.licenses where id=p_license for update;
  if not found or not private.can_use_license(p_license) then
    raise exception 'Not your license' using errcode='SF034'; end if;
  update public.license_devices set last_seen_at=now(),device_name=left(coalesce(p_device_name,device_name),80)
    where license_id=lic.id and device_hash=lower(p_device_hash);
  if found then
    return query select true,(select count(*)::int from public.license_devices where license_id=lic.id),lic.max_devices;
    return;
  end if;
  select count(*)::int into used from public.license_devices where license_id=lic.id;
  if used>=lic.max_devices then return query select false,used,lic.max_devices; return; end if;
  insert into public.license_devices(license_id,device_hash,device_name)
    values(lic.id,lower(p_device_hash),left(coalesce(p_device_name,''),80));
  return query select true,used+1,lic.max_devices;
end; $$;

create or replace function public.release_device(p_license uuid,p_device_hash text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.verified() then raise exception 'Sign in first' using errcode='SF030'; end if;
  perform 1 from public.licenses where id=p_license for update;
  if not private.can_use_license(p_license) then raise exception 'Not your license' using errcode='SF034'; end if;
  delete from public.license_devices where license_id=p_license and device_hash=lower(p_device_hash);
end; $$;

create or replace function private.order_license() returns trigger
language plpgsql security definer set search_path = '' as $$
declare attempt int:=0; is_game boolean;
begin
  if new.plan_id is not null or new.work_id is null then return new; end if;
  if new.status not in ('paid','processing','completed') then
    update public.licenses set order_revoked=true where order_id=new.id;
    delete from public.license_devices where license_id in (select id from public.licenses where order_id=new.id);
    return new;
  end if;
  -- Restore only the order-related restriction; a manually revoked key stays revoked.
  update public.licenses set order_revoked=false where order_id=new.id;
  if found or new.user_id is null then return new; end if;
  select lower(kind)='game' into is_game from public.works where id=new.work_id;
  loop
    begin
      insert into public.licenses(code,work_id,order_id,user_id,delivered_at)
        values(private.new_license_code(),new.work_id,new.id,new.user_id,case when is_game then null else now() end);
      exit;
    exception when unique_violation then attempt:=attempt+1; if attempt>=5 then raise; end if;
    end;
  end loop;
  return new;
end; $$;

-- Old drafts may remain incomplete; every published artifact must be verifiable.
-- PostgreSQL limits bounded regex repeats to 255; validate length separately.
alter table public.builds drop constraint builds_file_key_check;
alter table public.builds add constraint builds_file_key_check check
  (length(file_key) between 1 and 300 and file_key ~ '^[A-Za-z0-9._/-]+$');
alter table public.builds add column entrypoint text;
alter table public.builds add constraint builds_integrity check
  (not published or (sha256 is not null and sha256 ~ '^[a-fA-F0-9]{64}$' and size_bytes is not null and size_bytes>0));
alter table public.builds add constraint builds_windows_entrypoint check
  (not published or platform<>'windows' or (entrypoint is not null
    and entrypoint ~ '^[A-Za-z0-9_-][A-Za-z0-9_ ./-]*[.]exe$'
    and entrypoint !~ '(^|/)\.\.(/|$)' and entrypoint !~ '(^|/)\.(/|$)'));

-- Separate attempts retain the gateway mode/amount for each authority, including callbacks after a mode change.
create table private.payment_attempts (
  authority text primary key, order_id uuid not null references public.orders(id),
  test boolean not null, amount_irr bigint not null, created_at timestamptz not null default now(),
  verified_at timestamptz, ref_id text, needs_review boolean not null default false
);
alter table private.payment_attempts enable row level security;
revoke all on private.payment_attempts from public,anon,authenticated;
insert into private.payment_attempts(authority,order_id,test,amount_irr)
  select a,o.id,o.test,o.amount_irr from public.orders o cross join lateral unnest(o.authorities) a;

create function public.register_payment_attempt(p_order uuid,p_authority text,p_test boolean,p_amount bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders;
begin
  select * into o from public.orders where id=p_order for update;
  if not found or o.status<>'awaiting_payment' or o.amount_irr<>p_amount then
    raise exception 'Order changed' using errcode='SF040'; end if;
  insert into private.payment_attempts(authority,order_id,test,amount_irr) values(p_authority,p_order,p_test,p_amount);
  update public.orders set authority=p_authority,test=p_test,authorities=array_append(authorities,p_authority) where id=p_order;
end; $$;
create function public.payment_attempt(p_order uuid,p_authority text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(a) from private.payment_attempts a where a.order_id=p_order and a.authority=p_authority;
$$;
create function public.confirm_order_payment(p_order uuid,p_authority text,p_ref text,p_card text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.orders; a private.payment_attempts;
begin
  select * into o from public.orders where id=p_order for update;
  select * into a from private.payment_attempts where order_id=p_order and authority=p_authority for update;
  if o.id is null or a.authority is null or a.amount_irr<>o.amount_irr or coalesce(p_ref,'')='' then
    raise exception 'Invalid payment' using errcode='SF040'; end if;
  if a.verified_at is not null and a.ref_id is distinct from p_ref then
    raise exception 'Payment reference changed' using errcode='SF040'; end if;
  update private.payment_attempts set verified_at=coalesce(verified_at,now()),ref_id=p_ref,
    needs_review=(o.status='cancelled' or (o.ref_id is not null and o.ref_id<>p_ref)) where authority=p_authority;
  if o.status='cancelled' or (o.ref_id is not null and o.ref_id<>p_ref) then
    return jsonb_build_object('paid',false,'error','payment_review','number',o.number);
  end if;
  if o.status='awaiting_payment' or o.ref_id is null then
    update public.orders set status=case when o.status='awaiting_payment' then 'paid' else o.status end,
      authority=p_authority,ref_id=p_ref,test=a.test,
      card_pan=p_card,paid_at=coalesce(paid_at,now()) where id=p_order returning * into o;
  end if;
  return jsonb_build_object('paid',true,'number',o.number,'ref_id',o.ref_id,'plan',o.plan_id);
end; $$;
revoke all on function public.register_payment_attempt(uuid,text,boolean,bigint),
 public.payment_attempt(uuid,text),public.confirm_order_payment(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.register_payment_attempt(uuid,text,boolean,bigint),
 public.payment_attempt(uuid,text),public.confirm_order_payment(uuid,text,text,text) to service_role;

-- Transactional support outbox. Messages survive a browser closing before its notification request.
create table private.ticket_email_outbox (
  message_id uuid primary key references public.ticket_messages(id) on delete cascade,
  created_at timestamptz not null default now(), sent_at timestamptz,
  attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
  lease_until timestamptz, claim uuid, last_error text
);
alter table private.ticket_email_outbox enable row level security;
revoke all on private.ticket_email_outbox from public,anon,authenticated;
create function private.queue_ticket_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin insert into private.ticket_email_outbox(message_id) values(new.id) on conflict do nothing; return new; end;
$$;
revoke all on function private.queue_ticket_email() from public;
create trigger ticket_email_queued after insert on public.ticket_messages for each row execute function private.queue_ticket_email();
create function public.claim_ticket_emails(p_message uuid default null,p_limit integer default 10)
returns table(message_id uuid,claim uuid)
language plpgsql security definer set search_path = '' as $$
begin
  return query with due as (
    select q.message_id from private.ticket_email_outbox q
    where q.sent_at is null and q.attempts<20 and q.created_at>now()-interval '23 hours'
      and q.next_attempt_at<=now() and (q.lease_until is null or q.lease_until<now())
      and (p_message is null or q.message_id=p_message)
    order by q.created_at for update skip locked limit least(greatest(p_limit,1),20)
  ) update private.ticket_email_outbox q set claim=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=q.attempts+1
    from due where q.message_id=due.message_id returning q.message_id,q.claim;
end; $$;
create function public.finish_ticket_email(p_message uuid,p_claim uuid,p_error text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update private.ticket_email_outbox set sent_at=case when p_error is null then now() else null end,
    last_error=left(p_error,300),lease_until=null,claim=null,next_attempt_at=now()+interval '15 minutes'
    where message_id=p_message and claim=p_claim;
end; $$;
revoke all on function public.claim_ticket_emails(uuid,integer),public.finish_ticket_email(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_ticket_emails(uuid,integer),public.finish_ticket_email(uuid,uuid,text) to service_role;

commit;
