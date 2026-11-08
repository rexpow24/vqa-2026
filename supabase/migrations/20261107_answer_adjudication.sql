-- Answer adjudication. Annotators' own rows stay untouched (agreement and
-- derived difficulty read them); the final answer per question is derived from
-- them, and a separate table stores the decisions taken where they disagree.
-- Feature folder: features/answer-adjudication/.

-- 1. Verdict and answer must agree --------------------------------------------
-- AGREE means the draft is the answer, NOT_ANSWERABLE means "Không trả lời
-- được", so only DISAGREE may carry an edited answer, and it must carry one.
-- Before this, the UI let annotators rewrite the answer under AGREE.

create or replace function public.normalize_answer(value text)
returns text language sql immutable set search_path = '' as $$
  select nullif(regexp_replace(trim(coalesce(value, '')), '\s+', ' ', 'g'), '')
$$;

create or replace function public.effective_answer(verdict text, edited_answer text, draft_answer text)
returns text language sql immutable set search_path = '' as $$
  select case verdict
    when 'AGREE' then draft_answer
    when 'DISAGREE' then public.normalize_answer(edited_answer)
    else 'Không trả lời được' end
$$;

-- 2. Decisions ----------------------------------------------------------------
-- annotator_ids are the annotators whose disagreement was decided: only they
-- are locked and only they may read it, so a later annotator is neither blocked
-- nor anchored by it.

create table if not exists public.answer_adjudications (
  draft_id uuid primary key references public.video_drafts(id) on delete cascade,
  annotator_ids uuid[] not null,
  final_verdict text not null check (final_verdict in ('AGREE','NOT_ANSWERABLE','DISAGREE')),
  final_answer text not null,
  final_keyframes_s numeric(9,3)[] not null default '{}',
  llm_suggestion text,
  followed_llm boolean not null,
  decided_by uuid references public.user_profiles(id) on delete set null,
  decided_at timestamptz not null default now()
);

create table if not exists public.label_adjudications (
  video_id uuid primary key references public.videos(id) on delete cascade,
  annotator_ids uuid[] not null,
  event_label text not null check (event_label in ('accident','near-miss')),
  llm_suggestion text,
  followed_llm boolean not null,
  decided_by uuid references public.user_profiles(id) on delete set null,
  decided_at timestamptz not null default now()
);

alter table public.answer_adjudications enable row level security;
alter table public.label_adjudications enable row level security;
revoke all on public.answer_adjudications, public.label_adjudications from anon, authenticated;
grant select on public.answer_adjudications, public.label_adjudications to authenticated;
drop policy if exists answer_adjudications_read on public.answer_adjudications;
create policy answer_adjudications_read on public.answer_adjudications for select to authenticated
using (public.is_active_user() and (public.is_admin() or (select auth.uid()) = any(annotator_ids)));
drop policy if exists label_adjudications_read on public.label_adjudications;
create policy label_adjudications_read on public.label_adjudications for select to authenticated
using (public.is_active_user() and (public.is_admin() or (select auth.uid()) = any(annotator_ids)));

-- 3. Triggers -------------------------------------------------------------------

create or replace function public.validate_qa_annotation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare video_duration numeric;
declare draft_group text;
declare draft_answer text;
declare mark numeric;
begin
  if tg_op = 'UPDATE' and (new.draft_id <> old.draft_id or new.annotator_id <> old.annotator_id) then
    raise exception 'QA annotation ownership cannot be changed';
  end if;
  if tg_op = 'UPDATE' and exists (select 1 from public.answer_adjudications j
                                  where j.draft_id = old.draft_id and old.annotator_id = any(j.annotator_ids)) then
    raise exception 'This answer was adjudicated and is locked';
  end if;
  select v.duration_s, d.qgroup, d.answer into video_duration, draft_group, draft_answer
  from public.video_drafts d join public.videos v on v.id = d.video_id
  where d.id = new.draft_id and v.status = 'active';
  if video_duration is null then raise exception 'Active draft video not found'; end if;
  -- Evidence frames only for C, V, Attr (20261105_keyframe_groups.sql).
  if draft_group not in ('C','V','Attr') then
    new.human_keyframes_s := '{}';
  elsif cardinality(new.human_keyframes_s) not between 1 and 3 then
    raise exception 'Choose 1 to 3 evidence frames';
  end if;
  foreach mark in array new.human_keyframes_s loop
    if mark = 'NaN'::numeric or mark < 0 or mark > video_duration then
      raise exception 'Evidence frame is outside the video';
    end if;
  end loop;
  if new.verdict = 'DISAGREE' and (
    new.reason_code not in ('thiếu thực thể','sai thực thể','sai nhân quả',
      'sai mốc thời gian','bịa chi tiết','sai diễn đạt','khác') or new.reason_code is null
  ) then raise exception 'Disagreement needs a reason'; end if;
  if new.verdict = 'DISAGREE' and new.reason_code = 'khác' and length(trim(coalesce(new.reason_note,''))) = 0 then
    raise exception 'Other reason needs a note';
  end if;
  if new.verdict = 'DISAGREE' then
    new.edited_answer := nullif(trim(new.edited_answer), '');
    if public.normalize_answer(new.edited_answer) is null
       or public.normalize_answer(new.edited_answer) = public.normalize_answer(draft_answer) then
      raise exception 'A disagreement needs the corrected answer';
    end if;
  elsif public.normalize_answer(new.edited_answer) is null
        or public.normalize_answer(new.edited_answer) = public.normalize_answer(draft_answer) then
    new.edited_answer := null;
  else
    raise exception 'Only a disagreement can carry an edited answer';
  end if;
  new.annotated_at := now();
  return new;
end;
$$;

create or replace function public.validate_video_label()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.video_id <> old.video_id or new.annotator_id <> old.annotator_id) then
    raise exception 'Video label ownership cannot be changed';
  end if;
  if tg_op = 'UPDATE' and exists (select 1 from public.label_adjudications j
                                  where j.video_id = old.video_id and old.annotator_id = any(j.annotator_ids)) then
    raise exception 'This event label was adjudicated and is locked';
  end if;
  new.labeled_at := now();
  return new;
end;
$$;

-- A cascade from a deleted draft, video or user must still go through, so the
-- lock applies only while the parent rows exist.
create or replace function public.guard_adjudicated_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.user_profiles where id = old.annotator_id) then return old; end if;
  if tg_table_name = 'qa_annotations' then
    if exists (select 1 from public.video_drafts where id = old.draft_id)
       and exists (select 1 from public.answer_adjudications j
                   where j.draft_id = old.draft_id and old.annotator_id = any(j.annotator_ids)) then
      raise exception 'This answer was adjudicated and is locked';
    end if;
  elsif exists (select 1 from public.videos where id = old.video_id)
        and exists (select 1 from public.label_adjudications j
                    where j.video_id = old.video_id and old.annotator_id = any(j.annotator_ids)) then
    raise exception 'This event label was adjudicated and is locked';
  end if;
  return old;
end;
$$;

drop trigger if exists guard_adjudicated_answer_delete on public.qa_annotations;
create trigger guard_adjudicated_answer_delete before delete on public.qa_annotations
for each row execute function public.guard_adjudicated_delete();
drop trigger if exists guard_adjudicated_label_delete on public.video_labels;
create trigger guard_adjudicated_label_delete before delete on public.video_labels
for each row execute function public.guard_adjudicated_delete();

-- Completion also refuses answers saved in the old inconsistent shape.
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
    if exists (select 1 from public.qa_annotations a join public.video_drafts d on d.id = a.draft_id
               where d.video_id = new.video_id and a.annotator_id = new.annotator_id
                 and (a.verdict = 'DISAGREE') = (a.edited_answer is null)) then
      raise exception 'An edited answer needs the verdict Sai, and Sai needs an edited answer';
    end if;
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

-- 4. Final answers ------------------------------------------------------------------
-- Derived at read time from the annotators who completed the video. Keyframes
-- never cause a conflict; the final ones are the union. fingerprint changes
-- whenever any involved row changes or another annotator completes, which is
-- how an uploaded decision is recognised as stale.

create or replace view public.final_answers with (security_invoker = true) as
with done as (
  select video_id, annotator_id from public.video_assignments where status = 'completed'
), answers as (
  select d.id as draft_id, d.video_id, d.qgroup, q.annotator_id, q.verdict, q.reason_code, q.reason_note,
         q.edited_answer, q.human_keyframes_s,
         public.effective_answer(q.verdict, q.edited_answer, d.answer) as effective
  from public.video_drafts d
  join done on done.video_id = d.video_id
  join public.qa_annotations q on q.draft_id = d.id and q.annotator_id = done.annotator_id
), grouped as (
  select draft_id, video_id, qgroup,
         count(*)::int as annotators,
         array_agg(annotator_id order by annotator_id) as annotator_ids,
         count(distinct verdict) as verdicts,
         count(distinct public.normalize_answer(effective)) as answers,
         min(verdict) as some_verdict,
         (array_agg(effective order by annotator_id))[1] as some_answer,
         md5(string_agg(format('%s|%s|%s|%s|%s|%s', annotator_id, verdict, reason_code, reason_note,
                               edited_answer, human_keyframes_s), '#' order by annotator_id)) as fingerprint
  from answers group by draft_id, video_id, qgroup
), frames as (
  select draft_id, array_agg(distinct mark order by mark) as marks
  from answers, unnest(human_keyframes_s) as mark group by draft_id
)
select g.draft_id, g.video_id, g.qgroup, g.annotators, g.annotator_ids,
       case when j.draft_id is not null then 'adjudicated'
            when g.annotators = 1 then 'single'
            when g.verdicts = 1 and g.answers = 1 then 'consensus'
            else 'conflict' end as source,
       case when j.draft_id is not null then j.final_verdict
            when g.verdicts = 1 and g.answers = 1 then g.some_verdict end as final_verdict,
       case when j.draft_id is not null then j.final_answer
            when g.verdicts = 1 and g.answers = 1 then g.some_answer end as final_answer,
       case when j.draft_id is not null then j.final_keyframes_s
            when g.verdicts = 1 and g.answers = 1 then coalesce(f.marks, '{}') end as final_keyframes_s,
       g.fingerprint
from grouped g
left join frames f on f.draft_id = g.draft_id
left join public.answer_adjudications j on j.draft_id = g.draft_id;

create or replace view public.final_video_labels with (security_invoker = true) as
with labels as (
  select l.video_id, l.annotator_id, l.event_label
  from public.video_labels l
  join public.video_assignments a on a.video_id = l.video_id and a.annotator_id = l.annotator_id
  where a.status = 'completed'
), grouped as (
  select video_id, count(*)::int as annotators,
         array_agg(annotator_id order by annotator_id) as annotator_ids,
         count(distinct event_label) as labels, min(event_label) as some_label,
         md5(string_agg(format('%s|%s', annotator_id, event_label), '#' order by annotator_id)) as fingerprint
  from labels group by video_id
)
select g.video_id, g.annotators, g.annotator_ids,
       case when j.video_id is not null then 'adjudicated'
            when g.annotators = 1 then 'single'
            when g.labels = 1 then 'consensus'
            else 'conflict' end as source,
       case when j.video_id is not null then j.event_label
            when g.labels = 1 then g.some_label end as event_label,
       g.fingerprint
from grouped g
left join public.label_adjudications j on j.video_id = g.video_id;

revoke all on public.final_answers, public.final_video_labels from anon;
grant select on public.final_answers, public.final_video_labels to authenticated;

-- 5. Import ---------------------------------------------------------------------------
-- One decision per row; each row reports saved / stale / not_conflict / invalid
-- and a bad row never stops the others. Re-uploading a decision replaces it.

create or replace function public.import_adjudications(rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item jsonb;
declare position integer := 0;
declare results jsonb := '[]'::jsonb;
declare answer_row public.final_answers%rowtype;
declare label_row public.final_video_labels%rowtype;
declare draft_answer text;
declare draft_group text;
declare verdict text;
declare answer text;
declare marks numeric[];
declare followed boolean;
declare outcome text;
declare reason text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if jsonb_typeof(rows) <> 'array' then raise exception 'rows must be an array'; end if;
  for item in select value from jsonb_array_elements(rows) loop
    outcome := 'invalid'; reason := null;
    begin
      followed := (item->>'followed_llm')::boolean;
      if followed is null then
        reason := 'followed_llm must be yes or no';
      elsif item->>'kind' = 'answer' then
        select * into answer_row from public.final_answers where draft_id = (item->>'draft_id')::uuid;
        if not found then reason := 'No completed answers for this question';
        elsif answer_row.source not in ('conflict','adjudicated') then outcome := 'not_conflict';
        elsif answer_row.fingerprint is distinct from item->>'fingerprint' then
          outcome := 'stale'; reason := 'Answers changed after the export; download the CSV again';
        else
          select d.answer, d.qgroup into draft_answer, draft_group from public.video_drafts d where d.id = answer_row.draft_id;
          verdict := item->>'final_verdict';
          answer := public.normalize_answer(item->>'final_answer');
          if verdict is null or verdict not in ('AGREE','NOT_ANSWERABLE','DISAGREE') then
            reason := 'final_verdict must be AGREE, DISAGREE or NOT_ANSWERABLE';
          elsif verdict = 'DISAGREE' and (answer is null or answer = public.normalize_answer(draft_answer)) then
            reason := 'A DISAGREE decision needs the corrected answer';
          else
            answer := case verdict when 'AGREE' then draft_answer
                                   when 'NOT_ANSWERABLE' then 'Không trả lời được' else answer end;
            select coalesce(array_agg(value::numeric order by value::numeric), '{}') into marks
            from jsonb_array_elements_text(coalesce(item->'final_keyframes_s', '[]'::jsonb));
            if draft_group not in ('C','V','Attr') then
              marks := '{}';
            elsif cardinality(marks) = 0 then
              select coalesce(array_agg(distinct mark order by mark), '{}') into marks
              from public.qa_annotations q, unnest(q.human_keyframes_s) as mark
              where q.draft_id = answer_row.draft_id and q.annotator_id = any(answer_row.annotator_ids);
            end if;
            insert into public.answer_adjudications as j (draft_id, annotator_ids, final_verdict, final_answer,
              final_keyframes_s, llm_suggestion, followed_llm, decided_by, decided_at)
            values (answer_row.draft_id, answer_row.annotator_ids, verdict, answer, marks,
              public.normalize_answer(item->>'llm_suggestion'), followed, (select auth.uid()), now())
            on conflict (draft_id) do update set annotator_ids = excluded.annotator_ids,
              final_verdict = excluded.final_verdict, final_answer = excluded.final_answer,
              final_keyframes_s = excluded.final_keyframes_s, llm_suggestion = excluded.llm_suggestion,
              followed_llm = excluded.followed_llm, decided_by = excluded.decided_by, decided_at = excluded.decided_at;
            outcome := 'saved';
          end if;
        end if;
      elsif item->>'kind' = 'event' then
        select * into label_row from public.final_video_labels where video_id = (item->>'video_id')::uuid;
        if not found then reason := 'No completed labels for this video';
        elsif label_row.source not in ('conflict','adjudicated') then outcome := 'not_conflict';
        elsif label_row.fingerprint is distinct from item->>'fingerprint' then
          outcome := 'stale'; reason := 'Labels changed after the export; download the CSV again';
        elsif coalesce(item->>'final_event_label', '') not in ('accident','near-miss') then
          reason := 'final_event_label must be accident or near-miss';
        else
          insert into public.label_adjudications (video_id, annotator_ids, event_label, llm_suggestion,
            followed_llm, decided_by, decided_at)
          values (label_row.video_id, label_row.annotator_ids, item->>'final_event_label',
            public.normalize_answer(item->>'llm_suggestion'), followed, (select auth.uid()), now())
          on conflict (video_id) do update set annotator_ids = excluded.annotator_ids,
            event_label = excluded.event_label, llm_suggestion = excluded.llm_suggestion,
            followed_llm = excluded.followed_llm, decided_by = excluded.decided_by, decided_at = excluded.decided_at;
          outcome := 'saved';
        end if;
      else
        reason := 'kind must be answer or event';
      end if;
    exception when others then
      outcome := 'invalid'; reason := sqlerrm;
    end;
    results := results || jsonb_build_object('index', position, 'status', outcome, 'reason', reason);
    position := position + 1;
  end loop;
  return results;
end;
$$;

revoke all on function public.import_adjudications(jsonb) from public, anon;
grant execute on function public.import_adjudications(jsonb) to authenticated;

-- 6. Export and summary for the admin page ----------------------------------------------
-- One call each instead of joining thousands of ids through the REST API.
-- Both return nothing to a non-admin; the routes check the role as well.

create or replace function public.adjudication_export()
returns table (kind text, video_id uuid, filename text, draft_id uuid, qgroup text, question text,
               draft_answer text, fingerprint text, annotators jsonb)
language sql stable security definer set search_path = '' as $$
  select 'answer', f.video_id, v.filename, f.draft_id, f.qgroup, d.question, d.answer, f.fingerprint,
         (select jsonb_agg(jsonb_build_object('name', p.name, 'verdict', q.verdict, 'reason', q.reason_code,
                   'note', q.reason_note, 'answer', public.effective_answer(q.verdict, q.edited_answer, d.answer),
                   'keyframes', q.human_keyframes_s) order by q.annotator_id)
          from public.qa_annotations q join public.user_profiles p on p.id = q.annotator_id
          where q.draft_id = f.draft_id and q.annotator_id = any(f.annotator_ids))
  from public.final_answers f
  join public.video_drafts d on d.id = f.draft_id
  join public.videos v on v.id = f.video_id
  where f.source = 'conflict' and public.is_admin()
  union all
  select 'event', l.video_id, v.filename, null, null, null, null, l.fingerprint,
         (select jsonb_agg(jsonb_build_object('name', p.name, 'answer', x.event_label) order by x.annotator_id)
          from public.video_labels x join public.user_profiles p on p.id = x.annotator_id
          where x.video_id = l.video_id and x.annotator_id = any(l.annotator_ids))
  from public.final_video_labels l
  join public.videos v on v.id = l.video_id
  where l.source = 'conflict' and public.is_admin()
  order by 3, 1, 5
$$;

create or replace function public.adjudication_summary()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when public.is_admin() then jsonb_build_object(
    'answers', (select coalesce(jsonb_object_agg(source, n), '{}'::jsonb)
                from (select source, count(*) as n from public.final_answers group by source) s),
    'labels', (select coalesce(jsonb_object_agg(source, n), '{}'::jsonb)
               from (select source, count(*) as n from public.final_video_labels group by source) s)) end
$$;

revoke all on function public.adjudication_export(), public.adjudication_summary() from public, anon;
grant execute on function public.adjudication_export(), public.adjudication_summary() to authenticated;
