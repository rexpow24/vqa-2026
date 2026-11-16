import { requireProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { AssignmentPanel, type Overview, type Stratum } from "./assignment-panel";

/** [3, 1, 2, 7] -> "1-3, 7" */
function compress(numbers: number[]): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const pieces: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    pieces.push(i === j ? String(sorted[i]) : `${sorted[i]}-${sorted[j]}`);
    i = j;
  }
  return pieces.join(", ");
}

export default async function AssignmentsPage() {
  await requireProfile("admin");
  const supabase = await createClient();
  const [overview, strata, slots] = await Promise.all([supabase.rpc("assignment_overview"), supabase.rpc("agreement_strata"),
    // Only the slot assignments: every other one is text, the column default.
    supabase.from("video_assignments").select("annotator_id,videos!inner(seq)").eq("answer_format", "slots")]);
  const error = overview.error ?? strata.error ?? slots.error;
  if (error) throw new Error(error.message);
  const seqs = new Map<string, number[]>();
  for (const row of (slots.data ?? []) as unknown as { annotator_id: string; videos: { seq: number | null } }[]) {
    if (row.videos.seq === null) continue;
    seqs.set(row.annotator_id, [...(seqs.get(row.annotator_id) ?? []), row.videos.seq]);
  }
  const slotRanges = Object.fromEntries([...seqs].map(([id, numbers]) => [id, compress(numbers)]));
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center gap-4">
      <h2 className="text-xl font-semibold">Phân công video</h2>
    </div>
    <AssignmentPanel overview={overview.data as Overview} strata={(strata.data ?? []) as Stratum[]} slotRanges={slotRanges} />
  </div>;
}
