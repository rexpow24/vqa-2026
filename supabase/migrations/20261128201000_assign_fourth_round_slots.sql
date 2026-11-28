-- Assign the new fourth round in slot format without changing older work.
create function public.assign_fourth_agreement_round(annotators uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare inserted integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if coalesce(cardinality(annotators), 0) = 0 then raise exception 'Choose at least one annotator'; end if;
  if (select count(*) from public.videos where agreement_sample and status = 'active' and seq between 61 and 160) <> 100 then
    raise exception 'Prepare the 100-video fourth round first';
  end if;
  if exists (select 1 from unnest(annotators) u(id)
    where not exists (select 1 from public.user_profiles p where p.id = u.id and p.enabled and p.role = 'annotator')) then
    raise exception 'Choose enabled annotators only';
  end if;
  insert into public.video_assignments (video_id, annotator_id, status, batch, answer_format)
  select v.id, u.id, 'pending', 'agreement', 'slots'
  from public.videos v cross join (select distinct id from unnest(annotators) a(id)) u
  where v.agreement_sample and v.status = 'active' and v.seq between 61 and 160
    and not exists (select 1 from public.video_assignments a where a.video_id = v.id and a.annotator_id = u.id);
  get diagnostics inserted = row_count;
  return jsonb_build_object('assigned', inserted, 'videos', 100);
end;
$$;
revoke all on function public.assign_fourth_agreement_round(uuid[]) from public, anon;
grant execute on function public.assign_fourth_agreement_round(uuid[]) to authenticated;
