-- Difficulty is derived, not chosen: how many of the nine Gemini drafts the
-- annotator rejected. DISAGREE and NOT_ANSWERABLE both count, since a draft
-- that answers a question the video cannot support is itself wrong.
--
-- Computed at read time rather than stored, so the thresholds can change
-- after EDA without touching a row. A video labelled by two annotators takes
-- the mean of their counts, which keeps it on the same scale as the videos
-- only one person labels.

-- The manual choice is no longer asked for; rows chosen by hand stay as they are.
alter table public.video_labels alter column difficulty drop not null;

-- Provisional thresholds (0-2 easy, 3-5 medium, 6-9 high) until EDA sets real ones.
create or replace function public.difficulty_level(model_errors numeric)
returns text language sql immutable set search_path = '' as $$
  select case when model_errors is null then null
              when model_errors < 3 then 'easy'
              when model_errors < 6 then 'medium'
              else 'high' end;
$$;

-- One row per completed assignment. security_invoker keeps the underlying RLS:
-- an annotator sees their own rows, an admin sees all of them.
create or replace view public.annotator_difficulty with (security_invoker = true) as
  select a.video_id, a.annotator_id,
         count(*) filter (where q.verdict = 'DISAGREE') as disagree_count,
         count(*) filter (where q.verdict = 'NOT_ANSWERABLE') as not_answerable_count,
         count(*) filter (where q.verdict <> 'AGREE') as model_errors,
         public.difficulty_level(count(*) filter (where q.verdict <> 'AGREE')) as difficulty
    from public.video_assignments a
    join public.video_drafts d on d.video_id = a.video_id
    join public.qa_annotations q on q.draft_id = d.id and q.annotator_id = a.annotator_id
   where a.status = 'completed'
   group by a.video_id, a.annotator_id;

create or replace view public.video_difficulty with (security_invoker = true) as
  select video_id, count(*) as annotators,
         avg(model_errors)::numeric(4,2) as model_errors,
         public.difficulty_level(avg(model_errors)) as difficulty
    from public.annotator_difficulty
   group by video_id;

revoke all on public.annotator_difficulty, public.video_difficulty from public, anon;
grant select on public.annotator_difficulty, public.video_difficulty to authenticated;
revoke all on function public.difficulty_level(numeric) from public, anon;
grant execute on function public.difficulty_level(numeric) to authenticated;

-- Same as before, with the message no longer asking for a difficulty.
create or replace function public.validate_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare draft_count integer;
declare answer_count integer;
begin
  if tg_op = 'UPDATE' and (new.video_id <> old.video_id or new.annotator_id <> old.annotator_id) then
    raise exception 'Assignment ownership cannot be changed';
  end if;
  if new.status = 'completed' then
    if not exists (select 1 from public.video_labels l
                   where l.video_id = new.video_id and l.annotator_id = new.annotator_id) then
      raise exception 'Choose the event label before completing';
    end if;
    select count(*) into draft_count from public.video_drafts where video_id = new.video_id;
    select count(*) into answer_count from public.qa_annotations a
      join public.video_drafts d on d.id = a.draft_id
      where d.video_id = new.video_id and a.annotator_id = new.annotator_id;
    if draft_count <> 9 or answer_count <> 9 then
      raise exception 'Review all nine questions before completing';
    end if;
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;
