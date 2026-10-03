-- Phase 3 of the online launcher: achievements and cloud saves.
--
-- Achievements are defined per game by admins (admin.html). A running game
-- unlocks one through the launcher's local SDK, which calls
-- unlock_achievement() with the player's own session: the game never sees
-- the session, and the server checks the player owns the game.
--
-- Cloud saves: the launcher zips the game's save folder and keeps it in the
-- private storage bucket "saves" (see the next migration), one file per
-- player and game. cloud_saves records what's there (a hash of the content,
-- its size, when and from which computer), so the launcher can tell which
-- side is newer without downloading.

-- ---------- Achievements ----------
create table if not exists public.achievements (
  work_id text not null references public.works(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]{1,40}$'),
  title text not null check (char_length(title) between 1 and 80),
  title_fa text check (char_length(title_fa) <= 80),
  description text check (char_length(description) <= 200),
  description_fa text check (char_length(description_fa) <= 200),
  hidden boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (work_id, key)
);
alter table public.achievements enable row level security;

-- Everyone reads the list through game_achievements(), which keeps hidden
-- ones secret until unlocked; the table itself is for admins.
create policy "Admins read achievements" on public.achievements
  for select to authenticated using ((select private.is_admin()));
create policy "Admins add achievements" on public.achievements
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins edit achievements" on public.achievements
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins remove achievements" on public.achievements
  for delete to authenticated using ((select private.is_admin()));

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id text not null,
  key text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, work_id, key),
  foreign key (work_id, key) references public.achievements(work_id, key) on delete cascade on update cascade
);
create index if not exists user_achievements_recent on public.user_achievements (user_id, unlocked_at desc);
create index if not exists user_achievements_work on public.user_achievements (work_id, key);
alter table public.user_achievements enable row level security;
create policy "See your achievements" on public.user_achievements
  for select to authenticated using (user_id = (select auth.uid()));

-- Unlock one achievement of a game the player owns. Returns whether it was
-- new, with its text for the launcher's popup. Unlocking twice is harmless.
create or replace function public.unlock_achievement(p_work text, p_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); a public.achievements; added int;
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  if not public.owns_work(p_work) then raise exception 'Not your game' using errcode = 'SF050'; end if;
  select * into a from public.achievements where work_id = p_work and key = p_key;
  if not found then raise exception 'No such achievement' using errcode = 'SF051'; end if;
  if (select count(*) from public.user_achievements
      where user_id = me and unlocked_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many achievements at once' using errcode = 'SF052';
  end if;
  insert into public.user_achievements (user_id, work_id, key) values (me, p_work, p_key)
    on conflict do nothing;
  get diagnostics added = row_count;
  return jsonb_build_object('new', added > 0, 'key', a.key, 'title', a.title, 'title_fa', a.title_fa,
    'description', a.description, 'description_fa', a.description_fa);
end; $$;

-- A game's achievements, in order: hidden ones show their text only to
-- players who have them. "percent" is how many of the game's owners have
-- each one (rounded), like a rarity.
create or replace function public.game_achievements(p_work text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare me uuid := case when auth.role() = 'authenticated' and private.verified() then auth.uid() end;
  owners int; result jsonb;
begin
  if not exists(select 1 from public.works w where w.id = p_work
      and w.published and (w.publish_at is null or w.publish_at <= now())) then
    return '[]'::jsonb;
  end if;
  select count(distinct coalesce(l.redeemed_by, l.user_id)) into owners from public.licenses l
    where l.work_id = p_work and not l.revoked and not l.order_revoked and l.delivered_at is not null;
  select coalesce(jsonb_agg(jsonb_build_object(
      'key', a.key,
      'hidden', a.hidden,
      'title', case when not a.hidden or u.unlocked_at is not null then a.title end,
      'title_fa', case when not a.hidden or u.unlocked_at is not null then a.title_fa end,
      'description', case when not a.hidden or u.unlocked_at is not null then a.description end,
      'description_fa', case when not a.hidden or u.unlocked_at is not null then a.description_fa end,
      'unlocked_at', u.unlocked_at,
      'percent', case when owners > 0 then round(100.0 * (select count(*) from public.user_achievements x
        where x.work_id = a.work_id and x.key = a.key) / owners) else 0 end)
    order by a.sort, a.created_at), '[]'::jsonb)
  into result
  from public.achievements a
  left join public.user_achievements u on u.user_id = me and u.work_id = a.work_id and u.key = a.key
  where a.work_id = p_work;
  return result;
end; $$;

-- ---------- Cloud saves ----------
create table if not exists public.cloud_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  work_id text not null references public.works(id) on delete cascade,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  device_name text check (char_length(device_name) <= 80),
  updated_at timestamptz not null default now(),
  primary key (user_id, work_id)
);
alter table public.cloud_saves enable row level security;
create policy "See your cloud saves" on public.cloud_saves
  for select to authenticated using (user_id = (select auth.uid()));

-- What's in the cloud for a game (null when nothing yet).
create or replace function public.save_info(p_work text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare s public.cloud_saves;
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  select * into s from public.cloud_saves where user_id = auth.uid() and work_id = p_work;
  if not found then return null; end if;
  return jsonb_build_object('sha256', s.sha256, 'size_bytes', s.size_bytes,
    'device_name', s.device_name, 'updated_at', s.updated_at,
    'updated_epoch', floor(extract(epoch from s.updated_at))::bigint);
end; $$;

-- Record a save the launcher has just uploaded.
create or replace function public.save_commit(p_work text, p_sha256 text, p_size bigint, p_device text)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare saved_at timestamptz;
begin
  if not private.verified() then raise exception 'Sign in first' using errcode = 'SF030'; end if;
  if not public.owns_work(p_work) then raise exception 'Not your game' using errcode = 'SF050'; end if;
  insert into public.cloud_saves (user_id, work_id, sha256, size_bytes, device_name)
    values (auth.uid(), p_work, lower(p_sha256), p_size, left(p_device, 80))
  on conflict (user_id, work_id) do update set sha256 = excluded.sha256,
    size_bytes = excluded.size_bytes, device_name = excluded.device_name, updated_at = now()
  returning updated_at into saved_at;
  return saved_at;
end; $$;

-- ---------- Profiles show achievements ----------
create or replace function public.public_profile(p_handle text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p public.profiles; me uuid := auth.uid(); can_see boolean; relation text;
  games jsonb; total bigint; owned int; friend_count int; unlocked int;
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
      'minutes', coalesce(pt.seconds, 0) / 60, 'last_played', pt.last_played,
      'achievements', (select count(*) from public.user_achievements ua where ua.user_id = p.id and ua.work_id = w.id),
      'achievements_total', (select count(*) from public.achievements a where a.work_id = w.id))
      order by pt.last_played desc nulls last, w.title), '[]'::jsonb),
    coalesce(sum(pt.seconds), 0), count(*)
  into games, total, owned
  from private.owned_works(p.id) g
  join public.works w on w.id = g.work_id
  left join private.playtime(p.id) pt on pt.work_id = g.work_id;

  select count(*) into friend_count from public.friendships f
    where f.status = 'accepted' and p.id in (f.user_id, f.friend_id);
  select count(*) into unlocked from public.user_achievements ua where ua.user_id = p.id;

  return jsonb_build_object(
    'user_id', case when me is not null then p.id end,
    'handle', p.handle, 'avatar_url', p.avatar_url, 'bio', p.bio,
    'visibility', p.visibility, 'relation', relation, 'hidden', false,
    'member_since', p.created_at,
    'online', private.online(p.last_seen_at),
    'playing', case when private.online(p.last_seen_at) then
      (select jsonb_build_object('work_id', w.id, 'title', w.title) from public.works w where w.id = p.playing_work_id) end,
    'last_seen_at', p.last_seen_at,
    'level', 1 + owned * 2 + (total / 36000)::int + unlocked / 5,
    'minutes_played', total / 60,
    'achievements', unlocked,
    'friends', friend_count,
    'games', games);
end; $$;

-- ---------- Grants ----------
revoke all on function public.unlock_achievement(text, text) from public, anon;
revoke all on function public.save_info(text) from public, anon;
revoke all on function public.save_commit(text, text, bigint, text) from public, anon;
revoke all on function public.game_achievements(text) from public;
grant execute on function public.unlock_achievement(text, text) to authenticated;
grant execute on function public.save_info(text) to authenticated;
grant execute on function public.save_commit(text, text, bigint, text) to authenticated;
grant execute on function public.game_achievements(text) to anon, authenticated;

-- Writes only through the functions above (and admins on achievements).
revoke insert, update, delete, truncate, references, trigger
  on public.user_achievements, public.cloud_saves from anon, authenticated;
revoke truncate, references, trigger on public.achievements from anon, authenticated;
revoke insert, update, delete on public.achievements from anon;
revoke select on public.user_achievements, public.cloud_saves, public.achievements from anon;
-- Signed-in players read through row-level security (their own rows; the
-- achievements table only for admins, who also manage it).
grant select on public.user_achievements, public.cloud_saves to authenticated;
grant select, insert, update, delete on public.achievements to authenticated;

select 'done' as result;
