-- ============================================================
-- FI website – Supabase database setup
-- Run this once in Supabase: SQL Editor → New query → paste → Run.
-- It is safe to run again.
-- ============================================================

-- ---------- Each user's saved numbers ----------
create table if not exists public.user_data (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  tracker     jsonb not null default '{}'::jsonb,   -- net worth history, milestone labels, costs
  calculators jsonb not null default '{}'::jsonb,   -- last values typed into the calculators
  currency    text  not null default 'USD',
  updated_at  timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "Users read own data"   on public.user_data;
drop policy if exists "Users insert own data" on public.user_data;
drop policy if exists "Users update own data" on public.user_data;
drop policy if exists "Users delete own data" on public.user_data;

create policy "Users read own data"   on public.user_data for select using (auth.uid() = user_id);
create policy "Users insert own data" on public.user_data for insert with check (auth.uid() = user_id);
create policy "Users update own data" on public.user_data for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own data" on public.user_data for delete using (auth.uid() = user_id);

-- ---------- Admins (who may write blog posts) ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
-- No policies: nobody can read or change this table from the website.
-- Add yourself as admin from the SQL editor (see the bottom of this file).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Blog posts ----------
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  excerpt     text not null default '',
  content     text not null default '',            -- Markdown
  cover_url   text,
  published   boolean not null default false,
  author_id   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists posts_published_created_idx on public.posts (published, created_at desc);

alter table public.posts enable row level security;

drop policy if exists "Anyone reads published posts" on public.posts;
drop policy if exists "Admins read all posts"        on public.posts;
drop policy if exists "Admins insert posts"          on public.posts;
drop policy if exists "Admins update posts"          on public.posts;
drop policy if exists "Admins delete posts"          on public.posts;

create policy "Anyone reads published posts" on public.posts for select using (published);
create policy "Admins read all posts"        on public.posts for select using (public.is_admin());
create policy "Admins insert posts"          on public.posts for insert with check (public.is_admin());
create policy "Admins update posts"          on public.posts for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete posts"          on public.posts for delete using (public.is_admin());

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

drop trigger if exists user_data_touch on public.user_data;
create trigger user_data_touch before update on public.user_data
  for each row execute function public.touch_updated_at();

-- ---------- Image storage for blog posts ----------
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;

drop policy if exists "Anyone views blog images"   on storage.objects;
drop policy if exists "Admins upload blog images"  on storage.objects;
drop policy if exists "Admins update blog images"  on storage.objects;
drop policy if exists "Admins delete blog images"  on storage.objects;

create policy "Anyone views blog images"  on storage.objects for select using (bucket_id = 'blog-images');
create policy "Admins upload blog images" on storage.objects for insert with check (bucket_id = 'blog-images' and public.is_admin());
create policy "Admins update blog images" on storage.objects for update using (bucket_id = 'blog-images' and public.is_admin());
create policy "Admins delete blog images" on storage.objects for delete using (bucket_id = 'blog-images' and public.is_admin());

-- ============================================================
-- Make yourself admin (run AFTER you have signed up on the site):
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'YOUR_EMAIL_HERE'
--   on conflict do nothing;
-- ============================================================
