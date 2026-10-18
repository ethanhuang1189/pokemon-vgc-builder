-- Fixes ladder_teams.team, which 0005 left null: indexing array_agg() of arrays gives a 2-D
-- array, and [1] of that is null. Run once in the Supabase SQL editor after 0005; the team
-- now comes through in the newest game's team-preview order.

drop materialized view public.ladder_teams;

create materialized view public.ladder_teams as
  select
    format_id,
    team_key,
    string_to_array((array_agg(array_to_string(team, '|') order by played_at desc))[1], '|') as team,
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

revoke all on public.ladder_teams from anon, authenticated;
grant select on public.ladder_teams to anon, authenticated;
