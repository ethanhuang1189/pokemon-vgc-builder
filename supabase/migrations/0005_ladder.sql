-- Top teams from public Pokémon Showdown ladder replays. Run once in the Supabase SQL editor
-- after 0004. The collector (/api/collect-ladder, using the secret key) writes ladder_entries
-- and refreshes the summaries; browsers read only the summaries and an anonymous detail view.

-- ── Raw rows: one per 1500+ player per replay ───────────────────────────────
create table public.ladder_entries (
  replay_id     text        not null check (char_length(replay_id) <= 100),
  side          text        not null check (side in ('p1', 'p2')),
  format_id     text        not null,
  played_at     timestamptz not null,
  player_id     text        not null,
  rating        integer     not null,
  result        text        not null check (result in ('win', 'loss', 'tie')),
  team          text[]      not null check (cardinality(team) = 6),
  team_key      text        not null,
  core_keys     text[]      not null,
  brought       text[]      not null default '{}',
  leads         text[]      not null default '{}',
  mega          text,
  moves         jsonb       not null default '{}'::jsonb,
  items         jsonb       not null default '{}'::jsonb,
  abilities     jsonb       not null default '{}'::jsonb,
  parse_version integer     not null,
  collected_at  timestamptz not null default now(),
  primary key (replay_id, side)
);

create index ladder_entries_team on public.ladder_entries (format_id, team_key);
create index ladder_entries_cores on public.ladder_entries using gin (core_keys);

-- Where the collector is in Showdown's replay search, per format (upload times in seconds).
--   newest      — everything uploaded up to here has been scanned
--   scan_top    — top of the scan in progress (it becomes `newest` when the scan finishes)
--   scan_cursor — the scan in progress continues below this; null when no scan is running
create table public.ladder_state (
  format_id   text        primary key,
  newest      bigint      not null default 0,
  scan_top    bigint,
  scan_cursor bigint,
  updated_at  timestamptz not null default now()
);

-- Row-level security with no policies: only the server (secret key) reads or writes these.
alter table public.ladder_entries enable row level security;
alter table public.ladder_state enable row level security;

-- ── Summaries for the Top Teams card ────────────────────────────────────────
-- `score` ranks by win rate pulled toward 50% by 20 games, so small samples don't top the list
-- (LADDER_PRIOR_GAMES in src/domain/ladder.js). Only groups with 3+ players and 10+ games are
-- kept (MIN_PLAYERS, MIN_GAMES there).
create materialized view public.ladder_teams as
  select
    format_id,
    team_key,
    (array_agg(team order by played_at desc))[1] as team,
    count(*)::int                                  as games,
    (count(*) filter (where result = 'win'))::int  as wins,
    (count(*) filter (where result = 'loss'))::int as losses,
    count(distinct player_id)::int                 as players,
    round(avg(rating))::int                        as avg_rating,
    max(played_at)                                 as last_played,
    ((count(*) filter (where result = 'win')) + 20 * 0.5) / (count(*) + 20)::float8 as score
  from public.ladder_entries
  group by format_id, team_key
  having count(distinct player_id) >= 3 and count(*) >= 10;

create unique index ladder_teams_key on public.ladder_teams (format_id, team_key);

create materialized view public.ladder_cores as
  select
    format_id,
    core_key,
    count(*)::int                                  as games,
    (count(*) filter (where result = 'win'))::int  as wins,
    (count(*) filter (where result = 'loss'))::int as losses,
    count(distinct player_id)::int                 as players,
    count(distinct team_key)::int                  as teams,
    round(avg(rating))::int                        as avg_rating,
    max(played_at)                                 as last_played,
    ((count(*) filter (where result = 'win')) + 20 * 0.5) / (count(*) + 20)::float8 as score
  from public.ladder_entries, unnest(core_keys) as core_key
  group by format_id, core_key
  having count(distinct player_id) >= 3 and count(*) >= 10;

create unique index ladder_cores_key on public.ladder_cores (format_id, core_key);

-- Totals for the card's "N games from M players, updated …" line.
create materialized view public.ladder_overview as
  select
    e.format_id,
    count(*)::int                  as entries,
    count(distinct e.replay_id)::int as replays,
    count(distinct e.player_id)::int as players,
    min(e.played_at)               as first_played,
    max(e.played_at)               as last_played,
    max(s.updated_at)              as updated_at
  from public.ladder_entries e
  left join public.ladder_state s on s.format_id = e.format_id
  group by e.format_id;

create unique index ladder_overview_format on public.ladder_overview (format_id);

-- One team's or core's games for its breakdown, without who played them. (A plain view runs
-- with its owner's rights, so it can read the RLS-protected table; it exposes only these columns.)
create view public.ladder_entries_public as
  select replay_id, format_id, played_at, rating, result, team, team_key, core_keys,
         brought, leads, mega, moves, items, abilities
  from public.ladder_entries;

-- ── Privileges ──────────────────────────────────────────────────────────────
-- Read-only for browsers. The detail view must not be writable through (simple views are
-- auto-updatable, and this one runs with its owner's rights).
revoke all on public.ladder_teams, public.ladder_cores, public.ladder_overview, public.ladder_entries_public
  from anon, authenticated;
grant select on public.ladder_teams, public.ladder_cores, public.ladder_overview, public.ladder_entries_public
  to anon, authenticated;

-- Called by the collector after each run.
create function public.refresh_ladder_stats() returns void
  language sql security definer set search_path = '' as $$
    refresh materialized view concurrently public.ladder_teams;
    refresh materialized view concurrently public.ladder_cores;
    refresh materialized view concurrently public.ladder_overview;
  $$;

revoke execute on function public.refresh_ladder_stats() from public, anon, authenticated;
grant execute on function public.refresh_ladder_stats() to service_role;
