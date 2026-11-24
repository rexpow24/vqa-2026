-- The admin reference table also shows the group E training (features/c-training-gate, E-v1).
drop function public.reference_view_stats();
create function public.reference_view_stats()
returns table (annotator_id uuid, name text, email text, label text, opens bigint, videos_opened bigint,
  c_answers bigint, last_opened_at timestamptz, training_c_completed_at timestamptz, training_e_completed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select p.id, p.name, p.email, p.label,
    (select count(*) from public.reference_views r where r.annotator_id = p.id),
    (select count(distinct r.video_id) from public.reference_views r where r.annotator_id = p.id),
    (select count(*) from public.qa_annotations q join public.video_drafts d on d.id = q.draft_id
      where q.annotator_id = p.id and d.qgroup = 'C' and q.verdict = 'SLOTS'),
    (select max(r.opened_at) from public.reference_views r where r.annotator_id = p.id),
    (select t.completed_at from public.training_completions t where t.annotator_id = p.id and t.training = 'C-v1'),
    (select t.completed_at from public.training_completions t where t.annotator_id = p.id and t.training = 'E-v1')
  from public.user_profiles p
  where p.role = 'annotator'
  order by 5 asc, p.name;
end;
$$;
revoke all on function public.reference_view_stats() from public, anon;
grant execute on function public.reference_view_stats() to authenticated;
