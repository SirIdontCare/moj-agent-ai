-- Atomowy, kroczący limit 50 wiadomości na użytkownika w ciągu 60 minut.
create table if not exists public.chat_rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists chat_rate_limit_events_user_created_idx
  on public.chat_rate_limit_events (user_id, created_at);

alter table public.chat_rate_limit_events enable row level security;

-- Tabela nie jest dostępna bezpośrednio z klienta. Zapis odbywa się wyłącznie
-- przez funkcję, która używa auth.uid() i blokady transakcyjnej per użytkownik.
revoke all on table public.chat_rate_limit_events from public, anon, authenticated;

create or replace function public.consume_chat_rate_limit()
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_time timestamptz := clock_timestamp();
  used_count integer;
  oldest_event timestamptz;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Zapobiega przekroczeniu limitu przez równoległe żądania tego samego usera.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 0)
  );

  delete from public.chat_rate_limit_events
  where user_id = current_user_id
    and created_at <= request_time - interval '1 hour';

  select count(*)::integer, min(created_at)
    into used_count, oldest_event
  from public.chat_rate_limit_events
  where user_id = current_user_id
    and created_at > request_time - interval '1 hour';

  if used_count >= 50 then
    return query
      select false, 0, coalesce(oldest_event + interval '1 hour', request_time + interval '1 hour');
    return;
  end if;

  insert into public.chat_rate_limit_events (user_id, created_at)
  values (current_user_id, request_time);

  oldest_event := coalesce(oldest_event, request_time);

  return query
    select true, 50 - used_count - 1, oldest_event + interval '1 hour';
end;
$$;

revoke all on function public.consume_chat_rate_limit() from public, anon;
grant execute on function public.consume_chat_rate_limit() to authenticated;
