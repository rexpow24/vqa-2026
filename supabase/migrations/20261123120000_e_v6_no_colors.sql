-- E.v6: group E asks no clothing colour (features/e-v6-no-colors, revised by
-- features/o-level-first: the vehicle colour came back on the team's request).
-- E.v6 = E.v5 without `clothing_color`; a pedestrian is named "người đi bộ".
-- Stored E.v1-E.v5 rows keep their colours as stored: the cell rules below are
-- chosen by the row's own codebook_version.
insert into public.codebook_versions (id, qgroup, version, content, sha256, frozen_on)
values ('E.v6', 'E', 6, $cb${
  "group": "E",
  "version": 6,
  "frozen_on": "2026-11-23",
  "source": "docs/guidelines/E-thuc-the.md",
  "question": "Loại phương tiện và màu xe của các bên liên quan là gì?",
  "templates": [
    {
      "case": "Ô tô",
      "text": "Xe ô tô màu [3] (có/không có camera hành trình)"
    },
    {
      "case": "Xe khách, xe tải",
      "text": "[1] màu [3]"
    },
    {
      "case": "Xe máy",
      "text": "Xe máy màu [3]"
    },
    {
      "case": "Xe đạp",
      "text": "Xe đạp"
    },
    {
      "case": "Xe cứu thương, xe ba gác, khác",
      "text": "[1] màu [3]"
    },
    {
      "case": "Người đi bộ",
      "text": "Người đi bộ"
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
    }
  ]
}$cb$::jsonb, 'ee297a48feaeef1afc1814e6dede4ce82aef49fb148ab988d0e2ba15b93d8ef7', '2026-11-23')
on conflict (id) do nothing;

-- E.v6 keeps the vehicle colour rules of E.v4 and E.v5; it has no clothing
-- colour cell, which validate_slots refuses as a cell the book does not define.
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
  elsif new.codebook_version in ('E.v4', 'E.v5', 'E.v6') then
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
