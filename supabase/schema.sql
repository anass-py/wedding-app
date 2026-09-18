-- ============================================================================
-- Wedding photo wall — Supabase schema
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.guests (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid not null unique references auth.users(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  avatar_path text,
  created_at  timestamptz not null default now()
);

create table if not exists public.photos (
  id          uuid primary key default gen_random_uuid(),
  guest_id    uuid not null references public.guests(id) on delete cascade,
  path        text not null,
  thumb_path  text not null,
  width       int,
  height      int,
  caption     text check (caption is null or char_length(caption) <= 200),
  created_at  timestamptz not null default now()
);
create index if not exists photos_created_at_idx on public.photos (created_at desc);

-- v2.1: optional social links shown on the guest card ({ "instagram": "…", "x": "…", "tiktok": "…", "website": "…" })
alter table public.guests add column if not exists socials jsonb not null default '{}'::jsonb;

-- v1.2: videos. (alter … if not exists so re-running on an older database upgrades it)
alter table public.photos add column if not exists kind text not null default 'photo' check (kind in ('photo', 'video'));
alter table public.photos add column if not exists duration real;

create table if not exists public.hearts (
  photo_id    uuid not null references public.photos(id) on delete cascade,
  guest_id    uuid not null references public.guests(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (photo_id, guest_id)
);

-- Written only by scripts/rank.ts (service role). Guests can read.
create table if not exists public.photo_scores (
  photo_id    uuid primary key references public.photos(id) on delete cascade,
  score       numeric(4,2) not null check (score between 0 and 10),
  theme       text not null,
  tags        text[] not null default '{}',
  reason      text,
  model       text,
  scored_at   timestamptz not null default now()
);

-- ── Helper ──────────────────────────────────────────────────────────────────
create or replace function public.current_guest_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.guests where auth_id = auth.uid()
$$;

-- ── Row-level security ──────────────────────────────────────────────────────
alter table public.guests       enable row level security;
alter table public.photos       enable row level security;
alter table public.hearts       enable row level security;
alter table public.photo_scores enable row level security;

drop policy if exists "guests: read all"        on public.guests;
drop policy if exists "guests: insert self"     on public.guests;
drop policy if exists "guests: update self"     on public.guests;
drop policy if exists "photos: read all"        on public.photos;
drop policy if exists "photos: insert own"      on public.photos;
drop policy if exists "photos: delete own"      on public.photos;
drop policy if exists "hearts: read all"        on public.hearts;
drop policy if exists "hearts: insert own"      on public.hearts;
drop policy if exists "hearts: delete own"      on public.hearts;
drop policy if exists "scores: read all"        on public.photo_scores;

create policy "guests: read all"    on public.guests for select to authenticated using (true);
create policy "guests: insert self" on public.guests for insert to authenticated with check (auth_id = auth.uid());
create policy "guests: update self" on public.guests for update to authenticated using (auth_id = auth.uid());

create policy "photos: read all"    on public.photos for select to authenticated using (true);
create policy "photos: insert own"  on public.photos for insert to authenticated with check (guest_id = public.current_guest_id());
create policy "photos: delete own"  on public.photos for delete to authenticated using (guest_id = public.current_guest_id());

create policy "hearts: read all"    on public.hearts for select to authenticated using (true);
create policy "hearts: insert own"  on public.hearts for insert to authenticated with check (guest_id = public.current_guest_id());
create policy "hearts: delete own"  on public.hearts for delete to authenticated using (guest_id = public.current_guest_id());

create policy "scores: read all"    on public.photo_scores for select to authenticated using (true);
-- (no insert/update policy on photo_scores → only the service role can write)

-- ── Realtime ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'photos') then
    alter publication supabase_realtime add table public.photos;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'hearts') then
    alter publication supabase_realtime add table public.hearts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'photo_scores') then
    alter publication supabase_realtime add table public.photo_scores;
  end if;
end $$;

-- ── Storage ─────────────────────────────────────────────────────────────────
-- Public bucket: photos are served by unguessable UUID URLs (no listing).
-- 50 MB is the per-file cap on Supabase's free tier; raise it on Pro if you want longer videos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 52428800,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "photos bucket: read"          on storage.objects;
drop policy if exists "photos bucket: upload own"    on storage.objects;
drop policy if exists "photos bucket: delete own"    on storage.objects;

create policy "photos bucket: read" on storage.objects
  for select to public using (bucket_id = 'photos');
-- Each guest may only write inside a folder named after their auth uid.
create policy "photos bucket: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos bucket: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
