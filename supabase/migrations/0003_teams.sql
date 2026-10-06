-- Saved teams and the "current team". Run once in the Supabase SQL editor after 0002.
--
-- A team owns the games played from each time it was made current until the next team was.
-- That's worked out from dates in the app, so switching teams never rewrites stored battles.
-- battles.team_id is only a manual override ("this game belongs to that team").

create table public.teams (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  name       text        not null check (char_length(name) between 1 and 60),
  species    text[]      not null check (cardinality(species) between 1 and 6),
  paste      text        not null default '' check (char_length(paste) <= 10000),
  created_at timestamptz not null default now()
);

-- Each row: a team became current at started_at. The newest row is the current team.
create table public.team_periods (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  team_id    bigint      not null references public.teams (id) on delete cascade,
  started_at timestamptz not null default now()
);

create index team_periods_user_started on public.team_periods (user_id, started_at desc);

alter table public.battles add column team_id bigint references public.teams (id) on delete set null;

-- ── Row-level security ──────────────────────────────────────────────────────
alter table public.teams enable row level security;
alter table public.team_periods enable row level security;

create policy "Users read their own teams" on public.teams
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users add their own teams" on public.teams
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users edit their own teams" on public.teams
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users remove their own teams" on public.teams
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "Users read their own team history" on public.team_periods
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users switch to their own teams" on public.team_periods
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.teams t where t.id = team_id and t.user_id = (select auth.uid()))
  );

-- Moving a battle: only its team_id may change, and only to one of the user's own teams.
create policy "Users move their own battles between their teams" on public.battles
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and (team_id is null or exists (select 1 from public.teams t where t.id = team_id and t.user_id = (select auth.uid())))
  );

-- ── Column privileges ───────────────────────────────────────────────────────
-- Row-level security picks the rows; these pick the columns. Browsers may rename/edit a
-- team's contents, start a period (always stamped with the server's time), and change only
-- a battle's team — never its result, players or Pokémon.
revoke insert, update on public.teams from anon, authenticated;
grant insert (name, species, paste), update (name, species, paste) on public.teams to authenticated;

revoke insert, update on public.team_periods from anon, authenticated;
grant insert (team_id) on public.team_periods to authenticated;

revoke insert, update on public.battles from anon, authenticated;
grant update (team_id) on public.battles to authenticated;
