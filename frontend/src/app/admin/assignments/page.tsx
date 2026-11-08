import Link from "next/link";
import { requireProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { AssignmentPanel, type Overview, type Stratum } from "./assignment-panel";

export default async function AssignmentsPage() {
  await requireProfile("admin");
  const supabase = await createClient();
  const [overview, strata] = await Promise.all([supabase.rpc("assignment_overview"), supabase.rpc("agreement_strata")]);
  const error = overview.error ?? strata.error;
  if (error) throw new Error(error.message);
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center gap-4">
      <h2 className="text-xl font-semibold">Phân công video</h2>
      <Link href="/admin/users" className="ml-auto text-sm text-accent">Người dùng</Link>
      <Link href="/admin" className="text-sm text-accent">Dashboard</Link>
    </div>
    <AssignmentPanel overview={overview.data as Overview} strata={(strata.data ?? []) as Stratum[]} />
  </div>;
}
