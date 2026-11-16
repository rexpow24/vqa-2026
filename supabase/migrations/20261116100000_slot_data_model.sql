-- P2, slot answers (features/slot-data-model/): the data layer for answering
-- seven question groups by choosing cells from a frozen codebook instead of
-- rewriting the draft as free text. One file, so every reader of the verdict
-- changes together. Applied locally first; production needs its own approval.

-- 1. Frozen codebooks ---------------------------------------------------------
--
-- One row per codebook/<group>.v1.json, equal to the file, read-only through
-- the API. A later version arrives in a new migration as a new row; a row is
-- never edited. sha256 pins the exact bytes that were seeded, so an edit to a
-- file after this migration shows up as a mismatch (verify-slots, A1).
--
-- The values below are generated, not typed. From the repository root:
--
--   python - > seed.sql <<'PY'
--   import hashlib, json, pathlib, sys
--   groups = ["S", "E", "C", "V", "O", "R", "Prev"]
--   out = []
--   for i, g in enumerate(groups):
--       raw = pathlib.Path(f"codebook/{g}.v1.json").read_bytes()
--       d = json.loads(raw)
--       body = json.dumps(d, ensure_ascii=False, indent=2)
--       assert "$cb$" not in body
--       end = ";" if i == len(groups) - 1 else ","
--       out.append(f"  ('{d['group']}.v{d['version']}', '{d['group']}', {d['version']}, $cb${body}$cb$::jsonb,\n"
--                  f"   '{hashlib.sha256(raw).hexdigest()}', '{d['frozen_on']}'){end}\n")
--   sys.stdout.buffer.write("".join(out).encode("utf-8"))
--   PY
--
-- content is the parsed file re-printed (same JSON value, LF line endings);
-- sha256 is of the file's own bytes, which .gitattributes keeps LF on every
-- checkout (eol=lf), so the seed does not depend on core.autocrlf.

create table public.codebook_versions (
  id text primary key check (id = qgroup || '.v' || version),
  qgroup text not null check (qgroup in ('S','E','C','V','O','R','Prev')),
  version integer not null check (version > 0),
  content jsonb not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  frozen_on date not null,
  unique (qgroup, version)
);

insert into public.codebook_versions (id, qgroup, version, content, sha256, frozen_on) values
  ('S.v1', 'S', 1, $cb${
  "group": "S",
  "version": 1,
  "frozen_on": "2026-11-14",
  "source": "docs/guidelines/S-boi-canh.md",
  "question": "Thời tiết, ánh sáng, loại đường và tình trạng mặt đường ra sao?",
  "template": "Trời {weather}, {light}, {road_type} tại {segment}, mặt đường {surface}, mật độ xe {density}.",
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
          "id": "weather.overcast",
          "label": "âm u"
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
          "label": "thẳng"
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
  ]
}$cb$::jsonb,
   'd4af862b1af5130877f1160ba78d5fe14d362a3093bb50e6862d0619515b7397', '2026-11-14'),
  ('E.v1', 'E', 1, $cb${
  "group": "E",
  "version": 1,
  "frozen_on": "2026-11-15",
  "source": "docs/guidelines/E-thuc-the.md",
  "question": "Loại phương tiện và màu sắc của các bên liên quan là gì?",
  "templates": [
    {
      "case": "Ô tô có camera hành trình",
      "text": "Xe ô tô (có camera hành trình)"
    },
    {
      "case": "Ô tô khác",
      "text": "Xe ô tô màu [4]"
    },
    {
      "case": "Xe khách, xe tải",
      "text": "[1] [2] màu [4]"
    },
    {
      "case": "Xe máy, xe hai bánh",
      "text": "Xe máy màu [4] do người mặc áo [5] điều khiển (chở [6] người, khi từ 2 trở lên)"
    },
    {
      "case": "Xe ba gác, khác",
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
          "id": "type.motorbike",
          "label": "xe máy, xe hai bánh"
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
          "id": "type.other",
          "label": "khác",
          "free_text": true
        }
      ]
    },
    {
      "id": "size",
      "label": "Cỡ",
      "required": false,
      "when": "Chỉ với xe khách, xe tải",
      "options": [
        {
          "id": "size.large",
          "label": "to"
        },
        {
          "id": "size.small",
          "label": "nhỏ"
        }
      ]
    },
    {
      "id": "dashcam",
      "label": "Camera hành trình",
      "required": false,
      "when": "Chỉ với ô tô",
      "options": [
        {
          "id": "dashcam.yes",
          "label": "có"
        },
        {
          "id": "dashcam.no",
          "label": "không"
        }
      ]
    },
    {
      "id": "vehicle_color",
      "label": "Màu xe",
      "required": false,
      "when": "Bỏ trống với ô tô có camera hành trình, người đi bộ, động vật",
      "options": [
        {
          "id": "vehicle_color.white",
          "label": "trắng"
        },
        {
          "id": "vehicle_color.black",
          "label": "đen"
        },
        {
          "id": "vehicle_color.gray_silver",
          "label": "xám, bạc"
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
        },
        {
          "id": "vehicle_color.brown",
          "label": "nâu"
        },
        {
          "id": "vehicle_color.other",
          "label": "màu khác"
        },
        {
          "id": "vehicle_color.light",
          "label": "màu sáng"
        },
        {
          "id": "vehicle_color.dark",
          "label": "màu tối"
        },
        {
          "id": "vehicle_color.unclear",
          "label": "không rõ"
        }
      ]
    },
    {
      "id": "clothing_color",
      "label": "Màu áo người điều khiển",
      "required": false,
      "when": "Chỉ với xe máy, xe hai bánh và người đi bộ",
      "options": [
        {
          "id": "clothing_color.white",
          "label": "trắng"
        },
        {
          "id": "clothing_color.black",
          "label": "đen"
        },
        {
          "id": "clothing_color.gray_silver",
          "label": "xám, bạc"
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
        },
        {
          "id": "clothing_color.brown",
          "label": "nâu"
        },
        {
          "id": "clothing_color.other",
          "label": "màu khác"
        },
        {
          "id": "clothing_color.light",
          "label": "màu sáng"
        },
        {
          "id": "clothing_color.dark",
          "label": "màu tối"
        },
        {
          "id": "clothing_color.unclear",
          "label": "không rõ"
        }
      ]
    },
    {
      "id": "riders",
      "label": "Số người trên xe",
      "required": false,
      "when": "Chỉ với xe máy, xe hai bánh",
      "options": [
        {
          "id": "riders.one",
          "label": "1"
        },
        {
          "id": "riders.two",
          "label": "2"
        },
        {
          "id": "riders.three_plus",
          "label": "3 trở lên"
        }
      ]
    }
  ]
}$cb$::jsonb,
   '9c467a1742be73551d1714c52a2fdb599e163281894af5aebeb3e5ed2b4179c9', '2026-11-15'),
  ('C.v1', 'C', 1, $cb${
  "group": "C",
  "version": 1,
  "frozen_on": "2026-11-15",
  "source": "docs/guidelines/C-nguyen-nhan.md",
  "question": "Nguyên nhân trực tiếp hoặc hành động ngay trước va chạm là gì?",
  "templates": [
    {
      "case": "Va chạm",
      "text": "[Chủ thể] [hành động] (và [tốc độ]), [quan hệ] [đối tượng], dẫn đến va chạm."
    },
    {
      "case": "Suýt va chạm",
      "text": "[Chủ thể] [hành động] (và [tốc độ]), [quan hệ] [đối tượng], [bên né] phải [cách né], [kết quả né]."
    },
    {
      "case": "Cả A và B",
      "text": "[A] [hành động của A], đồng thời [B] [hành động của B], đi vào đường đi của nhau, dẫn đến [va chạm hoặc suýt va chạm]."
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
        }
      ]
    },
    {
      "id": "evader",
      "label": "Bên né",
      "required": false,
      "when": "chỉ khi có né",
      "from_entities": true,
      "options": [
        {
          "id": "evader.both",
          "label": "cả hai bên"
        }
      ]
    },
    {
      "id": "evasion",
      "label": "Cách né",
      "required": false,
      "options": [
        {
          "id": "evasion.hard_brake",
          "label": "phanh gấp"
        },
        {
          "id": "evasion.steer_left",
          "label": "đánh lái sang trái"
        },
        {
          "id": "evasion.steer_right",
          "label": "đánh lái sang phải"
        },
        {
          "id": "evasion.brake_and_steer",
          "label": "phanh gấp và đánh lái"
        }
      ]
    },
    {
      "id": "evasion_result",
      "label": "Kết quả né",
      "required": false,
      "options": [
        {
          "id": "evasion_result.avoided",
          "label": "tránh được"
        },
        {
          "id": "evasion_result.fell_or_skidded",
          "label": "ngã, trượt"
        },
        {
          "id": "evasion_result.still_hit",
          "label": "vẫn chạm"
        },
        {
          "id": "evasion_result.hit_other",
          "label": "chạm vào thực thể khác",
          "from_entities": true
        }
      ]
    }
  ]
}$cb$::jsonb,
   '847138975860141295ca9be297827adb65879e144c8ce1d77c31dff7106d3d8d', '2026-11-15'),
  ('V.v1', 'V', 1, $cb${
  "group": "V",
  "version": 1,
  "frozen_on": "2026-11-15",
  "source": "docs/guidelines/V-vi-pham.md",
  "question": "Có hành vi vi phạm quy tắc giao thông nào quan sát được không?",
  "templates": [
    {
      "case": "Có",
      "text": "[1] [2]."
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
      "options": []
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
          "id": "behavior.other",
          "label": "khác",
          "condition": "ghi ngắn hành vi nhìn thấy, không dùng từ \"lỗi\", \"vi phạm điều/khoản\", mức phạt.",
          "free_text": true
        }
      ]
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
   '45feaf90f29ad05246179e2f22af1bee03c5f3f3f3fe5d8716d4d675972eb51a', '2026-11-15'),
  ('O.v1', 'O', 1, $cb${
  "group": "O",
  "version": 1,
  "frozen_on": "2026-11-15",
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
      "case": "Không rõ",
      "text": "Không thể xác định."
    }
  ],
  "constraints": [
    "Ràng buộc với C: loại sự kiện \"va chạm\" thì mức độ không được là \"không va chạm\"; \"suýt va chạm\" với kết quả né \"tránh được\" thì mức độ là \"không va chạm\".",
    "Suýt va chạm nhưng bên né ngã, trượt hoặc chạm thực thể khác thì ghi mức độ theo hậu quả nhìn thấy."
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
      "options": [
        {
          "id": "level.none",
          "label": "không va chạm"
        },
        {
          "id": "level.minor",
          "label": "va chạm nhẹ"
        },
        {
          "id": "level.moderate",
          "label": "va chạm vừa"
        },
        {
          "id": "level.severe",
          "label": "va chạm mạnh"
        },
        {
          "id": "level.unclear",
          "label": "không rõ"
        }
      ]
    },
    {
      "id": "sign",
      "label": "Dấu hiệu nhìn thấy",
      "required": true,
      "parent_cell": "level",
      "options": [
        {
          "id": "sign.none",
          "label": "không có",
          "parent": "level.none"
        },
        {
          "id": "sign.scrape_stationary",
          "label": "chạm quẹt, vẫn đứng yên",
          "parent": "level.minor"
        },
        {
          "id": "sign.scrape_continued",
          "label": "chạm quẹt, vẫn đi tiếp",
          "parent": "level.minor"
        },
        {
          "id": "sign.deflected",
          "label": "lệch hướng",
          "parent": "level.moderate"
        },
        {
          "id": "sign.sudden_stop",
          "label": "dừng đột ngột",
          "parent": "level.moderate"
        },
        {
          "id": "sign.vehicle_fell",
          "label": "xe ngã",
          "parent": "level.moderate"
        },
        {
          "id": "sign.person_fell",
          "label": "người ngã",
          "parent": "level.moderate"
        },
        {
          "id": "sign.overturned",
          "label": "bị lật",
          "parent": "level.severe"
        },
        {
          "id": "sign.thrown",
          "label": "bị văng",
          "parent": "level.severe"
        },
        {
          "id": "sign.visible_deformation",
          "label": "biến dạng rõ",
          "parent": "level.severe"
        },
        {
          "id": "sign.person_lying",
          "label": "người nằm trên đường",
          "parent": "level.severe"
        }
      ]
    }
  ]
}$cb$::jsonb,
   'f9a8e8110429df94425526c2c2986c460b17a4c5d9efe69e5b7b55fce2c3d5fe', '2026-11-15'),
  ('R.v1', 'R', 1, $cb${
  "group": "R",
  "version": 1,
  "frozen_on": "2026-11-15",
  "source": "docs/guidelines/R-ung-xu.md",
  "question": "Hành vi của các bên sau tai nạn là gì?",
  "templates": [
    {
      "case": "Có đoạn sau",
      "text": "[Chủ thể] [1], [đối tượng] [2], người và xe xung quanh [3]."
    },
    {
      "case": "Hai bên cùng hành vi",
      "text": "Các bên [1]."
    },
    {
      "case": "Chỉ một bên",
      "text": "[Chủ thể] [1], người và xe xung quanh [3]."
    },
    {
      "case": "Không có đoạn sau",
      "text": "Không thể xác định."
    }
  ],
  "cells": [
    {
      "id": "has_aftermath",
      "label": "Clip có đoạn sau sự kiện",
      "required": true,
      "options": [
        {
          "id": "has_aftermath.yes",
          "label": "có"
        },
        {
          "id": "has_aftermath.no",
          "label": "không"
        }
      ]
    },
    {
      "id": "subject",
      "label": "Chủ thể",
      "required": true,
      "auto_fill": "Chủ thể và đối tượng được tự điền từ Nhóm C.",
      "options": [
        {
          "id": "subject.stopped",
          "label": "dừng lại"
        },
        {
          "id": "subject.left",
          "label": "tiếp tục di chuyển, rời đi"
        },
        {
          "id": "subject.got_up",
          "label": "tự đứng dậy, dựng xe"
        },
        {
          "id": "subject.scuffle",
          "label": "giằng co"
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
      "auto_fill": "Chủ thể và đối tượng được tự điền từ Nhóm C.",
      "when": "bỏ khi C không có đối tượng, ví dụ K18",
      "options": [
        {
          "id": "object.stopped",
          "label": "dừng lại"
        },
        {
          "id": "object.left",
          "label": "tiếp tục di chuyển, rời đi"
        },
        {
          "id": "object.got_up",
          "label": "tự đứng dậy, dựng xe"
        },
        {
          "id": "object.scuffle",
          "label": "giằng co"
        },
        {
          "id": "object.unclear",
          "label": "không rõ"
        }
      ]
    },
    {
      "id": "bystanders",
      "label": "Người, xe xung quanh",
      "required": true,
      "options": [
        {
          "id": "bystanders.helped",
          "label": "dừng lại hoặc đến hỗ trợ"
        },
        {
          "id": "bystanders.nobody_stopped",
          "label": "không thấy ai dừng lại"
        },
        {
          "id": "bystanders.unclear",
          "label": "không rõ"
        }
      ]
    }
  ]
}$cb$::jsonb,
   '2c077b63d596d4af91a6ea116035ca45db16406699397f509ec59037c8ca726d', '2026-11-15'),
  ('Prev.v1', 'Prev', 1, $cb${
  "group": "Prev",
  "version": 1,
  "frozen_on": "2026-11-15",
  "source": "docs/guidelines/Prev-phong-ngua.md",
  "question": "Lẽ ra người lái hoặc người liên quan nên làm gì để tránh va chạm này?",
  "templates": [
    {
      "case": "Một bên",
      "text": "[Bên] nên [2] (và [3])."
    },
    {
      "case": "Cả hai bên",
      "text": "[A] nên [2 của A] (và [3 của A]); [B] nên [2 của B] (và [3 của B])."
    },
    {
      "case": "C và Attr đều không rõ",
      "text": "Không thể xác định."
    }
  ],
  "cells": [
    {
      "id": "party",
      "label": "Bên",
      "required": true,
      "from_entities": true,
      "auto_fill": "Ô 1 được điền sẵn theo bên góp phần chính ở Nhóm Attr; annotator đổi được, ví dụ thêm bên còn lại khi bên đó cũng tránh được va chạm bằng một hành động rõ ràng.",
      "options": [
        {
          "id": "party.both",
          "label": "cả hai bên"
        },
        {
          "id": "party.unclear",
          "label": "không rõ"
        }
      ]
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
          "id": "main_action.wear_helmet",
          "label": "đội mũ bảo hiểm"
        },
        {
          "id": "main_action.other",
          "label": "khác",
          "free_text": true
        }
      ]
    },
    {
      "id": "extra_action",
      "label": "Hành động thêm",
      "required": false,
      "per_party": true,
      "must_differ_from": "main_action",
      "options": [
        {
          "id": "extra_action.slow_down",
          "label": "giảm tốc"
        },
        {
          "id": "extra_action.keep_distance",
          "label": "giữ khoảng cách an toàn"
        },
        {
          "id": "extra_action.observe_and_yield",
          "label": "quan sát và nhường đường"
        },
        {
          "id": "extra_action.change_lane_safely",
          "label": "chỉ chuyển làn khi an toàn"
        },
        {
          "id": "extra_action.stay_in_lane",
          "label": "đi đúng phần đường"
        },
        {
          "id": "extra_action.steady_steering",
          "label": "giữ ổn định hướng lái"
        },
        {
          "id": "extra_action.stop_and_look",
          "label": "dừng quan sát trước khi băng qua"
        },
        {
          "id": "extra_action.signal",
          "label": "bật xi nhan xin đường"
        },
        {
          "id": "extra_action.avoid_blind_spot",
          "label": "tránh điểm mù xe lớn"
        },
        {
          "id": "extra_action.obey_signals",
          "label": "chấp hành đèn tín hiệu"
        },
        {
          "id": "extra_action.check_vehicle",
          "label": "kiểm tra xe trước khi đi"
        },
        {
          "id": "extra_action.wear_helmet",
          "label": "đội mũ bảo hiểm"
        },
        {
          "id": "extra_action.other",
          "label": "khác",
          "free_text": true
        }
      ]
    }
  ],
  "prefill_from_c": [
    {
      "conflict_types": [
        "K01",
        "K02",
        "K03"
      ],
      "option": "main_action.keep_distance"
    },
    {
      "conflict_types": [
        "K04",
        "K05"
      ],
      "option": "main_action.change_lane_safely"
    },
    {
      "conflict_types": [
        "K06",
        "K10",
        "K11",
        "K12",
        "K13"
      ],
      "option": "main_action.observe_and_yield"
    },
    {
      "conflict_types": [
        "K07"
      ],
      "option": "main_action.observe_and_yield"
    },
    {
      "conflict_types": [
        "K08",
        "K09"
      ],
      "option": "main_action.stay_in_lane"
    },
    {
      "conflict_types": [
        "K14",
        "K15",
        "K16"
      ],
      "option": "main_action.stop_and_look"
    },
    {
      "conflict_types": [
        "K17"
      ],
      "option": "main_action.observe_and_yield"
    },
    {
      "conflict_types": [
        "K18"
      ],
      "option": "main_action.slow_down"
    }
  ],
  "prefill_note": "Bên không phải chủ thể không được điền sẵn."
}$cb$::jsonb,
   'aed6d4c0e1bf0e5ec0f7fec44ee7088b5a31e88950a5ec4f5245afb6e84a09fd', '2026-11-15');

alter table public.codebook_versions enable row level security;
create policy codebook_versions_read on public.codebook_versions for select to authenticated using (true);
revoke all on public.codebook_versions from anon, authenticated;
grant select on public.codebook_versions to authenticated;

-- 2. Answer format of an assignment --------------------------------------------
--
-- 'text' (every existing assignment, through the default) answers all nine
-- groups as today; 'slots' answers the groups that have a codebook by
-- choosing cells. The flag lives on the assignment, not in qgroups.json or in
-- batch, so turning it on for one person changes nobody else's form.

alter table public.video_assignments
  add column answer_format text not null default 'text' check (answer_format in ('text','slots'));

-- 3. Slot answers in qa_annotations ---------------------------------------------
--
-- A slot answer is a qa_annotations row with verdict SLOTS: the cells chosen
-- (slots), the codebook they were chosen from, and the sentence composed from
-- them by the save route (edited_answer). It carries no reason. Whether a row
-- must be a slot answer is decided by the assignment's answer_format and the
-- group having a codebook, never by what the client sent.

alter table public.qa_annotations
  add column slots jsonb,
  add column codebook_version text references public.codebook_versions(id);

alter table public.qa_annotations drop constraint qa_annotations_verdict_check;
alter table public.qa_annotations
  add constraint qa_annotations_verdict_check check (verdict in ('AGREE','NOT_ANSWERABLE','DISAGREE','SLOTS'));

-- Rewritten whole; the ownership, adjudication, keyframe and text-verdict
-- branches are those of 20261107_answer_adjudication.sql and
-- 20261112_keyframes_start_end.sql, unchanged.
create or replace function public.validate_qa_annotation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare video_duration numeric;
declare draft_video uuid;
declare draft_group text;
declare draft_answer text;
declare mark numeric;
declare format text;
declare slot_row boolean;
begin
  if tg_op = 'UPDATE' and (new.draft_id <> old.draft_id or new.annotator_id <> old.annotator_id) then
    raise exception 'QA annotation ownership cannot be changed';
  end if;
  if tg_op = 'UPDATE' and exists (select 1 from public.answer_adjudications j
                                  where j.draft_id = old.draft_id and old.annotator_id = any(j.annotator_ids)) then
    raise exception 'This answer was adjudicated and is locked';
  end if;
  select v.duration_s, d.video_id, d.qgroup, d.answer into video_duration, draft_video, draft_group, draft_answer
  from public.video_drafts d join public.videos v on v.id = d.video_id
  where d.id = new.draft_id and v.status = 'active';
  if video_duration is null then raise exception 'Active draft video not found'; end if;
  if draft_group not in ('C','V','Attr') then
    new.human_keyframes_s := '{}';
  elsif tg_op = 'UPDATE' and new.human_keyframes_s is not distinct from old.human_keyframes_s then
    null;  -- unchanged frames, possibly a legacy 1-3 row: keep as stored
  elsif cardinality(new.human_keyframes_s) <> 2
        or not coalesce(new.human_keyframes_s[1] < new.human_keyframes_s[2], false) then
    raise exception 'Mark exactly two evidence frames: start before end';
  end if;
  foreach mark in array new.human_keyframes_s loop
    if mark is null or mark = 'NaN'::numeric or mark < 0 or mark > video_duration then
      raise exception 'Evidence frame is outside the video';
    end if;
  end loop;

  -- The row's form follows the assignment; no assignment counts as text.
  select a.answer_format into format from public.video_assignments a
  where a.video_id = draft_video and a.annotator_id = new.annotator_id;
  if format = 'slots' then
    -- Two tabs of one annotator: this answer may point at an entity the
    -- other tab is removing. Each would check its own snapshot and both pass
    -- (write skew), so slot writes of one (video, annotator) take the
    -- assignment row in turn; save_video_entities takes the same lock. The
    -- checks below run after it, on what the other tab committed.
    select a.answer_format into format from public.video_assignments a
    where a.video_id = draft_video and a.annotator_id = new.annotator_id
    for update;
  end if;
  slot_row := coalesce(format, 'text') = 'slots'
              and exists (select 1 from public.codebook_versions c where c.qgroup = draft_group);

  if slot_row then
    if new.verdict is distinct from 'SLOTS' then
      raise exception using message = 'Slot answer: this group is answered with cells (verdict SLOTS)', hint = 'slot_group';
    end if;
    if new.reason_code is not null or new.reason_note is not null then
      raise exception using message = 'Slot answer: a slot answer carries no reason', hint = 'reason';
    end if;
    if new.codebook_version is null or not exists (select 1 from public.codebook_versions c
        where c.id = new.codebook_version and c.qgroup = draft_group) then
      raise exception using message = format('Slot answer: codebook %s does not belong to group %s', new.codebook_version, draft_group),
        hint = 'codebook_version';
    end if;
    if draft_group = 'E' then
      -- video_entities owns the entities; the E row is only their snapshot,
      -- whatever the client sent.
      new.slots := jsonb_build_object('entities', coalesce((
        select jsonb_agg(jsonb_build_object('key', e.entity_key, 'cells', e.cells) order by e.entity_key)
        from public.video_entities e where e.video_id = draft_video and e.annotator_id = new.annotator_id), '[]'::jsonb));
    elsif new.slots is null or jsonb_typeof(new.slots) <> 'object' then
      raise exception using message = 'Slot answer: the cells are missing', hint = 'missing_slots';
    else
      perform public.validate_slots(new.codebook_version, new.slots, draft_video, new.annotator_id);
    end if;
    -- The composed sentence may equal the draft word for word (video #39, R).
    new.edited_answer := public.normalize_answer(new.edited_answer);
    if new.edited_answer is null then
      raise exception using message = 'Slot answer: the composed sentence is missing', hint = 'missing_answer';
    end if;
    new.annotated_at := now();
    return new;
  end if;

  -- A text row: N and Attr of a slot assignment, and every row of a text
  -- assignment. It never takes the slot verdict or cells, so a slot form sent
  -- to a text assignment is refused instead of stored beside the text.
  if new.verdict = 'SLOTS' then
    raise exception using message = 'Text answer: this group is answered in text (AGREE, DISAGREE, NOT_ANSWERABLE)',
      hint = 'text_group';
  end if;
  if new.slots is not null or new.codebook_version is not null then
    raise exception using message = 'Text answer: a text answer carries no cells', hint = 'unexpected_slots';
  end if;
  if new.verdict = 'DISAGREE' and (
    new.reason_code not in ('thiếu thực thể','sai thực thể','sai nhân quả',
      'sai mốc thời gian','bịa chi tiết','sai diễn đạt','khác') or new.reason_code is null
  ) then raise exception 'Disagreement needs a reason'; end if;
  if new.verdict = 'DISAGREE' and new.reason_code = 'khác' and length(trim(coalesce(new.reason_note,''))) = 0 then
    raise exception 'Other reason needs a note';
  end if;
  if new.verdict = 'DISAGREE' then
    new.edited_answer := nullif(trim(new.edited_answer), '');
    if public.normalize_answer(new.edited_answer) is null
       or public.normalize_answer(new.edited_answer) = public.normalize_answer(draft_answer) then
      raise exception 'A disagreement needs the corrected answer';
    end if;
  elsif public.normalize_answer(new.edited_answer) is null
        or public.normalize_answer(new.edited_answer) = public.normalize_answer(draft_answer) then
    new.edited_answer := null;
  else
    raise exception 'Only a disagreement can carry an edited answer';
  end if;
  new.annotated_at := now();
  return new;
end;
$$;

-- The answer of a slot row is the sentence composed from its cells, named
-- explicitly rather than left to the else branch, which reads it as "Không trả
-- lời được". effective_answer of 20261107_answer_adjudication.sql plus SLOTS.
create or replace function public.effective_answer(verdict text, edited_answer text, draft_answer text)
returns text language sql immutable set search_path = '' as $$
  select case verdict
    when 'AGREE' then draft_answer
    when 'DISAGREE' then public.normalize_answer(edited_answer)
    when 'SLOTS' then public.normalize_answer(edited_answer)
    else 'Không trả lời được' end
$$;

-- Saves one or two slot answers of the caller in one transaction: the route
-- saves C together with the R sentence re-composed from it, and a bad row
-- leaves neither written. Security invoker, so the qa_annotations policies
-- (own row, assigned video, active user) apply as to any other save.
-- rows: [{draft_id, codebook_version, slots, edited_answer, human_keyframes_s}]
create or replace function public.save_slot_answers(rows jsonb)
returns setof public.qa_annotations
language plpgsql security invoker set search_path = '' as $$
declare item jsonb;
declare saved public.qa_annotations;
begin
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) not between 1 and 2 then
    raise exception 'Slot answer: send one or two answers';
  end if;
  for item in select value from jsonb_array_elements(rows) loop
    insert into public.qa_annotations as q
      (draft_id, annotator_id, verdict, reason_code, reason_note, edited_answer, slots, codebook_version, human_keyframes_s)
    values ((item->>'draft_id')::uuid, (select auth.uid()), 'SLOTS', null, null, item->>'edited_answer',
            item->'slots', item->>'codebook_version',
            coalesce((select array_agg(k.value::numeric(9,3) order by k.ordinality)
                      from jsonb_array_elements_text(item->'human_keyframes_s') with ordinality as k(value, ordinality)),
                     '{}'))
    on conflict (draft_id, annotator_id) do update
      set verdict = excluded.verdict, reason_code = null, reason_note = null,
          edited_answer = excluded.edited_answer, slots = excluded.slots,
          codebook_version = excluded.codebook_version, human_keyframes_s = excluded.human_keyframes_s
    returning q.* into saved;
    return next saved;
  end loop;
end;
$$;

revoke all on function public.save_slot_answers(jsonb) from public, anon;
grant execute on function public.save_slot_answers(jsonb) to authenticated;

-- 4. Who changes the answer format, and when ------------------------------------
--
-- assignments_update lets an annotator update their own assignment row (the
-- routes move status), so without this rule an annotator could switch their
-- own form. Only an admin session changes answer_format, the service role
-- included in "not an admin" (it has no auth.uid()), and never once the
-- assignment owns an answer or an entity: every stored answer was then checked
-- against the format it still has. The rule fires only when the column changes, so the
-- routes' status updates pass as before.

-- validate_assignment of 20261108_assigned_labeling.sql plus the answer_format rule.
create or replace function public.validate_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare draft_count integer;
declare answer_count integer;
begin
  if tg_op = 'UPDATE' and (new.video_id <> old.video_id or new.annotator_id <> old.annotator_id) then
    raise exception 'Assignment ownership cannot be changed';
  end if;
  if tg_op = 'UPDATE' and new.answer_format is distinct from old.answer_format then
    if not public.is_admin() then
      raise exception 'Only an admin can change the answer format';
    end if;
    if exists (select 1 from public.qa_annotations a join public.video_drafts d on d.id = a.draft_id
               where d.video_id = new.video_id and a.annotator_id = new.annotator_id)
       or exists (select 1 from public.video_entities e
                  where e.video_id = new.video_id and e.annotator_id = new.annotator_id) then
      raise exception 'The answer format cannot change once the assignment has answers or entities';
    end if;
  end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.user_profiles p where p.id = new.annotator_id and p.enabled) then
      raise exception 'Assign videos to an enabled user';
    end if;
    -- Serialises concurrent assignments of the same video.
    perform 1 from public.videos where id = new.video_id for update;
    if not exists (select 1 from public.videos v where v.id = new.video_id and v.agreement_sample)
       and exists (select 1 from public.video_assignments a
                   where a.video_id = new.video_id and a.annotator_id <> new.annotator_id) then
      raise exception 'This video is already assigned to another annotator';
    end if;
  end if;
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status <> 'completed') then
    if not exists (select 1 from public.video_labels l
                   where l.video_id = new.video_id and l.annotator_id = new.annotator_id) then
      raise exception 'Choose the event label before completing';
    end if;
    select count(*) into draft_count from public.video_drafts where video_id = new.video_id;
    select count(*) into answer_count from public.qa_annotations a
      join public.video_drafts d on d.id = a.draft_id
      where d.video_id = new.video_id and a.annotator_id = new.annotator_id;
    if draft_count <> 9 or answer_count <> 9 then
      raise exception 'Review all nine questions before completing';
    end if;
    if exists (select 1 from public.qa_annotations a join public.video_drafts d on d.id = a.draft_id
               where d.video_id = new.video_id and a.annotator_id = new.annotator_id
                 -- A slot answer carries its composed sentence, as DISAGREE carries the rewrite.
                 and (a.verdict in ('DISAGREE','SLOTS')) = (a.edited_answer is null)) then
      raise exception 'An edited answer needs the verdict Sai, and Sai needs an edited answer';
    end if;
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

-- Admin only. Switches the assignments of one person on videos numbered
-- seq_from..seq_to; an assignment that already has work (answers or entities,
-- section 5) keeps its format and
-- is counted in skipped_started, so the admin sees what did not change.
create or replace function public.set_answer_format(annotator uuid, seq_from integer, seq_to integer, format text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
declare switched integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if seq_from is null or seq_to is null or seq_from > seq_to then raise exception 'Invalid range'; end if;
  if format is null or format not in ('text','slots') then raise exception 'Unknown answer format %', format; end if;
  create temporary table format_candidates on commit drop as
  select a.id, a.answer_format = format as already,
         (exists (select 1 from public.qa_annotations q join public.video_drafts d on d.id = q.draft_id
                  where d.video_id = a.video_id and q.annotator_id = a.annotator_id)
          or exists (select 1 from public.video_entities e
                     where e.video_id = a.video_id and e.annotator_id = a.annotator_id)) as started
  from public.video_assignments a join public.videos v on v.id = a.video_id
  where a.annotator_id = annotator and v.seq between seq_from and seq_to
  for update of a;
  update public.video_assignments a set answer_format = format
  from format_candidates c where c.id = a.id and not c.already and not c.started;
  get diagnostics switched = row_count;
  select jsonb_build_object(
    'changed', switched,
    'already', count(*) filter (where already),
    'skipped_started', count(*) filter (where not already and started)) into result
  from format_candidates;
  drop table format_candidates;
  return result;
end;
$$;

revoke all on function public.set_answer_format(uuid, integer, integer, text) from public, anon;
grant execute on function public.set_answer_format(uuid, integer, integer, text) to authenticated;

-- 5. Entities and the cell rules -------------------------------------------------
--
-- The entities A, B, C one annotator declared on one video, owned by this
-- table alone: other groups point at them by key ({"entity": "B"}), and the E
-- answer is a snapshot taken by validate_qa_annotation. Written only through
-- save_video_entities (and deleted by the unassign functions); authenticated
-- has select and nothing else.

create table public.video_entities (
  video_id uuid not null references public.videos(id) on delete cascade,
  annotator_id uuid not null references public.user_profiles(id) on delete cascade,
  entity_key text not null check (entity_key ~ '^[A-Z]$'),
  cells jsonb not null,
  codebook_version text not null references public.codebook_versions(id),
  updated_at timestamptz not null default now(),
  primary key (video_id, annotator_id, entity_key)
);

create index video_entities_annotator_idx on public.video_entities(annotator_id);

alter table public.video_entities enable row level security;
create policy video_entities_read on public.video_entities for select to authenticated
  using (public.is_active_user() and (annotator_id = (select auth.uid()) or public.is_admin()));
revoke all on public.video_entities from anon, authenticated;
grant select on public.video_entities to authenticated;

-- Checks one flat object of cells against its codebook, using only the
-- codebook's machine-readable flags. scope: the cell ids this object may hold;
-- required: the ones it must hold; forbidden: the ones it must not (the
-- conditional rules, decided by validate_slots). Each refusal carries a
-- machine-readable code in HINT, which the routes return as `code`.
--   1. every key is the id of a cell in scope                      unknown_cell
--   2. an option belongs to its own cell                           unknown_option
--   3. an entity only on a from_entities cell or option, and
--      declared by the same annotator on the same video            unexpected_entity, unknown_entity
--   4. every required cell is present                              missing_cell
--   5. a parent_cell child is an option of the chosen parent; it is
--      required only when that parent has children, and must stay
--      empty when it has none (an "unclear" parent)               wrong_parent, unexpected_cell
--   6. text only on a free_text option, and required there: trimmed,
--      non-empty, at most 200 characters (spec Open 7, a guard against
--      a pasted paragraph, not a labelling rule)                   unexpected_text, missing_text, text_too_long
--   7. must_differ_from: not the same choice as the named cell     must_differ
create or replace function public.validate_slot_cells(book jsonb, cells jsonb, scope text[], required text[],
  forbidden text[], video uuid, annotator uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare cell jsonb;
declare chosen jsonb;
declare cell_key text;
declare val jsonb;
declare ref jsonb;
declare parent_option text;
declare has_children boolean;
begin
  if cells is null or jsonb_typeof(cells) <> 'object' then
    raise exception using message = 'Slot answer: the cells must be an object', hint = 'invalid_value';
  end if;
  for cell_key, val in select e.key, e.value from jsonb_each(cells) e loop
    cell := null;
    select c.value into cell from jsonb_array_elements(book->'cells') c
    where c.value->>'id' = cell_key and cell_key = any(scope);
    if cell is null then
      raise exception using message = format('Slot answer: %s.v%s has no cell %s here', book->>'group', book->>'version', cell_key),
        hint = 'unknown_cell';
    end if;
    if cell_key = any(forbidden) then
      raise exception using message = format('Slot answer: cell %s must stay empty with this choice', cell_key),
        hint = 'conditional_cell';
    end if;
    -- O "parties": the C pair, one or two entity references.
    if jsonb_typeof(val) = 'array' and cell_key = 'parties' and coalesce((cell->>'from_entities')::boolean, false) then
      if jsonb_array_length(val) not between 1 and 2
         or (select count(distinct r.value->>'entity') from jsonb_array_elements(val) r) <> jsonb_array_length(val) then
        raise exception using message = 'Slot answer: parties are one or two different entities', hint = 'parties';
      end if;
      for ref in select r.value from jsonb_array_elements(val) r loop
        if jsonb_typeof(ref) <> 'object' or ref - 'entity' <> '{}'::jsonb or jsonb_typeof(ref->'entity') <> 'string' then
          raise exception using message = 'Slot answer: parties hold entity references only', hint = 'invalid_value';
        end if;
        if not exists (select 1 from public.video_entities e where e.video_id = video
                       and e.annotator_id = annotator and e.entity_key = ref->>'entity') then
          raise exception using message = format('Slot answer: entity %s is not declared in E', ref->>'entity'),
            hint = 'unknown_entity';
        end if;
      end loop;
      continue;
    end if;
    if jsonb_typeof(val) <> 'object'
       or exists (select 1 from jsonb_object_keys(val) k where k not in ('option','entity','text')) then
      raise exception using message = format('Slot answer: cell %s has an invalid value', cell_key), hint = 'invalid_value';
    end if;
    chosen := null;
    if val ? 'option' then
      select o.value into chosen from jsonb_array_elements(cell->'options') o where o.value->>'id' = val->>'option';
      if chosen is null then
        raise exception using message = format('Slot answer: option %s is not in cell %s', val->>'option', cell_key),
          hint = 'unknown_option';
      end if;
    elsif not val ? 'entity' then
      raise exception using message = format('Slot answer: cell %s has no choice', cell_key), hint = 'missing_cell';
    end if;
    if val ? 'entity' then
      if (chosen is not null and not coalesce((chosen->>'from_entities')::boolean, false))
         or (chosen is null and not coalesce((cell->>'from_entities')::boolean, false)) then
        raise exception using message = format('Slot answer: cell %s does not take an entity', cell_key),
          hint = 'unexpected_entity';
      end if;
      if jsonb_typeof(val->'entity') <> 'string'
         or not exists (select 1 from public.video_entities e where e.video_id = video
                        and e.annotator_id = annotator and e.entity_key = val->>'entity') then
        raise exception using message = format('Slot answer: entity %s is not declared in E', val->>'entity'),
          hint = 'unknown_entity';
      end if;
    elsif chosen is not null and coalesce((chosen->>'from_entities')::boolean, false) then
      raise exception using message = format('Slot answer: %s needs an entity', val->>'option'), hint = 'missing_entity';
    end if;
    if val ? 'text' then
      if chosen is null or not coalesce((chosen->>'free_text')::boolean, false) then
        raise exception using message = format('Slot answer: %s takes no text', coalesce(val->>'option', cell_key)),
          hint = 'unexpected_text';
      end if;
      if jsonb_typeof(val->'text') <> 'string' or length(trim(val->>'text')) = 0 then
        raise exception using message = format('Slot answer: %s needs a short text', val->>'option'), hint = 'missing_text';
      end if;
      if char_length(trim(val->>'text')) > 200 then
        raise exception using message = format('Slot answer: the text of %s is longer than 200 characters', val->>'option'),
          hint = 'text_too_long';
      end if;
    elsif chosen is not null and coalesce((chosen->>'free_text')::boolean, false) then
      raise exception using message = format('Slot answer: %s needs a short text', val->>'option'), hint = 'missing_text';
    end if;
    if cell ? 'parent_cell' and chosen->>'parent' is distinct from cells->(cell->>'parent_cell')->>'option' then
      raise exception using message = format('Slot answer: %s does not belong under %s', val->>'option',
        coalesce(cells->(cell->>'parent_cell')->>'option', 'an empty ' || (cell->>'parent_cell'))), hint = 'wrong_parent';
    end if;
    if cell ? 'must_differ_from' and cells ? (cell->>'must_differ_from')
       and split_part(val->>'option', '.', 2) = split_part(cells->(cell->>'must_differ_from')->>'option', '.', 2) then
      raise exception using message = format('Slot answer: %s repeats %s', cell_key, cell->>'must_differ_from'),
        hint = 'must_differ';
    end if;
  end loop;
  for cell in select c.value from jsonb_array_elements(book->'cells') c where c.value->>'id' = any(scope) loop
    if cell ? 'parent_cell' then
      parent_option := cells->(cell->>'parent_cell')->>'option';
      has_children := exists (select 1 from jsonb_array_elements(cell->'options') o where o.value->>'parent' = parent_option);
      if not has_children and cells ? (cell->>'id') then
        raise exception using message = format('Slot answer: cell %s must stay empty under %s', cell->>'id', parent_option),
          hint = 'unexpected_cell';
      end if;
      if has_children and (cell->>'id') = any(required) and not cells ? (cell->>'id') then
        raise exception using message = format('Slot answer: cell %s is required', cell->>'id'), hint = 'missing_cell';
      end if;
    elsif (cell->>'id') = any(required) and not cells ? (cell->>'id') then
      raise exception using message = format('Slot answer: cell %s is required', cell->>'id'), hint = 'missing_cell';
    end if;
  end loop;
end;
$$;

-- Checks the cells of one answer (or of one entity) against its codebook:
-- the shape of the group (8. per_party: Prev holds its cells per party in
-- "parties"), then the conditional rules of spec Open 2, then each flat
-- object through validate_slot_cells. Sources of the conditional rules:
--   V: violator and behavior are "khi có" (V-vi-pham.md, ô 1-2): required
--      with result.yes, empty otherwise.
--   R: "Không có đoạn sau" is the fixed sentence "Không thể xác định."
--      (R-ung-xu.md, Mẫu câu), so has_aftermath.no takes no other cell.
--   parent_cell children (C action, O sign): validate_slot_cells, rule 5.
--   C subject.both (spec Open 4, decided 2026-11-16): rule 9 below, exactly
--      two parties of different entities, and no object, speed, evader,
--      evasion or evasion_result: the "Cả A và B" pattern (C-nguyen-nhan.md,
--      Mẫu câu) takes the pair from the two parties and has no speed or
--      evasion part (confirmed by the lead 2026-11-16).
-- 9. per_party_when X: while the cell of X holds X, the cell lives in each
--    item of "parties" (beside {"party": {"entity": K}}) and not outside; its
--    parent_cell stays outside, so both parties share it (rule 5 per item).
--    Otherwise there is no "parties".
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

  -- Rule 9. One per_party_when value per book (C.v1: action, subject.both).
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
        forbidden := array['object', 'speed', 'evader', 'evasion', 'evasion_result'];
      end if;
      perform public.validate_slot_cells(book, slots - 'parties', outer_cells,
        array(select r from unnest(required) r where r <> all(when_cells)), forbidden, video, annotator);
      return;
    end if;
  end if;

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
  perform public.validate_slot_cells(book, slots, all_cells, required, forbidden, video, annotator);
end;
$$;

create or replace function public.validate_video_entity()
returns trigger language plpgsql security definer set search_path = '' as $$
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
  new.updated_at := now();
  return new;
end;
$$;

create trigger validate_video_entity_trigger before insert or update on public.video_entities
for each row execute function public.validate_video_entity();

-- Replaces the caller's entities on one video and re-saves the E answer as
-- their snapshot, in one transaction: an entity the list no longer holds is
-- deleted, the rest upserted (an unchanged entity is not rewritten), then the
-- E row is upserted with the sentence the route composed.
-- entities: [{key, cells}]
create or replace function public.save_video_entities(target_video uuid, version text, entities jsonb, e_answer text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare caller uuid := (select auth.uid());
declare e_draft uuid;
declare item jsonb;
declare keys text[];
declare saved public.qa_annotations;
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

revoke all on function public.validate_slots(text, jsonb, uuid, uuid) from public, anon, authenticated;
revoke all on function public.validate_slot_cells(jsonb, jsonb, text[], text[], text[], uuid, uuid) from public, anon, authenticated;
revoke all on function public.validate_video_entity() from public, anon, authenticated;
revoke all on function public.save_video_entities(uuid, text, jsonb, text) from public, anon;
grant execute on function public.save_video_entities(uuid, text, jsonb, text) to authenticated;

-- 6. An entity in use cannot be removed or changed ------------------------------
--
-- Another group of the same annotator on the same video that points at the
-- entity ({"entity": K} at any depth of its slots) blocks deleting it and
-- changing its cells; the annotator unpoints it there first (conflicts.md,
-- conflict 10). The refusal names the entity and the groups in DETAIL as JSON,
-- which the entities route returns with 409. A cascade from a deleted video or
-- user passes, the same pattern as guard_adjudicated_delete: the parent row is
-- already gone when the cascade reaches this table.
create or replace function public.guard_referenced_entity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare groups text[];
begin
  if tg_op = 'DELETE' and (not exists (select 1 from public.videos where id = old.video_id)
                           or not exists (select 1 from public.user_profiles where id = old.annotator_id)) then
    return old;
  end if;
  if tg_op = 'UPDATE' and (new.entity_key, new.cells) is not distinct from (old.entity_key, old.cells) then
    return new;
  end if;
  groups := array(
    select d.qgroup from public.qa_annotations q join public.video_drafts d on d.id = q.draft_id
    where d.video_id = old.video_id and q.annotator_id = old.annotator_id and d.qgroup <> 'E'
      and q.slots is not null
      and jsonb_path_exists(q.slots, '$.** ? (@.entity == $k)', jsonb_build_object('k', old.entity_key))
    order by d.qgroup);
  if cardinality(groups) > 0 then
    raise exception using
      message = format('Slot answer: entity %s is used by %s', old.entity_key, array_to_string(groups, ', ')),
      hint = 'entity_referenced',
      detail = jsonb_build_object('entity', old.entity_key, 'groups', to_jsonb(groups))::text;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger guard_referenced_entity_trigger before update or delete on public.video_entities
for each row execute function public.guard_referenced_entity();

revoke all on function public.guard_referenced_entity() from public, anon, authenticated;

-- 7. Revisions carry the cells ---------------------------------------------------
--
-- A slot answer can change its cells without changing its sentence (R
-- bystanders.unclear and bystanders.nobody_stopped both drop the bystanders
-- part), so the log keeps slots and codebook_version and compares them too.
-- Rows logged before this have both null. record_qa_annotation_revision of
-- 20261107_qa_annotation_revisions.sql plus the two columns.

alter table public.qa_annotation_revisions
  add column slots jsonb,
  add column codebook_version text;

create or replace function public.record_qa_annotation_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    -- A cascade from a deleted video, draft or user removes the history too;
    -- logging the delete would point at a row that is already gone.
    if not exists (select 1 from public.video_drafts where id = old.draft_id)
       or not exists (select 1 from public.user_profiles where id = old.annotator_id) then
      return old;
    end if;
    insert into public.qa_annotation_revisions
      (draft_id, annotator_id, op, verdict, reason_code, reason_note, edited_answer, human_keyframes_s, slots, codebook_version)
    values (old.draft_id, old.annotator_id, 'DELETE', old.verdict, old.reason_code, old.reason_note,
            old.edited_answer, old.human_keyframes_s, old.slots, old.codebook_version);
    return old;
  end if;
  -- Auto-save re-sends the same answer; annotated_at changes on every save, so
  -- compare the content, not the row.
  if tg_op = 'UPDATE' and (old.verdict, old.reason_code, old.reason_note, old.edited_answer, old.human_keyframes_s,
                           old.slots, old.codebook_version)
     is not distinct from (new.verdict, new.reason_code, new.reason_note, new.edited_answer, new.human_keyframes_s,
                           new.slots, new.codebook_version) then
    return new;
  end if;
  insert into public.qa_annotation_revisions
    (draft_id, annotator_id, op, verdict, reason_code, reason_note, edited_answer, human_keyframes_s, slots, codebook_version,
     revised_at)
  values (new.draft_id, new.annotator_id, tg_op, new.verdict, new.reason_code, new.reason_note,
          new.edited_answer, new.human_keyframes_s, new.slots, new.codebook_version, new.annotated_at);
  return new;
end;
$$;

-- 8. Slot assignments stay out of difficulty and adjudication --------------------
--
-- Derived difficulty counts the drafts an annotator did not AGREE with; a slot
-- answer never agrees or disagrees with a draft, so all nine answers of a slot
-- assignment, N and Attr included, stay out (conflicts.md, conflict 3).
-- final_answers and final_video_labels compare annotators who answered the same
-- form: a slot sentence beside two AGREE rows would turn a consensus into a
-- conflict and send it to the adjudication CSV (conflict 4). video_difficulty,
-- adjudication_export, adjudication_summary and import_adjudications read these
-- views and follow. Each view is the one of 20261105_derived_difficulty.sql or
-- 20261107_answer_adjudication.sql plus answer_format = 'text'.

create or replace view public.annotator_difficulty with (security_invoker = true) as
  select a.video_id, a.annotator_id,
         count(*) filter (where q.verdict = 'DISAGREE') as disagree_count,
         count(*) filter (where q.verdict = 'NOT_ANSWERABLE') as not_answerable_count,
         count(*) filter (where q.verdict <> 'AGREE') as model_errors,
         public.difficulty_level(count(*) filter (where q.verdict <> 'AGREE')) as difficulty
    from public.video_assignments a
    join public.video_drafts d on d.video_id = a.video_id
    join public.qa_annotations q on q.draft_id = d.id and q.annotator_id = a.annotator_id
   where a.status = 'completed' and a.answer_format = 'text'
   group by a.video_id, a.annotator_id;

create or replace view public.final_answers with (security_invoker = true) as
with done as (
  select video_id, annotator_id from public.video_assignments where status = 'completed' and answer_format = 'text'
), answers as (
  select d.id as draft_id, d.video_id, d.qgroup, q.annotator_id, q.verdict, q.reason_code, q.reason_note,
         q.edited_answer, q.human_keyframes_s,
         public.effective_answer(q.verdict, q.edited_answer, d.answer) as effective
  from public.video_drafts d
  join done on done.video_id = d.video_id
  join public.qa_annotations q on q.draft_id = d.id and q.annotator_id = done.annotator_id
), grouped as (
  select draft_id, video_id, qgroup,
         count(*)::int as annotators,
         array_agg(annotator_id order by annotator_id) as annotator_ids,
         count(distinct verdict) as verdicts,
         count(distinct public.normalize_answer(effective)) as answers,
         min(verdict) as some_verdict,
         (array_agg(effective order by annotator_id))[1] as some_answer,
         md5(string_agg(format('%s|%s|%s|%s|%s|%s', annotator_id, verdict, reason_code, reason_note,
                               edited_answer, human_keyframes_s), '#' order by annotator_id)) as fingerprint
  from answers group by draft_id, video_id, qgroup
), frames as (
  select draft_id, array_agg(distinct mark order by mark) as marks
  from answers, unnest(human_keyframes_s) as mark group by draft_id
)
select g.draft_id, g.video_id, g.qgroup, g.annotators, g.annotator_ids,
       case when j.draft_id is not null then 'adjudicated'
            when g.annotators = 1 then 'single'
            when g.verdicts = 1 and g.answers = 1 then 'consensus'
            else 'conflict' end as source,
       case when j.draft_id is not null then j.final_verdict
            when g.verdicts = 1 and g.answers = 1 then g.some_verdict end as final_verdict,
       case when j.draft_id is not null then j.final_answer
            when g.verdicts = 1 and g.answers = 1 then g.some_answer end as final_answer,
       case when j.draft_id is not null then j.final_keyframes_s
            when g.verdicts = 1 and g.answers = 1 then coalesce(f.marks, '{}') end as final_keyframes_s,
       g.fingerprint
from grouped g
left join frames f on f.draft_id = g.draft_id
left join public.answer_adjudications j on j.draft_id = g.draft_id;

create or replace view public.final_video_labels with (security_invoker = true) as
with labels as (
  select l.video_id, l.annotator_id, l.event_label
  from public.video_labels l
  join public.video_assignments a on a.video_id = l.video_id and a.annotator_id = l.annotator_id
  where a.status = 'completed' and a.answer_format = 'text'
), grouped as (
  select video_id, count(*)::int as annotators,
         array_agg(annotator_id order by annotator_id) as annotator_ids,
         count(distinct event_label) as labels, min(event_label) as some_label,
         md5(string_agg(format('%s|%s', annotator_id, event_label), '#' order by annotator_id)) as fingerprint
  from labels group by video_id
)
select g.video_id, g.annotators, g.annotator_ids,
       case when j.video_id is not null then 'adjudicated'
            when g.annotators = 1 then 'single'
            when g.labels = 1 then 'consensus'
            else 'conflict' end as source,
       case when j.video_id is not null then j.event_label
            when g.labels = 1 then g.some_label end as event_label,
       g.fingerprint
from grouped g
left join public.label_adjudications j on j.video_id = g.video_id;

-- 9. The answers export names the answer format ------------------------------------
--
-- iaa_round.py computes agreement from this export; without the format a slot
-- sentence would count as an edited answer beside the text rows (conflicts.md,
-- conflict 5). The new column sits right after batch, so the return type
-- changes and the function is dropped and recreated, grants included. An
-- answer whose assignment is gone reads as text, as validate_qa_annotation
-- treats it. answers_export of 20261109_training_rounds.sql plus answer_format.

drop function public.answers_export(boolean, integer, integer);

create function public.answers_export(only_agreement boolean, seq_from integer, seq_to integer)
returns table (
  seq integer, filename text, agreement boolean, annotator_email text, annotator_name text,
  assignment_status text, batch text, answer_format text, qgroup text, question text, draft_answer text,
  verdict text, reason_code text, reason_note text, edited_answer text, effective_answer text,
  human_keyframes_s text, annotated_at timestamptz, event_label text,
  draft_id uuid, video_id uuid, annotator_id uuid
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select v.seq, v.filename, v.agreement_sample, p.email, p.name,
    a.status, a.batch, coalesce(a.answer_format, 'text'), d.qgroup, d.question, d.answer,
    q.verdict, q.reason_code, q.reason_note, q.edited_answer,
    public.effective_answer(q.verdict, q.edited_answer, d.answer),
    array_to_string(q.human_keyframes_s, ';'), q.annotated_at, l.event_label,
    d.id, v.id, q.annotator_id
  from public.qa_annotations q
  join public.video_drafts d on d.id = q.draft_id
  join public.videos v on v.id = d.video_id
  join public.user_profiles p on p.id = q.annotator_id
  left join public.video_assignments a on a.video_id = v.id and a.annotator_id = q.annotator_id
  left join public.video_labels l on l.video_id = v.id and l.annotator_id = q.annotator_id
  where (not only_agreement or v.agreement_sample)
    and (seq_from is null or v.seq >= seq_from) and (seq_to is null or v.seq <= seq_to)
  order by v.seq, d.qgroup, p.email, d.id;
end;
$$;

revoke all on function public.answers_export(boolean, integer, integer) from public, anon;
grant execute on function public.answers_export(boolean, integer, integer) to authenticated;

-- 10. Taking an assignment back takes its entities ----------------------------------
--
-- With delete_work, the answers go first, then the entities, then the event
-- label and the assignment: the answers are what point at the entities, so
-- guard_referenced_entity has nothing left to protect once they are gone
-- (conflicts.md, conflict 10). Without delete_work, an assignment that owns an
-- entity has started, like one that owns an answer, and stays. Both functions
-- are those of 20261110_unassign_rounds.sql and 20261111_unassign_range_work.sql
-- with the entity steps added; signatures and results unchanged.

create or replace function public.unassign_agreement_group(annotators uuid[], seq_from integer, seq_to integer, delete_work boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare removed integer;
declare kept integer;
declare answers integer := 0;
declare labels integer := 0;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if coalesce(cardinality(annotators), 0) = 0 then raise exception 'Choose at least one annotator'; end if;
  if seq_from is null or seq_to is null or seq_from > seq_to then raise exception 'Invalid number range'; end if;
  create temporary table round_targets on commit drop as
    select a.id as assignment_id, a.video_id, a.annotator_id
    from public.video_assignments a join public.videos v on v.id = a.video_id
    where v.agreement_sample and v.seq between seq_from and seq_to and a.annotator_id = any(annotators);
  if delete_work then
    if exists (select 1 from round_targets t join public.video_drafts d on d.video_id = t.video_id
               join public.answer_adjudications j on j.draft_id = d.id where t.annotator_id = any(j.annotator_ids))
       or exists (select 1 from round_targets t join public.label_adjudications j on j.video_id = t.video_id
                  where t.annotator_id = any(j.annotator_ids)) then
      raise exception 'Some of these answers were adjudicated; they cannot be deleted';
    end if;
    delete from public.qa_annotations q
    using public.video_drafts d, round_targets t
    where d.id = q.draft_id and d.video_id = t.video_id and q.annotator_id = t.annotator_id;
    get diagnostics answers = row_count;
    delete from public.video_entities e
    using round_targets t
    where e.video_id = t.video_id and e.annotator_id = t.annotator_id;
    delete from public.video_labels l
    using round_targets t
    where l.video_id = t.video_id and l.annotator_id = t.annotator_id;
    get diagnostics labels = row_count;
    delete from public.video_assignments a using round_targets t where a.id = t.assignment_id;
  else
    delete from public.video_assignments a
    using round_targets t
    where a.id = t.assignment_id and a.status <> 'completed'
      and not exists (select 1 from public.qa_annotations q join public.video_drafts d on d.id = q.draft_id
                      where d.video_id = a.video_id and q.annotator_id = a.annotator_id)
      and not exists (select 1 from public.video_entities e where e.video_id = a.video_id and e.annotator_id = a.annotator_id)
      and not exists (select 1 from public.video_labels l where l.video_id = a.video_id and l.annotator_id = a.annotator_id);
  end if;
  get diagnostics removed = row_count;
  select count(*) into kept from public.video_assignments a join round_targets t on t.assignment_id = a.id;
  drop table round_targets;
  return jsonb_build_object('removed', removed, 'kept_started', kept, 'deleted_answers', answers, 'deleted_labels', labels);
end;
$$;

create or replace function public.unassign_range(annotator uuid, seq_from integer, seq_to integer, delete_work boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare removed integer;
declare kept integer;
declare agreement integer;
declare answers integer := 0;
declare labels integer := 0;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if seq_from is null or seq_to is null or seq_from > seq_to then raise exception 'Invalid number range'; end if;
  create temporary table range_targets on commit drop as
    select a.id as assignment_id, a.video_id
    from public.video_assignments a join public.videos v on v.id = a.video_id
    where a.annotator_id = annotator and v.seq between seq_from and seq_to and not v.agreement_sample;
  if delete_work then
    if exists (select 1 from range_targets t join public.video_drafts d on d.video_id = t.video_id
               join public.answer_adjudications j on j.draft_id = d.id where annotator = any(j.annotator_ids))
       or exists (select 1 from range_targets t join public.label_adjudications j on j.video_id = t.video_id
                  where annotator = any(j.annotator_ids)) then
      raise exception 'Some of these answers were adjudicated; they cannot be deleted';
    end if;
    delete from public.qa_annotations q
    using public.video_drafts d, range_targets t
    where d.id = q.draft_id and d.video_id = t.video_id and q.annotator_id = annotator;
    get diagnostics answers = row_count;
    delete from public.video_entities e using range_targets t where e.video_id = t.video_id and e.annotator_id = annotator;
    delete from public.video_labels l using range_targets t where l.video_id = t.video_id and l.annotator_id = annotator;
    get diagnostics labels = row_count;
    delete from public.video_assignments a using range_targets t where a.id = t.assignment_id;
  else
    delete from public.video_assignments a
    using range_targets t
    where a.id = t.assignment_id and a.status <> 'completed'
      and not exists (select 1 from public.qa_annotations q join public.video_drafts d on d.id = q.draft_id
                      where d.video_id = a.video_id and q.annotator_id = a.annotator_id)
      and not exists (select 1 from public.video_entities e where e.video_id = a.video_id and e.annotator_id = a.annotator_id)
      and not exists (select 1 from public.video_labels l where l.video_id = a.video_id and l.annotator_id = a.annotator_id);
  end if;
  get diagnostics removed = row_count;
  select count(*) into kept from public.video_assignments a join range_targets t on t.assignment_id = a.id;
  select count(*) into agreement from public.video_assignments a join public.videos v on v.id = a.video_id
  where a.annotator_id = annotator and v.seq between seq_from and seq_to and v.agreement_sample;
  drop table range_targets;
  return jsonb_build_object('removed', removed, 'kept_started', kept, 'skipped_agreement', agreement,
                            'deleted_answers', answers, 'deleted_labels', labels);
end;
$$;
