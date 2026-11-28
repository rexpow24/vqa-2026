-- Cell reports may target every active annotation group.
alter table public.video_reports drop constraint video_reports_question_group_check;
alter table public.video_reports add constraint video_reports_question_group_check
  check (question_group is null or question_group in ('S', 'E', 'C', 'R', 'O'));

-- An annotator helping with an open case needs video playback, but not the
-- reporting annotator's unmasked annotation or assignment.
create function public.can_view_resolution_video(p_video_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_user() and exists (
    select 1 from public.video_reports r join public.videos v on v.id = r.video_id
    where r.video_id = p_video_id and r.reason = 'cell_conflict' and r.status = 'open'
      and r.annotator_id <> (select auth.uid()) and v.status = 'active'
  )
$$;
revoke all on function public.can_view_resolution_video(uuid) from public, anon;
grant execute on function public.can_view_resolution_video(uuid) to authenticated;

create function public.report_counts_by_annotator()
returns table (annotator_id uuid, sent_count bigint)
language sql stable security definer set search_path = '' as $$
  select r.annotator_id, count(*) from public.video_reports r
  where public.is_admin() group by r.annotator_id
$$;
revoke all on function public.report_counts_by_annotator() from public, anon;
grant execute on function public.report_counts_by_annotator() to authenticated;

-- Expand the existing 60-video agreement group in place. Existing video
-- numbers, assignments and answers stay untouched.
create function public.prepare_fourth_agreement_round()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ready_count integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if (select count(*) from public.videos where agreement_sample and status = 'active') <> 60
     or (select count(*) from public.videos where agreement_sample and status = 'active' and seq between 1 and 60) <> 60 then
    raise exception 'Expected the existing agreement group to contain videos #1-60 only';
  end if;
  select count(*) into ready_count from public.videos v
  where v.seq between 61 and 160 and v.status = 'active' and v.available
    and (select count(*) from public.video_drafts d where d.video_id = v.id) = 9;
  if ready_count <> 100 then
    raise exception 'Only % of the 100 videos #61-160 are active, available and have nine drafts', ready_count;
  end if;
  update public.videos set agreement_sample = true where seq between 61 and 160;
  return jsonb_build_object('group_size', 160, 'fourth_from', 61, 'fourth_to', 160);
end;
$$;
revoke all on function public.prepare_fourth_agreement_round() from public, anon;
grant execute on function public.prepare_fourth_agreement_round() to authenticated;
