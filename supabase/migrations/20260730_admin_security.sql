create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'prompt_injection',
      'system_message',
      'invalid_payload',
      'request_too_large',
      'rate_limit'
    )
  ),
  reason text not null,
  message_preview text not null default '',
  endpoint text not null default '/api/chat',
  created_at timestamptz not null default now()
);

create index if not exists security_events_created_idx
  on public.security_events (created_at desc);

create index if not exists security_events_user_created_idx
  on public.security_events (user_id, created_at desc);

alter table public.security_events enable row level security;

revoke all on table public.security_events from public, anon, authenticated;

create or replace function public.log_security_event(
  p_event_type text,
  p_reason text,
  p_message_preview text default '',
  p_endpoint text default '/api/chat'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_event_type not in (
    'prompt_injection',
    'system_message',
    'invalid_payload',
    'request_too_large',
    'rate_limit'
  ) then
    raise exception 'Unsupported security event type' using errcode = '22023';
  end if;

  insert into public.security_events (
    user_id,
    event_type,
    reason,
    message_preview,
    endpoint
  )
  values (
    current_user_id,
    p_event_type,
    pg_catalog.left(pg_catalog.coalesce(p_reason, ''), 500),
    pg_catalog.left(pg_catalog.coalesce(p_message_preview, ''), 500),
    pg_catalog.left(pg_catalog.coalesce(p_endpoint, '/api/chat'), 120)
  );
end;
$$;

revoke all on function public.log_security_event(text, text, text, text)
  from public, anon;
grant execute on function public.log_security_event(text, text, text, text)
  to authenticated;
