-- Codebook v2 (features/codebook-v2/requirements.md), after the lead labelled
-- 10 agreement videos with the slot form. New frozen codebooks arrive as new
-- rows; every v1 row stays as it is, and answers stored with v1 stay valid as
-- stored (the triggers re-check a row only when it is written).
--
--   S.v2     weather "âm u" replaced by "tạnh ráo"; new cell surface_material.
--   C.v2     speed adds "tốc độ cao"; the evasion cells (evader, evasion,
--            evasion_result) are gone; templates without the evasion part.
--   V.v2     violator may be "cả hai bên" (violator.both); then behavior is
--            given per party, as C does for subject.both (per_party_when);
--            behavior adds "không giảm tốc độ qua giao lộ".
--   Attr.v1  Attr becomes a slot group: one cell, parties, one or two entities
--            from E or parties.unclear. It keeps its start/end evidence frames
--            (validate_qa_annotation, keyframe groups C, V, Attr, unchanged).
--
-- Attr having a codebook makes it a slot group of every slot assignment
-- (validate_qa_annotation decides that by the existence of a codebook row,
-- unchanged here): an Attr answer saved in text before this migration stays as
-- stored, and the next save of it must be a slot answer.
-- Applied locally first; production needs its own approval (AC8).

-- 1. Frozen codebooks ---------------------------------------------------------
--
-- Generated, not typed, with the method of 20261116100000_slot_data_model.sql:
--
--   python - > seed.sql <<'PY'
--   import hashlib, json, pathlib, sys
--   names = ["S.v2", "C.v2", "V.v2", "Attr.v1"]
--   out = []
--   for i, n in enumerate(names):
--       raw = pathlib.Path(f"codebook/{n}.json").read_bytes()
--       d = json.loads(raw)
--       body = json.dumps(d, ensure_ascii=False, indent=2)
--       assert "$cb$" not in body
--       end = ";" if i == len(names) - 1 else ","
--       out.append(f"  ('{d['group']}.v{d['version']}', '{d['group']}', {d['version']}, $cb${body}$cb$::jsonb,\n"
--                  f"   '{hashlib.sha256(raw).hexdigest()}', '{d['frozen_on']}'){end}\n")
--   sys.stdout.buffer.write("".join(out).encode("utf-8"))
--   PY

alter table public.codebook_versions drop constraint codebook_versions_qgroup_check;
alter table public.codebook_versions
  add constraint codebook_versions_qgroup_check check (qgroup in ('S','E','C','V','O','R','Attr','Prev'));

insert into public.codebook_versions (id, qgroup, version, content, sha256, frozen_on) values
  ('S.v2', 'S', 2, $cb${
  "group": "S",
  "version": 2,
  "frozen_on": "2026-11-16",
  "source": "docs/guidelines/S-boi-canh.md",
  "question": "Thời tiết, ánh sáng, loại đường, chất liệu và tình trạng mặt đường ra sao?",
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
      "id": "density",
      "label": "Mật độ xe",
      "required": true,
      "options": [
        {
          "id": "density.sparse",
          "label": "thưa"
        },
        {
          "id": "density.dense",
          "label": "đông"
        },
        {
          "id": "density.jam",
          "label": "ùn tắc"
        },
        {
          "id": "density.unclear",
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
    },
    {
      "id": "surface_material",
      "label": "Chất liệu mặt đường",
      "required": true,
      "options": [
        {
          "id": "surface_material.asphalt",
          "label": "nhựa"
        },
        {
          "id": "surface_material.dirt",
          "label": "đất cát"
        },
        {
          "id": "surface_material.unclear",
          "label": "không rõ"
        }
      ]
    }
  ],
  "templates": [
    {
      "case": "Mặc định",
      "text": "Trời {weather}, {light}, đường {road_type}( tại {segment}), mặt đường {surface_material} {surface}, mật độ xe {density}."
    }
  ]
}$cb$::jsonb,
   '1a5c8789cb8bc7dd5d88d5e68669cc5f7f977408d63018faf237d781346267d4', '2026-11-16'),
  ('C.v2', 'C', 2, $cb${
  "group": "C",
  "version": 2,
  "frozen_on": "2026-11-16",
  "source": "docs/guidelines/C-nguyen-nhan.md",
  "question": "Nguyên nhân trực tiếp hoặc hành động ngay trước va chạm là gì?",
  "templates": [
    {
      "case": "Va chạm",
      "text": "{subject} {action}( và {speed}), {relation} {object}, dẫn đến va chạm."
    },
    {
      "case": "Suýt va chạm",
      "text": "{subject} {action}( và {speed}), {relation} {object}, suýt xảy ra va chạm."
    },
    {
      "case": "Không rõ loại sự kiện",
      "text": "{subject} {action}( và {speed}), {relation} {object}."
    },
    {
      "case": "Cả A và B, va chạm",
      "text": "{A} {action_A}, đồng thời {B} {action_B}, đi vào đường đi của nhau, dẫn đến va chạm."
    },
    {
      "case": "Cả A và B, suýt va chạm",
      "text": "{A} {action_A}, đồng thời {B} {action_B}, đi vào đường đi của nhau, suýt xảy ra va chạm."
    },
    {
      "case": "Cả A và B, không rõ loại sự kiện",
      "text": "{A} {action_A}, đồng thời {B} {action_B}, đi vào đường đi của nhau."
    }
  ],
  "keyframes": [
    "start",
    "end"
  ],
  "cells": [
    {
      "id": "event_type",
      "label": "Loại sự kiện",
      "required": true,
      "options": [
        {
          "id": "event_type.collision",
          "label": "va chạm"
        },
        {
          "id": "event_type.near_miss",
          "label": "suýt va chạm"
        },
        {
          "id": "event_type.unclear",
          "label": "không rõ"
        }
      ]
    },
    {
      "id": "subject",
      "label": "Chủ thể",
      "required": true,
      "from_entities": true,
      "options": [
        {
          "id": "subject.both",
          "label": "cả hai bên"
        },
        {
          "id": "subject.unclear",
          "label": "không rõ"
        }
      ]
    },
    {
      "id": "object",
      "label": "Đối tượng",
      "required": false,
      "from_entities": true,
      "auto_fill": "Đối tượng: video có 2 thực thể thì hệ thống tự điền bên còn lại; từ 3 thực thể trở lên thì chọn từ E.",
      "options": []
    },
    {
      "id": "conflict_type",
      "label": "Kiểu xung đột",
      "required": true,
      "options": [
        {
          "id": "conflict_type.k01",
          "label": "Xe phía trước dừng hoặc đứng yên",
          "code": "K01",
          "group": "Cùng chiều, phía trước",
          "relation": "tiến sát phía sau"
        },
        {
          "id": "conflict_type.k02",
          "label": "Xe phía trước phanh, giảm tốc",
          "code": "K02",
          "group": "Cùng chiều, phía trước",
          "relation": "ở ngay phía trước"
        },
        {
          "id": "conflict_type.k03",
          "label": "Tiến sát xe phía trước chạy chậm",
          "code": "K03",
          "group": "Cùng chiều, phía trước",
          "relation": "tiến sát phía sau"
        },
        {
          "id": "conflict_type.k04",
          "label": "Chuyển làn, nhập làn",
          "code": "K04",
          "group": "Cùng chiều, bên cạnh",
          "relation": "đi vào đường đi của"
        },
        {
          "id": "conflict_type.k05",
          "label": "Vượt, len giữa các xe",
          "code": "K05",
          "group": "Cùng chiều, bên cạnh",
          "relation": "tiến sát bên hông"
        },
        {
          "id": "conflict_type.k06",
          "label": "Rẽ cắt qua xe đi cùng chiều bên cạnh",
          "code": "K06",
          "group": "Cùng chiều, bên cạnh",
          "relation": "cắt ngang phía trước"
        },
        {
          "id": "conflict_type.k07",
          "label": "Xe đỗ ven đường, mở cửa, ra khỏi chỗ đỗ",
          "code": "K07",
          "group": "Cùng chiều, bên cạnh",
          "relation": "đi vào đường đi của"
        },
        {
          "id": "conflict_type.k08",
          "label": "Lấn sang phần đường ngược chiều",
          "code": "K08",
          "group": "Ngược chiều",
          "relation": "đi đối đầu với"
        },
        {
          "id": "conflict_type.k09",
          "label": "Đi ngược chiều trên làn của người khác",
          "code": "K09",
          "group": "Ngược chiều",
          "relation": "đi đối đầu với"
        },
        {
          "id": "conflict_type.k10",
          "label": "Rẽ trái hoặc quay đầu cắt đầu xe ngược chiều",
          "code": "K10",
          "group": "Ngược chiều",
          "relation": "cắt ngang phía trước"
        },
        {
          "id": "conflict_type.k11",
          "label": "Hai hướng cắt nhau tại giao lộ, cùng đi thẳng",
          "code": "K11",
          "group": "Cắt ngang",
          "relation": "cắt ngang phía trước"
        },
        {
          "id": "conflict_type.k12",
          "label": "Ra từ đường nhánh, hẻm, bãi xe",
          "code": "K12",
          "group": "Cắt ngang",
          "relation": "đi vào đường đi của"
        },
        {
          "id": "conflict_type.k13",
          "label": "Quay đầu giữa đường",
          "code": "K13",
          "group": "Cắt ngang",
          "relation": "cắt ngang phía trước"
        },
        {
          "id": "conflict_type.k14",
          "label": "Băng ngang đường giữa đoạn",
          "code": "K14",
          "group": "Cắt ngang",
          "relation": "cắt ngang phía trước"
        },
        {
          "id": "conflict_type.k15",
          "label": "Người đi bộ băng qua hoặc đi dưới lòng đường",
          "code": "K15",
          "group": "Người đi bộ, động vật",
          "relation": "cắt ngang phía trước"
        },
        {
          "id": "conflict_type.k16",
          "label": "Động vật lao ra đường",
          "code": "K16",
          "group": "Người đi bộ, động vật",
          "relation": "cắt ngang phía trước"
        },
        {
          "id": "conflict_type.k17",
          "label": "Lùi xe vào bên khác",
          "code": "K17",
          "group": "Khác",
          "relation": "tiến sát phía sau"
        },
        {
          "id": "conflict_type.k18",
          "label": "Một bên trượt, văng, không do bên kia",
          "code": "K18",
          "group": "Khác",
          "relation": "không có"
        },
        {
          "id": "conflict_type.unclear",
          "label": "không rõ"
        }
      ]
    },
    {
      "id": "action",
      "label": "Hành động",
      "required": true,
      "parent_cell": "conflict_type",
      "per_party_when": "subject.both",
      "options": [
        {
          "id": "action.k01.no_slowdown",
          "label": "không giảm tốc",
          "parent": "conflict_type.k01"
        },
        {
          "id": "action.k01.accelerate",
          "label": "tăng tốc",
          "parent": "conflict_type.k01"
        },
        {
          "id": "action.k02.hard_brake",
          "label": "phanh gấp",
          "parent": "conflict_type.k02"
        },
        {
          "id": "action.k02.sudden_stop",
          "label": "dừng đột ngột",
          "parent": "conflict_type.k02"
        },
        {
          "id": "action.k03.no_slowdown",
          "label": "không giảm tốc",
          "parent": "conflict_type.k03"
        },
        {
          "id": "action.k03.accelerate",
          "label": "tăng tốc",
          "parent": "conflict_type.k03"
        },
        {
          "id": "action.k04.lane_change_left",
          "label": "chuyển sang làn bên trái",
          "parent": "conflict_type.k04"
        },
        {
          "id": "action.k04.lane_change_right",
          "label": "chuyển sang làn bên phải",
          "parent": "conflict_type.k04"
        },
        {
          "id": "action.k05.overtake_left",
          "label": "vượt bên trái",
          "parent": "conflict_type.k05"
        },
        {
          "id": "action.k05.overtake_right",
          "label": "vượt bên phải",
          "parent": "conflict_type.k05"
        },
        {
          "id": "action.k05.filter_between",
          "label": "len giữa",
          "parent": "conflict_type.k05"
        },
        {
          "id": "action.k06.turn_left",
          "label": "rẽ trái",
          "parent": "conflict_type.k06"
        },
        {
          "id": "action.k06.turn_right",
          "label": "rẽ phải",
          "parent": "conflict_type.k06"
        },
        {
          "id": "action.k07.open_door",
          "label": "mở cửa xe",
          "parent": "conflict_type.k07"
        },
        {
          "id": "action.k07.pull_out",
          "label": "ra khỏi chỗ đỗ",
          "parent": "conflict_type.k07"
        },
        {
          "id": "action.k08.encroach_overtaking",
          "label": "lấn khi vượt",
          "parent": "conflict_type.k08"
        },
        {
          "id": "action.k08.encroach_curve",
          "label": "lấn khi vào cua",
          "parent": "conflict_type.k08"
        },
        {
          "id": "action.k08.encroach_straight",
          "label": "lấn khi đi thẳng",
          "parent": "conflict_type.k08"
        },
        {
          "id": "action.k09.wrong_way_straight",
          "label": "đi thẳng ngược chiều",
          "parent": "conflict_type.k09"
        },
        {
          "id": "action.k10.turn_left",
          "label": "rẽ trái",
          "parent": "conflict_type.k10"
        },
        {
          "id": "action.k10.u_turn",
          "label": "quay đầu",
          "parent": "conflict_type.k10"
        },
        {
          "id": "action.k11.left_to_right",
          "label": "từ trái sang phải",
          "parent": "conflict_type.k11"
        },
        {
          "id": "action.k11.right_to_left",
          "label": "từ phải sang trái",
          "parent": "conflict_type.k11"
        },
        {
          "id": "action.k12.exit_from_left",
          "label": "ra từ bên trái",
          "parent": "conflict_type.k12"
        },
        {
          "id": "action.k12.exit_from_right",
          "label": "ra từ bên phải",
          "parent": "conflict_type.k12"
        },
        {
          "id": "action.k13.u_turn_left",
          "label": "quay đầu sang trái",
          "parent": "conflict_type.k13"
        },
        {
          "id": "action.k13.u_turn_right",
          "label": "quay đầu sang phải",
          "parent": "conflict_type.k13"
        },
        {
          "id": "action.k14.left_to_right",
          "label": "từ trái sang phải",
          "parent": "conflict_type.k14"
        },
        {
          "id": "action.k14.right_to_left",
          "label": "từ phải sang trái",
          "parent": "conflict_type.k14"
        },
        {
          "id": "action.k15.left_to_right",
          "label": "từ trái sang phải",
          "parent": "conflict_type.k15"
        },
        {
          "id": "action.k15.right_to_left",
          "label": "từ phải sang trái",
          "parent": "conflict_type.k15"
        },
        {
          "id": "action.k15.along_road",
          "label": "đi dọc đường",
          "parent": "conflict_type.k15"
        },
        {
          "id": "action.k16.left_to_right",
          "label": "từ trái sang phải",
          "parent": "conflict_type.k16"
        },
        {
          "id": "action.k16.right_to_left",
          "label": "từ phải sang trái",
          "parent": "conflict_type.k16"
        },
        {
          "id": "action.k17.reverse",
          "label": "lùi xe",
          "parent": "conflict_type.k17"
        },
        {
          "id": "action.k18.skid",
          "label": "trượt",
          "parent": "conflict_type.k18"
        },
        {
          "id": "action.k18.run_off_lane",
          "label": "văng khỏi làn",
          "parent": "conflict_type.k18"
        },
        {
          "id": "action.k18.tire_blowout",
          "label": "nổ lốp",
          "parent": "conflict_type.k18"
        }
      ]
    },
    {
      "id": "speed",
      "label": "Tốc độ",
      "required": false,
      "options": [
        {
          "id": "speed.hard_brake",
          "label": "phanh gấp"
        },
        {
          "id": "speed.sudden_stop",
          "label": "dừng đột ngột"
        },
        {
          "id": "speed.accelerate",
          "label": "tăng tốc"
        },
        {
          "id": "speed.no_slowdown",
          "label": "không giảm tốc"
        },
        {
          "id": "speed.stationary",
          "label": "đứng yên"
        },
        {
          "id": "speed.high",
          "label": "tốc độ cao",
          "phrase": "chạy tốc độ cao"
        }
      ]
    }
  ]
}$cb$::jsonb,
   '68753b0118d54903a2d41d982bc945dea41da7b02bd5d4e7ba509a25bd6503a2', '2026-11-16'),
  ('V.v2', 'V', 2, $cb${
  "group": "V",
  "version": 2,
  "frozen_on": "2026-11-16",
  "source": "docs/guidelines/V-vi-pham.md",
  "question": "Có hành vi vi phạm quy tắc giao thông nào quan sát được không?",
  "templates": [
    {
      "case": "Có",
      "text": "{violator} {behavior}."
    },
    {
      "case": "Có, cả hai bên",
      "text": "{A} {behavior_A}, đồng thời {B} {behavior_B}."
    },
    {
      "case": "Có, cả hai bên cùng hành vi",
      "text": "Cả {A} và {B} cùng {behavior}."
    },
    {
      "case": "Không quan sát thấy",
      "text": "Không quan sát thấy vi phạm quy tắc giao thông rõ ràng."
    },
    {
      "case": "Không rõ",
      "text": "Không thể xác định."
    }
  ],
  "cells": [
    {
      "id": "result",
      "label": "Kết quả",
      "required": true,
      "options": [
        {
          "id": "result.yes",
          "label": "có"
        },
        {
          "id": "result.none_observed",
          "label": "không quan sát thấy"
        },
        {
          "id": "result.unclear",
          "label": "không rõ"
        }
      ]
    },
    {
      "id": "violator",
      "label": "Bên vi phạm",
      "required": false,
      "when": "khi có",
      "from_entities": true,
      "options": [
        {
          "id": "violator.both",
          "label": "cả hai bên"
        }
      ]
    },
    {
      "id": "behavior",
      "label": "Hành vi",
      "required": false,
      "when": "khi có",
      "options": [
        {
          "id": "behavior.wrong_lane",
          "label": "đi sai làn, lấn làn"
        },
        {
          "id": "behavior.wrong_way",
          "label": "đi ngược chiều"
        },
        {
          "id": "behavior.red_light",
          "label": "vượt đèn đỏ",
          "condition": "chỉ khi thấy rõ đèn."
        },
        {
          "id": "behavior.sign_or_marking",
          "label": "không chấp hành biển báo, vạch kẻ đường",
          "condition": "chỉ khi thấy rõ biển hoặc vạch. Người đi bộ sang đường khi đèn dành cho người đi bộ đỏ cũng chọn lựa chọn này."
        },
        {
          "id": "behavior.fail_to_yield",
          "label": "không nhường đường",
          "condition": "chỉ khi thấy rõ bên có quyền đi trước (xe đang đi thẳng trên đường chính, người đi bộ trên vạch, xe trong giao lộ). Dùng cho cả xe và người đi bộ."
        },
        {
          "id": "behavior.tailgating",
          "label": "không giữ khoảng cách an toàn"
        },
        {
          "id": "behavior.illegal_overtake",
          "label": "vượt xe sai quy định",
          "condition": "chỉ khi thấy rõ vượt qua vạch liền, tại giao lộ hoặc khúc cua."
        },
        {
          "id": "behavior.illegal_turn",
          "label": "chuyển hướng, quay đầu sai quy định",
          "condition": "chỉ khi thấy rõ biển cấm, vạch liền hoặc vị trí không được rẽ, quay đầu."
        },
        {
          "id": "behavior.illegal_reverse",
          "label": "lùi xe sai quy định"
        },
        {
          "id": "behavior.no_helmet",
          "label": "không đội mũ bảo hiểm",
          "condition": "chỉ khi thấy rõ đầu người trên xe máy."
        },
        {
          "id": "behavior.walking_in_road",
          "label": "đi bộ dưới lòng đường",
          "condition": "người đi bộ đứng hoặc đi dọc trong phần đường xe chạy, không phải băng qua."
        },
        {
          "id": "behavior.no_slowdown_intersection",
          "label": "không giảm tốc độ qua giao lộ",
          "condition": "chỉ khi thấy rõ là giao lộ và thấy rõ xe không giảm tốc khi vào giao lộ."
        },
        {
          "id": "behavior.other",
          "label": "khác",
          "condition": "ghi ngắn hành vi nhìn thấy, không dùng từ \"lỗi\", \"vi phạm điều/khoản\", mức phạt.",
          "free_text": true
        }
      ],
      "per_party_when": "violator.both"
    }
  ],
  "prefill_from_c": [
    {
      "conflict_types": [
        "K01",
        "K02",
        "K03"
      ],
      "option": "behavior.tailgating"
    },
    {
      "conflict_types": [
        "K04"
      ],
      "option": "behavior.wrong_lane"
    },
    {
      "conflict_types": [
        "K08"
      ],
      "c_actions": [
        "action.k08.encroach_curve",
        "action.k08.encroach_straight"
      ],
      "option": "behavior.wrong_lane",
      "note": "K08 khi vào cua hoặc đi thẳng"
    },
    {
      "conflict_types": [
        "K05"
      ],
      "option": "behavior.illegal_overtake"
    },
    {
      "conflict_types": [
        "K08"
      ],
      "c_actions": [
        "action.k08.encroach_overtaking"
      ],
      "option": "behavior.illegal_overtake",
      "note": "K08 khi vượt"
    },
    {
      "conflict_types": [
        "K06",
        "K10",
        "K13"
      ],
      "option": "behavior.illegal_turn"
    },
    {
      "conflict_types": [
        "K09"
      ],
      "option": "behavior.wrong_way"
    },
    {
      "conflict_types": [
        "K11",
        "K12",
        "K14",
        "K15"
      ],
      "option": "behavior.fail_to_yield"
    },
    {
      "conflict_types": [
        "K17"
      ],
      "option": "behavior.illegal_reverse"
    }
  ]
}$cb$::jsonb,
   '86457ed5b40607999e173d019436184f78f86f7224adaf10736e2ce4194e5aec', '2026-11-16'),
  ('Attr.v1', 'Attr', 1, $cb${
  "group": "Attr",
  "version": 1,
  "frozen_on": "2026-11-16",
  "source": "docs/guidelines/Attr-ben-gop-phan.md",
  "question": "Bên nào đóng vai trò chính dẫn đến va chạm, dựa trên bằng chứng thị giác?",
  "templates": [
    {
      "case": "Một bên",
      "text": "{A}."
    },
    {
      "case": "Hai bên",
      "text": "Cả {A} và {B}."
    },
    {
      "case": "Không rõ",
      "text": "Không thể xác định."
    }
  ],
  "keyframes": [
    "start",
    "end"
  ],
  "cells": [
    {
      "id": "parties",
      "label": "Bên góp phần chính",
      "required": true,
      "from_entities": true,
      "max_entities": 2,
      "options": [
        {
          "id": "parties.unclear",
          "label": "không rõ"
        }
      ]
    }
  ]
}$cb$::jsonb,
   'f87a7a91f8e1d732b5852044470aa20d4c05695034f28334ddc943d46900cf9b', '2026-11-16');

-- 2. Cell rules -------------------------------------------------------------------
--
-- validate_slots of 20261116100000_slot_data_model.sql with two changes:
--   - the conditional rules of V (and R) are decided before rule 9, so V.v2
--     with violator.both checks its outer cells with the "khi có" rule:
--     violator.both needs result.yes, and behavior is required in each party;
--   - the cells forbidden beside C subject.both are limited to those the book
--     has, since C.v2 has no evasion cells (a key outside the book is refused
--     as unknown_cell either way).
-- Attr needs no new rule: its one cell, parties, is a from_entities cell
-- holding one or two entity references (validate_slot_cells, as O parties) or
-- the option parties.unclear, and it is required.
create or replace function public.validate_slots(version text, slots jsonb, video uuid, annotator uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare book jsonb;
declare grp text;
declare all_cells text[];
declare party_cells text[];
declare required text[];
declare forbidden text[] := '{}';
declare item jsonb;
declare when_cells text[];
declare when_option text;
declare outer_cells text[];
declare parent_cells text[];
begin
  select c.content into book from public.codebook_versions c where c.id = validate_slots.version;
  if book is null then
    raise exception using message = format('Slot answer: unknown codebook %s', version), hint = 'codebook_version';
  end if;
  if slots is null or jsonb_typeof(slots) <> 'object' then
    raise exception using message = 'Slot answer: the cells must be an object', hint = 'invalid_value';
  end if;
  grp := book->>'group';
  all_cells := array(select c.value->>'id' from jsonb_array_elements(book->'cells') c);
  required := array(select c.value->>'id' from jsonb_array_elements(book->'cells') c
                    where coalesce((c.value->>'required')::boolean, false));
  party_cells := array(select c.value->>'id' from jsonb_array_elements(book->'cells') c
                       where coalesce((c.value->>'per_party')::boolean, false));

  if cardinality(party_cells) > 0 then
    -- Prev: {"parties": [{"party": {"entity": K}, "main_action": ..., "extra_action": ...}]}, one or two
    -- parties, different entities; party.both is stored as two parties, never as itself (spec Open 5).
    if exists (select 1 from jsonb_object_keys(slots) k where k <> 'parties') then
      raise exception using message = format('Slot answer: %s holds its cells per party, in "parties"', grp), hint = 'per_party';
    end if;
    if jsonb_typeof(slots->'parties') is distinct from 'array' or jsonb_array_length(slots->'parties') not between 1 and 2 then
      raise exception using message = 'Slot answer: parties are one or two', hint = 'parties';
    end if;
    if exists (select 1 from jsonb_array_elements(slots->'parties') p where p.value->'party'->>'option' = 'party.both') then
      raise exception using message = 'Slot answer: party.both is stored as two parties, one per entity', hint = 'parties';
    end if;
    -- party.unclear (spec Open 3, decided 2026-11-16: "C và Attr đều không
    -- rõ" gives "Không thể xác định." and the action cells stay empty): the
    -- only party, without actions.
    if exists (select 1 from jsonb_array_elements(slots->'parties') p where p.value->'party'->>'option' = 'party.unclear') then
      if jsonb_array_length(slots->'parties') <> 1 then
        raise exception using message = 'Slot answer: party.unclear is the only party', hint = 'parties';
      end if;
      perform public.validate_slot_cells(book, slots->'parties'->0, party_cells || 'party'::text,
        array['party'], party_cells, video, annotator);
      return;
    end if;
    if (select count(distinct p.value->'party') from jsonb_array_elements(slots->'parties') p)
       <> jsonb_array_length(slots->'parties') then
      raise exception using message = 'Slot answer: each party is a different entity', hint = 'parties';
    end if;
    for item in select p.value from jsonb_array_elements(slots->'parties') p loop
      perform public.validate_slot_cells(book, item, party_cells || 'party'::text,
        array(select r from unnest(required) r where r = any(party_cells || 'party'::text)), forbidden, video, annotator);
    end loop;
    return;
  end if;

  -- The conditional rules of V and R, decided before rule 9: V.v2 reaches
  -- rule 9 with violator.both, and its outer cells keep the "khi có" rule.
  if grp = 'V' then
    if slots->'result'->>'option' = 'result.yes' then
      required := required || array['violator', 'behavior'];
    else
      forbidden := array['violator', 'behavior'];
    end if;
  elsif grp = 'R' and slots->'has_aftermath'->>'option' = 'has_aftermath.no' then
    required := array['has_aftermath'];
    forbidden := array(select c from unnest(all_cells) c where c <> 'has_aftermath');
  end if;

  -- Rule 9. One per_party_when value per book (C: action, subject.both; V.v2: behavior, violator.both).
  when_cells := array(select c.value->>'id' from jsonb_array_elements(book->'cells') c where c.value ? 'per_party_when');
  if cardinality(when_cells) > 0 then
    select c.value->>'per_party_when' into when_option from jsonb_array_elements(book->'cells') c
    where c.value->>'id' = when_cells[1];
    if slots->split_part(when_option, '.', 1)->>'option' is distinct from when_option then
      if slots ? 'parties' then
        raise exception using message = format('Slot answer: parties only with %s', when_option), hint = 'per_party';
      end if;
    else
      if exists (select 1 from unnest(when_cells) w where slots ? w) then
        raise exception using message = format('Slot answer: with %s, %s is given per party', when_option,
          array_to_string(when_cells, ', ')), hint = 'per_party';
      end if;
      if jsonb_typeof(slots->'parties') is distinct from 'array' or jsonb_array_length(slots->'parties') <> 2
         or exists (select 1 from jsonb_array_elements(slots->'parties') p
                    where jsonb_typeof(p.value) <> 'object' or jsonb_typeof(p.value->'party') is distinct from 'object'
                       or (p.value->'party') - 'entity' <> '{}'::jsonb
                       or jsonb_typeof(p.value->'party'->'entity') is distinct from 'string')
         or (select count(distinct p.value->'party'->>'entity') from jsonb_array_elements(slots->'parties') p) <> 2 then
        raise exception using message = format('Slot answer: %s is two parties, each a different entity', when_option),
          hint = 'parties';
      end if;
      parent_cells := array(select c.value->>'parent_cell' from jsonb_array_elements(book->'cells') c
                            where c.value->>'id' = any(when_cells) and c.value ? 'parent_cell');
      for item in select p.value from jsonb_array_elements(slots->'parties') p loop
        if not exists (select 1 from public.video_entities e where e.video_id = video
                       and e.annotator_id = annotator and e.entity_key = item->'party'->>'entity') then
          raise exception using message = format('Slot answer: entity %s is not declared in E', item->'party'->>'entity'),
            hint = 'unknown_entity';
        end if;
        -- The party's own cells, checked beside the shared parent they hang under.
        perform public.validate_slot_cells(book,
          (item - 'party') || coalesce((select jsonb_object_agg(k, slots->k) from unnest(parent_cells) k where slots ? k), '{}'::jsonb),
          when_cells || parent_cells, array(select r from unnest(required) r where r = any(when_cells)), '{}', video, annotator);
      end loop;
      outer_cells := array(select c from unnest(all_cells) c where c <> all(when_cells));
      if grp = 'C' then
        -- Only cells this book has: C.v2 has no evasion cells.
        forbidden := array(select f from unnest(array['object', 'speed', 'evader', 'evasion', 'evasion_result']) f
                           where f = any(all_cells));
      end if;
      perform public.validate_slot_cells(book, slots - 'parties', outer_cells,
        array(select r from unnest(required) r where r <> all(when_cells)), forbidden, video, annotator);
      return;
    end if;
  end if;

  perform public.validate_slot_cells(book, slots, all_cells, required, forbidden, video, annotator);
end;
$$;
