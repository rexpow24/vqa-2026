import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { outcomeConflict, type StoredOutcome } from "@/lib/codebook/outcome";
import type { Slots } from "@/lib/codebook/compose";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  const { id } = await context.params;
  const supabase = await createClient();
  // O.v2 is derived from C; a C changed afterwards can leave an O that says
  // otherwise (features/o-codebook-v2). The video is not finished until it agrees.
  const conflict = await storedOutcomeConflict(supabase, id, profile.id);
  if (conflict) return Response.json({ error: conflict, code: "outcome_conflict" }, { status: 422 });
  const { data, error } = await supabase.from("video_assignments")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("video_id", id).eq("annotator_id", profile.id)
    .select("id,status,completed_at").maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 422 });
  if (!data) return Response.json({ error: "Assignment not found" }, { status: 404 });

  // Hand back the next unfinished assigned video (by number) so the client
  // can go straight there instead of bouncing through the list.
  const { data: queue } = await supabase.rpc("next_assigned_video");
  const next = Array.isArray(queue) && queue.length ? queue[0] : null;
  return Response.json({
    ...data,
    next_video_id: next?.video_id ?? null,
    next_filename: next?.filename ?? null,
  });
}

async function storedOutcomeConflict(supabase: Awaited<ReturnType<typeof createClient>>, videoId: string,
  annotatorId: string): Promise<string | null> {
  const { data: drafts } = await supabase.from("video_drafts").select("id,qgroup").eq("video_id", videoId).in("qgroup", ["C", "O"]);
  const ids = (drafts ?? []).map((draft) => draft.id);
  if (ids.length !== 2) return null;
  const { data: answers } = await supabase.from("qa_annotations").select("draft_id,slots,codebook_version,edited_answer")
    .eq("annotator_id", annotatorId).eq("verdict", "SLOTS").in("draft_id", ids);
  const byGroup = (group: string) => {
    const draftId = drafts!.find((draft) => draft.qgroup === group)!.id;
    return (answers ?? []).find((answer) => answer.draft_id === draftId) ?? null;
  };
  const cause = byGroup("C");
  return outcomeConflict((cause?.slots as Slots | undefined) ?? null, byGroup("O") as StoredOutcome);
}
