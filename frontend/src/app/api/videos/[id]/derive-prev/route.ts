import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { currentVersion } from "@/lib/codebook";
import { compose, type Entity, type Slots } from "@/lib/codebook/compose";
import { derivePreventionFromCause } from "@/lib/codebook/derivation";
import { outcomeRow } from "@/lib/codebook/outcome";

type Context = { params: Promise<{ id: string }> };

/**
 * Idempotently synchronize the answers derived from the saved C and E: Prev,
 * and O when C fully decides it (a near miss) or an O.v2 answer with signs
 * needs its parties and sentence to follow C (features/o-codebook-v2).
 */
export async function POST(_request: Request, context: Context) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  const { id: videoId } = await context.params;
  const supabase = await createClient();
  const { data: assignment } = await supabase.from("video_assignments").select("status,answer_format")
    .eq("video_id", videoId).eq("annotator_id", profile.id).maybeSingle();
  if (!assignment || assignment.answer_format !== "slots" || assignment.status === "completed") {
    return Response.json({ rows: [] });
  }
  const { data: drafts } = await supabase.from("video_drafts").select("id,qgroup")
    .eq("video_id", videoId).in("qgroup", ["C", "Prev", "O"]);
  const byGroup = new Map((drafts ?? []).map((row) => [row.qgroup, row.id]));
  const cDraftId = byGroup.get("C");
  const prevDraftId = byGroup.get("Prev");
  if (!cDraftId || !prevDraftId) return Response.json({ rows: [] });
  const { data: cause } = await supabase.from("qa_annotations").select("slots")
    .eq("draft_id", cDraftId).eq("annotator_id", profile.id).eq("verdict", "SLOTS").maybeSingle();
  if (!cause?.slots) return Response.json({ rows: [] });
  const { data: entitiesData } = await supabase.from("video_entities").select("entity_key,cells")
    .eq("video_id", videoId).eq("annotator_id", profile.id);
  const entities = (entitiesData ?? []).map((row) => ({ key: row.entity_key, cells: row.cells as Slots })) as Entity[];
  const slots = derivePreventionFromCause(cause.slots as Slots, entities);
  const version = currentVersion("Prev")!;
  const rows: Record<string, unknown>[] = [{ draft_id: prevDraftId, codebook_version: version, slots, human_keyframes_s: [],
    edited_answer: compose("Prev", slots, { version, entities }) }];
  const outcomeDraftId = byGroup.get("O") ?? null;
  if (outcomeDraftId) {
    const { data: stored } = await supabase.from("qa_annotations").select("slots,codebook_version,edited_answer")
      .eq("draft_id", outcomeDraftId).eq("annotator_id", profile.id).eq("verdict", "SLOTS").maybeSingle();
    const outcome = outcomeRow(cause.slots as Slots, stored as Parameters<typeof outcomeRow>[1], entities, outcomeDraftId);
    if (outcome) rows.push(outcome);
  }
  const { data, error } = await supabase.rpc("save_slot_answers", { rows });
  if (error) return Response.json({ error: error.message, code: error.hint }, { status: 422 });
  return Response.json({ rows: data ?? [] });
}
