-- Remove V from new labeling work and derive Prev directly from C.
insert into public.codebook_versions (id, qgroup, version, content, sha256, frozen_on)
values ('Prev.v4', 'Prev', 4, $cb${
  "group": "Prev",
  "version": 4,
  "frozen_on": "2026-11-22",
  "source": "docs/guidelines/Prev-phong-ngua.md",
  "question": "Từ tình huống và hành động đã ghi ở nhóm C, bên nào nên làm gì để phòng tránh xung đột?",
  "templates": [
    {
      "case": "Một bên",
      "text": "[Bên] nên [2]."
    },
    {
      "case": "Cả hai bên",
      "text": "[A] nên [2 của A]; [B] nên [2 của B]."
    },
    {
      "case": "C không đủ căn cứ",
      "text": "Không thể xác định từ tình huống C."
    }
  ],
  "cells": [
    {
      "id": "party",
      "label": "Bên",
      "required": true,
      "from_entities": true,
      "auto_fill": "Tự suy ra từ nhóm C; annotator không sửa.",
      "options": [
        {
          "id": "party.both",
          "label": "cả hai bên"
        },
        {
          "id": "party.unclear",
          "label": "không rõ"
        }
      ],
      "read_only": true
    },
    {
      "id": "main_action",
      "label": "Hành động chính",
      "required": true,
      "per_party": true,
      "options": [
        {
          "id": "main_action.slow_down",
          "label": "giảm tốc"
        },
        {
          "id": "main_action.keep_distance",
          "label": "giữ khoảng cách an toàn"
        },
        {
          "id": "main_action.observe_and_yield",
          "label": "quan sát và nhường đường"
        },
        {
          "id": "main_action.change_lane_safely",
          "label": "chỉ chuyển làn khi an toàn"
        },
        {
          "id": "main_action.stay_in_lane",
          "label": "đi đúng phần đường"
        },
        {
          "id": "main_action.steady_steering",
          "label": "giữ ổn định hướng lái"
        },
        {
          "id": "main_action.stop_and_look",
          "label": "dừng quan sát trước khi băng qua"
        },
        {
          "id": "main_action.signal",
          "label": "bật xi nhan xin đường"
        },
        {
          "id": "main_action.avoid_blind_spot",
          "label": "tránh điểm mù xe lớn"
        },
        {
          "id": "main_action.obey_signals",
          "label": "chấp hành đèn tín hiệu"
        },
        {
          "id": "main_action.check_vehicle",
          "label": "kiểm tra xe trước khi đi"
        },
        {
          "id": "main_action.overtake_safely",
          "label": "chỉ vượt khi đủ điều kiện an toàn"
        },
        {
          "id": "main_action.check_surroundings",
          "label": "quan sát xung quanh trước khi thao tác"
        },
        {
          "id": "main_action.use_pedestrian_path",
          "label": "đi trên lề hoặc vỉa hè nếu có"
        },
        {
          "id": "main_action.other",
          "label": "khác",
          "free_text": true
        }
      ],
      "read_only": true,
      "auto_fill": "Tự suy ra từ nhóm C; annotator không sửa."
    }
  ],
  "inferred_from": "C",
  "read_only": true,
  "derivation": "Tự sinh trực tiếp từ C theo quy tắc có điều kiện; nếu thiếu căn cứ để xác định bên hoặc hành động chính thì ghi không thể xác định."
}$cb$::jsonb,
        '2d03b5c7fc67764dc949cd8fb30fc0b1e61f1b2986b92f30bb23d2f669c13228', '2026-11-22');

-- The active set is eight questions: S, E, N, C, O, R, Attr, Prev.
-- V rows remain readable as historical data but do not block new assignments.
create or replace function public.current_question_set_ready(target_video_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select count(*) filter (where d.qgroup in ('S','E','N','C','O','R','Attr','Prev')) = 8
  from public.video_drafts d
  where d.video_id = target_video_id
$$;

-- Keep old V drafts for history while refusing new ones.
create or replace function public.reject_removed_v_draft()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.qgroup = 'V' then
    raise exception using message = 'Question group V has been removed from active labeling', hint = 'group_removed';
  end if;
  return new;
end;
$$;
drop trigger if exists video_drafts_reject_removed_v on public.video_drafts;
create trigger video_drafts_reject_removed_v before insert on public.video_drafts
for each row execute function public.reject_removed_v_draft();

create or replace function public.reject_removed_v_annotation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.video_drafts d where d.id = new.draft_id and d.qgroup = 'V') then
    raise exception using message = 'Question group V has been removed from active labeling', hint = 'group_removed';
  end if;
  return new;
end;
$$;
drop trigger if exists qa_annotations_reject_removed_v on public.qa_annotations;
create trigger qa_annotations_reject_removed_v before insert or update on public.qa_annotations
for each row execute function public.reject_removed_v_annotation();

-- Update the current CSV import routine while preserving its existing checks and upsert behavior.
do $$
declare original text;
declare updated text;
declare signature text;
begin
  signature := 'public.import_video_drafts(uuid,jsonb,text,text,text)';
  original := pg_get_functiondef(to_regprocedure(signature));
  updated := replace(original, 'jsonb_array_length(rows) <> 9', 'jsonb_array_length(rows) <> 8');
  updated := replace(updated,
    $old$(select count(distinct value->>'qgroup') from jsonb_array_elements(rows)) <> 9$old$,
    $new$(select count(distinct value->>'qgroup') from jsonb_array_elements(rows)) <> 8$new$);
  updated := replace(updated, 'CSV must contain exactly nine distinct question groups', 'CSV must contain exactly eight active question groups');
  updated := replace(updated,
    $old$item->>'qgroup' not in ('S','E','N','C','V','O','R','Attr','Prev')$old$,
    $new$item->>'qgroup' not in ('S','E','N','C','O','R','Attr','Prev')$new$);
  updated := replace(updated, 'return 9;', 'return 8;');
  if updated = original then raise exception 'Could not update import_video_drafts for the active eight-question set'; end if;
  execute updated;
end;
$$;

-- Assignment validation ignores retained historical V rows and requires all eight active answers.
do $$
declare original text;
declare updated text;
begin
  original := pg_get_functiondef('public.validate_assignment()'::regprocedure);
  updated := replace(original,
    'where d.video_id = new.video_id and a.annotator_id = new.annotator_id;',
    'where d.video_id = new.video_id and d.qgroup <> ''V'' and a.annotator_id = new.annotator_id;');
  updated := replace(updated, 'if draft_count <> 9 or answer_count <> 9 then',
    'if not public.current_question_set_ready(new.video_id) or answer_count <> 8 then');
  updated := replace(updated, 'Review all nine questions before completing', 'Review all eight active questions before completing');
  if updated = original then raise exception 'Could not update validate_assignment for the active eight-question set'; end if;
  execute updated;
end;
$$;

-- The annotator list reports only answers in the current question set.
do $$
declare original text;
declare updated text;
begin
  original := pg_get_functiondef('public.my_assignments(integer,integer,text)'::regprocedure);
  updated := replace(original,
    'where d.video_id = m.id and q.annotator_id = (select auth.uid()))',
    'where d.video_id = m.id and d.qgroup <> ''V'' and q.annotator_id = (select auth.uid()))');
  if updated = original then raise exception 'Could not update my_assignments to ignore historical V answers'; end if;
  execute updated;
end;
$$;

-- Readiness checks used by assignment, agreement sampling, and the admin overview.
do $$
declare signature text;
declare original text;
declare updated text;
declare signatures text[] := array[
  'public.assign_range(uuid,integer,integer,text)',
  'public.agreement_strata()',
  'public.plan_agreement_group(integer)',
  'public.assignment_overview()',
  'public.split_free_videos(integer)'
];
begin
  foreach signature in array signatures loop
    original := pg_get_functiondef(to_regprocedure(signature));
    updated := replace(original,
      '(select count(*) from public.video_drafts d where d.video_id = v.id) = 9',
      'public.current_question_set_ready(v.id)');
    if updated = original then raise exception 'Could not update draft readiness in %', signature; end if;
    execute updated;
  end loop;
end;
$$;
