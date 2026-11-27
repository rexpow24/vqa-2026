import { requireProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { VideoReports, type VideoReportRow } from "./video-reports";

export default async function VideoReportsPage() {
  await requireProfile("admin");
  const supabase = await createClient();
  const { data: reports, error } = await supabase.from("video_reports")
    .select("id,video_id,annotator_id,reason,question_group,entity_key,target_label,target_cell,target_index,report_snapshot,final_answer,note,vote_summary,status,created_at,resolved_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const { data: votes, error: votesError } = await supabase.from("cell_resolution_votes")
    .select("id,report_id,annotator_id,answer,created_at").order("created_at");
  if (votesError) throw new Error(votesError.message);
  const videoIds = [...new Set((reports ?? []).map((report) => report.video_id))];
  const annotatorIds = [...new Set((reports ?? []).map((report) => report.annotator_id))];
  const voterIds = [...new Set((votes ?? []).map((vote) => vote.annotator_id))];
  const [videos, profiles] = await Promise.all([
    videoIds.length ? supabase.from("videos").select("id,seq,filename").in("id", videoIds) : Promise.resolve({ data: [], error: null }),
    [...new Set([...annotatorIds, ...voterIds])].length ? supabase.from("user_profiles").select("id,name,email").in("id", [...new Set([...annotatorIds, ...voterIds])]) : Promise.resolve({ data: [], error: null }),
  ]);
  if (videos.error ?? profiles.error) throw new Error(videos.error?.message ?? profiles.error?.message ?? "Không tải được thông tin báo cáo.");
  const videoById = new Map((videos.data ?? []).map((video) => [video.id, video]));
  const profileById = new Map((profiles.data ?? []).map((profile) => [profile.id, profile]));
  const votesByReport = new Map<string, { id: string; answer: string; created_at: string; annotator: { id: string; name: string | null } | null }[]>();
  for (const vote of votes ?? []) votesByReport.set(vote.report_id, [...(votesByReport.get(vote.report_id) ?? []), {
    id: vote.id, answer: vote.answer, created_at: vote.created_at,
    annotator: profileById.get(vote.annotator_id) ? { id: vote.annotator_id, name: profileById.get(vote.annotator_id)!.name } : null,
  }]);
  const rows: VideoReportRow[] = (reports ?? []).map((report) => ({
    ...report, video: videoById.get(report.video_id) ?? null, annotator: profileById.get(report.annotator_id) ?? null,
    votes: votesByReport.get(report.id) ?? [],
  }));
  return <VideoReports initialReports={rows} />;
}
