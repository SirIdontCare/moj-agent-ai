-- Aktualizacja bazy z lekcji 05-06 do modelu prywatnych danych użytkownika.
-- Stare rekordy bez user_id są usuwane zgodnie z instrukcją warsztatu W3.

alter table public.conversations
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.documents
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.messages
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.messages messages
set user_id = conversations.user_id
from public.conversations conversations
where messages.conversation_id = conversations.id
  and messages.user_id is null;

delete from public.messages
where conversation_id in (
  select id from public.conversations where user_id is null
) or conversation_id is null
  or not exists (
    select 1 from public.conversations
    where conversations.id = messages.conversation_id
  );
delete from public.conversations where user_id is null;
delete from public.documents where user_id is null;
delete from public.user_profiles profile
where not exists (select 1 from auth.users users where users.id = profile.id);

alter table public.conversations alter column user_id set not null;
alter table public.documents alter column user_id set not null;
alter table public.messages alter column user_id set not null;
alter table public.user_profiles alter column id drop default;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_id_fkey'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint user_profiles_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_conversation_id_fkey'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_conversation_id_fkey
      foreign key (conversation_id) references public.conversations(id) on delete cascade;
  end if;
end $$;

alter table public.messages alter column conversation_id set not null;

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);
create index if not exists documents_user_created_idx
  on public.documents (user_id, created_at desc);
create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
create index if not exists messages_user_created_idx
  on public.messages (user_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_profiles enable row level security;
alter table public.documents enable row level security;

drop policy if exists "Users manage their conversations" on public.conversations;
create policy "Users manage their conversations"
  on public.conversations for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage messages in their conversations" on public.messages;
create policy "Users manage messages in their conversations"
  on public.messages for all to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = (select auth.uid())
    )
  )
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users manage their profile" on public.user_profiles;
create policy "Users manage their profile"
  on public.user_profiles for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users manage their documents" on public.documents;
create policy "Users manage their documents"
  on public.documents for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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
