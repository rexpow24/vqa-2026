-- Reference clips opened from the labeling page (features/c-reference-hints):
-- one row per open, so the admin can see which annotators open them least.
create table public.reference_views (
  id bigint generated always as identity primary key,
  annotator_id uuid not null references public.user_profiles(id) on delete cascade,
  video_id uuid references public.videos(id) on delete set null,
  qgroup text not null check (qgroup in ('C')),
  reference text not null check (reference ~ '^K\d\d(-K\d\d)?$'),
  chosen text check (chosen ~ '^K\d\d$'),
  opened_at timestamptz not null default now()
);
create index reference_views_annotator on public.reference_views (annotator_id, opened_at);

alter table public.reference_views enable row level security;
create policy reference_views_insert on public.reference_views for insert to authenticated
with check (public.is_active_user() and annotator_id = auth.uid());
create policy reference_views_read on public.reference_views for select to authenticated
using (public.is_active_user() and (public.is_admin() or annotator_id = auth.uid()));
grant select, insert on public.reference_views to authenticated;

-- Per annotator: reference clips opened next to the C answers saved, admins only.
create or replace function public.reference_view_stats()
returns table (annotator_id uuid, name text, email text, label text, opens bigint, videos_opened bigint,
  c_answers bigint, last_opened_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select p.id, p.name, p.email, p.label,
    (select count(*) from public.reference_views r where r.annotator_id = p.id),
    (select count(distinct r.video_id) from public.reference_views r where r.annotator_id = p.id),
    (select count(*) from public.qa_annotations q join public.video_drafts d on d.id = q.draft_id
      where q.annotator_id = p.id and d.qgroup = 'C' and q.verdict = 'SLOTS'),
    (select max(r.opened_at) from public.reference_views r where r.annotator_id = p.id)
  from public.user_profiles p
  where p.role = 'annotator'
  order by 5 asc, p.name;
end;
$$;
revoke all on function public.reference_view_stats() from public, anon;
grant execute on function public.reference_view_stats() to authenticated;
