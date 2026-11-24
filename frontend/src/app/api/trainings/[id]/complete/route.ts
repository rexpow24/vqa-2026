import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { isTrainingId } from "@/lib/trainings";

type Context = { params: Promise<{ id: string }> };

/**
 * Records that the caller watched a training video to the end (features/c-training-gate).
 * Idempotent: the first completion time is kept.
 */
export async function POST(_request: Request, context: Context) {
  const profile = await requireApiProfile();
  if (profile instanceof Response) return profile;
  const { id } = await context.params;
  if (!isTrainingId(id)) return Response.json({ error: "Unknown training", code: "unknown_training" }, { status: 422 });
  const supabase = await createClient();
  const { error } = await supabase.from("training_completions")
    .upsert({ annotator_id: profile.id, training: id }, { onConflict: "annotator_id,training", ignoreDuplicates: true });
  if (error) return Response.json({ error: error.message }, { status: 422 });
  return Response.json({ ok: true, training: id });
}
