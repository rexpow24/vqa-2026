-- The range "Gỡ" can delete started work too, like "Gỡ vòng".
--
-- unassign_range kept every video with an answer or an event label, so a
-- regular video handed to the wrong person (or labelled in a test) could not
-- be taken back once opened. With delete_work it deletes that annotator's
-- answers and event labels on those videos, completed or not, then the
-- assignments; refused when any of them is part of an adjudication decision.
-- Agreement videos are still skipped here: "Gỡ vòng" handles them.

drop function if exists public.unassign_range(uuid, integer, integer);

create or replace function public.unassign_range(annotator uuid, seq_from integer, seq_to integer, delete_work boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare removed integer;
declare kept integer;
declare agreement integer;
declare answers integer := 0;
declare labels integer := 0;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if seq_from is null or seq_to is null or seq_from > seq_to then raise exception 'Invalid number range'; end if;
  create temporary table range_targets on commit drop as
    select a.id as assignment_id, a.video_id
    from public.video_assignments a join public.videos v on v.id = a.video_id
    where a.annotator_id = annotator and v.seq between seq_from and seq_to and not v.agreement_sample;
  if delete_work then
    if exists (select 1 from range_targets t join public.video_drafts d on d.video_id = t.video_id
               join public.answer_adjudications j on j.draft_id = d.id where annotator = any(j.annotator_ids))
       or exists (select 1 from range_targets t join public.label_adjudications j on j.video_id = t.video_id
                  where annotator = any(j.annotator_ids)) then
      raise exception 'Some of these answers were adjudicated; they cannot be deleted';
    end if;
    delete from public.qa_annotations q
    using public.video_drafts d, range_targets t
    where d.id = q.draft_id and d.video_id = t.video_id and q.annotator_id = annotator;
    get diagnostics answers = row_count;
    delete from public.video_labels l using range_targets t where l.video_id = t.video_id and l.annotator_id = annotator;
    get diagnostics labels = row_count;
    delete from public.video_assignments a using range_targets t where a.id = t.assignment_id;
  else
    delete from public.video_assignments a
    using range_targets t
    where a.id = t.assignment_id and a.status <> 'completed'
      and not exists (select 1 from public.qa_annotations q join public.video_drafts d on d.id = q.draft_id
                      where d.video_id = a.video_id and q.annotator_id = a.annotator_id)
      and not exists (select 1 from public.video_labels l where l.video_id = a.video_id and l.annotator_id = a.annotator_id);
  end if;
  get diagnostics removed = row_count;
  select count(*) into kept from public.video_assignments a join range_targets t on t.assignment_id = a.id;
  select count(*) into agreement from public.video_assignments a join public.videos v on v.id = a.video_id
  where a.annotator_id = annotator and v.seq between seq_from and seq_to and v.agreement_sample;
  drop table range_targets;
  return jsonb_build_object('removed', removed, 'kept_started', kept, 'skipped_agreement', agreement,
                            'deleted_answers', answers, 'deleted_labels', labels);
end;
$$;

revoke all on function public.unassign_range(uuid, integer, integer, boolean) from public, anon;
grant execute on function public.unassign_range(uuid, integer, integer, boolean) to authenticated;
