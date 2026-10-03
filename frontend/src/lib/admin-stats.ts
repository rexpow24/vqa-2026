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

export async function getAdminStats() {
  const supabase = await createClient();
  const [profilesResult, videosResult, assignmentsResult, annotationCountResult] = await Promise.all([
    supabase.from("user_profiles").select("id,email,name,role,enabled,created_at").order("created_at"),
    supabase.from("videos").select("id,status").eq("status", "active"),
    supabase.from("video_assignments").select("video_id,status"),
    supabase.from("qa_annotations").select("draft_id", { count: "exact", head: true }),
  ]);
  const error = profilesResult.error ?? videosResult.error ?? assignmentsResult.error ?? annotationCountResult.error;
  if (error) throw new Error(error.message);
  const profiles = (profilesResult.data ?? []) as Profile[];
  const videos = videosResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const users: UserStats[] = await Promise.all(profiles.filter((p) => p.role === "annotator").map(async (profile) => {
    const [assignedResult, completedResult, annotationResult, lastResult] = await Promise.all([
      supabase.from("video_assignments").select("id", { count: "exact", head: true }).eq("annotator_id", profile.id),
      supabase.from("video_assignments").select("id", { count: "exact", head: true }).eq("annotator_id", profile.id).eq("status", "completed"),
      supabase.from("qa_annotations").select("draft_id", { count: "exact", head: true }).eq("annotator_id", profile.id),
      supabase.from("qa_annotations").select("annotated_at").eq("annotator_id", profile.id).order("annotated_at", { ascending: false }).limit(1),
    ]);
    const countsError = assignedResult.error ?? completedResult.error ?? annotationResult.error ?? lastResult.error;
    if (countsError) throw new Error(countsError.message);
    const assigned = assignedResult.count ?? 0;
    const completed = completedResult.count ?? 0;
    return {
      profile,
      assigned,
      completed,
      remaining: Math.max(0, assigned - completed),
      annotations: annotationResult.count ?? 0,
      completionRate: assigned ? Math.round(completed / assigned * 100) : 0,
      lastActivity: lastResult.data?.[0]?.annotated_at ?? null,
    };
  }));
  const completedVideos = videos.filter((video) => {
    const work = assignments.filter((assignment) => assignment.video_id === video.id);
    return work.length > 0 && work.every((assignment) => assignment.status === "completed");
  }).length;
  return {
    users,
    totalAnnotators: users.length,
    totalVideos: videos.length,
    completedVideos,
    pendingVideos: videos.length - completedVideos,
    totalAnnotations: annotationCountResult.count ?? 0,
    completedAssignments: assignments.filter((assignment) => assignment.status === "completed").length,
    totalAssignments: assignments.length,
  };
}
