-- MEYANAK DATABASE + RLS
-- Jalankan di Supabase SQL Editor setelah membuat project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  bio text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  visibility text not null default 'public' check (visibility in ('public','private')),
  media_url text,
  media_path text,
  media_type text check (media_type in ('image','video') or media_type is null),
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) <= 5000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists posts_created_idx on public.posts(created_at desc);
create index if not exists posts_author_idx on public.posts(author_id);
create index if not exists comments_post_idx on public.comments(post_id,created_at);
create index if not exists messages_pair_idx on public.messages(sender_id,receiver_id,created_at);

-- Profile otomatis dibuat setelah register.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_name text;
begin
  base_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1), 'Pengguna');
  insert into public.profiles(id,display_name,username)
  values(new.id,base_name,
    regexp_replace(lower(left(base_name,18)),'[^a-z0-9]','','g') || '_' || left(new.id::text,6))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.saves enable row level security;
alter table public.messages enable row level security;

-- Profiles dapat ditemukan agar jejaring sosial berfungsi.
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Publik dapat dibaca semua user login. Private hanya pemilik.
create policy "posts readable" on public.posts for select to authenticated
using (visibility='public' or author_id=auth.uid());
create policy "own posts insert" on public.posts for insert to authenticated
with check (author_id=auth.uid());
create policy "own posts update" on public.posts for update to authenticated
using (author_id=auth.uid()) with check (author_id=auth.uid());
create policy "own posts delete" on public.posts for delete to authenticated
using (author_id=auth.uid());

create policy "likes readable" on public.likes for select to authenticated using (true);
create policy "like own" on public.likes for insert to authenticated with check (user_id=auth.uid());
create policy "unlike own" on public.likes for delete to authenticated using (user_id=auth.uid());

-- Komentar pada posting publik atau milik sendiri.
create policy "comments readable" on public.comments for select to authenticated
using (exists(select 1 from public.posts p where p.id=post_id and (p.visibility='public' or p.author_id=auth.uid())));
create policy "comments own insert" on public.comments for insert to authenticated
with check (user_id=auth.uid() and exists(select 1 from public.posts p where p.id=post_id and p.visibility='public'));
create policy "comments own delete" on public.comments for delete to authenticated using (user_id=auth.uid());

create policy "saves own read" on public.saves for select to authenticated using (user_id=auth.uid());
create policy "saves own insert" on public.saves for insert to authenticated with check (user_id=auth.uid());
create policy "saves own delete" on public.saves for delete to authenticated using (user_id=auth.uid());

create policy "messages participant read" on public.messages for select to authenticated
using (sender_id=auth.uid() or receiver_id=auth.uid());
create policy "messages sender insert" on public.messages for insert to authenticated
with check (sender_id=auth.uid());
create policy "messages receiver update" on public.messages for update to authenticated
using (receiver_id=auth.uid()) with check (receiver_id=auth.uid());

-- Storage bucket media harus dibuat sebagai PUBLIC untuk URL media sederhana.
insert into storage.buckets(id,name,public,file_size_limit)
values('media','media',true,52428800)
on conflict(id) do update set public=true,file_size_limit=52428800;

create policy "media authenticated upload" on storage.objects for insert to authenticated
with check (bucket_id='media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "media public read" on storage.objects for select
using (bucket_id='media');
create policy "media own delete" on storage.objects for delete to authenticated
using (bucket_id='media' and owner_id=auth.uid()::text);

-- Opsional realtime untuk chat/feed. Aktifkan tabel berikut pada Database > Replication
-- sesuai kebutuhan: posts, comments, messages, likes.
