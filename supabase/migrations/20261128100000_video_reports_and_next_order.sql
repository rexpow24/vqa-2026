-- Let annotators flag videos that need review, and let admins mark reports
-- for re-labeling without deleting the existing annotation history.
create table public.video_reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  assignment_id uuid not null references public.video_assignments(id) on delete cascade,
  annotator_id uuid not null references public.user_profiles(id) on delete cascade,
  reason text not null check (reason in ('overcut', 'too_difficult')),
  note text check (note is null or length(note) <= 1000),
  status text not null default 'open' check (status in ('open', 'needs_relabel', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.user_profiles(id)
);

create index video_reports_created_idx on public.video_reports(status, created_at desc);
create unique index video_reports_one_open_per_assignment
  on public.video_reports(assignment_id) where status = 'open';

alter table public.video_reports enable row level security;
revoke all on public.video_reports from anon;
grant select on public.video_reports to authenticated;
grant insert (video_id, assignment_id, annotator_id, reason, note) on public.video_reports to authenticated;

create policy video_reports_read on public.video_reports for select to authenticated
using (public.is_active_user() and (public.is_admin() or annotator_id = (select auth.uid())));
create policy video_reports_insert on public.video_reports for insert to authenticated
with check (
  public.is_active_user()
  and annotator_id = (select auth.uid())
  and status = 'open'
  and resolved_at is null
  and resolved_by is null
  and exists (
    select 1 from public.video_assignments a
    where a.id = video_reports.assignment_id
      and a.video_id = video_reports.video_id
      and a.annotator_id = video_reports.annotator_id
  )
);
create or replace function public.admin_resolve_video_report(p_report_id uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare report_row public.video_reports%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_action not in ('needs_relabel', 'dismissed') then raise exception 'Invalid report action'; end if;

  select * into report_row from public.video_reports where id = p_report_id for update;
  if not found then raise exception 'Video report not found'; end if;
  if report_row.status <> 'open' then raise exception 'Video report was already resolved'; end if;

  if p_action = 'needs_relabel' then
    update public.video_assignments
      set status = 'pending', completed_at = null
      where id = report_row.assignment_id;
  end if;

  update public.video_reports
    set status = p_action, resolved_at = now(), resolved_by = (select auth.uid())
    where id = p_report_id;
  return jsonb_build_object('id', p_report_id, 'video_id', report_row.video_id,
    'assignment_id', report_row.assignment_id, 'status', p_action);
end;
$$;
revoke all on function public.admin_resolve_video_report(uuid, text) from public, anon;
grant execute on function public.admin_resolve_video_report(uuid, text) to authenticated;

-- The next-video action advances from the video currently on screen, even when
-- an older assignment is still unfinished.
create or replace function public.next_assigned_video_after(after_video_id uuid)
returns table (video_id uuid, seq integer, filename text)
language sql stable security definer set search_path = '' as $$
  select v.id, v.seq, v.filename
  from public.video_assignments a
  join public.videos v on v.id = a.video_id
  join public.videos current_video on current_video.id = after_video_id
  where a.annotator_id = (select auth.uid())
    and a.status <> 'completed'
    and v.status = 'active'
    and v.seq > current_video.seq
    and public.is_active_user()
  order by v.seq
  limit 1
$$;
revoke all on function public.next_assigned_video_after(uuid) from public, anon;
grant execute on function public.next_assigned_video_after(uuid) to authenticated;
