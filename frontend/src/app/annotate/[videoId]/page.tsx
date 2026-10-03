import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { HostedLabeling, type HostedDraft } from "@/components/HostedLabeling";

type Context = { params: Promise<{ videoId: string }> };

export default async function VideoPage({ params }: Context) {
  const profile = await requireProfile();
  const { videoId } = await params;
  const supabase = await createClient();
  const { data: video } = await supabase.from("videos")
    .select("id,filename,duration_s,available,status").eq("id", videoId).single();
  if (!video || video.status !== "active") notFound();
  const [assignmentResult, labelResult, draftsResult] = await Promise.all([
    supabase.from("video_assignments").select("id,status,completed_at").eq("video_id", videoId).eq("annotator_id", profile.id).maybeSingle(),
    supabase.from("video_labels").select("difficulty,event_label").eq("video_id", videoId).eq("annotator_id", profile.id).maybeSingle(),
    supabase.from("video_drafts").select("id,qgroup,group_name,question,answer,source_kind,truncated,completion_tokens,latency_ms,prompt_version,frame_times_s,predicted_keyframes_s")
      .eq("video_id", videoId),
  ]);
  const error = assignmentResult.error ?? labelResult.error ?? draftsResult.error;
  if (error) throw new Error(error.message);
  const drafts = draftsResult.data ?? [];
  const draftIds = drafts.map((draft) => draft.id);
  const annotationResult = draftIds.length ? await supabase.from("qa_annotations")
    .select("draft_id,verdict,reason_code,reason_note,edited_answer,human_keyframes_s")
    .eq("annotator_id", profile.id).in("draft_id", draftIds) : { data: [], error: null };
  if (annotationResult.error) throw new Error(annotationResult.error.message);
  const order = ["S", "E", "N", "C", "V", "O", "R", "Attr", "Prev"];
  const initialDrafts = drafts.map((draft) => {
    const mine = annotationResult.data?.find((item) => item.draft_id === draft.id);
    return { ...draft, verdict: mine?.verdict ?? null, reason_code: mine?.reason_code ?? null,
      reason_note: mine?.reason_note ?? null, edited_answer: mine?.edited_answer ?? null,
      human_keyframes_s: mine?.human_keyframes_s ?? [],
      predicted_keyframes_s: mine ? draft.predicted_keyframes_s : null,
    };
  }).sort((a, b) => order.indexOf(a.qgroup) - order.indexOf(b.qgroup));
  return <HostedLabeling video={video} initialAssignment={assignmentResult.data}
    initialLabel={labelResult.data as { difficulty: "easy" | "medium" | "high"; event_label: "accident" | "near-miss" } | null}
    initialDrafts={initialDrafts as HostedDraft[]} />;
}
