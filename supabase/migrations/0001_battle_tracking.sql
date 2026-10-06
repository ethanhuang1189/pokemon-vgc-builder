-- Battle tracking schema. Run once in the Supabase SQL editor (or `supabase db push`).
--
-- Security model:
--   * Every table has row-level security: a signed-in user only ever sees their own rows.
--   * Users manage their own Showdown names directly from the browser.
--   * Battles have NO insert/update policy, so browsers can't write them. Only the server
--     (secret key) inserts battles, after fetching the replay from Showdown itself.
--   * Passwords live in Supabase Auth (auth.users, bcrypt-hashed); nothing here stores them.

-- ── Linked Showdown usernames ───────────────────────────────────────────────
create table public.showdown_names (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  name       text        not null check (char_length(name) between 1 and 18),
  name_id    text        not null check (name_id ~ '^[a-z0-9]{1,18}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, name_id)
);

alter table public.showdown_names enable row level security;

create policy "Users read their own Showdown names" on public.showdown_names
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users add their own Showdown names" on public.showdown_names
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users remove their own Showdown names" on public.showdown_names
  for delete to authenticated using (user_id = (select auth.uid()));

-- Each linked name costs a Showdown search per sync, so cap how many one account can add.
create function public.limit_showdown_names() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.showdown_names where user_id = new.user_id) >= 10 then
    raise exception 'You can link up to 10 Showdown names';
  end if;
  return new;
end $$;

create trigger limit_showdown_names before insert on public.showdown_names
  for each row execute function public.limit_showdown_names();

-- ── Imported battles ────────────────────────────────────────────────────────
create table public.battles (
  id               bigint generated always as identity primary key,
  user_id          uuid        not null references auth.users (id) on delete cascade,
  replay_id        text        not null check (char_length(replay_id) <= 100),
  format           text        not null,
  format_id        text        not null,
  played_at        timestamptz not null,
  rating           integer,
  result           text        not null check (result in ('win', 'loss', 'tie')),
  player_name      text        not null,
  opponent_name    text        not null,
  team             text[]      not null,
  brought          text[]      not null,
  mega             text,
  opponent_team    text[]      not null,
  opponent_brought text[]      not null,
  opponent_mega    text,
  turns            integer     not null,
  imported_at      timestamptz not null default now(),
  unique (user_id, replay_id)
);

create index battles_user_played_at on public.battles (user_id, played_at desc);

alter table public.battles enable row level security;

create policy "Users read their own battles" on public.battles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users delete their own battles" on public.battles
  for delete to authenticated using (user_id = (select auth.uid()));
