-- Admin-driven assignment (features/assigned-labeling/).
--
-- Before this, any annotator could read every video's drive_file_id and
-- download the original from link-shared Drive, and could claim any video.
-- Now: Drive ids are readable by no session client, annotators see and label
-- only the videos an admin assigned to them, a regular video has at most one
-- annotator, and an agreement group (stratified by the review labels) is the
-- only place several annotators label the same video.

-- 1. Columns --------------------------------------------------------------------

alter table public.user_profiles add column if not exists label text;
alter table public.video_assignments add column if not exists batch text not null default 'manual';

-- Video number. The agreement group takes 1..N once it is created
-- (create_agreement_group); until then numbers follow the filename.
create sequence if not exists public.video_number;
alter table public.videos add column if not exists seq integer;
update public.videos set agreement_sample = false where agreement_sample;
with ordered as (select id, row_number() over (order by filename, id) as n from public.videos where seq is null)
update public.videos v set seq = o.n + coalesce((select max(seq) from public.videos), 0)
from ordered o where o.id = v.id;
select setval('public.video_number', greatest(1, coalesce((select max(seq) from public.videos), 0)),
              (select count(*) > 0 from public.videos));
alter table public.videos alter column seq set default nextval('public.video_number');
alter table public.videos alter column seq set not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'videos_seq_key') then
    alter table public.videos add constraint videos_seq_key unique (seq);
  end if;
end $$;
alter sequence public.video_number owned by public.videos.seq;
grant usage on sequence public.video_number to authenticated;

-- Drive will not stream this 114 MB clip (virus-scan page), so it is not assignable.
update public.videos set available = false where filename = 'fb_ca1ee5326f08417c8193d7bab278891a_full_t01.mp4';

-- validate_assignment (20261107 version) plus the insert rules: the assignee is
-- an enabled user, and a video outside the agreement group has one annotator.
-- The completion checks now run only when an assignment becomes completed: an
-- unrelated update (the batch backfill below) is not a new completion, and a
-- video completed before a rule existed must not block every later update.
-- Defined before the legacy section, which updates assignments.
create or replace function public.validate_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare draft_count integer;
declare answer_count integer;
begin
  if tg_op = 'UPDATE' and (new.video_id <> old.video_id or new.annotator_id <> old.annotator_id) then
    raise exception 'Assignment ownership cannot be changed';
  end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.user_profiles p where p.id = new.annotator_id and p.enabled) then
      raise exception 'Assign videos to an enabled user';
    end if;
    -- Serialises concurrent assignments of the same video.
    perform 1 from public.videos where id = new.video_id for update;
    if not exists (select 1 from public.videos v where v.id = new.video_id and v.agreement_sample)
       and exists (select 1 from public.video_assignments a
                   where a.video_id = new.video_id and a.annotator_id <> new.annotator_id) then
      raise exception 'This video is already assigned to another annotator';
    end if;
  end if;
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then
    if not exists (select 1 from public.video_labels l
                   where l.video_id = new.video_id and l.annotator_id = new.annotator_id) then
      raise exception 'Choose the event label before completing';
    end if;
    select count(*) into draft_count from public.video_drafts where video_id = new.video_id;
    select count(*) into answer_count from public.qa_annotations a
      join public.video_drafts d on d.id = a.draft_id
      where d.video_id = new.video_id and a.annotator_id = new.annotator_id;
    if draft_count <> 9 or answer_count <> 9 then
      raise exception 'Review all nine questions before completing';
    end if;
    if exists (select 1 from public.qa_annotations a join public.video_drafts d on d.id = a.draft_id
               where d.video_id = new.video_id and a.annotator_id = new.annotator_id
                 and (a.verdict = 'DISAGREE') = (a.edited_answer is null)) then
      raise exception 'An edited answer needs the verdict Sai, and Sai needs an edited answer';
    end if;
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

-- 2. Legacy self-claims ------------------------------------------------------------
-- Keep the ones with work in them; drop the untouched ones and their event labels.

delete from public.video_labels l
using public.video_assignments a
where a.video_id = l.video_id and a.annotator_id = l.annotator_id and a.status <> 'completed'
  and not exists (select 1 from public.qa_annotations q join public.video_drafts d on d.id = q.draft_id
                  where d.video_id = a.video_id and q.annotator_id = a.annotator_id);
delete from public.video_assignments a
where a.status <> 'completed'
  and not exists (select 1 from public.qa_annotations q join public.video_drafts d on d.id = q.draft_id
                  where d.video_id = a.video_id and q.annotator_id = a.annotator_id);
update public.video_assignments set batch = 'legacy';

-- 3. Access ------------------------------------------------------------------------------

revoke select on public.videos from authenticated;
grant select (id, filename, duration_s, available, status, created_at, agreement_sample, seq)
  on public.videos to authenticated;

drop policy if exists videos_read on public.videos;
create policy videos_read on public.videos for select to authenticated
using (public.is_active_user() and (public.is_admin() or public.has_assignment(id)));

drop policy if exists video_drafts_read on public.video_drafts;
create policy video_drafts_read on public.video_drafts for select to authenticated
using (public.is_active_user() and (public.is_admin() or public.has_assignment(video_id)));

drop policy if exists assignments_insert on public.video_assignments;
create policy assignments_insert on public.video_assignments for insert to authenticated
with check (public.is_admin());

-- 4. The annotator's own list --------------------------------------------------------------
-- A numeric search is a video number; anything else matches part of the filename.

drop function if exists public.annotator_queue(integer, integer);
drop function if exists public.annotator_progress();

create or replace function public.my_assignments(page_size integer, page_offset integer, search text default null)
returns table (video_id uuid, seq integer, filename text, duration_s numeric, status text,
               answered bigint, agreement boolean, total bigint)
language sql stable security definer set search_path = '' as $$
  with term as (select nullif(trim(coalesce(search, '')), '') as q),
  mine as (
    select v.id, v.seq, v.filename, v.duration_s, a.status, v.agreement_sample
    from public.video_assignments a
    join public.videos v on v.id = a.video_id
    cross join term
    where a.annotator_id = (select auth.uid()) and v.status = 'active' and public.is_active_user()
      and (term.q is null
           or (term.q ~ '^[0-9]+$' and v.seq = term.q::integer)
           or (term.q !~ '^[0-9]+$' and strpos(lower(v.filename), lower(term.q)) > 0))
  )
  select m.id, m.seq, m.filename, m.duration_s, m.status,
         (select count(*) from public.qa_annotations q join public.video_drafts d on d.id = q.draft_id
          where d.video_id = m.id and q.annotator_id = (select auth.uid())),
         m.agreement_sample, count(*) over ()
  from mine m
  order by m.seq
  limit greatest(1, least(page_size, 100)) offset greatest(0, page_offset)
$$;

create or replace function public.annotator_progress()
returns table (assigned bigint, completed bigint)
language sql stable security definer set search_path = '' as $$
  select count(*), count(*) filter (where a.status = 'completed')
  from public.video_assignments a join public.videos v on v.id = a.video_id
  where a.annotator_id = (select auth.uid()) and v.status = 'active' and public.is_active_user()
$$;

create or replace function public.next_assigned_video()
returns table (video_id uuid, seq integer, filename text)
language sql stable security definer set search_path = '' as $$
  select v.id, v.seq, v.filename
  from public.video_assignments a join public.videos v on v.id = a.video_id
  where a.annotator_id = (select auth.uid()) and a.status <> 'completed' and v.status = 'active'
    and public.is_active_user()
  order by v.seq limit 1
$$;

-- 5. Admin: ranges -----------------------------------------------------------------------------

create or replace function public.assign_range(annotator uuid, seq_from integer, seq_to integer, batch_label text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
declare inserted integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if seq_from is null or seq_to is null or seq_from > seq_to then raise exception 'Invalid range'; end if;
  if not exists (select 1 from public.user_profiles where id = annotator and enabled) then
    raise exception 'Assign videos to an enabled user';
  end if;
  perform 1 from public.videos where seq between seq_from and seq_to for update;
  create temporary table range_candidates on commit drop as
  select v.id, v.agreement_sample as agreement,
         (v.status = 'active' and v.available
          and (select count(*) from public.video_drafts d where d.video_id = v.id) = 9) as ready,
         exists (select 1 from public.video_assignments a where a.video_id = v.id and a.annotator_id <> annotator) as taken,
         exists (select 1 from public.video_assignments a where a.video_id = v.id and a.annotator_id = annotator) as mine
  from public.videos v where v.seq between seq_from and seq_to;
  insert into public.video_assignments (video_id, annotator_id, status, batch)
  select id, annotator, 'pending', coalesce(nullif(trim(batch_label), ''), 'manual')
  from range_candidates where not agreement and ready and not taken and not mine;
  get diagnostics inserted = row_count;
  select jsonb_build_object(
    'assigned', inserted,
    'skipped_agreement', count(*) filter (where agreement),
    'skipped_not_ready', count(*) filter (where not agreement and not ready),
    'skipped_taken', count(*) filter (where not agreement and ready and taken),
    'already_mine', count(*) filter (where not agreement and ready and mine)) into result
  from range_candidates;
  drop table range_candidates;
  return result;
end;
$$;

-- Only untouched assignments go: no answer and no event label.
create or replace function public.unassign_range(annotator uuid, seq_from integer, seq_to integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare removed integer;
declare kept integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  delete from public.video_assignments a
  using public.videos v
  where v.id = a.video_id and a.annotator_id = annotator and v.seq between seq_from and seq_to
    and not v.agreement_sample and a.status <> 'completed'
    and not exists (select 1 from public.qa_annotations q join public.video_drafts d on d.id = q.draft_id
                    where d.video_id = a.video_id and q.annotator_id = a.annotator_id)
    and not exists (select 1 from public.video_labels l where l.video_id = a.video_id and l.annotator_id = a.annotator_id);
  get diagnostics removed = row_count;
  select count(*) into kept from public.video_assignments a join public.videos v on v.id = a.video_id
  where a.annotator_id = annotator and v.seq between seq_from and seq_to and not v.agreement_sample;
  return jsonb_build_object('removed', removed, 'kept_started', kept);
end;
$$;

-- 6. Admin: reference labels and the agreement group ------------------------------------------
-- Reference labels are the review step's difficulty / event_label, as written
-- by scripts/export_labels_csv.py: `key` is the shot file stem (filename
-- without .mp4, labels are per shot), a full filename, or a clip_id (filename
-- without _tNN.mp4, applied to every shot of the clip).

create or replace function public.import_reference_labels(rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare saved integer;
declare unknown jsonb;
declare invalid jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  create temporary table reference_items on commit drop as
  select x.idx, trim(x.key) as key, lower(trim(x.difficulty)) as difficulty, lower(trim(x.event_label)) as event_label
  from rows from (jsonb_to_recordset(rows) as (key text, difficulty text, event_label text))
       with ordinality as x(key, difficulty, event_label, idx);
  select coalesce(jsonb_agg(key order by idx), '[]'::jsonb) into invalid from reference_items
  where coalesce(difficulty, '') not in ('easy','medium','high') or coalesce(event_label, '') not in ('accident','near-miss')
     or coalesce(key, '') = '';
  delete from reference_items
  where coalesce(difficulty, '') not in ('easy','medium','high') or coalesce(event_label, '') not in ('accident','near-miss')
     or coalesce(key, '') = '';
  create temporary table reference_matches on commit drop as
  select i.idx, v.id as video_id, i.difficulty, i.event_label
  from reference_items i
  join public.videos v on v.filename = i.key or v.filename = i.key || '.mp4'
                       or regexp_replace(v.filename, '_t[0-9]+\.mp4$', '') = i.key;
  select coalesce(jsonb_agg(i.key order by i.idx), '[]'::jsonb) into unknown from reference_items i
  where not exists (select 1 from reference_matches m where m.idx = i.idx);
  insert into public.video_reference_labels (video_id, difficulty, event_label, uploaded_at)
  select distinct on (video_id) video_id, difficulty, event_label, now() from reference_matches order by video_id, idx desc
  on conflict (video_id) do update set difficulty = excluded.difficulty, event_label = excluded.event_label,
    uploaded_at = excluded.uploaded_at;
  select count(distinct idx) into saved from reference_matches;
  drop table reference_matches;
  drop table reference_items;
  return jsonb_build_object('saved', saved, 'unknown', unknown, 'invalid', invalid);
end;
$$;

-- The pool the group is drawn from: active, assignable, 9 drafts, labelled.
create or replace function public.agreement_strata()
returns table (event_label text, difficulty text, available bigint, in_group bigint)
language sql stable security definer set search_path = '' as $$
  select r.event_label, r.difficulty, count(*), count(*) filter (where v.agreement_sample)
  from public.videos v join public.video_reference_labels r on r.video_id = v.id
  where public.is_admin() and v.status = 'active' and v.available
    and (select count(*) from public.video_drafts d where d.video_id = v.id) = 9
  group by r.event_label, r.difficulty
  order by r.event_label, r.difficulty
$$;

-- Proportional allocation with largest remainders (ties: bigger stratum, then
-- name), and a stable pseudo-random order inside each stratum.
create or replace function public.plan_agreement_group(group_size integer)
returns table (video_id uuid, filename text, event_label text, difficulty text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if group_size is null or group_size < 1 then raise exception 'Group size must be at least 1'; end if;
  if group_size > (select coalesce(sum(s.available), 0) from public.agreement_strata() s) then
    raise exception 'Only % labelled videos are available', (select coalesce(sum(s.available), 0) from public.agreement_strata() s);
  end if;
  return query
  with strata as (select s.event_label, s.difficulty, s.available as n from public.agreement_strata() s),
  quota as (
    select s.*, group_size * s.n::numeric / (select sum(n) from strata) as exact,
           floor(group_size * s.n::numeric / (select sum(n) from strata))::integer as base
    from strata s
  ),
  ranked as (
    select q.*, row_number() over (order by q.exact - q.base desc, q.n desc, q.event_label, q.difficulty) as r from quota q
  ),
  alloc as (
    select a.event_label, a.difficulty,
           a.base + case when a.r <= group_size - (select sum(base) from quota) then 1 else 0 end as k
    from ranked a
  ),
  pool as (
    select v.id, v.filename, r.event_label, r.difficulty,
           row_number() over (partition by r.event_label, r.difficulty order by md5(v.drive_file_id), v.id) as i
    from public.videos v join public.video_reference_labels r on r.video_id = v.id
    where v.status = 'active' and v.available
      and (select count(*) from public.video_drafts d where d.video_id = v.id) = 9
  )
  select p.id, p.filename, p.event_label, p.difficulty
  from pool p join alloc a on a.event_label = p.event_label and a.difficulty = p.difficulty
  where p.i <= a.k
  order by p.event_label, p.difficulty, p.i;
end;
$$;

-- Writes the plan and renumbers: group 1..N, then everything else by filename.
-- Refused once real work is handed out, so an assigned range never shifts.
create or replace function public.create_agreement_group(group_size integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare chosen integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if exists (select 1 from public.video_assignments where batch <> 'legacy') then
    raise exception 'The agreement group can only change before videos are assigned';
  end if;
  lock table public.videos in share row exclusive mode;
  create temporary table group_plan on commit drop as select p.video_id from public.plan_agreement_group(group_size) p;
  update public.videos set agreement_sample = false where agreement_sample;
  update public.videos set agreement_sample = true where id in (select video_id from group_plan);
  get diagnostics chosen = row_count;
  update public.videos set seq = -seq;
  with ordered as (
    select id, row_number() over (order by agreement_sample desc, filename, id) as n from public.videos
  )
  update public.videos v set seq = o.n from ordered o where o.id = v.id;
  perform setval('public.video_number', (select max(seq) from public.videos));
  drop table group_plan;
  return jsonb_build_object('group_size', chosen);
end;
$$;

create or replace function public.assign_agreement_group(annotators uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare inserted integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if exists (select 1 from unnest(annotators) as u(id)
             where not exists (select 1 from public.user_profiles p where p.id = u.id and p.enabled)) then
    raise exception 'Assign videos to enabled users';
  end if;
  insert into public.video_assignments (video_id, annotator_id, status, batch)
  select v.id, u.id, 'pending', 'agreement'
  from public.videos v cross join unnest(annotators) as u(id)
  where v.agreement_sample and v.status = 'active'
    and not exists (select 1 from public.video_assignments a where a.video_id = v.id and a.annotator_id = u.id);
  get diagnostics inserted = row_count;
  return jsonb_build_object('assigned', inserted);
end;
$$;

-- 7. Admin: overview ----------------------------------------------------------------------------
-- ranges: the annotator's regular videos as runs of consecutive numbers.

create or replace function public.assignment_overview()
returns jsonb language sql stable security definer set search_path = '' as $$
  with mine as (
    select a.annotator_id, v.seq, v.agreement_sample, a.status
    from public.video_assignments a join public.videos v on v.id = a.video_id
    where v.status = 'active'
  ),
  runs as (
    select annotator_id, min(seq) as lo, max(seq) as hi
    from (select annotator_id, seq, seq - row_number() over (partition by annotator_id order by seq) as island
          from mine where not agreement_sample) x
    group by annotator_id, island
  ),
  people as (
    select p.id, p.name, p.email, p.role, p.label, p.enabled,
      (select count(*) from mine m where m.annotator_id = p.id)::integer as total,
      (select count(*) from mine m where m.annotator_id = p.id and m.status = 'completed')::integer as completed,
      (select count(*) from mine m where m.annotator_id = p.id and m.agreement_sample)::integer as agreement,
      coalesce((select string_agg(case when lo = hi then lo::text else lo || '-' || hi end, ', ' order by lo)
                from runs r where r.annotator_id = p.id), '') as ranges
    from public.user_profiles p
  ),
  free as (
    select v.seq from public.videos v
    where v.status = 'active' and v.available and not v.agreement_sample
      and (select count(*) from public.video_drafts d where d.video_id = v.id) = 9
      and not exists (select 1 from public.video_assignments a where a.video_id = v.id)
  )
  select case when public.is_admin() then jsonb_build_object(
    'annotators', (select coalesce(jsonb_agg(to_jsonb(p) order by p.role desc, p.name), '[]'::jsonb) from people p),
    'group_size', (select count(*) from public.videos where agreement_sample and status = 'active'),
    'next_free_seq', (select min(seq) from free),
    'unassigned', (select count(*) from free),
    'handed_out', exists (select 1 from public.video_assignments where batch <> 'legacy')) end
$$;

revoke all on function public.my_assignments(integer, integer, text), public.annotator_progress(),
  public.next_assigned_video(), public.assign_range(uuid, integer, integer, text),
  public.unassign_range(uuid, integer, integer), public.import_reference_labels(jsonb),
  public.agreement_strata(), public.plan_agreement_group(integer), public.create_agreement_group(integer),
  public.assign_agreement_group(uuid[]), public.assignment_overview() from public, anon;
grant execute on function public.my_assignments(integer, integer, text), public.annotator_progress(),
  public.next_assigned_video(), public.assign_range(uuid, integer, integer, text),
  public.unassign_range(uuid, integer, integer), public.import_reference_labels(jsonb),
  public.agreement_strata(), public.plan_agreement_group(integer), public.create_agreement_group(integer),
  public.assign_agreement_group(uuid[]), public.assignment_overview() to authenticated;
