-- Annotator work queue, server-side.
--
-- Before this, /annotate loaded every video, every draft of every video, every
-- assignment and every answer on each page load, then joined and counted in the
-- browser. At 29 videos that was invisible; the dataset is heading for ~1400
-- videos (~12600 draft rows), where four unbounded selects per page load stop
-- being viable. These two functions push the filtering, counting and paging
-- into Postgres so a page load fetches one bounded page.
--
-- Two behaviours the old client-side version did not have:
--
--   * A video the caller already completed is excluded entirely, rather than
--     rendered with a "Hoàn thành" badge the annotator has to skip past by eye.
--     Exclusion is per annotator: everyone else still sees the video, which is
--     what makes agreement between two annotators measurable at all.
--
--   * Ordering is by how many annotators have already finished the video,
--     ascending. With a single shared ordering every annotator would otherwise
--     start at the same first page and pile onto the same handful of videos
--     while the tail never gets touched. Ascending coverage self-balances: a
--     video nobody has done sorts first, and drops away once it has its pair.

create or replace function public.annotator_queue(
  page_size integer default 10,
  page_offset integer default 0
)
returns table (
  video_id uuid,
  filename text,
  duration_s numeric,
  coverage bigint,
  answered bigint,
  assignment_status text
)
language sql stable security definer set search_path = '' as $$
  -- security definer so one call can read the counts without the caller
  -- needing select on every underlying row; is_active_user() keeps a
  -- disabled or unknown account from getting anything back.
  select v.id, v.filename, v.duration_s,
         (select count(*) from public.video_assignments done
           where done.video_id = v.id and done.status = 'completed') as coverage,
         (select count(*) from public.qa_annotations q
            join public.video_drafts d on d.id = q.draft_id
           where d.video_id = v.id and q.annotator_id = (select auth.uid())) as answered,
         coalesce(mine.status, 'available') as assignment_status
    from public.videos v
    left join public.video_assignments mine
      on mine.video_id = v.id and mine.annotator_id = (select auth.uid())
   where public.is_active_user()
     and v.status = 'active'
     and coalesce(mine.status, '') <> 'completed'
     -- Only videos whose nine drafts are already imported are labelable; the
     -- claim endpoint rejects anything else, so showing them is a dead end.
     and (select count(*) from public.video_drafts d where d.video_id = v.id) = 9
   order by (select count(*) from public.video_assignments done
              where done.video_id = v.id and done.status = 'completed') asc,
            v.filename asc
   limit greatest(1, least(page_size, 100))
  offset greatest(0, page_offset);
$$;

-- Progress for the annotator's own header: how many labelable videos they have
-- finished out of how many exist. `total` counts every ready video, not only
-- the ones they claimed, so the denominator does not grow as they work.
create or replace function public.annotator_progress()
returns table (completed bigint, total bigint)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*) from public.video_assignments a
       join public.videos v on v.id = a.video_id
      where a.annotator_id = (select auth.uid())
        and a.status = 'completed'
        and v.status = 'active'),
    (select count(*) from public.videos v
      where v.status = 'active'
        and (select count(*) from public.video_drafts d where d.video_id = v.id) = 9)
  where public.is_active_user();
$$;

revoke all on function public.annotator_queue(integer, integer) from public, anon;
revoke all on function public.annotator_progress() from public, anon;
grant execute on function public.annotator_queue(integer, integer) to authenticated;
grant execute on function public.annotator_progress() to authenticated;

-- Counting completed assignments per video happens for every row of every
-- queue page, and video_assignments has no index leading with video_id
-- (its unique key leads with (video_id, annotator_id), which cannot answer
-- a status filter alone).
create index if not exists video_assignments_video_status_idx
  on public.video_assignments(video_id, status);

-- Deliberately no index on video_drafts(video_id): the table's own
-- UNIQUE (video_id, qgroup) already answers `where video_id = ?` from its
-- leading column. An extra single-column copy was created here at first and
-- dropped again in 20261004_videos_filename_unique.sql -- it only added write
-- cost on ~12600 draft rows. Confirmed with EXPLAIN: the count still runs as
-- an Index Only Scan on video_drafts_video_id_qgroup_key.
