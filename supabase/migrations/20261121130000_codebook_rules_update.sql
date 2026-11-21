-- Register the current annotation codebook rules and enforce them at the database boundary.
insert into public.codebook_versions (id, qgroup, version, content, sha256, frozen_on) values
  ('S.v3', 'S', 3, $cb${
  "group": "S",
  "version": 3,
  "frozen_on": "2026-11-21",
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
          "id": "surface_material.concrete",
          "label": "bê tông"
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
}$cb$::jsonb, '474fa45fd151d964e74045b256de21364a17a7a7157e0922ec0b11a40dfba942', '2026-11-21'),
  ('E.v4', 'E', 4, $cb${
  "group": "E",
  "version": 4,
  "frozen_on": "2026-11-21",
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
}$cb$::jsonb, 'c11559e1e99e9c1fa814e58dbcc048440946ab274faa546862c94dd0c3a07297', '2026-11-21'),
  ('C.v4', 'C', 4, $cb${
  "group": "C",
  "version": 4,
  "frozen_on": "2026-11-21",
  "source": "docs/guidelines/C-nguyen-nhan.md",
  "question": "Nguyên nhân trực tiếp hoặc hành động ngay trước va chạm là gì?",
  "templates": [
    {
      "case": "Va chạm",
      "text": "{subject} {action}, {relation} {object}, dẫn đến va chạm."
    },
    {
      "case": "Suýt va chạm",
      "text": "{subject} {action}, {relation} {object}, suýt xảy ra va chạm."
    },
    {
      "case": "Cả A và B, va chạm",
      "text": "{A} {action_A}, đồng thời {B} {action_B}, đi vào đường đi của nhau, dẫn đến va chạm."
    },
    {
      "case": "Cả A và B, suýt va chạm",
      "text": "{A} {action_A}, đồng thời {B} {action_B}, đi vào đường đi của nhau, suýt xảy ra va chạm."
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
          "label": "Băng ngang đường giữa đoạn, không ở giao lộ",
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
    }
  ]
}$cb$::jsonb, '8ea0d0ad087d3ef6cf597435fd173ff9e2c343c37fbc3faa39090883afdf0050', '2026-11-21'),
  ('V.v9', 'V', 9, $cb${
  "group": "V",
  "version": 9,
  "frozen_on": "2026-11-21",
  "source": "docs/guidelines/V-vi-pham.md",
  "question": "Có hành vi vi phạm quy tắc giao thông nào quan sát được hoặc được suy ra theo quy tắc hẹp từ nhóm C không?",
  "templates": [
    {
      "case": "Có",
      "text": "{violator} {behavior}."
    },
    {
      "case": "Có, chưa xác định người điều khiển vật nuôi",
      "text": "Quan sát thấy {behavior}; không xác định được người điều khiển vật nuôi."
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
      ],
      "read_only": true
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
      ],
      "read_only": true
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
          "id": "behavior.fail_to_yield",
          "label": "không nhường đường",
          "condition": "chỉ khi thấy rõ bên có quyền đi trước (xe đang đi thẳng trên đường chính, người đi bộ trên vạch, xe trong giao lộ). Dùng cho cả xe và người đi bộ."
        },
        {
          "id": "behavior.tailgating",
          "label": "không giữ khoảng cách an toàn"
        },
        {
          "id": "behavior.illegal_turn",
          "label": "quay đầu sai quy định",
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
          "condition": "Ghi ngắn hành vi nhìn thấy được. Không suy đoán danh tính hoặc trách nhiệm của người không xuất hiện. Không dùng từ \"lỗi\", \"vi phạm điều/khoản\", mức phạt.",
          "free_text": true
        }
      ],
      "per_party_when": "violator.both",
      "multiple": true,
      "inferred_from": "C",
      "allow_manual_additions": true,
      "additions_optional": true,
      "read_only": true
    },
    {
      "note": "Không chọn động vật làm bên vi phạm.",
      "id": "additional_violator",
      "required": false,
      "from_entities": true,
      "label": "Bên có hành vi bổ sung",
      "options": []
    },
    {
      "note": "Chỉ chọn hành vi quan sát được rõ ràng.",
      "id": "additional_behavior",
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
          "id": "behavior.fail_to_yield",
          "label": "không nhường đường",
          "condition": "chỉ khi thấy rõ bên có quyền đi trước (xe đang đi thẳng trên đường chính, người đi bộ trên vạch, xe trong giao lộ). Dùng cho cả xe và người đi bộ."
        },
        {
          "id": "behavior.tailgating",
          "label": "không giữ khoảng cách an toàn"
        },
        {
          "id": "behavior.illegal_turn",
          "label": "quay đầu sai quy định",
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
          "condition": "Ghi ngắn hành vi nhìn thấy được. Không suy đoán danh tính hoặc trách nhiệm của người không xuất hiện. Không dùng từ \"lỗi\", \"vi phạm điều/khoản\", mức phạt.",
          "free_text": true
        }
      ],
      "required": false,
      "label": "Hành vi vi phạm bổ sung",
      "multiple": true
    }
  ],
  "inferred_from": "C",
  "inference_mode": "derived_with_optional_additions",
  "derivation": "Core chỉ tự suy ra K09; các trường bổ sung là hành vi quan sát trực tiếp do annotator chọn."
}$cb$::jsonb, '6c4774714a9cf3af6b3479dcbe7ca5b3ecfec487025f7750240ce742c2539014', '2026-11-21')
on conflict (id) do nothing;

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
  elsif new.codebook_version = 'E.v4' then
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

-- Save one annotator's related slot answers atomically. A save can include the edited group and derived C/V/Prev/R rows.
create or replace function public.save_slot_answers(rows jsonb)
returns setof public.qa_annotations
language plpgsql security invoker set search_path = '' as $$
declare item jsonb;
declare saved public.qa_annotations;
begin
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) not between 1 and 9 then
    raise exception using message = 'Slot answer: send one to nine answers', hint = 'invalid_slots';
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
