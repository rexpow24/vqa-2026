-- Register the frozen codebook versions used by the updated slot UI.
insert into public.codebook_versions (id, qgroup, version, content, sha256, frozen_on) values
  ('C.v3', 'C', 3, $cb${
  "group": "C",
  "version": 3,
  "frozen_on": "2026-11-20",
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
      "case": "Không rõ loại sự kiện",
      "text": "{subject} {action}, {relation} {object}."
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
    }
  ]
}
$cb$, '541a0b3b883fa6829242bdaf19ea1de521864bea87b259695e54dff272efa113', '2026-11-20'),
  ('E.v3', 'E', 3, $cb${
  "group": "E",
  "version": 3,
  "frozen_on": "2026-11-20",
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
      "when": "Bắt buộc chọn với ô tô; bỏ trống với người đi bộ và động vật",
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
      ],
      "required_when": "type.car"
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
}
$cb$, '62f35666e5e6cceca2c7b4461e899b6e2f6106ff8ced7f32f2c97ed9e6496a02', '2026-11-20'),
  ('R.v2', 'R', 2, $cb${
  "group": "R",
  "version": 2,
  "frozen_on": "2026-11-20",
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
          "id": "bystanders.unclear",
          "label": "không rõ"
        }
      ]
    }
  ]
}
$cb$, '9c9b3633621d98dbe0d6ee31159f3679aa9214bf818bcb59ffc6ae553f9de243', '2026-11-20'),
  ('Prev.v2', 'Prev', 2, $cb${
  "group": "Prev",
  "version": 2,
  "frozen_on": "2026-11-20",
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
      "auto_fill": "Tự suy ra từ nhóm V; annotator không sửa.",
      "options": [
        {
          "id": "party.both",
          "label": "cả hai bên"
        },
        {
          "id": "party.unclear",
          "label": "không rõ"
        }
      ],
      "read_only": true
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
      ],
      "read_only": true,
      "auto_fill": "Tự suy ra từ nhóm V; annotator không sửa."
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
  "prefill_note": "Bên không phải chủ thể không được điền sẵn.",
  "inferred_from": "V",
  "read_only": true
}
$cb$, '52078812cc99182c3e6f2dac8189663594cb98ede942a1749d12892c75216b47', '2026-11-20'),
  ('V.v7', 'V', 7, $cb${
  "group": "V",
  "version": 7,
  "frozen_on": "2026-11-20",
  "source": "docs/guidelines/V-vi-pham.md",
  "question": "Có hành vi vi phạm quy tắc giao thông nào quan sát được không?",
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
        },
        {
          "id": "violator.unidentified",
          "condition": "Chỉ dùng khi thấy rõ vật nuôi đi rông gây nguy cơ giao thông nhưng chưa xác định được người liên quan đến hành vi đó. Chỉ nhận diện được chủ nuôi hoặc thấy họ đến nhận con vật chưa đủ để chọn họ làm bên vi phạm. Không chọn con vật làm bên vi phạm.",
          "label": "chủ/người quản lý vật nuôi (chưa xác định)",
          "party_label": "chủ/người quản lý vật nuôi chưa xác định"
        }
      ],
      "per_party_options": [
        "violator.unidentified"
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
          "condition": "Ghi ngắn hành vi quan sát được. Nếu thấy rõ chủ nuôi hoặc người quản lý để vật nuôi lao ra đường gây mất an toàn, chọn người đó từ E và mô tả hành vi; không gán chỉ vì nhận diện được chủ hoặc thấy họ đến nhận con vật sau sự việc. Với người chưa xác định, chỉ mô tả vật nuôi đi rông. Không dùng từ \"lỗi\", \"vi phạm điều/khoản\", mức phạt.",
          "free_text": true
        }
      ],
      "per_party_when": "violator.both",
      "multiple": true,
      "inferred_from": "C",
      "allow_manual_additions": true,
      "additions_optional": true
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
  ],
  "inferred_from": "C",
  "inference_mode": "derived_with_optional_additions"
}
$cb$, '6b2d2e132e8398cfdc8c62b5745bd7367a14f0f8e8828ddc06e604f4b85a7d64', '2026-11-20')
on conflict (id) do nothing;

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
  if new.codebook_version = 'E.v3'
     and new.cells #>> '{type,option}' = 'type.car'
     and (new.cells -> 'dashcam' is null or new.cells -> 'vehicle_color' is null) then
    raise exception using message = 'Slot answer: car entities require dashcam and vehicle color',
      hint = 'missing_cell';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
