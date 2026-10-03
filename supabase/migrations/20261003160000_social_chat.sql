-- Social, phase 2: chat between friends, blocking, and closing gaps found
-- in the phase 1 review.
--
-- Messages go only between friends who haven't blocked each other, only
-- through send_message(), at most 30 a minute. The launcher asks for new
-- messages every few seconds (inbox), so nothing needs a live socket.

-- ---------- Review fixes ----------
-- Pictures only from the site's own storage: an outside address would let
-- whoever set it see the IP of everyone who opens the profile.
alter table public.profiles add constraint profiles_avatar_own_storage check (
  avatar_url is null
  or avatar_url like 'https://gwyqkzhhnspfadqefmix.supabase.co/storage/v1/object/public/avatars/%');

-- Names that would pass for the studio are kept for admins.
create or replace function private.handle_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.handle is distinct from old.handle and new.handle is not null
     and lower(new.handle) ~ '^(saufox.*|admin.*|support.*|moderator.*|staff|official.*|system|root|help|security)$'
     and not private.is_admin() then
    raise exception 'That username is reserved' using errcode = '23514';
  end if;
  return new;
end; $$;
create trigger profiles_handle_guard before update on public.profiles
  for each row execute function private.handle_guard();

-- ---------- Blocking ----------
create table public.blocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id),
  check (user_id <> blocked_id)
);
create index blocks_blocked on public.blocks (blocked_id);
alter table public.blocks enable row level security;
create policy "Members read their own blocks" on public.blocks
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.blocks to authenticated;

create or replace function private.blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.blocks
    where (user_id = a and blocked_id = b) or (user_id = b and blocked_id = a));
$$;

-- Blocking ends the friendship (or request) and stops messages both ways.
create or replace function public.block_user(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  if p_user = auth.uid() then return; end if;
  insert into public.blocks (user_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  delete from public.friendships
    where (user_id = auth.uid() and friend_id = p_user) or (user_id = p_user and friend_id = auth.uid());
end; $$;

create or replace function public.unblock_user(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  delete from public.blocks where user_id = auth.uid() and blocked_id = p_user;
end; $$;

create or replace function public.my_blocks()
returns table(user_id uuid, handle text, avatar_url text, since timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  return query select p.id, p.handle, p.avatar_url, b.created_at
    from public.blocks b join public.profiles p on p.id = b.blocked_id
    where b.user_id = auth.uid() order by b.created_at desc;
end; $$;

-- Friend requests: not to or from someone blocked (answered as if the
-- name didn't exist, so a block isn't revealed), and at most 30 waiting.
create or replace function public.friend_request(p_handle text)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); them uuid; existing public.friendships;
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  select id into them from public.profiles where lower(handle) = lower(trim(p_handle));
  if them is null then return 'not_found'; end if;
  if them = me then return 'self'; end if;
  if private.blocked_between(me, them) then return 'not_found'; end if;
  select * into existing from public.friendships
    where (user_id = me and friend_id = them) or (user_id = them and friend_id = me) for update;
  if found then
    if existing.status = 'accepted' then return 'already'; end if;
    if existing.user_id = me then return 'pending'; end if;
    update public.friendships set status = 'accepted', accepted_at = now()
      where user_id = them and friend_id = me;
    return 'accepted';
  end if;
  if (select count(*) from public.friendships where user_id = me and status = 'pending') >= 30 then
    return 'limit';
  end if;
  insert into public.friendships (user_id, friend_id) values (me, them);
  return 'sent';
end; $$;

-- ---------- Messages ----------
create table public.messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index messages_inbox on public.messages (recipient_id, id);
create index messages_pair on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), id desc);
create index messages_sender_recent on public.messages (sender_id, created_at desc);
alter table public.messages enable row level security;
create policy "Members read their own messages" on public.messages
  for select to authenticated using ((select auth.uid()) in (sender_id, recipient_id));
grant select on public.messages to authenticated;

create or replace function public.send_message(p_to uuid, p_body text)
returns public.messages language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); body text := btrim(coalesce(p_body, '')); row public.messages;
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  if body = '' or char_length(body) > 2000 then raise exception 'Message is empty or too long' using errcode = 'SF040'; end if;
  if not private.are_friends(me, p_to) or private.blocked_between(me, p_to) then
    raise exception 'You can only message friends' using errcode = 'SF041';
  end if;
  if (select count(*) from public.messages where sender_id = me and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Slow down a little' using errcode = 'SF042';
  end if;
  insert into public.messages (sender_id, recipient_id, body) values (me, p_to, body) returning * into row;
  return row;
end; $$;

-- A conversation, newest first, 50 at a time (p_before pages back).
create or replace function public.chat_history(p_with uuid, p_before bigint default null, p_limit int default 50)
returns setof public.messages language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  return query select m.* from public.messages m
    where least(m.sender_id, m.recipient_id) = least(me, p_with)
      and greatest(m.sender_id, m.recipient_id) = greatest(me, p_with)
      and (p_before is null or m.id < p_before)
    order by m.id desc limit least(greatest(coalesce(p_limit, 50), 1), 100);
end; $$;

-- Everything new since the last message the launcher has seen (both ways,
-- so a second computer stays in step too). Polled every few seconds.
create or replace function public.inbox(p_after bigint default 0)
returns setof public.messages language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  return query select m.* from public.messages m
    where m.id > coalesce(p_after, 0) and (m.recipient_id = me or m.sender_id = me)
    order by m.id limit 200;
end; $$;

create or replace function public.mark_read(p_with uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  update public.messages set read_at = now()
    where recipient_id = auth.uid() and sender_id = p_with and read_at is null;
end; $$;

-- Friends list, now with unread counts and the last message time.
drop function public.my_friends();
create function public.my_friends()
returns table(user_id uuid, handle text, avatar_url text, relation text,
  online boolean, playing_work_id text, playing_title text, last_seen_at timestamptz, since timestamptz,
  unread int, last_message_at timestamptz, last_message_id bigint)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  return query
  select p.id, p.handle, p.avatar_url,
    case when f.status = 'accepted' then 'friend' when f.user_id = me then 'sent' else 'received' end,
    f.status = 'accepted' and private.online(p.last_seen_at),
    case when f.status = 'accepted' and private.online(p.last_seen_at) then p.playing_work_id end,
    case when f.status = 'accepted' and private.online(p.last_seen_at) then w.title end,
    case when f.status = 'accepted' then p.last_seen_at end,
    coalesce(f.accepted_at, f.created_at),
    (select count(*)::int from public.messages m where m.recipient_id = me and m.sender_id = p.id and m.read_at is null),
    lm.created_at, lm.id
  from public.friendships f
  join public.profiles p on p.id = case when f.user_id = me then f.friend_id else f.user_id end
  left join public.works w on w.id = p.playing_work_id
  left join lateral (select m.id, m.created_at from public.messages m
      where least(m.sender_id, m.recipient_id) = least(me, p.id)
        and greatest(m.sender_id, m.recipient_id) = greatest(me, p.id)
      order by m.id desc limit 1) lm on true
  where me in (f.user_id, f.friend_id)
  order by (f.status = 'accepted' and private.online(p.last_seen_at)) desc, lower(p.handle);
end; $$;

-- Profiles carry the member's id for signed-in viewers (to message or
-- block them), and show "blocked" to whoever blocked them.
create or replace function public.public_profile(p_handle text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles; me uuid := auth.uid(); can_see boolean; relation text;
  games jsonb; total bigint; owned int; friend_count int;
begin
  select * into p from public.profiles where lower(handle) = lower(trim(p_handle));
  if not found then return null; end if;

  relation := case
    when me is null then 'none'
    when me = p.id then 'self'
    when private.are_friends(me, p.id) then 'friend'
    when exists(select 1 from public.blocks where user_id = me and blocked_id = p.id) then 'blocked'
    when exists(select 1 from public.friendships where user_id = me and friend_id = p.id) then 'sent'
    when exists(select 1 from public.friendships where user_id = p.id and friend_id = me) then 'received'
    else 'none' end;
  can_see := relation = 'self' or p.visibility = 'public' or (p.visibility = 'friends' and relation = 'friend');

  if not can_see then
    return jsonb_build_object('user_id', case when me is not null then p.id end,
      'handle', p.handle, 'avatar_url', p.avatar_url,
      'visibility', p.visibility, 'relation', relation, 'hidden', true);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'work_id', w.id, 'title', w.title, 'cover_url', w.cover_url,
      'minutes', coalesce(pt.seconds, 0) / 60, 'last_played', pt.last_played)
      order by pt.last_played desc nulls last, w.title), '[]'::jsonb),
    coalesce(sum(pt.seconds), 0), count(*)
  into games, total, owned
  from private.owned_works(p.id) g
  join public.works w on w.id = g.work_id
  left join private.playtime(p.id) pt on pt.work_id = g.work_id;

  select count(*) into friend_count from public.friendships f
    where f.status = 'accepted' and p.id in (f.user_id, f.friend_id);

  return jsonb_build_object(
    'user_id', case when me is not null then p.id end,
    'handle', p.handle, 'avatar_url', p.avatar_url, 'bio', p.bio,
    'visibility', p.visibility, 'relation', relation, 'hidden', false,
    'member_since', p.created_at,
    'online', private.online(p.last_seen_at),
    'playing', case when private.online(p.last_seen_at) then
      (select jsonb_build_object('work_id', w.id, 'title', w.title) from public.works w where w.id = p.playing_work_id) end,
    'last_seen_at', p.last_seen_at,
    'level', 1 + owned * 2 + (total / 36000)::int,
    'minutes_played', total / 60,
    'friends', friend_count,
    'games', games);
end; $$;

-- ---------- Grants ----------
revoke all on function private.handle_guard() from public, anon, authenticated;
revoke all on function private.blocked_between(uuid, uuid) from public, anon, authenticated;
revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
revoke all on function public.my_blocks() from public, anon;
revoke all on function public.friend_request(text) from public, anon;
revoke all on function public.send_message(uuid, text) from public, anon;
revoke all on function public.chat_history(uuid, bigint, int) from public, anon;
revoke all on function public.inbox(bigint) from public, anon;
revoke all on function public.mark_read(uuid) from public, anon;
revoke all on function public.my_friends() from public, anon;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.my_blocks() to authenticated;
grant execute on function public.friend_request(text) to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.chat_history(uuid, bigint, int) to authenticated;
grant execute on function public.inbox(bigint) to authenticated;
grant execute on function public.mark_read(uuid) to authenticated;
grant execute on function public.my_friends() to authenticated;

-- Writes only through the functions above (row-level security already
-- refuses them; this removes the default grants as well).
revoke insert, update, delete, truncate, references, trigger
  on public.messages, public.blocks, public.friendships, public.play_sessions from anon, authenticated;
revoke select on public.messages, public.blocks, public.friendships, public.play_sessions from anon;

select 'done' as result;
