-- Avoid ambiguity between the PL/pgSQL variable and video_entities.entity_key.
-- Keep this as a follow-up migration for databases that already have V.v4.
create or replace function public.reject_animal_v_violator()
returns trigger language plpgsql security definer set search_path = '' as $$
declare draft_group text;
declare draft_video uuid;
declare selected_entity_key text;
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
    selected_entity_key := new.slots->'violator'->>'entity';
    select e.cells into entity_cells from public.video_entities e
    where e.video_id = draft_video and e.annotator_id = new.annotator_id
      and e.entity_key = selected_entity_key;
    if entity_cells->'type'->>'option' = 'type.animal' then
      raise exception using message = 'Slot answer: an animal cannot be the V violator', hint = 'animal_violator';
    end if;
  end if;

  if new.slots->'violator'->>'option' = 'violator.both'
     and jsonb_typeof(new.slots->'parties') = 'array' then
    for party in select value from jsonb_array_elements(new.slots->'parties') loop
      selected_entity_key := party->'party'->>'entity';
      if selected_entity_key is not null then
        select e.cells into entity_cells from public.video_entities e
        where e.video_id = draft_video and e.annotator_id = new.annotator_id
          and e.entity_key = selected_entity_key;
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
