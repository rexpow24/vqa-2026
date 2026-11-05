-- Evidence frames only for the groups whose answer rests on one moment:
-- C (cause), V (violation), Attr (attribution). The other six describe the
-- whole clip, where 1-3 frames carry no evidence and only cost annotator time.
--
-- Same list as `keyframes` in frontend/src/lib/qgroups.json; change both together.
-- Other groups store an empty array whatever the client sends, so a browser
-- still running the old page cannot leave stray frames behind.

create or replace function public.validate_qa_annotation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare video_duration numeric;
declare draft_group text;
declare mark numeric;
begin
  if tg_op = 'UPDATE' and (new.draft_id <> old.draft_id or new.annotator_id <> old.annotator_id) then
    raise exception 'QA annotation ownership cannot be changed';
  end if;
  select v.duration_s, d.qgroup into video_duration, draft_group
  from public.video_drafts d join public.videos v on v.id = d.video_id
  where d.id = new.draft_id and v.status = 'active';
  if video_duration is null then raise exception 'Active draft video not found'; end if;
  if draft_group not in ('C','V','Attr') then
    new.human_keyframes_s := '{}';
  elsif cardinality(new.human_keyframes_s) not between 1 and 3 then
    raise exception 'Choose 1 to 3 evidence frames';
  end if;
  foreach mark in array new.human_keyframes_s loop
    if mark = 'NaN'::numeric or mark < 0 or mark > video_duration then
      raise exception 'Evidence frame is outside the video';
    end if;
  end loop;
  if new.verdict = 'DISAGREE' and (
    new.reason_code not in ('thiếu thực thể','sai thực thể','sai nhân quả',
      'sai mốc thời gian','bịa chi tiết','sai diễn đạt','khác') or new.reason_code is null
  ) then raise exception 'Disagreement needs a reason'; end if;
  if new.verdict = 'DISAGREE' and new.reason_code = 'khác' and length(trim(coalesce(new.reason_note,''))) = 0 then
    raise exception 'Other reason needs a note';
  end if;
  new.annotated_at := now();
  return new;
end;
$$;
