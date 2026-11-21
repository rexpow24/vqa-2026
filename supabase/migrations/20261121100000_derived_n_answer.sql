-- N is an automatically generated summary for slot assignments, not an
-- independently judged answer. Keep it separate from the model's draft text.
alter table public.qa_annotations
  add column if not exists generated_answer text;

comment on column public.qa_annotations.generated_answer is
  'System-generated N summary for slot assignments; exclude from independent inter-annotator agreement.';
