-- Personalizacja kont: jednoznaczna kolumna display_name i profil dla każdego auth usera.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'display_name'
  ) then
    alter table public.user_profiles rename column name to display_name;
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'name'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'display_name'
  ) then
    update public.user_profiles
    set display_name = coalesce(display_name, name);
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_profiles'
      and column_name = 'display_name'
  ) then
    alter table public.user_profiles add column display_name text;
  end if;
end $$;

alter table public.user_profiles
  alter column preferences set default '{}'::jsonb;

update public.user_profiles
set preferences = '{}'::jsonb
where preferences is null;

alter table public.user_profiles
  alter column preferences set not null;

insert into public.user_profiles (id, display_name, preferences)
select id, null, '{}'::jsonb
from auth.users
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (id, display_name, preferences)
  values (new.id, null, '{}'::jsonb)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
