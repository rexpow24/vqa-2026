-- Queue ordering that actually forms pairs on the agreement sample.
--
-- `coverage asc` sank a video below every untouched one as soon as one annotator
-- finished it, so a second opinion was only reachable after the whole dataset
-- had a first one.
--
-- `taken` counts other annotators' assignments, open ones included: two people
-- on single-label videos would otherwise work in lockstep down the same list.
-- An abandoned claim only lowers priority, so nothing becomes unreachable.

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
   cross join lateral (
     select count(*) as taken from public.video_assignments other
      where other.video_id = v.id and other.annotator_id <> (select auth.uid())
   ) others
   where public.is_active_user()
     and v.status = 'active'
     and coalesce(mine.status, '') <> 'completed'
     and (select count(*) from public.video_drafts d where d.video_id = v.id) = 9
   order by case
              when mine.status is not null then 0
              when v.agreement_sample and others.taken < 2 then 1
              when not v.agreement_sample and others.taken = 0 then 2
              else 3
            end,
            -- Inside the sample, finish an open pair before starting a new one.
            case when v.agreement_sample and others.taken < 2 then others.taken else 0 end desc,
            v.filename asc
   limit greatest(1, least(page_size, 100))
  offset greatest(0, page_offset);
$$;
