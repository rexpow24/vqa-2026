-- S.v4 removes traffic density and road material; O.v3 fixes parties to A and B.
insert into public.codebook_versions (id, qgroup, version, content, sha256, frozen_on) values
  ('S.v4', 'S', 4, $cb${
  "group": "S",
  "version": 4,
  "frozen_on": "2026-11-28",
  "source": "docs/guidelines/S-boi-canh.md",
  "question": "Thời tiết, ánh sáng, loại đường và tình trạng mặt đường ra sao?",
  "cells": [
    {
      "id": "weather",
      "label": "Thời tiết",
      "required": true,
      "options": [
        {
          "id": "weather.sunny",
          "label": "nắng"
        },
        {
          "id": "weather.no_rain",
          "label": "tạnh ráo"
        },
        {
          "id": "weather.rain",
          "label": "mưa"
        },
        {
          "id": "weather.fog",
          "label": "sương mù"
        },
        {
          "id": "weather.unclear",
          "label": "không rõ"
        }
      ]
    },
    {
      "id": "light",
      "label": "Ánh sáng",
      "required": true,
      "options": [
        {
          "id": "light.day",
          "label": "ban ngày"
        },
        {
          "id": "light.night",
          "label": "ban đêm"
        },
        {
          "id": "light.unclear",
          "label": "không rõ"
        }
      ]
    },
    {
      "id": "road_type",
      "label": "Loại đường",
      "required": true,
      "options": [
        {
          "id": "road_type.two_way_divided",
          "label": "hai chiều có dải phân cách"
        },
        {
          "id": "road_type.two_way_undivided",
          "label": "hai chiều không có dải phân cách"
        },
        {
          "id": "road_type.one_way",
          "label": "một chiều"
        },
        {
          "id": "road_type.unclear",
          "label": "không rõ"
        }
      ]
    },
    {
      "id": "surface",
      "label": "Mặt đường",
      "required": true,
      "options": [
        {
          "id": "surface.dry",
          "label": "khô"
        },
        {
          "id": "surface.wet",
          "label": "ướt"
        },
        {
          "id": "surface.unclear",
          "label": "không rõ"
        }
      ]
    },
    {
      "id": "segment",
      "label": "Đoạn đường",
      "required": true,
      "options": [
        {
          "id": "segment.straight",
          "label": "thẳng",
          "phrase": "đoạn đường thẳng"
        },
        {
          "id": "segment.curve",
          "label": "khúc cua"
        },
        {
          "id": "segment.intersection",
          "label": "giao lộ"
        },
        {
          "id": "segment.unclear",
          "label": "không rõ"
        }
      ]
    }
  ],
  "templates": [
    {
      "case": "Mặc định",
      "text": "Trời {weather}, {light}, đường {road_type}( tại {segment}), mặt đường {surface}."
    }
  ]
}$cb$::jsonb, '8e64e9d9b8540b58ef015bb904e816ebb8dda25135dac44630e02039ea0725bf', '2026-11-28'),
  ('O.v3', 'O', 3, $cb${
  "group": "O",
  "version": 3,
  "frozen_on": "2026-11-28",
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
    "\"có chạm nhưng các bên vẫn giữ thăng bằng\" không đi cùng dấu hiệu nào khác.",
    "Các bên luôn là cả A và B theo nhóm E, tự điền và không chỉnh sửa."
  ],
  "cells": [
    {
      "id": "parties",
      "label": "Các bên",
      "required": true,
      "from_entities": true,
      "auto_fill": "Tự chọn cả A và B từ nhóm E; không chỉnh sửa.",
      "options": [],
      "read_only": true
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
}$cb$::jsonb, '11c9a78f4f8665e5350b25624ff14a1f3ca289bff12d0ab641552274a7daa450', '2026-11-28');
