import { requireProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { currentVersion, getCodebook } from "@/lib/codebook";
import { ResolutionQueue, type ResolutionCase } from "./resolution-queue";

export default async function ResolutionPage() {
  await requireProfile("annotator");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cell_resolution_queue");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<ResolutionCase, "options" | "optionLabels">[];
  const cases: ResolutionCase[] = rows.map((row) => {
    const version = currentVersion(row.question_group);
    const book = version ? getCodebook(version) : undefined;
    const options = book?.cells.find((cell) => cell.id === row.target_cell)?.options ?? [];
    return { ...row, options: options.map(({ id, label }) => ({ id, label })),
      optionLabels: Object.fromEntries((book?.cells.flatMap((cell) => cell.options ?? []) ?? []).map(({ id, label }) => [id, label])) };
  });
  return <ResolutionQueue initialCases={cases} />;
}
