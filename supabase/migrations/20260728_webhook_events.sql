-- Zdarzenia przychodzące z systemów zewnętrznych (webhook) razem z analizą agenta.

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null check (type in ('feedback', 'alert', 'order')),
  data jsonb not null default '{}'::jsonb,
  analysis text not null
);

create index if not exists webhook_events_created_at_idx
  on public.webhook_events (created_at desc);

create index if not exists webhook_events_type_idx
  on public.webhook_events (type, created_at desc);

alter table public.webhook_events enable row level security;

-- Endpoint używa klucza service_role. Dane nie są dostępne przez publiczny anon key.
revoke all on table public.webhook_events from anon, authenticated;
grant select, insert on table public.webhook_events to service_role;
