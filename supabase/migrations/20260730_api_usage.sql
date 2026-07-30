create table if not exists public.api_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  endpoint text not null default '/api/chat',
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null check (total_tokens >= 0),
  created_at timestamptz not null default now()
);

create index if not exists api_usage_user_created_idx
  on public.api_usage (user_id, created_at);

alter table public.api_usage enable row level security;

revoke all on table public.api_usage from public, anon, authenticated;

create or replace function public.get_daily_api_usage()
returns table (
  allowed boolean,
  used_tokens bigint,
  remaining_tokens bigint,
  limit_tokens integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_time timestamptz := clock_timestamp();
  local_day_start timestamp;
  day_start timestamptz;
  day_end timestamptz;
  daily_limit constant integer := 10000;
  tokens_used bigint;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  local_day_start := pg_catalog.date_trunc(
    'day',
    request_time at time zone 'Europe/Warsaw'
  );
  day_start := local_day_start at time zone 'Europe/Warsaw';
  day_end := (local_day_start + interval '1 day') at time zone 'Europe/Warsaw';

  select coalesce(sum(total_tokens), 0)::bigint
    into tokens_used
  from public.api_usage
  where user_id = current_user_id
    and created_at >= day_start
    and created_at < day_end;

  return query
    select
      tokens_used < daily_limit,
      tokens_used,
      pg_catalog.greatest(daily_limit::bigint - tokens_used, 0::bigint),
      daily_limit,
      day_end;
end;
$$;

revoke all on function public.get_daily_api_usage() from public, anon;
grant execute on function public.get_daily_api_usage() to authenticated;

create or replace function public.record_api_usage(
  p_model text,
  p_endpoint text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_total_tokens integer
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

  if p_total_tokens < 0
    or p_input_tokens < 0
    or p_output_tokens < 0 then
    raise exception 'Token counts cannot be negative' using errcode = '22023';
  end if;

  insert into public.api_usage (
    user_id,
    model,
    endpoint,
    input_tokens,
    output_tokens,
    total_tokens
  )
  values (
    current_user_id,
    pg_catalog.left(pg_catalog.coalesce(p_model, 'unknown'), 120),
    pg_catalog.left(pg_catalog.coalesce(p_endpoint, '/api/chat'), 120),
    p_input_tokens,
    p_output_tokens,
    p_total_tokens
  );
end;
$$;

revoke all on function public.record_api_usage(text, text, integer, integer, integer)
  from public, anon;
grant execute on function public.record_api_usage(text, text, integer, integer, integer)
  to authenticated;
