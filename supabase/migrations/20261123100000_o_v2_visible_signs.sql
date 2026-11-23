-- O.v2: the outcome level and its visible signs (features/o-codebook-v2); since
-- features/o-level-first the annotator chooses the level on a collision and then
-- ticks the signs of that level only.
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
    }
  ],
  "constraints": [
    "C suýt va chạm (hoặc C cũ không rõ loại sự kiện): mức độ tự điền \"không va chạm\", không có dấu hiệu.",
    "C va chạm: chọn mức độ trước (va chạm nhẹ, vừa hoặc mạnh), sau đó chọn ít nhất một dấu hiệu thấy rõ của mức đó.",
    "Mọi dấu hiệu đã chọn thuộc đúng mức độ đã chọn.",
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
      "auto_fill": "Tự điền \"không va chạm\" khi C là suýt va chạm (hoặc C cũ không rõ loại sự kiện); C va chạm thì annotator chọn mức độ.",
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
      "note": "Chỉ chọn dấu hiệu thấy rõ trong video; chọn mọi dấu hiệu thấy được của mức đã chọn.",
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
  "derivation": "Annotator chọn mức độ, rồi chọn các dấu hiệu thấy rõ của mức đó làm bằng chứng (GraDE: một dấu hiệu Major thấy rõ là đủ; SHRP 2: chấm mức theo tiêu chí rời rạc).",
  "references": [
    "Darji, M. & Gondaliya, N. (2026). GraDE: A Severity-Graded Dashcam Event Dataset with Per-Video Adaptive Segmentation. Journal of Trends in Computer Science and Smart Technology 8(4), 1018-1045. doi:10.36548/jtcsst.2026.4.006",
    "SHRP 2 Naturalistic Driving Study crash severity levels 1-4, as summarised in Li, Hao, Gibbons & Medina (2023), Understanding Crashes Involving Roadway Objects with SHRP 2 Naturalistic Driving Study Data, report 23-UR-124."
  ]
}$cb$::jsonb,
        'baa2babaabfb7204c86939a932ac0652267126290fa9f9ce440903cafc2a4392', '2026-11-23');

-- The cross-cell rule of O.v2, after the generic cell checks have accepted every
-- option: none carries no sign; a collision level is chosen first and carries
-- at least one sign, every one of them a sign of that level (option `level`;
-- features/o-level-first); the "giữ thăng bằng" sign (`exclusive`) stands alone.
create or replace function public.validate_outcome_slots(book jsonb, slots jsonb)
returns void language plpgsql stable security definer set search_path = '' as $$
declare level_id text := slots->'level'->>'option';
declare sign_ids text[] := coalesce(array(select jsonb_array_elements_text(slots->'signs'->'options')), '{}');
declare other_level text;
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
  select s.value->>'level' into other_level
  from jsonb_array_elements(book->'cells') c, jsonb_array_elements(c.value->'options') s
  where c.value->>'id' = 'signs' and s.value->>'id' = any(sign_ids)
    and s.value->>'level' is distinct from level_id
  limit 1;
  if other_level is not null then
    raise exception using message = format('Slot answer: every sign must be a sign of level %s (found %s)', level_id, other_level),
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
  -- Line-ending agnostic: the stored source carries whatever newlines the earlier
  -- migration file had (CRLF from a Windows autocrlf checkout, LF elsewhere), and
  -- a literal anchor silently stops matching when the two differ.
  updated := regexp_replace(original,
    '(  perform public\.validate_slot_cells\(book, slots, all_cells, required, forbidden, video, annotator\);)(\r?\n)end;',
    '\1\2  if grp = ''O'' and ''signs'' = any(all_cells) then\2    perform public.validate_outcome_slots(book, slots);\2  end if;\2end;');
  if updated = original then raise exception 'Could not add the O.v2 rule to validate_slots'; end if;
  execute updated;
end;
$$;
