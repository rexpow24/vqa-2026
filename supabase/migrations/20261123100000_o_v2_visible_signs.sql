-- O.v2: the outcome level is derived from visible signs (features/o-codebook-v2).
-- O.v1 rows stay as stored: validate_outcome_slots runs only for a book with a
-- `signs` cell, and every row is validated against its own codebook_version.
insert into public.codebook_versions (id, qgroup, version, content, sha256, frozen_on)
values ('O.v2', 'O', 2, $cb${
  "group": "O",
  "version": 2,
  "frozen_on": "2026-11-23",
  "source": "docs/guidelines/O-hau-qua.md",
  "question": "Hậu quả va chạm và mức độ hư hỏng quan sát được là gì?",
  "templates": [
    {
      "case": "Có va chạm",
      "text": "[Chủ thể] và [đối tượng] [1], [2]."
    },
    {
      "case": "Chỉ một bên (C là K18, không có đối tượng)",
      "text": "[Chủ thể] [2]."
    },
    {
      "case": "Không va chạm",
      "text": "Không quan sát thấy va chạm hoặc hư hỏng phương tiện."
    },
    {
      "case": "C không rõ loại sự kiện",
      "text": "Không đánh giá hậu quả vì nhóm C không rõ loại sự kiện."
    }
  ],
  "constraints": [
    "Mức độ tự suy ra từ C và dấu hiệu, annotator không chọn.",
    "C suýt va chạm: mức độ là \"không va chạm\", không có dấu hiệu.",
    "C không rõ loại sự kiện (chỉ có ở câu C cũ): mức độ là \"không đánh giá\", không có dấu hiệu.",
    "C va chạm: chọn ít nhất một dấu hiệu thấy rõ; mức độ là mức cao nhất trong các dấu hiệu đã chọn.",
    "\"có chạm nhưng các bên vẫn giữ thăng bằng\" không đi cùng dấu hiệu nào khác."
  ],
  "cells": [
    {
      "id": "parties",
      "label": "Các bên",
      "required": false,
      "from_entities": true,
      "auto_fill": "Các bên được tự điền từ cặp chủ thể và đối tượng của Nhóm C.",
      "options": []
    },
    {
      "id": "level",
      "label": "Mức độ",
      "required": true,
      "read_only": true,
      "auto_fill": "Tự suy ra: C suýt va chạm thì không va chạm; C không rõ thì không đánh giá; C va chạm thì mức cao nhất của các dấu hiệu đã chọn.",
      "options": [
        {
          "id": "level.none",
          "label": "không va chạm",
          "rank": 0
        },
        {
          "id": "level.minor",
          "label": "va chạm nhẹ",
          "rank": 1
        },
        {
          "id": "level.moderate",
          "label": "va chạm vừa",
          "rank": 2
        },
        {
          "id": "level.severe",
          "label": "va chạm mạnh",
          "rank": 3
        },
        {
          "id": "level.not_assessed",
          "label": "không đánh giá"
        }
      ]
    },
    {
      "id": "signs",
      "label": "Dấu hiệu nhìn thấy rõ",
      "required": false,
      "multiple": true,
      "note": "Chỉ chọn dấu hiệu thấy rõ trong video; chọn mọi dấu hiệu thấy được.",
      "options": [
        {
          "id": "sign.contact_balanced",
          "label": "có chạm nhưng các bên vẫn giữ thăng bằng",
          "level": "level.minor",
          "exclusive": true
        },
        {
          "id": "sign.fell_in_place",
          "label": "ngã tại chỗ",
          "level": "level.moderate"
        },
        {
          "id": "sign.spun_or_lost_control",
          "label": "xoay ngang hoặc lệch hướng mất lái",
          "level": "level.moderate"
        },
        {
          "id": "sign.overturned",
          "label": "bị lật",
          "level": "level.severe"
        },
        {
          "id": "sign.person_thrown",
          "label": "người bị hất văng khỏi xe",
          "level": "level.severe"
        },
        {
          "id": "sign.vehicle_thrown",
          "label": "xe bị hất khỏi quỹ đạo",
          "level": "level.severe"
        },
        {
          "id": "sign.major_deformation",
          "label": "thân hoặc khung xe biến dạng lớn",
          "level": "level.severe"
        },
        {
          "id": "sign.secondary_collision",
          "label": "va chạm thứ cấp",
          "level": "level.severe"
        }
      ]
    }
  ],
  "inferred_from": "C",
  "derivation": "Mức độ = mức cao nhất trong các dấu hiệu thấy rõ (GraDE: một dấu hiệu Major thấy rõ là đủ; SHRP 2: chấm mức theo tiêu chí rời rạc).",
  "references": [
    "Darji, M. & Gondaliya, N. (2026). GraDE: A Severity-Graded Dashcam Event Dataset with Per-Video Adaptive Segmentation. Journal of Trends in Computer Science and Smart Technology 8(4), 1018-1045. doi:10.36548/jtcsst.2026.4.006",
    "SHRP 2 Naturalistic Driving Study crash severity levels 1-4, as summarised in Li, Hao, Gibbons & Medina (2023), Understanding Crashes Involving Roadway Objects with SHRP 2 Naturalistic Driving Study Data, report 23-UR-124."
  ]
}$cb$::jsonb,
        '9fffc7d58d3ea22e3fae16ec55c4078601f7acfd10d13ed2f2b321c20108345a', '2026-11-23');

-- The cross-cell rule of O.v2, after the generic cell checks have accepted every
-- option: none and not assessed carry no sign; a collision level carries at least
-- one sign and equals the highest level among them (option `rank`); the
-- "giữ thăng bằng" sign (`exclusive`) stands alone.
create or replace function public.validate_outcome_slots(book jsonb, slots jsonb)
returns void language plpgsql stable security definer set search_path = '' as $$
declare level_id text := slots->'level'->>'option';
declare sign_ids text[] := coalesce(array(select jsonb_array_elements_text(slots->'signs'->'options')), '{}');
declare highest text;
begin
  if level_id in ('level.none', 'level.not_assessed') then
    if slots ? 'signs' then
      raise exception using message = format('Slot answer: %s takes no sign', level_id), hint = 'level_mismatch';
    end if;
    return;
  end if;
  if cardinality(sign_ids) = 0 then
    raise exception using message = 'Slot answer: cell signs is required for a collision level', hint = 'missing_cell';
  end if;
  if cardinality(sign_ids) > 1 and exists (
      select 1 from jsonb_array_elements(book->'cells') c, jsonb_array_elements(c.value->'options') o
      where c.value->>'id' = 'signs' and o.value->>'id' = any(sign_ids) and coalesce((o.value->>'exclusive')::boolean, false)) then
    raise exception using message = 'Slot answer: an exclusive sign cannot be combined with another sign', hint = 'exclusive_sign';
  end if;
  select s.value->>'level' into highest
  from jsonb_array_elements(book->'cells') c, jsonb_array_elements(c.value->'options') s,
       jsonb_array_elements(book->'cells') lc, jsonb_array_elements(lc.value->'options') l
  where c.value->>'id' = 'signs' and s.value->>'id' = any(sign_ids)
    and lc.value->>'id' = 'level' and l.value->>'id' = s.value->>'level'
  order by (l.value->>'rank')::int desc limit 1;
  if highest is distinct from level_id then
    raise exception using message = format('Slot answer: level %s is not the highest level of its signs (%s)', level_id, highest),
      hint = 'level_mismatch';
  end if;
end;
$$;
revoke all on function public.validate_outcome_slots(jsonb, jsonb) from public, anon, authenticated;

-- validate_slots ends with the generic check of the outer cells; O.v2 adds its rule there.
do $$
declare original text;
declare updated text;
begin
  original := pg_get_functiondef('public.validate_slots(text,jsonb,uuid,uuid)'::regprocedure);
  updated := replace(original,
    $old$  perform public.validate_slot_cells(book, slots, all_cells, required, forbidden, video, annotator);
end;$old$,
    $new$  perform public.validate_slot_cells(book, slots, all_cells, required, forbidden, video, annotator);
  if grp = 'O' and 'signs' = any(all_cells) then
    perform public.validate_outcome_slots(book, slots);
  end if;
end;$new$);
  if updated = original then raise exception 'Could not add the O.v2 rule to validate_slots'; end if;
  execute updated;
end;
$$;
