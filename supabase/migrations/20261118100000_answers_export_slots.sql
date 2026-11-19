-- Include the structured multiple-choice answer in the downloadable answer
-- export. Keep the format metadata beside the stored cells so offline IAA
-- analysis can distinguish codebook versions and compare selections.

drop function public.answers_export(boolean, integer, integer);

create function public.answers_export(only_agreement boolean, seq_from integer, seq_to integer)
returns table (
  seq integer, filename text, agreement boolean, annotator_email text, annotator_name text,
  assignment_status text, batch text, answer_format text, codebook_version text, slots jsonb,
  qgroup text, question text, draft_answer text,
  verdict text, reason_code text, reason_note text, edited_answer text, effective_answer text,
  human_keyframes_s text, annotated_at timestamptz, event_label text,
  draft_id uuid, video_id uuid, annotator_id uuid
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  return query
  select v.seq, v.filename, v.agreement_sample, p.email, p.name,
    a.status, a.batch, coalesce(a.answer_format, 'text'), q.codebook_version, q.slots,
    d.qgroup, d.question, d.answer,
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
    and (seq_from is null or v.seq >= seq_from)
    and (seq_to is null or v.seq <= seq_to)
  order by v.seq, d.qgroup, p.email, d.id;
end;
$$;

revoke all on function public.answers_export(boolean, integer, integer) from public, anon;
grant execute on function public.answers_export(boolean, integer, integer) to authenticated;
