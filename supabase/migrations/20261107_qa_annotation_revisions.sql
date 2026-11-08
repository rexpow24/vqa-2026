-- qa_annotations keeps one row per (draft, annotator) and every save overwrites
-- it, so a changed mind left no trace. This table keeps every version: an
-- append-only log written only by a trigger, never by the API or the client.

create table if not exists public.qa_annotation_revisions (
  id bigint generated always as identity primary key,
  draft_id uuid not null references public.video_drafts(id) on delete cascade,
  annotator_id uuid not null references public.user_profiles(id) on delete cascade,
  op text not null check (op in ('INSERT','UPDATE','DELETE')),
  verdict text not null,
  reason_code text,
  reason_note text,
  edited_answer text,
  human_keyframes_s numeric(9,3)[] not null,
  revised_at timestamptz not null default now()
);

create index if not exists qa_annotation_revisions_answer_idx
  on public.qa_annotation_revisions(draft_id, annotator_id, id);
create index if not exists qa_annotation_revisions_annotator_idx
  on public.qa_annotation_revisions(annotator_id);

create or replace function public.record_qa_annotation_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    -- A cascade from a deleted video, draft or user removes the history too;
    -- logging the delete would point at a row that is already gone.
    if not exists (select 1 from public.video_drafts where id = old.draft_id)
       or not exists (select 1 from public.user_profiles where id = old.annotator_id) then
      return old;
    end if;
    insert into public.qa_annotation_revisions
      (draft_id, annotator_id, op, verdict, reason_code, reason_note, edited_answer, human_keyframes_s)
    values (old.draft_id, old.annotator_id, 'DELETE', old.verdict, old.reason_code, old.reason_note,
            old.edited_answer, old.human_keyframes_s);
    return old;
  end if;
  -- Auto-save re-sends the same answer; annotated_at changes on every save, so
  -- compare the content, not the row.
  if tg_op = 'UPDATE' and (old.verdict, old.reason_code, old.reason_note, old.edited_answer, old.human_keyframes_s)
     is not distinct from (new.verdict, new.reason_code, new.reason_note, new.edited_answer, new.human_keyframes_s) then
    return new;
  end if;
  insert into public.qa_annotation_revisions
    (draft_id, annotator_id, op, verdict, reason_code, reason_note, edited_answer, human_keyframes_s, revised_at)
  values (new.draft_id, new.annotator_id, tg_op, new.verdict, new.reason_code, new.reason_note,
          new.edited_answer, new.human_keyframes_s, new.annotated_at);
  return new;
end;
$$;

drop trigger if exists record_qa_annotation_revision_trigger on public.qa_annotations;
create trigger record_qa_annotation_revision_trigger after insert or update or delete on public.qa_annotations
for each row execute function public.record_qa_annotation_revision();

-- Answers saved before this migration get their current version as revision 1,
-- so every answer has a history; what they were before that is not recoverable.
insert into public.qa_annotation_revisions
  (draft_id, annotator_id, op, verdict, reason_code, reason_note, edited_answer, human_keyframes_s, revised_at)
select a.draft_id, a.annotator_id, 'INSERT', a.verdict, a.reason_code, a.reason_note, a.edited_answer,
       a.human_keyframes_s, a.annotated_at
from public.qa_annotations a
where not exists (select 1 from public.qa_annotation_revisions r
                  where r.draft_id = a.draft_id and r.annotator_id = a.annotator_id);

alter table public.qa_annotation_revisions enable row level security;
revoke all on public.qa_annotation_revisions from anon, authenticated;
grant select on public.qa_annotation_revisions to authenticated;
drop policy if exists qa_annotation_revisions_read on public.qa_annotation_revisions;
create policy qa_annotation_revisions_read on public.qa_annotation_revisions for select to authenticated
using (public.is_active_user() and (annotator_id = (select auth.uid()) or public.is_admin()));
