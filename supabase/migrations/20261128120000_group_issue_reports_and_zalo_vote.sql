-- Add issue-specific annotation reports and record the admin's Zalo vote outcome.
alter table public.video_reports
  add column question_group text check (question_group in ('E', 'C')),
  add column entity_key text check (entity_key is null or entity_key in ('A', 'B')),
  add column target_label text check (target_label is null or length(target_label) <= 200),
  add column vote_summary text check (vote_summary is null or length(vote_summary) <= 500);

alter table public.video_reports drop constraint video_reports_reason_check;
alter table public.video_reports add constraint video_reports_reason_check check (
  reason in ('overcut', 'too_difficult', 'entity_color_unclear', 'cause_too_difficult')
);
alter table public.video_reports add constraint video_reports_group_target_check check (
  (reason = 'entity_color_unclear' and question_group = 'E' and entity_key in ('A', 'B'))
  or (reason = 'cause_too_difficult' and question_group = 'C' and entity_key is null)
  or (reason in ('overcut', 'too_difficult') and question_group is null and entity_key is null and target_label is null)
);

-- Keep separate open issues for E and C, and one issue per side in E.
drop index if exists public.video_reports_one_open_per_assignment;
create unique index video_reports_one_open_per_target
  on public.video_reports(assignment_id, reason, coalesce(entity_key, '')) where status = 'open';

grant insert (video_id, assignment_id, annotator_id, reason, note, question_group, entity_key, target_label)
  on public.video_reports to authenticated;

drop function public.admin_resolve_video_report(uuid, text);
create function public.admin_resolve_video_report(p_report_id uuid, p_action text, p_vote_summary text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare report_row public.video_reports%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_action not in ('needs_relabel', 'dismissed') then raise exception 'Invalid report action'; end if;
  if p_vote_summary is not null and length(p_vote_summary) > 500 then raise exception 'Vote summary is too long'; end if;

  select * into report_row from public.video_reports where id = p_report_id for update;
  if not found then raise exception 'Video report not found'; end if;
  if report_row.status <> 'open' then raise exception 'Video report was already resolved'; end if;

  if p_action = 'needs_relabel' then
    update public.video_assignments
      set status = 'pending', completed_at = null
      where id = report_row.assignment_id;
  end if;

  update public.video_reports
    set status = p_action, vote_summary = nullif(trim(p_vote_summary), ''),
        resolved_at = now(), resolved_by = (select auth.uid())
    where id = p_report_id;
  return jsonb_build_object('id', p_report_id, 'video_id', report_row.video_id,
    'assignment_id', report_row.assignment_id, 'status', p_action, 'vote_summary', nullif(trim(p_vote_summary), ''));
end;
$$;
revoke all on function public.admin_resolve_video_report(uuid, text, text) from public, anon;
grant execute on function public.admin_resolve_video_report(uuid, text, text) to authenticated;
