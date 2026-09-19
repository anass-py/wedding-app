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
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'photos') then
    alter publication supabase_realtime add table public.photos;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hearts') then
    alter publication supabase_realtime add table public.hearts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'photo_scores') then
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

-- ── v2.6: unique names + reconnect by name ──────────────────────────────────
-- Names are unique (case-insensitive). A guest on a new phone types their name on
-- "Déjà inscrit ?" and the profile is re-linked to that device — no code.
drop trigger if exists guests_secret on public.guests;
drop function if exists public.guest_secret_on_insert();
drop function if exists public.my_recovery_code();
drop function if exists public.claim_guest(text, text);
drop function if exists public.gen_recovery_code();
drop table if exists public.guest_secrets;

-- Rename duplicates that exist already (the first one keeps the name, later ones get " 2", " 3"…)
do $$
declare r record; n int; candidate text;
begin
  for r in
    select id, name from (
      select id, name, row_number() over (partition by lower(btrim(name)) order by created_at) as rn from public.guests
    ) d where rn > 1 order by name
  loop
    n := 2;
    loop
      candidate := btrim(r.name) || ' ' || n;
      exit when not exists (select 1 from public.guests where lower(btrim(name)) = lower(candidate));
      n := n + 1;
    end loop;
    update public.guests set name = candidate where id = r.id;
  end loop;
end $$;

create unique index if not exists guests_name_unique on public.guests (lower(btrim(name)));

create or replace function public.claim_guest(p_name text) returns setof public.guests
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.guests where auth_id = auth.uid()) then raise exception 'already registered'; end if;
  select id into gid from public.guests where lower(btrim(name)) = lower(btrim(p_name)) limit 1;
  if gid is null then raise exception 'no guest with this name'; end if;
  update public.guests set auth_id = auth.uid() where id = gid;
  return query select * from public.guests where id = gid;
end $$;
grant execute on function public.claim_guest(text) to authenticated;

-- ── v2.7: one profile, many devices ─────────────────────────────────────────
-- Each device (anonymous auth user) is linked to a guest through guest_devices, so a
-- phone and a laptop can both stay signed in as the same person.
create table if not exists public.guest_devices (
  auth_id    uuid primary key references auth.users(id) on delete cascade,
  guest_id   uuid not null references public.guests(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.guest_devices enable row level security;
drop policy if exists "devices: read own" on public.guest_devices;
create policy "devices: read own" on public.guest_devices for select to authenticated using (auth_id = auth.uid());

insert into public.guest_devices (auth_id, guest_id)
select g.auth_id, g.id from public.guests g
on conflict (auth_id) do nothing;

-- Who am I? (through the devices table)
create or replace function public.current_guest_id()
returns uuid language sql stable security definer set search_path = public as $$
  select guest_id from public.guest_devices where auth_id = auth.uid()
$$;

create or replace function public.my_guest() returns setof public.guests
language sql stable security definer set search_path = public as $$
  select g.* from public.guests g join public.guest_devices d on d.guest_id = g.id where d.auth_id = auth.uid()
$$;
grant execute on function public.my_guest() to authenticated;

-- The device that creates a profile is linked to it automatically.
create or replace function public.guest_device_on_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.guest_devices (auth_id, guest_id) values (new.auth_id, new.id)
  on conflict (auth_id) do update set guest_id = excluded.guest_id;
  return new;
end $$;
drop trigger if exists guests_device on public.guests;
create trigger guests_device after insert on public.guests for each row execute function public.guest_device_on_insert();

-- Guests can edit their profile from any linked device.
drop policy if exists "guests: update self" on public.guests;
create policy "guests: update self" on public.guests for update to authenticated using (id = public.current_guest_id());

-- Reconnect = add this device to the profile with that name (other devices stay linked).
create or replace function public.claim_guest(p_name text) returns setof public.guests
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.guest_devices where auth_id = auth.uid()) then raise exception 'already registered'; end if;
  select id into gid from public.guests where lower(btrim(name)) = lower(btrim(p_name)) limit 1;
  if gid is null then raise exception 'no guest with this name'; end if;
  insert into public.guest_devices (auth_id, guest_id) values (auth.uid(), gid);
  return query select * from public.guests where id = gid;
end $$;
grant execute on function public.claim_guest(text) to authenticated;

-- ── v2.8: livre d'or (messages to the couple) ────────────────────────────────
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  guest_id   uuid not null references public.guests(id) on delete cascade,
  text       text not null check (char_length(btrim(text)) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists messages_created_at_idx on public.messages (created_at desc);

create table if not exists public.message_hearts (
  message_id uuid not null references public.messages(id) on delete cascade,
  guest_id   uuid not null references public.guests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, guest_id)
);

alter table public.messages       enable row level security;
alter table public.message_hearts enable row level security;
drop policy if exists "messages: read all"   on public.messages;
drop policy if exists "messages: insert own" on public.messages;
drop policy if exists "messages: delete own" on public.messages;
drop policy if exists "mhearts: read all"    on public.message_hearts;
drop policy if exists "mhearts: insert own"  on public.message_hearts;
drop policy if exists "mhearts: delete own"  on public.message_hearts;
create policy "messages: read all"   on public.messages for select to authenticated using (true);
create policy "messages: insert own" on public.messages for insert to authenticated with check (guest_id = public.current_guest_id());
create policy "messages: delete own" on public.messages for delete to authenticated using (guest_id = public.current_guest_id());
create policy "mhearts: read all"    on public.message_hearts for select to authenticated using (true);
create policy "mhearts: insert own"  on public.message_hearts for insert to authenticated with check (guest_id = public.current_guest_id());
create policy "mhearts: delete own"  on public.message_hearts for delete to authenticated using (guest_id = public.current_guest_id());

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_hearts') then
    alter publication supabase_realtime add table public.message_hearts;
  end if;
end $$;

-- ── Migrations without copy/paste ───────────────────────────────────────────
-- Lets `npm run migrate` apply this file with the service-role key (never exposed to guests).
create or replace function public.exec_sql(sql text) returns void
language plpgsql security definer set search_path = public as $$
begin
  execute sql;
end $$;
revoke all on function public.exec_sql(text) from public, anon, authenticated;
grant execute on function public.exec_sql(text) to service_role;
