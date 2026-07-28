-- Automatyczne poranne briefingi generowane przez endpoint cron.

create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  content text not null,
  date date not null unique,
  user_id uuid references auth.users(id) on delete cascade
);

create index if not exists briefings_created_at_idx
  on public.briefings (created_at desc);

alter table public.briefings enable row level security;

-- Endpoint używa klucza service_role. Dane nie są dostępne przez publiczny anon key.
revoke all on table public.briefings from anon, authenticated;
grant select, insert, update on table public.briefings to service_role;
