-- The admin dashboard in one round trip.
--
-- getAdminStats() used to issue 4 queries, then 4 more per annotator, and two
-- of the first four pulled whole tables down (every active video, every
-- assignment) only to count them in JavaScript. At N annotators that is
-- 4 + 4N queries; the serverless function and the database sit in different
-- regions, so each one costs a measured ~250ms of latency that nothing can
-- overlap away once they are issued per-user. Ten annotators would have meant
-- 44 queries for a single page.
--
-- Counting belongs in the database. This returns one JSON document, so the
-- page makes exactly one call no matter how many annotators exist.

create or replace function public.admin_stats()
returns jsonb
language sql stable security definer set search_path = '' as $$
  with video_state as (
    select v.id,
           count(a.id) as assignments,
           count(a.id) filter (where a.status = 'completed') as completed
      from public.videos v
      left join public.video_assignments a on a.video_id = v.id
     where v.status = 'active'
     group by v.id
  ),
  annotators as (
    select p.id, p.email, p.name, p.role, p.enabled, p.created_at,
           (select count(*) from public.video_assignments a
             where a.annotator_id = p.id) as assigned,
           (select count(*) from public.video_assignments a
             where a.annotator_id = p.id and a.status = 'completed') as completed,
           (select count(*) from public.qa_annotations q
             where q.annotator_id = p.id) as annotations,
           (select max(q.annotated_at) from public.qa_annotations q
             where q.annotator_id = p.id) as last_activity
      from public.user_profiles p
     where p.role = 'annotator'
  )
  select jsonb_build_object(
    'users', coalesce(
      (select jsonb_agg(to_jsonb(a) order by a.created_at) from annotators a),
      '[]'::jsonb),
    'totalVideos', (select count(*) from video_state),
    -- "completed" means every annotator who took it finished it, and at least
    -- one did; a video nobody has claimed is not complete.
    'completedVideos', (select count(*) from video_state
                         where assignments > 0 and assignments = completed),
    'totalAnnotations', (select count(*) from public.qa_annotations),
    'completedAssignments', (select count(*) from public.video_assignments
                              where status = 'completed'),
    'totalAssignments', (select count(*) from public.video_assignments)
  )
  where public.is_admin();
$$;

revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
