import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { currentVersion } from "@/lib/codebook";
import { compose, type Entity, type Slots } from "@/lib/codebook/compose";
import { derivePrevention, deriveViolation } from "@/lib/codebook/derivation";

type Context = { params: Promise<{ id: string }> };

/** Idempotently synchronize V and Prev from the annotator's saved C and E. */
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
    .eq("video_id", videoId).in("qgroup", ["C", "V", "Prev"]);
  const byGroup = new Map((drafts ?? []).map((row) => [row.qgroup, row.id]));
  const cDraftId = byGroup.get("C");
  if (!cDraftId) return Response.json({ rows: [] });
  const { data: cause } = await supabase.from("qa_annotations").select("slots,human_keyframes_s")
    .eq("draft_id", cDraftId).eq("annotator_id", profile.id).eq("verdict", "SLOTS").maybeSingle();
  if (!cause?.slots) return Response.json({ rows: [] });
  const { data: entitiesData } = await supabase.from("video_entities").select("entity_key,cells")
    .eq("video_id", videoId).eq("annotator_id", profile.id);
  const entities = (entitiesData ?? []).map((row) => ({ key: row.entity_key, cells: row.cells as Slots })) as Entity[];
  const vDraftId = byGroup.get("V");
  const { data: oldV } = vDraftId ? await supabase.from("qa_annotations").select("slots")
    .eq("draft_id", vDraftId).eq("annotator_id", profile.id).eq("verdict", "SLOTS").maybeSingle() : { data: null };
  const vSlots = deriveViolation(cause.slots as Slots, entities, oldV?.slots as Slots | null);
  const prevSlots = derivePrevention(vSlots, entities);
  const rows: Record<string, unknown>[] = [];
  if (vDraftId) rows.push({ draft_id: vDraftId, codebook_version: currentVersion("V"), slots: vSlots,
    human_keyframes_s: cause.human_keyframes_s ?? [],
    edited_answer: compose("V", vSlots, { version: currentVersion("V"), entities }) });
  const prevDraftId = byGroup.get("Prev");
  if (prevDraftId) rows.push({ draft_id: prevDraftId, codebook_version: currentVersion("Prev"), slots: prevSlots,
    human_keyframes_s: [], edited_answer: compose("Prev", prevSlots, { version: currentVersion("Prev"), entities }) });
  if (!rows.length) return Response.json({ rows: [] });
  const { data, error } = await supabase.rpc("save_slot_answers", { rows });
  if (error) return Response.json({ error: error.message, code: error.hint }, { status: 422 });
  return Response.json({ rows: data ?? [] });
}
