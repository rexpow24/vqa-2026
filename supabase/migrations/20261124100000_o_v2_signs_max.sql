-- O.v2 goes back to a derived level (features/o-signs-max-grouped): the annotator
-- ticks every clearly visible sign and the level is the highest level among them,
-- as the O.v1 agreement audit motivated; the level-first trial of
-- features/o-level-first is undone. The sign set, the merged "không va chạm" and
-- the one-party sentence "[Chủ thể]: [2]." are kept.
--
-- 20261123100000 already ran in production, so the O.v2 row is revised here in
-- place rather than by a new version: it is only safe while no O.v2 answer
-- exists, which the first block checks.
do $$
begin
  if exists (select 1 from public.qa_annotations where codebook_version = 'O.v2') then
    raise exception 'O.v2 already has stored answers; revise it as a new version instead';
  end if;
end;
$$;

update public.codebook_versions
set content = $cb${
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
      "text": "[Chủ thể]: [2]."
    },
    {
      "case": "Không va chạm",
      "text": "Không quan sát thấy va chạm hoặc hư hỏng phương tiện."
    }
  ],
  "constraints": [
    "Mức độ tự suy ra từ C và dấu hiệu, annotator không chọn.",
    "C suýt va chạm (hoặc C cũ không rõ loại sự kiện): mức độ là \"không va chạm\", không có dấu hiệu.",
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
      "auto_fill": "Tự suy ra: C suýt va chạm (hoặc C cũ không rõ loại sự kiện) thì không va chạm; C va chạm thì mức cao nhất của các dấu hiệu đã chọn.",
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
        }
      ]
    },
    {
      "id": "signs",
      "label": "Dấu hiệu nhìn thấy rõ",
      "required": false,
      "multiple": true,
      "note": "Chỉ chọn dấu hiệu thấy rõ trong video; chọn mọi dấu hiệu thấy được, ở mọi mức.",
      "options": [
        {
          "id": "sign.contact_balanced",
          "label": "có chạm nhưng các bên vẫn giữ thăng bằng",
          "level": "level.minor",
          "exclusive": true
        },
        {
          "id": "sign.vehicle_fell",
          "label": "xe đổ tại chỗ",
          "level": "level.moderate"
        },
        {
          "id": "sign.person_fell",
          "label": "người ngã tại chỗ",
          "level": "level.moderate"
        },
        {
          "id": "sign.spun_or_lost_control",
          "label": "xoay ngang mất lái",
          "level": "level.moderate"
        },
        {
          "id": "sign.visible_body_damage",
          "label": "có hư hỏng nhìn thấy được ở thân xe (ô tô)",
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
          "label": "biến dạng nghiêm trọng, cấu trúc xe bị phá vỡ rõ rệt",
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
}
$cb$::jsonb,
    sha256 = '9d1e934c13b379631aed115e0b98b2ae780ea6a190e8ec5fefa646a9674b9e6f'
where id = 'O.v2';

do $$
begin
  if (select sha256 from public.codebook_versions where id = 'O.v2') is distinct from '9d1e934c13b379631aed115e0b98b2ae780ea6a190e8ec5fefa646a9674b9e6f' then
    raise exception 'O.v2 codebook row was not updated';
  end if;
end;
$$;

-- The cross-cell rule of O.v2, after the generic cell checks have accepted every
-- option: none carries no sign; a collision level carries at least one sign and
-- equals the highest level among them (option `rank`); the "giữ thăng bằng" sign
-- (`exclusive`) stands alone.
create or replace function public.validate_outcome_slots(book jsonb, slots jsonb)
returns void language plpgsql stable security definer set search_path = '' as $fn$
declare level_id text := slots->'level'->>'option';
declare sign_ids text[] := coalesce(array(select jsonb_array_elements_text(slots->'signs'->'options')), '{}');
declare highest text;
begin
  if level_id = 'level.none' then
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
$fn$;

revoke all on function public.validate_outcome_slots(jsonb, jsonb) from public, anon, authenticated;
