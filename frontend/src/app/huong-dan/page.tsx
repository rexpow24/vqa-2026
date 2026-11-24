import Link from "next/link";
import { notFound } from "next/navigation";
import { TrainingVideo } from "@/components/TrainingVideo";
import { requireProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { GUIDE_TRAININGS, WELCOME_TRAINING } from "@/lib/trainings";

// The welcome video every annotator watches before labelling, then the group
// training videos (features/welcome-gate). /annotate sends an annotator here
// until WELCOME-v1 is recorded.
export default async function GuidePage() {
  if (process.env.VERCEL !== "1" && process.env.PLATFORM_MODE !== "hosted") notFound();
  const profile = await requireProfile();
  const annotator = profile.role !== "admin";
  const supabase = await createClient();
  const { data, error } = annotator
    ? await supabase.from("training_completions").select("training").eq("annotator_id", profile.id)
    : { data: [], error: null };
  if (error) throw new Error(error.message);
  const done = new Set((data ?? []).map((row) => row.training as string));
  const welcomeDone = done.has(WELCOME_TRAINING.id);

  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-xl font-semibold">Hướng dẫn</h2>
      {(!annotator || welcomeDone) && <Link href="/annotate" className="text-sm text-accent">Bắt đầu gán nhãn</Link>}
    </div>
    {annotator && !welcomeDone && <p className="rounded border border-amber/50 bg-amber/10 px-3 py-2 text-sm">
      <b className="text-amber">Bắt buộc:</b> xem hết video welcome trước khi gán nhãn.
    </p>}
    {GUIDE_TRAININGS.map(({ heading, training }) => <TrainingVideo key={training.id} heading={heading} training={training}
      done={done.has(training.id)} record={annotator} welcome={training.id === WELCOME_TRAINING.id} />)}
  </div>;
}
