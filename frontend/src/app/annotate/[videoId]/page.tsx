import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { HostedLabeling, type HostedDraft } from "@/components/HostedLabeling";
import { groupOrder } from "@/lib/qgroups";

type Context = { params: Promise<{ videoId: string }> };

export default async function VideoPage({ params }: Context) {
  const profile = await requireProfile();
  const { videoId } = await params;
  const supabase = await createClient();
  const { data: video } = await supabase.from("videos")
    .select("id,seq,filename,duration_s,available,status").eq("id", videoId).maybeSingle();
  if (!video || video.status !== "active") notFound();
  const [assignmentResult, labelResult, draftsResult, labelDecisionResult] = await Promise.all([
    supabase.from("video_assignments").select("id,status,completed_at").eq("video_id", videoId).eq("annotator_id", profile.id).maybeSingle(),
    supabase.from("video_labels").select("event_label").eq("video_id", videoId).eq("annotator_id", profile.id).maybeSingle(),
    supabase.from("video_drafts").select("id,qgroup,group_name,question,answer,source_kind,truncated,completion_tokens,latency_ms,prompt_version,frame_times_s,predicted_keyframes_s")
      .eq("video_id", videoId),
    // RLS returns a decision only to the annotators it was decided between.
    supabase.from("label_adjudications").select("event_label").eq("video_id", videoId).maybeSingle(),
  ]);
  const error = assignmentResult.error ?? labelResult.error ?? draftsResult.error ?? labelDecisionResult.error;
  if (error) throw new Error(error.message);
  const drafts = draftsResult.data ?? [];
  const draftIds = drafts.map((draft) => draft.id);
  const [annotationResult, decisionResult] = draftIds.length ? await Promise.all([
    supabase.from("qa_annotations").select("draft_id,verdict,reason_code,reason_note,edited_answer,human_keyframes_s")
      .eq("annotator_id", profile.id).in("draft_id", draftIds),
    supabase.from("answer_adjudications").select("draft_id,final_verdict,final_answer,final_keyframes_s").in("draft_id", draftIds),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  const answersError = annotationResult.error ?? decisionResult.error;
  if (answersError) throw new Error(answersError.message);
  const initialDrafts = drafts.map((draft) => {
    const mine = annotationResult.data?.find((item) => item.draft_id === draft.id);
    return { ...draft, verdict: mine?.verdict ?? null, reason_code: mine?.reason_code ?? null,
      reason_note: mine?.reason_note ?? null, edited_answer: mine?.edited_answer ?? null,
      human_keyframes_s: mine?.human_keyframes_s ?? [],
      predicted_keyframes_s: mine ? draft.predicted_keyframes_s : null,
      decision: decisionResult.data?.find((item) => item.draft_id === draft.id) ?? null,
    };
  }).sort((a, b) => groupOrder(a.qgroup) - groupOrder(b.qgroup));
  return <HostedLabeling video={video} initialAssignment={assignmentResult.data}
    initialLabel={labelResult.data as { event_label: "accident" | "near-miss" } | null}
    initialDrafts={initialDrafts as HostedDraft[]}
    labelDecision={(labelDecisionResult.data?.event_label ?? null) as "accident" | "near-miss" | null} />;
}
