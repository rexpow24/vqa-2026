-- Taking a training round back, and saying why the range "Gỡ" skipped it.
--
-- unassign_range only ever touched regular videos, so "Gỡ #1-20" on an
-- agreement round did nothing and reported nothing. A round assigned to the
-- wrong person, or during a test, had no way back.
--
-- unassign_agreement_group(annotators, seq_from, seq_to, delete_work):
--   delete_work = false: removes only untouched assignments (no answer, no
--     event label, not completed), like unassign_range.
--   delete_work = true: also deletes those annotators' answers and event
--     labels on those videos, completed or not. Refused when any of them is
--     part of an adjudication decision, since the decision depends on them.
--     The revision log keeps a DELETE entry for every removed answer.

create or replace function public.unassign_range(annotator uuid, seq_from integer, seq_to integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare removed integer;
declare kept integer;
declare agreement integer;
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
  select count(*) filter (where not v.agreement_sample), count(*) filter (where v.agreement_sample)
  into kept, agreement
  from public.video_assignments a join public.videos v on v.id = a.video_id
  where a.annotator_id = annotator and v.seq between seq_from and seq_to;
  return jsonb_build_object('removed', removed, 'kept_started', kept, 'skipped_agreement', agreement);
end;
$$;

create or replace function public.unassign_agreement_group(annotators uuid[], seq_from integer, seq_to integer, delete_work boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare removed integer;
declare kept integer;
declare answers integer := 0;
declare labels integer := 0;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if coalesce(cardinality(annotators), 0) = 0 then raise exception 'Choose at least one annotator'; end if;
  if seq_from is null or seq_to is null or seq_from > seq_to then raise exception 'Invalid number range'; end if;
  create temporary table round_targets on commit drop as
    select a.id as assignment_id, a.video_id, a.annotator_id
    from public.video_assignments a join public.videos v on v.id = a.video_id
    where v.agreement_sample and v.seq between seq_from and seq_to and a.annotator_id = any(annotators);
  if delete_work then
    if exists (select 1 from round_targets t join public.video_drafts d on d.video_id = t.video_id
               join public.answer_adjudications j on j.draft_id = d.id where t.annotator_id = any(j.annotator_ids))
       or exists (select 1 from round_targets t join public.label_adjudications j on j.video_id = t.video_id
                  where t.annotator_id = any(j.annotator_ids)) then
      raise exception 'Some of these answers were adjudicated; they cannot be deleted';
    end if;
    delete from public.qa_annotations q
    using public.video_drafts d, round_targets t
    where d.id = q.draft_id and d.video_id = t.video_id and q.annotator_id = t.annotator_id;
    get diagnostics answers = row_count;
    delete from public.video_labels l
    using round_targets t
    where l.video_id = t.video_id and l.annotator_id = t.annotator_id;
    get diagnostics labels = row_count;
    delete from public.video_assignments a using round_targets t where a.id = t.assignment_id;
  else
    delete from public.video_assignments a
    using round_targets t
    where a.id = t.assignment_id and a.status <> 'completed'
      and not exists (select 1 from public.qa_annotations q join public.video_drafts d on d.id = q.draft_id
                      where d.video_id = a.video_id and q.annotator_id = a.annotator_id)
      and not exists (select 1 from public.video_labels l where l.video_id = a.video_id and l.annotator_id = a.annotator_id);
  end if;
  get diagnostics removed = row_count;
  select count(*) into kept from public.video_assignments a join round_targets t on t.assignment_id = a.id;
  drop table round_targets;
  return jsonb_build_object('removed', removed, 'kept_started', kept, 'deleted_answers', answers, 'deleted_labels', labels);
end;
$$;

revoke all on function public.unassign_agreement_group(uuid[], integer, integer, boolean) from public, anon;
grant execute on function public.unassign_agreement_group(uuid[], integer, integer, boolean) to authenticated;
