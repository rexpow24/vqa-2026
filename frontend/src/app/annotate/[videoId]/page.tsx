import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { HostedLabeling, type HostedDraft } from "@/components/HostedLabeling";
import { groupOrder } from "@/lib/qgroups";
import { createAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ videoId: string }> };

export default async function VideoPage({ params }: Context) {
  const profile = await requireProfile();
  const { videoId } = await params;
  const supabase = await createClient();
  const { data: video } = await supabase.from("videos")
    .select("id,seq,filename,duration_s,available,status").eq("id", videoId).maybeSingle();
  if (!video || video.status !== "active") notFound();
  const [assignmentResult, labelResult, draftsResult, labelDecisionResult] = await Promise.all([
    supabase.from("video_assignments").select("id,status,completed_at,answer_format").eq("video_id", videoId).eq("annotator_id", profile.id).maybeSingle(),
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
  const slotForm = assignmentResult.data?.answer_format === "slots";
  const [annotationResult, decisionResult, entityResult] = draftIds.length ? await Promise.all([
    supabase.from("qa_annotations").select("draft_id,verdict,reason_code,reason_note,edited_answer,human_keyframes_s,slots,codebook_version")
      .eq("annotator_id", profile.id).in("draft_id", draftIds),
    supabase.from("answer_adjudications").select("draft_id,final_verdict,final_answer,final_keyframes_s").in("draft_id", draftIds),
    // The parties A, B, C of group E, only a slot assignment has them.
    slotForm ? supabase.from("video_entities").select("entity_key,cells").eq("video_id", videoId).eq("annotator_id", profile.id)
      .order("entity_key") : Promise.resolve({ data: [], error: null }),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const answersError = annotationResult.error ?? decisionResult.error ?? entityResult.error;
  if (answersError) throw new Error(answersError.message);
  const initialDrafts = drafts.map((draft) => {
    const mine = annotationResult.data?.find((item) => item.draft_id === draft.id);
    return { ...draft, verdict: mine?.verdict ?? null, reason_code: mine?.reason_code ?? null,
      reason_note: mine?.reason_note ?? null, edited_answer: mine?.edited_answer ?? null,
      human_keyframes_s: mine?.human_keyframes_s ?? [],
      slots: mine?.slots ?? null, codebook_version: mine?.codebook_version ?? null,
      predicted_keyframes_s: mine ? draft.predicted_keyframes_s : null,
      decision: decisionResult.data?.find((item) => item.draft_id === draft.id) ?? null,
    };
  }).sort((a, b) => groupOrder(a.qgroup) - groupOrder(b.qgroup));
  let adminAnswers: {
    annotator_id: string; annotator_name: string; annotator_email: string; assignment_status: string;
    answer_format: "text" | "slots"; qgroup: string; question: string; verdict: string | null;
    edited_answer: string | null; slots: Record<string, unknown> | null; codebook_version: string | null;
  }[] | undefined;
  if (profile.role === "admin" && draftIds.length) {
    const admin = createAdminClient();
    const [adminAssignments, adminAnnotations] = await Promise.all([
      admin.from("video_assignments").select("annotator_id,status,answer_format,user_profiles(name,email)").eq("video_id", videoId),
      admin.from("qa_annotations").select("draft_id,annotator_id,verdict,edited_answer,slots,codebook_version").in("draft_id", draftIds),
    ]);
    const adminError = adminAssignments.error ?? adminAnnotations.error;
    if (adminError) throw new Error(adminError.message);
    const assignmentByAnnotator = new Map((adminAssignments.data ?? []).map((assignment) => [assignment.annotator_id, assignment]));
    const draftById = new Map(drafts.map((draft) => [draft.id, draft]));
    adminAnswers = (adminAnnotations.data ?? []).flatMap((annotation) => {
      const assignment = assignmentByAnnotator.get(annotation.annotator_id);
      const draft = draftById.get(annotation.draft_id);
      if (!assignment || !draft) return [];
      const user = assignment.user_profiles as unknown as { name: string | null; email: string | null } | null;
      return [{ annotator_id: annotation.annotator_id, annotator_name: user?.name ?? "Chưa rõ tên",
        annotator_email: user?.email ?? "", assignment_status: assignment.status,
        answer_format: assignment.answer_format === "slots" ? "slots" as const : "text" as const,
        qgroup: draft.qgroup, question: draft.question, verdict: annotation.verdict,
        edited_answer: annotation.edited_answer, slots: annotation.slots as Record<string, unknown> | null,
        codebook_version: annotation.codebook_version }];
    }).sort((a, b) => a.annotator_name.localeCompare(b.annotator_name, "vi")
      || groupOrder(a.qgroup) - groupOrder(b.qgroup));
  }
  return <HostedLabeling video={video} initialAssignment={assignmentResult.data}
    initialLabel={labelResult.data as { event_label: "accident" | "near-miss" } | null}
    initialDrafts={initialDrafts as HostedDraft[]}
    labelDecision={(labelDecisionResult.data?.event_label ?? null) as "accident" | "near-miss" | null}
    answerFormat={slotForm ? "slots" : "text"}
    initialEntities={(entityResult.data ?? []).map((row) => ({ key: row.entity_key as string, cells: row.cells as Record<string, unknown> }))}
    adminAnswers={adminAnswers} />;
}
