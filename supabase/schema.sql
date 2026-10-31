-- GPBL shared results: schema + Row Level Security. Idempotent: safe to run more than once in the Supabase SQL editor.
-- Design: every table has RLS on. Public can READ non-private tables. NOBODY (anon or signed-in) can write tables directly;
-- all writes go through SECURITY DEFINER functions below that check who the caller is. No secrets in this file.


-- ---------- tables ----------
create table if not exists public.leagues (
  id text primary key, name text not null, short text not null,
  cut int not null default 14, byes int not null default 0, relegate int not null default 0, sort int not null default 0);

create table if not exists public.seasons (id text primary key, label text not null, starts_at timestamptz not null, is_current boolean not null default false);

create table if not exists public.weeks (
  season_id text not null references public.seasons(id) on delete cascade, week int not null,
  start_at timestamptz not null, send_by timestamptz not null, finish_by timestamptz not null,
  primary key (season_id, week));

create table if not exists public.players (
  id text primary key, league_id text not null references public.leagues(id),
  name text not null, is_sample boolean not null default false,
  user_id uuid unique references auth.users(id) on delete set null);   -- private: hidden by column grants

create table if not exists public.player_private (           -- private contact details: exec-only
  player_id text primary key references public.players(id) on delete cascade, email text);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'player' check (role in ('player','exec')), created_at timestamptz not null default now());

create table if not exists public.matches (
  id text primary key, season_id text not null references public.seasons(id) on delete cascade,
  league_id text not null references public.leagues(id), round int not null, week int not null,
  home text not null references public.players(id), away text not null references public.players(id),
  send_by timestamptz not null, finish_by timestamptz not null,
  status text not null default 'open' check (status in ('open','pending','confirmed','disputed','resolved')),
  check (home <> away));

create table if not exists public.results (
  match_id text primary key references public.matches(id) on delete cascade,
  winner text not null,                 -- a player id or 'draw'
  game text not null check (length(game) between 1 and 40),
  status text not null check (status in ('pending','confirmed','disputed','resolved')),
  reported_by text references public.players(id),     -- player ids (public), not auth ids
  confirmed_by text references public.players(id),
  disputed_by text references public.players(id),
  resolved_by uuid references auth.users(id),          -- hidden by column grants
  updated_at timestamptz not null default now());

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade, email text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(), decided_by uuid references auth.users(id));
create unique index if not exists claims_one_pending_per_user on public.claims(user_id) where status = 'pending';

-- ---------- helpers ----------
create or replace function public.is_exec() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where user_id = auth.uid() and role = 'exec') $$;

create or replace function public.my_player() returns text language sql stable security definer set search_path = public as
$$ select id from players where user_id = auth.uid() limit 1 $$;

-- profile row for every new auth user (role always 'player'; execs are promoted by SQL only)
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as
$$ begin insert into profiles(user_id) values (new.id) on conflict do nothing; return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
insert into public.profiles(user_id) select id from auth.users on conflict do nothing;

-- ---------- RLS + grants ----------
alter table public.leagues enable row level security;
alter table public.seasons enable row level security;
alter table public.weeks enable row level security;
alter table public.players enable row level security;
alter table public.player_private enable row level security;
alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.results enable row level security;
alter table public.claims enable row level security;

revoke all on public.leagues, public.seasons, public.weeks, public.players, public.player_private,
  public.profiles, public.matches, public.results, public.claims from anon, authenticated;
grant select on public.leagues, public.seasons, public.weeks, public.matches to anon, authenticated;
grant select (id, league_id, name, is_sample) on public.players to anon, authenticated;
grant select (match_id, winner, game, status, reported_by, confirmed_by, disputed_by, updated_at) on public.results to anon, authenticated;
grant select on public.profiles, public.claims, public.player_private to authenticated;

drop policy if exists read_all on public.leagues;  create policy read_all on public.leagues  for select using (true);
drop policy if exists read_all on public.seasons;  create policy read_all on public.seasons  for select using (true);
drop policy if exists read_all on public.weeks;    create policy read_all on public.weeks    for select using (true);
drop policy if exists read_all on public.players;  create policy read_all on public.players  for select using (true);
drop policy if exists read_all on public.matches;  create policy read_all on public.matches  for select using (true);
drop policy if exists read_all on public.results;  create policy read_all on public.results  for select using (true);
drop policy if exists exec_read on public.player_private; create policy exec_read on public.player_private for select to authenticated using (public.is_exec());
drop policy if exists own_or_exec on public.profiles; create policy own_or_exec on public.profiles for select to authenticated using (user_id = auth.uid() or public.is_exec());
drop policy if exists own_or_exec on public.claims;   create policy own_or_exec on public.claims   for select to authenticated using (user_id = auth.uid() or public.is_exec());
-- No insert/update/delete policies anywhere: direct writes are denied. Writes happen only in the functions below.

-- ---------- write API (RPC) ----------
create or replace function public.whoami() returns json language sql stable security definer set search_path = public as
$$ select json_build_object('user_id', auth.uid(), 'role', coalesce((select role from profiles where user_id = auth.uid()), 'anon'),
   'player_id', my_player(), 'claim', (select json_build_object('player_id', player_id, 'status', status) from claims where user_id = auth.uid() order by created_at desc limit 1)) $$;

create or replace function public.report_result(p_match text, p_winner text, p_game text) returns void
language plpgsql security definer set search_path = public as $$
declare m matches; me text := my_player(); r results;
begin
  if auth.uid() is null or me is null then raise exception 'Sign in and claim your player first'; end if;
  select * into m from matches where id = p_match; if not found then raise exception 'No such match'; end if;
  if me not in (m.home, m.away) then raise exception 'Not your match'; end if;
  if p_winner not in (m.home, m.away, 'draw') then raise exception 'Winner must be a player in this match or draw'; end if;
  if p_game is null or length(trim(p_game)) = 0 or length(p_game) > 40 then raise exception 'Bad game'; end if;
  select * into r from results where match_id = p_match;
  if found and not (r.status = 'pending' and r.reported_by = me) then raise exception 'Result already reported (status %)', r.status; end if;
  insert into results(match_id, winner, game, status, reported_by, updated_at) values (p_match, p_winner, trim(p_game), 'pending', me, now())
    on conflict (match_id) do update set winner = excluded.winner, game = excluded.game, updated_at = now();
  update matches set status = 'pending' where id = p_match;
end $$;

create or replace function public.respond_result(p_match text, p_confirm boolean) returns void
language plpgsql security definer set search_path = public as $$
declare m matches; me text := my_player(); r results;
begin
  if auth.uid() is null or me is null then raise exception 'Sign in and claim your player first'; end if;
  select * into m from matches where id = p_match; select * into r from results where match_id = p_match;
  if r.match_id is null or r.status <> 'pending' then raise exception 'Nothing pending to confirm'; end if;
  if me not in (m.home, m.away) or me = r.reported_by then raise exception 'Only the opponent can confirm or dispute'; end if;
  if p_confirm then update results set status = 'confirmed', confirmed_by = me, updated_at = now() where match_id = p_match;
  else update results set status = 'disputed', disputed_by = me, updated_at = now() where match_id = p_match; end if;
  update matches set status = case when p_confirm then 'confirmed' else 'disputed' end where id = p_match;
end $$;

create or replace function public.exec_set_result(p_match text, p_winner text, p_game text) returns void
language plpgsql security definer set search_path = public as $$
declare m matches;
begin
  if not is_exec() then raise exception 'Executives only'; end if;
  select * into m from matches where id = p_match; if not found then raise exception 'No such match'; end if;
  if p_winner is null then delete from results where match_id = p_match; update matches set status = 'open' where id = p_match; return; end if;
  if p_winner not in (m.home, m.away, 'draw') then raise exception 'Winner must be a player in this match or draw'; end if;
  insert into results(match_id, winner, game, status, resolved_by, updated_at) values (p_match, p_winner, coalesce(nullif(trim(p_game), ''), 'Unspecified'), 'resolved', auth.uid(), now())
    on conflict (match_id) do update set winner = excluded.winner, game = excluded.game, status = 'resolved', resolved_by = auth.uid(), updated_at = now();
  update matches set status = 'resolved' where id = p_match;
end $$;

create or replace function public.request_claim(p_player text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if my_player() is not null then raise exception 'You already have a player'; end if;
  if not exists (select 1 from players where id = p_player and user_id is null) then raise exception 'Player not found or already claimed'; end if;
  delete from claims where user_id = auth.uid() and status = 'pending';
  insert into claims(user_id, player_id, email) values (auth.uid(), p_player, (select email from auth.users where id = auth.uid()));
end $$;

create or replace function public.exec_decide_claim(p_claim uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c claims;
begin
  if not is_exec() then raise exception 'Executives only'; end if;
  select * into c from claims where id = p_claim and status = 'pending'; if not found then raise exception 'No pending claim'; end if;
  if p_approve then
    if exists (select 1 from players where id = c.player_id and user_id is not null) then raise exception 'Player already claimed'; end if;
    update players set user_id = null where user_id = c.user_id;
    update players set user_id = c.user_id where id = c.player_id;
    insert into player_private(player_id, email) values (c.player_id, c.email) on conflict (player_id) do update set email = excluded.email;
    update claims set status = 'rejected', decided_by = auth.uid() where player_id = c.player_id and status = 'pending' and id <> c.id;
  end if;
  update claims set status = case when p_approve then 'approved' else 'rejected' end, decided_by = auth.uid() where id = c.id;
end $$;

-- exec-only view of pending claims with player names (function so RLS on claims + exec check both apply)
create or replace function public.exec_pending_claims() returns table(id uuid, player_id text, player_name text, email text, created_at timestamptz)
language sql stable security definer set search_path = public as
$$ select c.id, c.player_id, p.name, c.email, c.created_at from claims c join players p on p.id = c.player_id
   where c.status = 'pending' and is_exec() order by c.created_at $$;

revoke all on function public.report_result(text,text,text), public.respond_result(text,boolean), public.exec_set_result(text,text,text),
  public.request_claim(text), public.exec_decide_claim(uuid,boolean), public.exec_pending_claims(), public.whoami(),
  public.is_exec(), public.my_player(), public.handle_new_user() from public, anon;
grant execute on function public.report_result(text,text,text), public.respond_result(text,boolean), public.exec_set_result(text,text,text),
  public.request_claim(text), public.exec_decide_claim(uuid,boolean), public.exec_pending_claims(), public.whoami(),
  public.is_exec(), public.my_player() to authenticated;
