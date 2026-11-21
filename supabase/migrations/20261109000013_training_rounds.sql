-- Training rounds for the agreement group, a suggested split of the rest, and
-- a full answers export.
--
-- 1. create_agreement_group failed through the API with "UPDATE requires a
--    WHERE clause": Supabase loads pg_safeupdate for API sessions, and the
--    renumbering step was `update videos set seq = -seq` with no WHERE. The
--    tests only called plan_agreement_group, never create (it renumbers
--    production), so nothing caught it.
-- 2. The group is labelled in rounds (e.g. 60 videos as 3 rounds of 20, with
--    agreement measured and guidelines updated after each). So the group is
--    numbered in an interleaved stratum order, which makes every block of
--    consecutive numbers close to the group's own event_label x difficulty mix,
--    and assign_agreement_group takes a number range.
-- 3. "Trained" is derived, not stored: anyone holding an agreement assignment.
--    split_free_videos suggests contiguous ranges of equal size over the videos
--    nobody holds yet; it assigns nothing.
-- 4. answers_export: one row per saved answer, for computing agreement outside.

-- 1 + 2. Plan order: interleaved across strata --------------------------------------------------
-- Inside a stratum of k chosen videos, the i-th sits at (i - 0.5) / k of the way
-- through the group, so a stratum is spread evenly instead of in one block.
-- Deterministic: same reference labels and same pool give the same videos in
-- the same order.

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
    select a.event_label, a.difficulty, a.n,
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
  order by (p.i - 0.5) / a.k, a.k desc, p.event_label, p.difficulty;
end;
$$;

create or replace function public.create_agreement_group(group_size integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare chosen integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if exists (select 1 from public.video_assignments where batch <> 'legacy') then
    raise exception 'The agreement group can only change before videos are assigned';
  end if;
  lock table public.videos in share row exclusive mode;
  create temporary table group_plan on commit drop as
    select p.video_id, p.ord from public.plan_agreement_group(group_size) with ordinality as p(video_id, filename, event_label, difficulty, ord);
  update public.videos set agreement_sample = false where agreement_sample;
  update public.videos set agreement_sample = true where id in (select g.video_id from group_plan g);
  get diagnostics chosen = row_count;
  -- Every statement needs a WHERE: pg_safeupdate rejects it otherwise. Negate
  -- first so the new numbers never collide with the unique old ones.
  update public.videos set seq = -seq where seq is not null;
  with ordered as (
    select v.id, row_number() over (order by g.ord nulls last, v.filename, v.id) as n
    from public.videos v left join group_plan g on g.video_id = v.id
  )
  update public.videos v set seq = o.n from ordered o where o.id = v.id;
  perform setval('public.video_number', (select max(seq) from public.videos));
  drop table group_plan;
  return jsonb_build_object('group_size', chosen);
end;
$$;

-- 2. A round is a number range inside the group --------------------------------------------------

drop function if exists public.assign_agreement_group(uuid[]);

create or replace function public.assign_agreement_group(annotators uuid[], seq_from integer, seq_to integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare inserted integer; group_videos integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if coalesce(cardinality(annotators), 0) = 0 then raise exception 'Choose at least one annotator'; end if;
  if seq_from is null or seq_to is null or seq_from > seq_to then raise exception 'Invalid number range'; end if;
  if exists (select 1 from unnest(annotators) as u(id)
             where not exists (select 1 from public.user_profiles p where p.id = u.id and p.enabled)) then
    raise exception 'Assign videos to enabled users';
  end if;
  select count(*) into group_videos from public.videos v
  where v.agreement_sample and v.status = 'active' and v.seq between seq_from and seq_to;
  if group_videos = 0 then raise exception 'No agreement videos in % - %', seq_from, seq_to; end if;
  insert into public.video_assignments (video_id, annotator_id, status, batch)
  select v.id, u.id, 'pending', 'agreement'
  from public.videos v cross join unnest(annotators) as u(id)
  where v.agreement_sample and v.status = 'active' and v.seq between seq_from and seq_to
    and not exists (select 1 from public.video_assignments a where a.video_id = v.id and a.annotator_id = u.id);
  get diagnostics inserted = row_count;
  return jsonb_build_object('assigned', inserted, 'videos', group_videos);
end;
$$;

-- 3. Overview: agreement ranges and "trained" ------------------------------------------------

create or replace function public.assignment_overview()
returns jsonb language sql stable security definer set search_path = '' as $$
  with mine as (
    select a.annotator_id, v.seq, v.agreement_sample, a.status
    from public.video_assignments a join public.videos v on v.id = a.video_id
    where v.status = 'active'
  ),
  runs as (
    select annotator_id, agreement_sample, min(seq) as lo, max(seq) as hi
    from (select annotator_id, seq, agreement_sample,
                 seq - row_number() over (partition by annotator_id, agreement_sample order by seq) as island
          from mine) x
    group by annotator_id, agreement_sample, island
  ),
  people as (
    select p.id, p.name, p.email, p.role, p.label, p.enabled,
      (select count(*) from mine m where m.annotator_id = p.id)::integer as total,
      (select count(*) from mine m where m.annotator_id = p.id and m.status = 'completed')::integer as completed,
      (select count(*) from mine m where m.annotator_id = p.id and m.agreement_sample)::integer as agreement,
      (select count(*) from mine m where m.annotator_id = p.id and m.agreement_sample and m.status = 'completed')::integer as agreement_completed,
      exists (select 1 from mine m where m.annotator_id = p.id and m.agreement_sample) as trained,
      coalesce((select string_agg(case when lo = hi then lo::text else lo || '-' || hi end, ', ' order by lo)
                from runs r where r.annotator_id = p.id and not r.agreement_sample), '') as ranges,
      coalesce((select string_agg(case when lo = hi then lo::text else lo || '-' || hi end, ', ' order by lo)
                from runs r where r.annotator_id = p.id and r.agreement_sample), '') as agreement_ranges
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

-- 3. Suggested split: `parts` contiguous ranges over the free videos, sizes
-- differing by at most one (the first ranges take the extra video). A range
-- may span numbers that are held or not ready; assign_range skips those.

create or replace function public.split_free_videos(parts integer)
returns table (part integer, seq_from integer, seq_to integer, videos integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if parts is null or parts < 1 then raise exception 'Split into at least one part'; end if;
  return query
  with free as (
    select v.seq from public.videos v
    where v.status = 'active' and v.available and not v.agreement_sample
      and (select count(*) from public.video_drafts d where d.video_id = v.id) = 9
      and not exists (select 1 from public.video_assignments a where a.video_id = v.id)
  ),
  tiled as (select f.seq, ntile(parts) over (order by f.seq) as t from free f)
  select t.t::integer, min(t.seq)::integer, max(t.seq)::integer, count(*)::integer
  from tiled t group by t.t order by t.t;
end;
$$;

-- 4. Answers export: every saved answer with its question and annotator --------------------

create or replace function public.answers_export(only_agreement boolean, seq_from integer, seq_to integer)
returns table (
  seq integer, filename text, agreement boolean, annotator_email text, annotator_name text,
  assignment_status text, batch text, qgroup text, question text, draft_answer text,
  verdict text, reason_code text, reason_note text, edited_answer text, effective_answer text,
  human_keyframes_s text, annotated_at timestamptz, event_label text,
  draft_id uuid, video_id uuid, annotator_id uuid
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select v.seq, v.filename, v.agreement_sample, p.email, p.name,
    a.status, a.batch, d.qgroup, d.question, d.answer,
    q.verdict, q.reason_code, q.reason_note, q.edited_answer,
    public.effective_answer(q.verdict, q.edited_answer, d.answer),
    array_to_string(q.human_keyframes_s, ';'), q.annotated_at, l.event_label,
    d.id, v.id, q.annotator_id
  from public.qa_annotations q
  join public.video_drafts d on d.id = q.draft_id
  join public.videos v on v.id = d.video_id
  join public.user_profiles p on p.id = q.annotator_id
  left join public.video_assignments a on a.video_id = v.id and a.annotator_id = q.annotator_id
  left join public.video_labels l on l.video_id = v.id and l.annotator_id = q.annotator_id
  where (not only_agreement or v.agreement_sample)
    and (seq_from is null or v.seq >= seq_from) and (seq_to is null or v.seq <= seq_to)
  order by v.seq, d.qgroup, p.email, d.id;
end;
$$;

revoke all on function public.assign_agreement_group(uuid[], integer, integer), public.split_free_videos(integer),
  public.answers_export(boolean, integer, integer) from public, anon;
grant execute on function public.assign_agreement_group(uuid[], integer, integer), public.split_free_videos(integer),
  public.answers_export(boolean, integer, integer) to authenticated;
