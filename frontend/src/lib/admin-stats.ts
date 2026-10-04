import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/auth";

export type UserStats = {
  profile: Profile;
  assigned: number;
  completed: number;
  remaining: number;
  annotations: number;
  completionRate: number;
  lastActivity: string | null;
};

// Shape of public.admin_stats(); the counting happens in Postgres so this page
// costs one round trip rather than 4 + 4 per annotator. See the migration
// 20261004_admin_stats.sql for why.
type StatsRow = Profile & {
  assigned: number;
  completed: number;
  annotations: number;
  last_activity: string | null;
};
type StatsPayload = {
  users: StatsRow[];
  totalVideos: number;
  completedVideos: number;
  totalAnnotations: number;
  completedAssignments: number;
  totalAssignments: number;
};

export async function getAdminStats() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_stats");
  if (error) throw new Error(error.message);
  // The function returns nothing at all when the caller is not an admin.
  if (!data) throw new Error("Admin access required");
  const payload = data as StatsPayload;

  const users: UserStats[] = (payload.users ?? []).map((row) => {
    const assigned = Number(row.assigned);
    const completed = Number(row.completed);
    return {
      profile: {
        id: row.id, email: row.email, name: row.name,
        role: row.role, enabled: row.enabled, created_at: row.created_at,
      },
      assigned,
      completed,
      remaining: Math.max(0, assigned - completed),
      annotations: Number(row.annotations),
      completionRate: assigned ? Math.round((completed / assigned) * 100) : 0,
      lastActivity: row.last_activity,
    };
  });

  return {
    users,
    totalAnnotators: users.length,
    totalVideos: Number(payload.totalVideos),
    completedVideos: Number(payload.completedVideos),
    pendingVideos: Number(payload.totalVideos) - Number(payload.completedVideos),
    totalAnnotations: Number(payload.totalAnnotations),
    completedAssignments: Number(payload.completedAssignments),
    totalAssignments: Number(payload.totalAssignments),
  };
}
