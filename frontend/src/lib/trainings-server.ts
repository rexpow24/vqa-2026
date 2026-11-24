import type { SupabaseClient } from "@supabase/supabase-js";
import { requiredTraining } from "@/lib/trainings";

/**
 * The 403 a save route answers while the caller has not watched the training of
 * this group (features/c-training-gate), or null when they may save. Admins are not gated.
 */
export async function trainingRequired(supabase: SupabaseClient, profile: { id: string; role: string }, qgroup: string):
  Promise<Response | null> {
  const training = profile.role === "admin" ? null : requiredTraining(qgroup);
  if (!training) return null;
  const { data } = await supabase.from("training_completions").select("training")
    .eq("annotator_id", profile.id).eq("training", training.id).maybeSingle();
  if (data) return null;
  return Response.json({ error: `Xem hết video hướng dẫn nhóm ${qgroup} trước khi gán nhãn nhóm này.`,
    code: "training_required" }, { status: 403 });
}
