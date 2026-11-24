import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { WELCOME_TRAINING, missingForSave } from "@/lib/trainings";

/** The training ids the caller completed (RLS returns only their own rows). */
async function completedTrainings(supabase: SupabaseClient, annotatorId: string): Promise<string[]> {
  const { data, error } = await supabase.from("training_completions").select("training").eq("annotator_id", annotatorId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.training as string);
}

/**
 * The 403 a save route answers while the caller has not watched the welcome
 * video (features/welcome-gate) or the training of this group
 * (features/c-training-gate), or null when they may save. Admins are not gated.
 */
export async function trainingRequired(supabase: SupabaseClient, profile: { id: string; role: string }, qgroup: string):
  Promise<Response | null> {
  if (profile.role === "admin") return null;
  const missing = missingForSave(qgroup, await completedTrainings(supabase, profile.id));
  if (!missing.length) return null;
  const error = missing[0].id === WELCOME_TRAINING.id
    ? "Xem hết video welcome ở trang Hướng dẫn trước khi gán nhãn."
    : `Xem hết video hướng dẫn nhóm ${qgroup} trước khi gán nhãn nhóm này.`;
  return Response.json({ error, code: "training_required", training: missing[0].id }, { status: 403 });
}

/**
 * Sends an annotator who has not watched the welcome video to /huong-dan
 * (features/welcome-gate). Admins are not gated. Call it in a page, before any data is shown.
 */
export async function requireWelcome(supabase: SupabaseClient, profile: { id: string; role: string }): Promise<void> {
  if (profile.role === "admin") return;
  const { data, error } = await supabase.from("training_completions").select("training")
    .eq("annotator_id", profile.id).eq("training", WELCOME_TRAINING.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) redirect("/huong-dan");
}
