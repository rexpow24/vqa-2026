-- E.v6 drops the type "khác" (features/e-type-definitions, user decision 2026-11-24):
-- every party is one of the listed types, defined in docs/guidelines/E-thuc-the.md
-- (xe máy, xe đạp, xe ba gác = any three-wheeler). Stored E.v2/E.v4 rows keep their
-- "khác": each row is validated against its own codebook_version.
--
-- 20261123120000 already ran in production, so the E.v6 row is revised in place; that
-- is only safe while no stored E.v6 party uses type.other, which the first block checks.
do $$
begin
  if exists (select 1 from public.video_entities
             where codebook_version = 'E.v6' and cells->'type'->>'option' = 'type.other') then
    raise exception 'An E.v6 party already uses type.other; revise E as a new version instead';
  end if;
end;
$$;

update public.codebook_versions
set content = $cb${
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
      "case": "Xe cứu thương, xe ba gác",
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
}
$cb$::jsonb,
    sha256 = 'b2c596c347fdebac60cf558df2afbfee71893c699904b30d08f21e1cc39a1f10'
where id = 'E.v6';

do $$
begin
  if (select sha256 from public.codebook_versions where id = 'E.v6') is distinct from 'b2c596c347fdebac60cf558df2afbfee71893c699904b30d08f21e1cc39a1f10' then
    raise exception 'E.v6 codebook row was not updated';
  end if;
end;
$$;
