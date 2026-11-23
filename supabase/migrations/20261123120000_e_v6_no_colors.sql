-- E.v6: group E asks no colour (features/e-v6-no-colors). Annotators disagreed
-- on vehicle and clothing colours, so E.v6 = E.v5 without `vehicle_color` and
-- `clothing_color`; parties are told apart by type and by their letter, named
-- by the positional rule. Stored E.v1-E.v5 rows keep their colours as stored:
-- the cell rules below are chosen by the row's own codebook_version.
insert into public.codebook_versions (id, qgroup, version, content, sha256, frozen_on)
values ('E.v6', 'E', 6, $cb${
  "group": "E",
  "version": 6,
  "frozen_on": "2026-11-23",
  "source": "docs/guidelines/E-thuc-the.md",
  "question": "Loại phương tiện của các bên liên quan là gì?",
  "templates": [
    {
      "case": "Ô tô",
      "text": "Xe ô tô (có/không có camera hành trình)"
    },
    {
      "case": "Xe khách, xe tải",
      "text": "[1]"
    },
    {
      "case": "Xe máy",
      "text": "Xe máy"
    },
    {
      "case": "Xe đạp",
      "text": "Xe đạp"
    },
    {
      "case": "Xe cứu thương, xe ba gác, khác",
      "text": "[1]"
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
    }
  ]
}$cb$::jsonb, 'ed195a634476ce685be4ac7e8ca13c5805c80d0eab2135ca31d007e64f63b72a', '2026-11-23')
on conflict (id) do nothing;

-- E.v6 gets the dashcam rule only; E.v4 and E.v5 keep their colour rules.
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
  elsif new.codebook_version = 'E.v6' then
    -- E.v6 has no colour cells (validate_slots refuses them); a car needs its
    -- dashcam choice and only cars take one.
    if entity_type = 'type.car' and dashcam_choice is null then
      raise exception using message = 'Slot answer: car entities require dashcam', hint = 'missing_cell';
    elsif entity_type is distinct from 'type.car' and new.cells ? 'dashcam' then
      raise exception using message = 'Slot answer: only cars take a dashcam value', hint = 'unexpected_cell';
    end if;
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
