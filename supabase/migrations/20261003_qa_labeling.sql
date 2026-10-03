-- Hosted Labeling uses the same nine VLM draft groups as the local annotator.
-- Existing timestamp annotations are retained for compatibility but no longer
-- drive the hosted labeling workflow or completion statistics.

create table if not exists public.video_drafts (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  qgroup text not null check (qgroup in ('S','E','N','C','V','O','R','Attr','Prev')),
  group_name text not null,
  question text not null,
  answer text not null,
  source_sha256 text not null,
  source_kind text not null default 'vlm' check (source_kind in ('vlm','admin_csv')),
  prompt_version integer not null,
  predicted_keyframes_s numeric(9,3)[] not null default '{}',
  frame_times_s numeric(9,3)[] not null default '{}',
  truncated boolean not null default false,
  completion_tokens integer,
  latency_ms integer,
  created_at timestamptz not null default now(),
  unique (video_id, qgroup)
);

alter table public.video_drafts add column if not exists source_kind text not null default 'vlm'
  check (source_kind in ('vlm','admin_csv'));

create table if not exists public.video_reference_labels (
  video_id uuid primary key references public.videos(id) on delete cascade,
  difficulty text not null check (difficulty in ('easy','medium','high')),
  event_label text not null check (event_label in ('accident','near-miss')),
  uploaded_at timestamptz not null default now()
);

create table if not exists public.video_labels (
  video_id uuid not null references public.videos(id) on delete cascade,
  annotator_id uuid not null references public.user_profiles(id) on delete cascade,
  difficulty text not null check (difficulty in ('easy','medium','high')),
  event_label text not null check (event_label in ('accident','near-miss')),
  labeled_at timestamptz not null default now(),
  primary key (video_id, annotator_id)
);

create table if not exists public.qa_annotations (
  draft_id uuid not null references public.video_drafts(id) on delete cascade,
  annotator_id uuid not null references public.user_profiles(id) on delete cascade,
  verdict text not null check (verdict in ('AGREE','NOT_ANSWERABLE','DISAGREE')),
  reason_code text,
  reason_note text,
  edited_answer text,
  human_keyframes_s numeric(9,3)[] not null,
  annotated_at timestamptz not null default now(),
  primary key (draft_id, annotator_id)
);

create index if not exists video_drafts_video_idx on public.video_drafts(video_id);
create index if not exists qa_annotations_annotator_idx on public.qa_annotations(annotator_id, annotated_at desc);
create index if not exists video_labels_annotator_idx on public.video_labels(annotator_id);

create or replace function public.validate_qa_annotation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare video_duration numeric;
declare mark numeric;
begin
  if tg_op = 'UPDATE' and (new.draft_id <> old.draft_id or new.annotator_id <> old.annotator_id) then
    raise exception 'QA annotation ownership cannot be changed';
  end if;
  select v.duration_s into video_duration
  from public.video_drafts d join public.videos v on v.id = d.video_id
  where d.id = new.draft_id and v.status = 'active';
  if video_duration is null then raise exception 'Active draft video not found'; end if;
  if cardinality(new.human_keyframes_s) not between 1 and 3 then
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
  new.annotated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_qa_annotation_trigger on public.qa_annotations;
create trigger validate_qa_annotation_trigger before insert or update on public.qa_annotations
for each row execute function public.validate_qa_annotation();

create or replace function public.validate_video_label()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (new.video_id <> old.video_id or new.annotator_id <> old.annotator_id) then
    raise exception 'Video label ownership cannot be changed';
  end if;
  new.labeled_at := now();
  return new;
end;
$$;

drop trigger if exists validate_video_label_trigger on public.video_labels;
create trigger validate_video_label_trigger before insert or update on public.video_labels
for each row execute function public.validate_video_label();

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
      raise exception 'Choose difficulty and event label before completing';
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

create or replace function public.reopen_qa_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_video_id uuid;
begin
  if tg_table_name = 'qa_annotations' then
    select video_id into target_video_id from public.video_drafts where id = old.draft_id;
  else
    target_video_id := old.video_id;
  end if;
  update public.video_assignments set status = 'in_progress', completed_at = null
  where video_id = target_video_id and annotator_id = old.annotator_id and status = 'completed';
  return old;
end;
$$;

drop trigger if exists reopen_qa_assignment_trigger on public.qa_annotations;
create trigger reopen_qa_assignment_trigger after delete on public.qa_annotations
for each row execute function public.reopen_qa_assignment();
drop trigger if exists reopen_label_assignment_trigger on public.video_labels;
create trigger reopen_label_assignment_trigger after delete on public.video_labels
for each row execute function public.reopen_qa_assignment();

alter table public.video_drafts enable row level security;
alter table public.video_labels enable row level security;
alter table public.qa_annotations enable row level security;
alter table public.video_reference_labels enable row level security;
revoke all on public.video_drafts, public.video_labels, public.qa_annotations, public.video_reference_labels from anon;
grant select, insert, update, delete on public.video_drafts, public.video_labels, public.qa_annotations, public.video_reference_labels to authenticated;

drop policy if exists video_drafts_read on public.video_drafts;
drop policy if exists video_drafts_admin_write on public.video_drafts;
drop policy if exists video_labels_read on public.video_labels;
drop policy if exists video_labels_insert on public.video_labels;
drop policy if exists video_labels_update on public.video_labels;
drop policy if exists video_labels_delete on public.video_labels;
drop policy if exists qa_annotations_read on public.qa_annotations;
drop policy if exists qa_annotations_insert on public.qa_annotations;
drop policy if exists qa_annotations_update on public.qa_annotations;
drop policy if exists qa_annotations_delete on public.qa_annotations;
drop policy if exists video_reference_admin on public.video_reference_labels;

create policy video_drafts_read on public.video_drafts for select to authenticated
using (public.is_active_user() and exists (
  select 1 from public.videos v where v.id = video_id and v.status = 'active'
    and (public.is_admin() or v.available or public.has_assignment(v.id))
));
create policy video_drafts_admin_write on public.video_drafts for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy video_labels_read on public.video_labels for select to authenticated
using (public.is_active_user() and (annotator_id = (select auth.uid()) or public.is_admin()));
create policy video_labels_insert on public.video_labels for insert to authenticated
with check (public.is_active_user() and annotator_id = (select auth.uid()) and public.has_assignment(video_id));
create policy video_labels_update on public.video_labels for update to authenticated
using (public.is_active_user() and annotator_id = (select auth.uid()) and public.has_assignment(video_id))
with check (public.is_active_user() and annotator_id = (select auth.uid()) and public.has_assignment(video_id));
create policy video_labels_delete on public.video_labels for delete to authenticated
using (public.is_active_user() and annotator_id = (select auth.uid()));
create policy qa_annotations_read on public.qa_annotations for select to authenticated
using (public.is_active_user() and (annotator_id = (select auth.uid()) or public.is_admin()));
create policy qa_annotations_insert on public.qa_annotations for insert to authenticated
with check (public.is_active_user() and annotator_id = (select auth.uid()) and exists (
  select 1 from public.video_drafts d where d.id = draft_id and public.has_assignment(d.video_id)
));
create policy qa_annotations_update on public.qa_annotations for update to authenticated
using (public.is_active_user() and annotator_id = (select auth.uid()) and exists (
  select 1 from public.video_drafts d where d.id = draft_id and public.has_assignment(d.video_id)
))
with check (public.is_active_user() and annotator_id = (select auth.uid()) and exists (
  select 1 from public.video_drafts d where d.id = draft_id and public.has_assignment(d.video_id)
));
create policy qa_annotations_delete on public.qa_annotations for delete to authenticated
using (public.is_active_user() and annotator_id = (select auth.uid()));
create policy video_reference_admin on public.video_reference_labels for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create or replace function public.import_video_drafts(
  target_video_id uuid, rows jsonb, csv_sha256 text,
  reference_difficulty text default null, reference_event_label text default null
)
returns integer language plpgsql security definer set search_path = '' as $$
declare item jsonb;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) <> 9 or
     (select count(distinct value->>'qgroup') from jsonb_array_elements(rows)) <> 9 then
    raise exception 'CSV must contain exactly nine distinct question groups';
  end if;
  if csv_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'Invalid CSV fingerprint'; end if;
  if (reference_difficulty is null) <> (reference_event_label is null) then
    raise exception 'Reference labels must be provided together';
  end if;
  if reference_difficulty is not null and (
    reference_difficulty not in ('easy','medium','high') or
    reference_event_label not in ('accident','near-miss')
  ) then raise exception 'Invalid reference labels'; end if;
  perform 1 from public.videos where id = target_video_id and status = 'active' for update;
  if not found then raise exception 'Active video not found'; end if;
  if exists (select 1 from public.qa_annotations a
             join public.video_drafts d on d.id = a.draft_id
             where d.video_id = target_video_id) then
    raise exception 'Cannot replace drafts after labeling has started';
  end if;
  for item in select value from jsonb_array_elements(rows) loop
    if item->>'qgroup' not in ('S','E','N','C','V','O','R','Attr','Prev') or
       length(trim(coalesce(item->>'question',''))) = 0 or
       length(trim(coalesce(item->>'answer',''))) = 0 then
      raise exception 'Every group needs a question and an answer';
    end if;
    insert into public.video_drafts
      (video_id,qgroup,group_name,question,answer,source_sha256,source_kind,prompt_version)
    values
      (target_video_id,item->>'qgroup',item->>'group_name',item->>'question',item->>'answer',
       csv_sha256,'admin_csv',0)
    on conflict (video_id,qgroup) do update set
      group_name = excluded.group_name, question = excluded.question,
      answer = excluded.answer, source_sha256 = excluded.source_sha256,
      source_kind = excluded.source_kind, prompt_version = 0,
      predicted_keyframes_s = '{}', frame_times_s = '{}', truncated = false,
      completion_tokens = null, latency_ms = null;
  end loop;
  if reference_difficulty is null then
    delete from public.video_reference_labels where video_id = target_video_id;
  else
    insert into public.video_reference_labels (video_id,difficulty,event_label)
    values (target_video_id,reference_difficulty,reference_event_label)
    on conflict (video_id) do update set
      difficulty = excluded.difficulty, event_label = excluded.event_label, uploaded_at = now();
  end if;
  return 9;
end;
$$;

revoke all on function public.validate_qa_annotation() from public, anon, authenticated;
revoke all on function public.validate_video_label() from public, anon, authenticated;
revoke all on function public.reopen_qa_assignment() from public, anon, authenticated;
revoke all on function public.import_video_drafts(uuid,jsonb,text,text,text) from public, anon;
grant execute on function public.import_video_drafts(uuid,jsonb,text,text,text) to authenticated;

-- The original Drive file uses MPEG-4 Part 2, which HTML5 players cannot
-- reliably decode. Point its existing metadata row to the H.264 copy.
update public.videos set
  drive_file_id = '1E3MREPSdIl4zz2q3V5rnL4QqXXr8Br4x',
  filename = 'AeseZkBqBf0_180633_186500_t01_h264.mp4'
where drive_file_id = '1ymkOkK4vNhETL47D1s8qzrR1fJ1y0HFj';
