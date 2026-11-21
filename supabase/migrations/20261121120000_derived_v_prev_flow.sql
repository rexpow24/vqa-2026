-- Register evidence-limited derived V and Prev codebooks.
insert into public.codebook_versions (id, qgroup, version, content, sha256, frozen_on) values
  ('V.v8', 'V', 8, $cb${
  "group": "V",
  "version": 8,
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
}
$cb$, '8989c5d50529cecafe96176e823600308a136e31b4b6273f33d659d182b53f13', '2026-11-21'),
  ('Prev.v3', 'Prev', 3, $cb${
  "group": "Prev",
  "version": 3,
  "frozen_on": "2026-11-21",
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
  "inferred_from": "V",
  "read_only": true,
  "derivation": "Tự sinh từ V; một hành vi chỉ ánh xạ khi quy tắc ánh xạ cho một hành động duy nhất, nếu không thì không thể xác định."
}$cb$, 'd66c961a4fd3ca87a7cc3edb651271140884f27e417c63153b26a7a73290f342', '2026-11-21')
on conflict (id) do nothing;

create or replace function public.validate_v8_additions()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare grp text;
declare version text;
declare video uuid;
begin
  select d.qgroup, new.codebook_version, d.video_id into grp, version, video
  from public.video_drafts d where d.id = new.draft_id;
  if grp = 'V' and version = 'V.v8' and new.verdict = 'SLOTS' then
    if (new.slots ? 'additional_violator') <> (new.slots ? 'additional_behavior') then
      raise exception using message = 'Slot answer: additional V actor and behavior must be selected together', hint = 'parties';
    end if;
    if exists (select 1 from public.video_entities e where e.video_id = video
               and e.annotator_id = new.annotator_id
               and e.entity_key = new.slots->'additional_violator'->>'entity'
               and e.cells->'type'->>'option' = 'type.animal') then
      raise exception using message = 'Slot answer: an animal cannot be named as a V violator', hint = 'unknown_entity';
    end if;
  end if;
  return new;
end;
$fn$;

create trigger validate_v8_additions_trigger before insert or update on public.qa_annotations
for each row execute function public.validate_v8_additions();
