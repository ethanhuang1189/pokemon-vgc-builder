-- Extra per-battle details for stats: ladder rating, leads and moves used.
-- Run once in the Supabase SQL editor after 0003. Existing battles are re-read from Showdown
-- by the next syncs (parse_version tracks which parser version wrote each row).

alter table public.battles
  add column rating_before  integer,
  add column rating_after   integer,
  add column leads          text[]  not null default '{}',
  add column opponent_leads text[]  not null default '{}',
  add column moves          jsonb   not null default '{}'::jsonb,
  add column parse_version  integer not null default 1;

-- Finds rows written by an older parser quickly.
create index battles_user_parse_version on public.battles (user_id, parse_version);

-- Browsers still may only change team_id (granted in 0003); these columns are server-written.
