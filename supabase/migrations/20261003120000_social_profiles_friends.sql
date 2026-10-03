-- Social, phase 1: public profiles with a username, playtime the launcher
-- records, friends, and online / in-game status.
--
-- Everything that touches another member goes through the security-definer
-- functions below; the new tables only let a member read their own rows.
-- A profile's real name and email are never shown to anyone else: the
-- username (handle) is the public name.

-- ---------- Profiles ----------
alter table public.profiles
  add column if not exists handle text,
  add column if not exists bio text,
  add column if not exists visibility text not null default 'public',
  add column if not exists last_seen_at timestamptz,
  add column if not exists playing_work_id text references public.works(id) on delete set null;

alter table public.profiles
  add constraint profiles_handle_format check (handle is null or handle ~ '^[A-Za-z0-9_]{3,20}$'),
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 300),
  add constraint profiles_visibility check (visibility in ('public', 'friends', 'private'));
create unique index profiles_handle_key on public.profiles (lower(handle));

-- Members still update their own row (name, avatar, handle, bio,
-- visibility). Presence only changes through heartbeat(), which checks the
-- game is theirs: a direct update leaves those two columns as they were.
create or replace function private.profile_presence_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.last_seen_at := old.last_seen_at;
    new.playing_work_id := old.playing_work_id;
  end if;
  return new;
end; $$;
create trigger profiles_presence_guard before update on public.profiles
  for each row execute function private.profile_presence_guard();

-- ---------- Playtime ----------
-- One row per play session. The launcher sends a heartbeat every minute
-- while a game runs; a session whose heartbeats stop is closed at the last
-- one, so a crash never counts hours that weren't played.
create table public.play_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id text not null references public.works(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_beat_at timestamptz not null default now(),
  ended_at timestamptz
);
create index play_sessions_user_work on public.play_sessions (user_id, work_id);
create index play_sessions_open on public.play_sessions (user_id) where ended_at is null;
alter table public.play_sessions enable row level security;
create policy "Members read their own play sessions" on public.play_sessions
  for select to authenticated using (user_id = (select auth.uid()));
grant select on public.play_sessions to authenticated;

-- ---------- Friends ----------
-- A request is a row from the asker (user_id) to the other member
-- (friend_id). Accepting it makes the pair friends both ways; one row per
-- pair, whichever way round.
create table public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create unique index friendships_pair on public.friendships (least(user_id, friend_id), greatest(user_id, friend_id));
create index friendships_friend on public.friendships (friend_id);
alter table public.friendships enable row level security;
create policy "Members read their own friendships" on public.friendships
  for select to authenticated using ((select auth.uid()) in (user_id, friend_id));
grant select on public.friendships to authenticated;

-- ---------- Helpers ----------
create or replace function private.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.user_id = a and f.friend_id = b) or (f.user_id = b and f.friend_id = a)));
$$;

-- Seconds played, per game, for one member (open sessions count up to their
-- last heartbeat).
create or replace function private.playtime(p_user uuid)
returns table(work_id text, seconds bigint, last_played timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.work_id,
    sum(extract(epoch from (coalesce(s.ended_at, s.last_beat_at) - s.started_at)))::bigint,
    max(coalesce(s.ended_at, s.last_beat_at))
  from public.play_sessions s where s.user_id = p_user group by s.work_id;
$$;

-- Online: the launcher sent a heartbeat in the last two minutes.
create or replace function private.online(p_seen timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select p_seen is not null and p_seen > now() - interval '2 minutes';
$$;

-- The games a member owns: the same rule as private.can_use_license, for
-- any member rather than the caller.
create or replace function private.owned_works(p_user uuid)
returns table(work_id text) language sql stable security definer set search_path = '' as $$
  select distinct l.work_id from public.licenses l
  where not l.revoked and not l.order_revoked and l.delivered_at is not null
    and coalesce(l.redeemed_by, l.user_id) = p_user
    and (l.order_id is null or exists(select 1 from public.orders o
      where o.id = l.order_id and o.status in ('paid','processing','completed')));
$$;

-- ---------- Heartbeat (the launcher, every minute) ----------
-- Marks the member online and, when p_playing is a game they own, in that
-- game, extending its play session or starting a new one. Any other open
-- session is closed at its last heartbeat.
create or replace function public.heartbeat(p_playing text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); playing text; open_id uuid;
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  playing := case when p_playing is not null and public.owns_work(p_playing) then p_playing end;

  update public.profiles set last_seen_at = now(), playing_work_id = playing where id = me;

  update public.play_sessions set ended_at = last_beat_at
    where user_id = me and ended_at is null
      and (playing is null or work_id <> playing or last_beat_at < now() - interval '3 minutes');

  if playing is not null then
    select id into open_id from public.play_sessions
      where user_id = me and work_id = playing and ended_at is null limit 1;
    if open_id is null then
      insert into public.play_sessions (user_id, work_id) values (me, playing);
    else
      update public.play_sessions set last_beat_at = now() where id = open_id;
    end if;
  end if;
end; $$;

-- ---------- Friends ----------
create or replace function public.friend_request(p_handle text)
returns text language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); them uuid; existing public.friendships;
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  select id into them from public.profiles where lower(handle) = lower(trim(p_handle));
  if them is null then return 'not_found'; end if;
  if them = me then return 'self'; end if;
  select * into existing from public.friendships
    where (user_id = me and friend_id = them) or (user_id = them and friend_id = me) for update;
  if found then
    if existing.status = 'accepted' then return 'already'; end if;
    if existing.user_id = me then return 'pending'; end if;
    -- They had already asked: asking back accepts.
    update public.friendships set status = 'accepted', accepted_at = now()
      where user_id = them and friend_id = me;
    return 'accepted';
  end if;
  insert into public.friendships (user_id, friend_id) values (me, them);
  return 'sent';
end; $$;

create or replace function public.friend_respond(p_user uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  if p_accept then
    update public.friendships set status = 'accepted', accepted_at = now()
      where user_id = p_user and friend_id = auth.uid() and status = 'pending';
  else
    delete from public.friendships
      where user_id = p_user and friend_id = auth.uid() and status = 'pending';
  end if;
end; $$;

-- Unfriend, or take back a request you sent.
create or replace function public.friend_remove(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  delete from public.friendships
    where (user_id = auth.uid() and friend_id = p_user) or (user_id = p_user and friend_id = auth.uid());
end; $$;

-- Friends and requests, with presence for friends only.
create or replace function public.my_friends()
returns table(user_id uuid, handle text, avatar_url text, relation text,
  online boolean, playing_work_id text, playing_title text, last_seen_at timestamptz, since timestamptz)
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
    coalesce(f.accepted_at, f.created_at)
  from public.friendships f
  join public.profiles p on p.id = case when f.user_id = me then f.friend_id else f.user_id end
  left join public.works w on w.id = p.playing_work_id
  where me in (f.user_id, f.friend_id)
  order by (f.status = 'accepted' and private.online(p.last_seen_at)) desc, lower(p.handle);
end; $$;

-- ---------- Public profile (site and launcher; anyone may ask) ----------
-- Shows a member by username. "public": everyone sees it; "friends": only
-- friends see more than the name and picture; "private": only the member.
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
    when exists(select 1 from public.friendships where user_id = me and friend_id = p.id) then 'sent'
    when exists(select 1 from public.friendships where user_id = p.id and friend_id = me) then 'received'
    else 'none' end;
  can_see := relation = 'self' or p.visibility = 'public' or (p.visibility = 'friends' and relation = 'friend');

  if not can_see then
    return jsonb_build_object('handle', p.handle, 'avatar_url', p.avatar_url,
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

-- The member's own playtime per game (for the launcher's library).
create or replace function public.my_playtime()
returns table(work_id text, minutes bigint, last_played timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  return query select t.work_id, t.seconds / 60, t.last_played from private.playtime(auth.uid()) t;
end; $$;

-- ---------- Grants ----------
revoke all on function private.are_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function private.playtime(uuid) from public, anon, authenticated;
revoke all on function private.owned_works(uuid) from public, anon, authenticated;
revoke all on function public.heartbeat(text) from public, anon;
revoke all on function public.friend_request(text) from public, anon;
revoke all on function public.friend_respond(uuid, boolean) from public, anon;
revoke all on function public.friend_remove(uuid) from public, anon;
revoke all on function public.my_friends() from public, anon;
revoke all on function public.my_playtime() from public, anon;
grant execute on function public.heartbeat(text) to authenticated;
grant execute on function public.friend_request(text) to authenticated;
grant execute on function public.friend_respond(uuid, boolean) to authenticated;
grant execute on function public.friend_remove(uuid) to authenticated;
grant execute on function public.my_friends() to authenticated;
grant execute on function public.my_playtime() to authenticated;
grant execute on function public.public_profile(text) to anon, authenticated;
