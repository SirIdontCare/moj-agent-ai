-- Kompletny schemat aplikacji z Supabase Auth i izolacją danych per użytkownik.
-- Uruchom w Supabase Dashboard -> SQL Editor dla nowego projektu.

create extension if not exists vector;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  title text,
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text,
  content text
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text,
  preferences jsonb not null default '{}'::jsonb
);

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

insert into public.user_profiles (id, display_name, preferences)
select id, null, '{}'::jsonb
from auth.users
on conflict (id) do nothing;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  title text not null,
  content text not null,
  embedding vector(768) not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);
create index if not exists documents_user_created_idx
  on public.documents (user_id, created_at desc);
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
create index if not exists messages_user_created_idx
  on public.messages (user_id, created_at);
create index if not exists reports_user_created_idx
  on public.reports (user_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_profiles enable row level security;
alter table public.documents enable row level security;
alter table public.reports enable row level security;

drop policy if exists "Users manage their conversations" on public.conversations;
create policy "Users manage their conversations"
  on public.conversations
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage messages in their conversations" on public.messages;
create policy "Users manage messages in their conversations"
  on public.messages
  for all
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users manage their profile" on public.user_profiles;
create policy "Users manage their profile"
  on public.user_profiles
  for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users manage their documents" on public.documents;
create policy "Users manage their documents"
  on public.documents
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their reports" on public.reports;
create policy "Users manage their reports"
  on public.reports
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.reports from anon;
grant select, insert, update, delete on table public.reports to authenticated;

create or replace function public.match_documents(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  select
    documents.id,
    documents.title,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from public.documents
  where documents.user_id = (select auth.uid())
    and 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

grant execute on function public.match_documents(vector, float, int) to authenticated;
