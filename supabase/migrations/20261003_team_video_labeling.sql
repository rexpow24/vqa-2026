-- Apply in the Supabase SQL Editor before starting the hosted frontend.
-- Public signup must also be disabled in Authentication > Providers > Email.

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null check (length(trim(name)) > 0),
  role text not null check (role in ('admin', 'annotator')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique check (length(trim(drive_file_id)) > 0),
  filename text not null check (length(trim(filename)) > 0),
  duration_s numeric(12,3) not null check (duration_s > 0),
  available boolean not null default true,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.video_assignments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  annotator_id uuid not null references public.user_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (video_id, annotator_id),
  check ((status = 'completed') = (completed_at is not null))
);

create table if not exists public.annotations (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  annotator_id uuid not null references public.user_profiles(id) on delete cascade,
  start_time numeric(12,3) not null check (start_time >= 0),
  end_time numeric(12,3) not null check (end_time > start_time),
  label text not null check (length(trim(label)) > 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_assignments_annotator_idx on public.video_assignments(annotator_id, status);
create index if not exists annotations_annotator_idx on public.annotations(annotator_id, updated_at desc);
create index if not exists annotations_video_idx on public.annotations(video_id, annotator_id);

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid()) and p.enabled
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid()) and p.enabled and p.role = 'admin'
  );
$$;

create or replace function public.has_assignment(target_video_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.video_assignments a
    join public.videos v on v.id = a.video_id
    where a.video_id = target_video_id
      and a.annotator_id = (select auth.uid())
      and v.status = 'active'
  );
$$;

create or replace function public.validate_annotation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare video_duration numeric;
begin
  select duration_s into video_duration from public.videos where id = new.video_id and status = 'active';
  if video_duration is null or new.start_time < 0 or new.end_time <= new.start_time or new.end_time > video_duration then
    raise exception 'Annotation times must be ordered and within the active video duration';
  end if;
  if tg_op = 'UPDATE' then
    if new.video_id <> old.video_id or new.annotator_id <> old.annotator_id then
      raise exception 'Annotation ownership cannot be changed';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_annotation_trigger on public.annotations;
create trigger validate_annotation_trigger before insert or update on public.annotations
for each row execute function public.validate_annotation();

create or replace function public.validate_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.video_id <> old.video_id or new.annotator_id <> old.annotator_id then
      raise exception 'Assignment ownership cannot be changed';
    end if;
  end if;
  if new.status = 'completed' and not exists (
    select 1 from public.annotations a where a.video_id = new.video_id and a.annotator_id = new.annotator_id
  ) then
    raise exception 'Add at least one annotation before completing this video';
  end if;
  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_assignment_trigger on public.video_assignments;
create trigger validate_assignment_trigger before insert or update on public.video_assignments
for each row execute function public.validate_assignment();

create or replace function public.reopen_empty_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.annotations a where a.video_id = old.video_id and a.annotator_id = old.annotator_id
  ) then
    update public.video_assignments
    set status = 'pending', completed_at = null
    where video_id = old.video_id and annotator_id = old.annotator_id;
  end if;
  return old;
end;
$$;

drop trigger if exists reopen_empty_assignment_trigger on public.annotations;
create trigger reopen_empty_assignment_trigger after delete on public.annotations
for each row execute function public.reopen_empty_assignment();

alter table public.user_profiles enable row level security;
alter table public.videos enable row level security;
alter table public.video_assignments enable row level security;
alter table public.annotations enable row level security;

revoke all on public.user_profiles, public.videos, public.video_assignments, public.annotations from anon;
grant select, insert, update on public.user_profiles to authenticated;
grant select, insert, update, delete on public.videos to authenticated;
grant select, insert, update on public.video_assignments to authenticated;
grant select, insert, update, delete on public.annotations to authenticated;

drop policy if exists profiles_read on public.user_profiles;
drop policy if exists profiles_admin_insert on public.user_profiles;
drop policy if exists profiles_admin_update on public.user_profiles;
drop policy if exists videos_read on public.videos;
drop policy if exists videos_admin_write on public.videos;
drop policy if exists assignments_read on public.video_assignments;
drop policy if exists assignments_insert on public.video_assignments;
drop policy if exists assignments_update on public.video_assignments;
drop policy if exists annotations_read on public.annotations;
drop policy if exists annotations_insert on public.annotations;
drop policy if exists annotations_update on public.annotations;
drop policy if exists annotations_delete on public.annotations;

create policy profiles_read on public.user_profiles for select to authenticated
using (public.is_active_user() and (id = (select auth.uid()) or public.is_admin()));
create policy profiles_admin_insert on public.user_profiles for insert to authenticated
with check (public.is_admin());
create policy profiles_admin_update on public.user_profiles for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy videos_read on public.videos for select to authenticated
using (public.is_active_user() and (public.is_admin() or (status = 'active' and (available or public.has_assignment(id)))));
create policy videos_admin_write on public.videos for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy assignments_read on public.video_assignments for select to authenticated
using (public.is_active_user() and (annotator_id = (select auth.uid()) or public.is_admin()));
create policy assignments_insert on public.video_assignments for insert to authenticated
with check (
  public.is_admin() or (
    public.is_active_user() and annotator_id = (select auth.uid()) and status = 'pending'
    and exists (select 1 from public.videos v where v.id = video_id and v.status = 'active' and v.available)
  )
);
create policy assignments_update on public.video_assignments for update to authenticated
using (public.is_active_user() and (annotator_id = (select auth.uid()) or public.is_admin()))
with check (public.is_active_user() and (annotator_id = (select auth.uid()) or public.is_admin()));

create policy annotations_read on public.annotations for select to authenticated
using (public.is_active_user() and (annotator_id = (select auth.uid()) or public.is_admin()));
create policy annotations_insert on public.annotations for insert to authenticated
with check (public.is_active_user() and annotator_id = (select auth.uid()) and public.has_assignment(video_id));
create policy annotations_update on public.annotations for update to authenticated
using (public.is_active_user() and (annotator_id = (select auth.uid()) or public.is_admin()))
with check (public.is_active_user() and (annotator_id = (select auth.uid()) or public.is_admin()));
create policy annotations_delete on public.annotations for delete to authenticated
using (public.is_active_user() and (annotator_id = (select auth.uid()) or public.is_admin()));

revoke all on function public.validate_annotation() from public, anon, authenticated;
revoke all on function public.validate_assignment() from public, anon, authenticated;
revoke all on function public.reopen_empty_assignment() from public, anon, authenticated;
revoke all on function public.is_active_user() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.has_assignment(uuid) from public, anon;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_assignment(uuid) to authenticated;

-- Initial video verified in the supplied Drive folder on 2026-10-03.
insert into public.videos (drive_file_id, filename, duration_s)
values ('1ymkOkK4vNhETL47D1s8qzrR1fJ1y0HFj', 'AeseZkBqBf0_180633_186500_t01.mp4', 5.900)
on conflict (drive_file_id) do nothing;
