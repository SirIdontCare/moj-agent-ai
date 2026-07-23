-- Prywatne raporty wygenerowane przez agenta.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  title text not null,
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  word_count integer not null default 0 check (word_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reports_user_created_idx
  on public.reports (user_id, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "Users manage their reports" on public.reports;
create policy "Users manage their reports"
  on public.reports
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.reports from anon;
grant select, insert, update, delete on table public.reports to authenticated;
