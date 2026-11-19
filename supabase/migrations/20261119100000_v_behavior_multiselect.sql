-- V.v3 adds multiple selected behaviour tags while preserving V.v2 as a frozen codebook.
insert into public.codebook_versions (id, qgroup, version, content, sha256, frozen_on)
values ('V.v3', 'V', 3, $cb${
  "group": "V",
  "version": 3,
  "frozen_on": "2026-11-19",
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
}$cb$::jsonb, '95c763f0f2f825fb6af73d9cbd17b97349c1b56ac8c31cec0cb32050cd51a2a8', '2026-11-19');

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
declare selected jsonb;
declare selected_option jsonb;
declare option_id text;
declare selected_ids text[];
declare primary_option text;
declare contains_free_text boolean;
declare normalized_value jsonb;
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
    -- A multiple-choice cell stores all selected tag IDs in {"options": [...]}.
    -- Validate every ID, then normalize one choice so the existing cell rules
    -- still validate the required cell, free text, parent, and entity rules.
    if coalesce((cell->>'multiple')::boolean, false) and jsonb_typeof(val) = 'object' and val ? 'options' then
      if val ? 'option' or val ? 'entity'
         or exists (select 1 from jsonb_object_keys(val) k where k not in ('options','text')) then
        raise exception using message = format('Slot answer: cell %s has an invalid multiple-choice value', cell_key),
          hint = 'invalid_value';
      end if;
      selected := val->'options';
      if jsonb_typeof(selected) is distinct from 'array' then
        raise exception using message = format('Slot answer: cell %s choices must be an array', cell_key),
          hint = 'invalid_value';
      end if;
      if jsonb_array_length(selected) = 0 then
        raise exception using message = format('Slot answer: cell %s needs at least one choice', cell_key),
          hint = 'missing_cell';
      end if;
      if exists (select 1 from jsonb_array_elements(selected) x where jsonb_typeof(x.value) is distinct from 'string') then
        raise exception using message = format('Slot answer: cell %s choices must be strings', cell_key),
          hint = 'invalid_value';
      end if;
      selected_ids := array(select jsonb_array_elements_text(selected));
      if cardinality(selected_ids) <> (select count(distinct x) from unnest(selected_ids) x) then
        raise exception using message = format('Slot answer: cell %s has duplicate choices', cell_key),
          hint = 'invalid_value';
      end if;
      primary_option := selected_ids[1];
      contains_free_text := false;
      foreach option_id in array selected_ids loop
        selected_option := null;
        select o.value into selected_option from jsonb_array_elements(cell->'options') o where o.value->>'id' = option_id;
        if selected_option is null then
          raise exception using message = format('Slot answer: option %s is not in cell %s', option_id, cell_key),
            hint = 'unknown_option';
        end if;
        if coalesce((selected_option->>'from_entities')::boolean, false) then
          raise exception using message = format('Slot answer: multiple-choice option %s cannot take an entity', option_id),
            hint = 'unexpected_entity';
        end if;
        if coalesce((selected_option->>'free_text')::boolean, false) then
          if contains_free_text then
            raise exception using message = format('Slot answer: cell %s has more than one free-text choice', cell_key),
              hint = 'invalid_value';
          end if;
          contains_free_text := true;
          primary_option := option_id;
        end if;
        if cell ? 'parent_cell' and selected_option->>'parent' is distinct from cells->(cell->>'parent_cell')->>'option' then
          raise exception using message = format('Slot answer: %s does not belong under %s', option_id,
            coalesce(cells->(cell->>'parent_cell')->>'option', 'an empty ' || (cell->>'parent_cell'))), hint = 'wrong_parent';
        end if;
        if cell ? 'must_differ_from' and cells ? (cell->>'must_differ_from')
           and split_part(option_id, '.', 2) = split_part(cells->(cell->>'must_differ_from')->>'option', '.', 2) then
          raise exception using message = format('Slot answer: %s repeats %s', cell_key, cell->>'must_differ_from'),
            hint = 'must_differ';
        end if;
      end loop;
      if val ? 'text' and not contains_free_text then
        raise exception using message = format('Slot answer: %s takes no text', cell_key), hint = 'unexpected_text';
      end if;
      normalized_value := jsonb_build_object('option', primary_option);
      if val ? 'text' then normalized_value := normalized_value || jsonb_build_object('text', val->'text'); end if;
      cells := jsonb_set(cells, array[cell_key], normalized_value);
      val := normalized_value;
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
