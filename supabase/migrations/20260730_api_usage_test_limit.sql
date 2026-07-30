-- Tymczasowy limit testowy: 100 tokenów na użytkownika dziennie.
-- Osobna migracja aktualizuje projekty, które wykonały już migrację api_usage.
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
  daily_limit constant integer := 100;
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
