-- In-app peer help for one annotation cell, followed by an admin decision.
alter table public.video_reports
  add column target_cell text check (target_cell is null or length(target_cell) <= 100),
  add column target_index integer check (target_index is null or target_index between 0 and 1),
  add column report_snapshot jsonb,
  add column final_answer text check (final_answer is null or length(final_answer) <= 1000);

alter table public.video_reports drop constraint video_reports_reason_check;
alter table public.video_reports add constraint video_reports_reason_check
  check (reason in ('overcut', 'too_difficult', 'entity_color_unclear', 'cause_too_difficult', 'cell_conflict'));
alter table public.video_reports drop constraint video_reports_status_check;
alter table public.video_reports add constraint video_reports_status_check
  check (status in ('open', 'needs_relabel', 'dismissed', 'resolved'));
alter table public.video_reports drop constraint video_reports_group_target_check;
alter table public.video_reports add constraint video_reports_group_target_check check (
  (reason = 'entity_color_unclear' and question_group = 'E' and entity_key in ('A', 'B'))
  or (reason = 'cause_too_difficult' and question_group = 'C' and entity_key is null)
  or (reason in ('overcut', 'too_difficult') and question_group is null and entity_key is null and target_label is null)
  or (reason = 'cell_conflict' and question_group in ('S','E','C','R','O') and target_cell is not null
      and target_label is not null and report_snapshot is not null
      and ((question_group = 'E' and entity_key in ('A','B')) or (question_group <> 'E' and entity_key is null)))
);
drop index if exists public.video_reports_one_open_per_target;
create unique index video_reports_one_open_per_cell
  on public.video_reports(assignment_id, question_group, target_cell, coalesce(entity_key, ''), coalesce(target_index, -1))
  where status = 'open' and reason = 'cell_conflict';
grant insert (video_id, assignment_id, annotator_id, reason, note, question_group, entity_key, target_label,
  target_cell, target_index, report_snapshot) on public.video_reports to authenticated;

create table public.cell_resolution_votes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.video_reports(id) on delete cascade,
  annotator_id uuid not null references public.user_profiles(id) on delete cascade,
  answer text not null check (length(trim(answer)) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique (report_id, annotator_id)
);
alter table public.cell_resolution_votes enable row level security;
revoke all on public.cell_resolution_votes from anon, authenticated;
grant select on public.cell_resolution_votes to authenticated;
create policy cell_resolution_votes_admin_read on public.cell_resolution_votes for select to authenticated
  using (public.is_active_user() and public.is_admin());

create or replace function public.cell_resolution_queue()
returns table (id uuid, video_id uuid, seq integer, filename text, question_group text, target_cell text,
  target_label text, entity_key text, target_index integer, note text, report_snapshot jsonb, created_at timestamptz,
  reporter_name text, my_answer text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.video_id, v.seq, v.filename, r.question_group, r.target_cell, r.target_label, r.entity_key,
    r.target_index, r.note, r.report_snapshot, r.created_at, p.name,
    (select x.answer from public.cell_resolution_votes x where x.report_id = r.id and x.annotator_id = (select auth.uid()))
  from public.video_reports r join public.videos v on v.id = r.video_id
  join public.user_profiles p on p.id = r.annotator_id
  where r.reason = 'cell_conflict' and r.status = 'open'
    and public.is_active_user() and not public.is_admin() and r.annotator_id <> (select auth.uid())
    and not exists (select 1 from public.cell_resolution_votes x where x.report_id = r.id and x.annotator_id = (select auth.uid()))
  order by r.created_at, v.seq
$$;
revoke all on function public.cell_resolution_queue() from public, anon;
grant execute on function public.cell_resolution_queue() to authenticated;

create or replace function public.submit_cell_resolution_vote(p_report_id uuid, p_answer text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare report_row public.video_reports%rowtype;
begin
  if not public.is_active_user() or public.is_admin() then raise exception 'Annotator access required'; end if;
  if length(trim(coalesce(p_answer, ''))) not between 1 and 1000 then raise exception 'Answer must be 1 to 1000 characters'; end if;
  select * into report_row from public.video_reports where id = p_report_id for update;
  if not found or report_row.reason <> 'cell_conflict' or report_row.status <> 'open' then raise exception 'Report is no longer open'; end if;
  if report_row.annotator_id = (select auth.uid()) then raise exception 'Report creator cannot vote on this report'; end if;
  insert into public.cell_resolution_votes (report_id, annotator_id, answer)
    values (p_report_id, (select auth.uid()), trim(p_answer))
    on conflict (report_id, annotator_id) do update set answer = excluded.answer, created_at = now();
  return jsonb_build_object('report_id', p_report_id, 'answer', trim(p_answer));
end;
$$;
revoke all on function public.submit_cell_resolution_vote(uuid, text) from public, anon;
grant execute on function public.submit_cell_resolution_vote(uuid, text) to authenticated;

create or replace function public.admin_finalize_cell_report(p_report_id uuid, p_answer text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare report_row public.video_reports%rowtype;
declare video_seq integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if length(trim(coalesce(p_answer, ''))) not between 1 and 1000 then raise exception 'Final answer must be 1 to 1000 characters'; end if;
  select * into report_row from public.video_reports where id = p_report_id for update;
  if not found or report_row.reason <> 'cell_conflict' then raise exception 'Cell report not found'; end if;
  if report_row.status <> 'open' then raise exception 'Report was already finalized'; end if;
  update public.video_reports set status = 'resolved', final_answer = trim(p_answer), resolved_at = now(), resolved_by = (select auth.uid())
    where id = p_report_id;
  select seq into video_seq from public.videos where id = report_row.video_id;
  return jsonb_build_object('id', p_report_id, 'video_id', report_row.video_id, 'seq', video_seq,
    'question_group', report_row.question_group, 'target_cell', report_row.target_cell,
    'entity_key', report_row.entity_key, 'target_index', report_row.target_index, 'final_answer', trim(p_answer));
end;
$$;
revoke all on function public.admin_finalize_cell_report(uuid, text) from public, anon;
grant execute on function public.admin_finalize_cell_report(uuid, text) to authenticated;
