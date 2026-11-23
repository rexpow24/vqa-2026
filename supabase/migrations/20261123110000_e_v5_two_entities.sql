-- E.v5: E declares at most the two main parties: the pair of the first
-- collision, else of the first near miss; a single-vehicle event declares one
-- (features/two-entity-subject-rules). Cells are E.v4's unchanged.
-- Stored E.v1-E.v4 lists (some hold 3 or 4 parties) stay as stored: the limit
-- is read from the book a list is saved under, and nothing re-saves old lists.
insert into public.codebook_versions (id, qgroup, version, content, sha256, frozen_on)
values ('E.v5', 'E', 5, $cb${
  "group": "E",
  "version": 5,
  "frozen_on": "2026-11-23",
  "source": "docs/guidelines/E-thuc-the.md",
  "question": "Loại phương tiện và màu sắc của các bên liên quan là gì?",
  "templates": [
    {
      "case": "Ô tô",
      "text": "Xe ô tô màu [4] (có/không có camera hành trình)"
    },
    {
      "case": "Xe khách, xe tải",
      "text": "[1] màu [4]"
    },
    {
      "case": "Xe máy",
      "text": "Xe máy màu [4]"
    },
    {
      "case": "Xe đạp",
      "text": "Xe đạp màu [4]"
    },
    {
      "case": "Xe cứu thương, xe ba gác, khác",
      "text": "[1] màu [4]"
    },
    {
      "case": "Người đi bộ",
      "text": "Người đi bộ mặc áo [5]"
    },
    {
      "case": "Động vật",
      "text": "Động vật"
    }
  ],
  "per_entity": true,
  "max_entities": 2,
  "cells": [
    {
      "id": "type",
      "label": "Loại",
      "required": true,
      "when": "Luôn điền",
      "options": [
        {
          "id": "type.car",
          "label": "ô tô"
        },
        {
          "id": "type.bus",
          "label": "xe khách"
        },
        {
          "id": "type.truck",
          "label": "xe tải"
        },
        {
          "id": "type.ambulance",
          "label": "xe cứu thương"
        },
        {
          "id": "type.motorbike",
          "label": "xe máy"
        },
        {
          "id": "type.cargo_tricycle",
          "label": "xe ba gác"
        },
        {
          "id": "type.pedestrian",
          "label": "người đi bộ"
        },
        {
          "id": "type.animal",
          "label": "động vật"
        },
        {
          "id": "type.bicycle",
          "label": "xe đạp"
        },
        {
          "id": "type.other",
          "label": "khác",
          "free_text": true
        }
      ]
    },
    {
      "id": "dashcam",
      "label": "Camera hành trình",
      "required": false,
      "when": "Bắt buộc chọn với ô tô",
      "options": [
        {
          "id": "dashcam.yes",
          "label": "có"
        },
        {
          "id": "dashcam.no",
          "label": "không"
        }
      ],
      "required_when": "type.car"
    },
    {
      "id": "vehicle_color",
      "label": "Màu xe",
      "required": false,
      "when": "Bắt buộc với phương tiện có màu; không áp dụng ô tô có dashcam, xe đạp, người đi bộ và động vật",
      "options": [
        {
          "id": "vehicle_color.white_gray_silver",
          "label": "trắng, xám/bạc"
        },
        {
          "id": "vehicle_color.black",
          "label": "đen"
        },
        {
          "id": "vehicle_color.red",
          "label": "đỏ"
        },
        {
          "id": "vehicle_color.blue_green",
          "label": "xanh"
        },
        {
          "id": "vehicle_color.yellow",
          "label": "vàng"
        }
      ]
    },
    {
      "id": "clothing_color",
      "label": "Màu áo người điều khiển",
      "required": false,
      "when": "Chỉ với người đi bộ",
      "options": [
        {
          "id": "clothing_color.white_gray_silver",
          "label": "trắng, xám/bạc"
        },
        {
          "id": "clothing_color.black",
          "label": "đen"
        },
        {
          "id": "clothing_color.red",
          "label": "đỏ"
        },
        {
          "id": "clothing_color.blue_green",
          "label": "xanh"
        },
        {
          "id": "clothing_color.yellow",
          "label": "vàng"
        }
      ]
    }
  ]
}$cb$::jsonb, 'c5bd42cbeb1b87da0bafb08642e2169f48bcbaf19161630219cccec8485d7dbd', '2026-11-23')
on conflict (id) do nothing;

-- E.v5 takes the E.v4 cell rules (dashcam and vehicle colour by type).
create or replace function public.validate_video_entity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare entity_type text;
declare dashcam_choice text;
begin
  if tg_op = 'UPDATE' and (new.video_id, new.annotator_id, new.entity_key)
                          is distinct from (old.video_id, old.annotator_id, old.entity_key) then
    raise exception 'Entity ownership cannot be changed';
  end if;
  if not exists (select 1 from public.codebook_versions c where c.id = new.codebook_version and c.qgroup = 'E') then
    raise exception using message = format('Slot answer: %s is not an E codebook', new.codebook_version),
      hint = 'codebook_version';
  end if;
  perform public.validate_slots(new.codebook_version, new.cells, new.video_id, new.annotator_id);
  entity_type := new.cells #>> '{type,option}';
  dashcam_choice := new.cells #>> '{dashcam,option}';
  if new.codebook_version = 'E.v3' and entity_type = 'type.car'
     and (new.cells -> 'dashcam' is null or new.cells -> 'vehicle_color' is null) then
    raise exception using message = 'Slot answer: car entities require dashcam and vehicle color', hint = 'missing_cell';
  elsif new.codebook_version in ('E.v4', 'E.v5') then
    if entity_type = 'type.car' then
      if dashcam_choice is null then
        raise exception using message = 'Slot answer: car entities require dashcam', hint = 'missing_cell';
      elsif dashcam_choice = 'dashcam.yes' and new.cells ? 'vehicle_color' then
        raise exception using message = 'Slot answer: cars with dashcam cannot have a vehicle color', hint = 'unexpected_cell';
      elsif dashcam_choice = 'dashcam.no' and not new.cells ? 'vehicle_color' then
        raise exception using message = 'Slot answer: cars without dashcam require a vehicle color', hint = 'missing_cell';
      end if;
    elsif entity_type in ('type.bicycle', 'type.pedestrian', 'type.animal') then
      if new.cells ? 'vehicle_color' then
        raise exception using message = 'Slot answer: this entity type does not take a vehicle color', hint = 'unexpected_cell';
      end if;
      if new.cells ? 'dashcam' then
        raise exception using message = 'Slot answer: only cars take a dashcam value', hint = 'unexpected_cell';
      end if;
    else
      if not new.cells ? 'vehicle_color' then
        raise exception using message = 'Slot answer: this vehicle requires a vehicle color', hint = 'missing_cell';
      end if;
      if new.cells ? 'dashcam' then
        raise exception using message = 'Slot answer: only cars take a dashcam value', hint = 'unexpected_cell';
      end if;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- The list limit, checked under the assignment lock save_video_entities already takes.
create or replace function public.save_video_entities(target_video uuid, version text, entities jsonb, e_answer text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller uuid := (select auth.uid());
declare e_draft uuid;
declare item jsonb;
declare keys text[];
declare saved public.qa_annotations;
declare max_parties int;
begin
  if not public.is_active_user() then
    raise exception using message = 'Slot answer: this account is disabled', hint = 'forbidden';
  end if;
  -- Locks the assignment row like validate_qa_annotation does for a slot
  -- answer, so removing an entity and pointing at it from another tab run
  -- one after the other (A21).
  perform 1 from public.video_assignments a join public.videos v on v.id = a.video_id
  where a.video_id = target_video and a.annotator_id = caller
    and v.status = 'active' and a.answer_format = 'slots'
  for update of a;
  if not found then
    raise exception using message = 'Slot answer: no slot assignment on this video', hint = 'forbidden';
  end if;
  if entities is null or jsonb_typeof(entities) <> 'array'
     or exists (select 1 from jsonb_array_elements(entities) e where jsonb_typeof(e.value) <> 'object') then
    raise exception using message = 'Slot answer: entities must be a list of {key, cells}', hint = 'invalid_value';
  end if;
  keys := array(select e.value->>'key' from jsonb_array_elements(entities) e);
  if exists (select 1 from unnest(keys) k where k is null or k !~ '^[A-Z]$')
     or cardinality(keys) <> (select count(distinct k) from unnest(keys) k) then
    raise exception using message = 'Slot answer: entity keys are single distinct capital letters', hint = 'entity_key';
  end if;
  -- E.v5 on: at most the two main parties (features/two-entity-subject-rules).
  -- A book without max_entities (E.v1-E.v4) keeps no limit; stored lists are
  -- never re-validated, only a list saved under a limited book.
  select (c.content->>'max_entities')::int into max_parties
  from public.codebook_versions c where c.id = save_video_entities.version and c.qgroup = 'E';
  if max_parties is not null and cardinality(keys) > max_parties then
    raise exception using message = format('Slot answer: %s takes at most %s entities', version, max_parties),
      hint = 'too_many_entities';
  end if;
  delete from public.video_entities e
  where e.video_id = target_video and e.annotator_id = caller and e.entity_key <> all(keys);
  for item in select e.value from jsonb_array_elements(entities) e loop
    insert into public.video_entities as v (video_id, annotator_id, entity_key, cells, codebook_version)
    values (target_video, caller, item->>'key', item->'cells', version)
    on conflict (video_id, annotator_id, entity_key) do update
      set cells = excluded.cells, codebook_version = excluded.codebook_version
      where (v.cells, v.codebook_version) is distinct from (excluded.cells, excluded.codebook_version);
  end loop;
  select d.id into e_draft from public.video_drafts d where d.video_id = target_video and d.qgroup = 'E';
  if e_draft is null then raise exception 'Active draft video not found'; end if;
  insert into public.qa_annotations as q
    (draft_id, annotator_id, verdict, reason_code, reason_note, edited_answer, slots, codebook_version, human_keyframes_s)
  values (e_draft, caller, 'SLOTS', null, null, e_answer, '{}'::jsonb, version, '{}')
  on conflict (draft_id, annotator_id) do update
    set verdict = excluded.verdict, reason_code = null, reason_note = null, edited_answer = excluded.edited_answer,
        slots = excluded.slots, codebook_version = excluded.codebook_version
  returning q.* into saved;
  return jsonb_build_object('entities', saved.slots->'entities', 'edited_answer', saved.edited_answer, 'slots', saved.slots);
end;
$$;
