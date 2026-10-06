-- Replays sync couldn't import (unfinished, not the user's, removed from Showdown), so it
-- doesn't fetch them again on every sync. Run once in the Supabase SQL editor after 0001.

create table public.skipped_replays (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  replay_id  text        not null check (char_length(replay_id) <= 100),
  reason     text        not null check (char_length(reason) <= 200),
  skipped_at timestamptz not null default now(),
  primary key (user_id, replay_id)
);

-- Row-level security with no policies: browsers can't read or write this table at all;
-- only the server (secret key) uses it.
alter table public.skipped_replays enable row level security;
