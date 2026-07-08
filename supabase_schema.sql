-- Gutly sync schema
-- Run once: Supabase dashboard → SQL Editor → New query → paste all of this → Run.
--
-- One table holds every synced record (log entries + custom foods). Each record
-- is stored as `data` jsonb (the exact local shape) plus the columns sync needs:
-- who owns it, when it changed, and whether it was deleted. Scoped per user by
-- Row-Level Security, so a user can only ever read or write their own rows.

create table if not exists public.records (
  owner_id   uuid        not null references auth.users(id) on delete cascade,
  id         text        not null,            -- the local record id (e.g. m123..., cf_...)
  kind       text        not null,            -- 'log' | 'customFood'
  data       jsonb       not null,            -- the full local record
  updated_at timestamptz not null default now(),
  deleted    boolean     not null default false,
  primary key (owner_id, id)
);

-- Row-Level Security: each user only sees and changes their own rows.
alter table public.records enable row level security;

drop policy if exists "records are private to owner" on public.records;
create policy "records are private to owner"
  on public.records
  for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Speeds up the app's "fetch my rows" query.
create index if not exists records_owner_idx on public.records (owner_id);
