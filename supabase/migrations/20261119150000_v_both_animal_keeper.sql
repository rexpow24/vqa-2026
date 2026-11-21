-- V.v6 supports an explicitly unidentified animal keeper beside an E entity in V both-parties answers.
-- Earlier codebooks and other groups retain their entity-only party validation.
insert into public.codebook_versions (id, qgroup, version, content, sha256, frozen_on) values
  ('V.v6', 'V', 6, $cb${
  "group": "V",
  "version": 6,
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
          "condition": "Chỉ dùng khi thấy rõ vật nuôi đi rông gây nguy cơ giao thông nhưng chưa xác định được người liên quan đến hành vi đó. Chỉ nhận diện được chủ nuôi hoặc thấy họ đến nhận con vật chưa đủ để chọn họ làm bên vi phạm. Không chọn con vật làm bên vi phạm.",
          "label": "chủ/người quản lý vật nuôi (chưa xác định)",
          "party_label": "chủ/người quản lý vật nuôi chưa xác định"
        }
      ],
      "per_party_options": [
        "violator.unidentified"
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
          "condition": "Ghi ngắn hành vi quan sát được. Nếu thấy rõ chủ nuôi hoặc người quản lý để vật nuôi lao ra đường gây mất an toàn, chọn người đó từ E và mô tả hành vi; không gán chỉ vì nhận diện được chủ hoặc thấy họ đến nhận con vật sau sự việc. Với người chưa xác định, chỉ mô tả vật nuôi đi rông. Không dùng từ \"lỗi\", \"vi phạm điều/khoản\", mức phạt.",
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
$cb$::jsonb, '0b49cdcb9e3c1a7356351b494b9ea7261e975da5b4fe219358d6fadb484ddba1', '2026-11-19');

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
                    where jsonb_typeof(p.value) is distinct from 'object'
                       or case when jsonb_typeof(p.value->'party') = 'object' then not (
                         ((p.value->'party') - 'entity' = '{}'::jsonb
                           and jsonb_typeof(p.value->'party'->'entity') is not distinct from 'string')
                         or coalesce((grp = 'V' and (p.value->'party') - 'option' = '{}'::jsonb
                           and jsonb_typeof(p.value->'party'->'option') = 'string'
                           and coalesce((select c.value->'per_party_options' from jsonb_array_elements(book->'cells') c
                                         where c.value->>'id' = 'violator'), '[]'::jsonb)
                               ? (p.value->'party'->>'option')), false))
                         else true end)
         or (select count(distinct p.value->'party') from jsonb_array_elements(slots->'parties') p) <> 2 then
        raise exception using message = format('Slot answer: %s requires two different parties', when_option),
          hint = 'parties';
      end if;
      parent_cells := array(select c.value->>'parent_cell' from jsonb_array_elements(book->'cells') c
                            where c.value->>'id' = any(when_cells) and c.value ? 'parent_cell');
      for item in select p.value from jsonb_array_elements(slots->'parties') p loop
        if item->'party' ? 'entity' and not exists (select 1 from public.video_entities e where e.video_id = video
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
