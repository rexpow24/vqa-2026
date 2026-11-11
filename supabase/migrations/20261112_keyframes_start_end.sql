-- Evidence frames become exactly two: the start and the end of the event.
--
-- Groups C (cause), V (violation), Attr (attribution) took 1-3 free frames
-- (20261105_keyframe_groups.sql). Annotators now mark one span instead:
-- human_keyframes_s = [start, end] with start < end. The other six groups
-- still store '{}' whatever the client sends.
--
-- Rows saved under the 1-3 rule stay valid as stored: an UPDATE that leaves
-- human_keyframes_s unchanged is not re-checked, so a legacy row with one or
-- three frames never starts failing on an unrelated update (a verdict fixed
-- by hand, a backfill). Any INSERT, and any UPDATE that changes the frames,
-- must carry exactly two. The app's save route always resends the frames and
-- requires two, so re-saving a legacy answer there converts it.
--
-- Same list as `keyframes` in frontend/src/lib/qgroups.json; change both together.
-- Everything except the keyframe branch is copied unchanged from
-- 20261107_answer_adjudication.sql.

create or replace function public.validate_qa_annotation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare video_duration numeric;
declare draft_group text;
declare draft_answer text;
declare mark numeric;
begin
  if tg_op = 'UPDATE' and (new.draft_id <> old.draft_id or new.annotator_id <> old.annotator_id) then
    raise exception 'QA annotation ownership cannot be changed';
  end if;
  if tg_op = 'UPDATE' and exists (select 1 from public.answer_adjudications j
                                  where j.draft_id = old.draft_id and old.annotator_id = any(j.annotator_ids)) then
    raise exception 'This answer was adjudicated and is locked';
  end if;
  select v.duration_s, d.qgroup, d.answer into video_duration, draft_group, draft_answer
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
