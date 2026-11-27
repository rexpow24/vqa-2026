import { requireProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { VideoReports, type VideoReportRow } from "./video-reports";

export default async function VideoReportsPage() {
  await requireProfile("admin");
  const supabase = await createClient();
  const { data: reports, error } = await supabase.from("video_reports")
    .select("id,video_id,annotator_id,reason,note,status,created_at,resolved_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const videoIds = [...new Set((reports ?? []).map((report) => report.video_id))];
  const annotatorIds = [...new Set((reports ?? []).map((report) => report.annotator_id))];
  const [videos, profiles] = await Promise.all([
    videoIds.length ? supabase.from("videos").select("id,seq,filename").in("id", videoIds) : Promise.resolve({ data: [], error: null }),
    annotatorIds.length ? supabase.from("user_profiles").select("id,name,email").in("id", annotatorIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (videos.error ?? profiles.error) throw new Error(videos.error?.message ?? profiles.error?.message ?? "Không tải được thông tin báo cáo.");
  const videoById = new Map((videos.data ?? []).map((video) => [video.id, video]));
  const profileById = new Map((profiles.data ?? []).map((profile) => [profile.id, profile]));
  const rows: VideoReportRow[] = (reports ?? []).map((report) => ({
    ...report, video: videoById.get(report.video_id) ?? null, annotator: profileById.get(report.annotator_id) ?? null,
  }));
  return <VideoReports initialReports={rows} />;
}
