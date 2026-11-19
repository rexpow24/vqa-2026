-- V.v4 records animal-related unsafe conduct without treating an animal as the legal violator.
insert into public.codebook_versions (id, qgroup, version, content, sha256, frozen_on)
values ('V.v4', 'V', 4, $cb$
{
  "group": "V",
  "version": 4,
  "frozen_on": "2026-11-19",
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
        },
        {
          "id": "violator.unidentified",
          "condition": "Chỉ dùng khi thấy vật nuôi đi rông hoặc gây nguy cơ giao thông nhưng không thấy người điều khiển/dẫn dắt. Không chọn con vật làm bên vi phạm.",
          "label": "không xác định được người điều khiển vật nuôi"
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
          "condition": "Ghi ngắn điều quan sát được; với vật nuôi đi rông, mô tả vị trí/hành động nhìn thấy, không suy đoán người chịu trách nhiệm. Không dùng từ \"lỗi\", \"vi phạm điều/khoản\", mức phạt.",
          "free_text": true
        }
      ],
      "per_party_when": "violator.both",
      "multiple": true
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
}
$cb$::jsonb, 'f19baa8ae51bff5089ba429d6fa12ebda9437300216ee26b12db43bc1a58c40b', '2026-11-19');

create or replace function public.reject_animal_v_violator()
returns trigger language plpgsql security definer set search_path = '' as $$
declare draft_group text;
declare draft_video uuid;
declare entity_key text;
declare entity_cells jsonb;
declare party jsonb;
begin
  if new.verdict is distinct from 'SLOTS' or new.slots is null then
    return new;
  end if;
  select d.qgroup, d.video_id into draft_group, draft_video
  from public.video_drafts d where d.id = new.draft_id;
  if draft_group is distinct from 'V' then
    return new;
  end if;

  if new.slots->'violator'->>'entity' is not null then
    entity_key := new.slots->'violator'->>'entity';
    select e.cells into entity_cells from public.video_entities e
    where e.video_id = draft_video and e.annotator_id = new.annotator_id and e.entity_key = entity_key;
    if entity_cells->'type'->>'option' = 'type.animal' then
      raise exception using message = 'Slot answer: an animal cannot be the V violator', hint = 'animal_violator';
    end if;
  end if;

  if new.slots->'violator'->>'option' = 'violator.both'
     and jsonb_typeof(new.slots->'parties') = 'array' then
    for party in select value from jsonb_array_elements(new.slots->'parties') loop
      entity_key := party->'party'->>'entity';
      if entity_key is not null then
        select e.cells into entity_cells from public.video_entities e
        where e.video_id = draft_video and e.annotator_id = new.annotator_id and e.entity_key = entity_key;
        if entity_cells->'type'->>'option' = 'type.animal' then
          raise exception using message = 'Slot answer: an animal cannot be the V violator', hint = 'animal_violator';
        end if;
      end if;
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function public.reject_animal_v_violator() from public, anon, authenticated;
drop trigger if exists reject_animal_v_violator on public.qa_annotations;
create trigger reject_animal_v_violator
before insert or update of verdict, slots, draft_id, annotator_id on public.qa_annotations
for each row execute function public.reject_animal_v_violator();
