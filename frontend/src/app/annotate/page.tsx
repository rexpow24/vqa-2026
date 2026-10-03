import Link from "next/link";
import LegacyAnnotate from "@/components/LegacyAnnotate";
import { requireProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AnnotatePage() {
  if (process.env.VERCEL !== "1" && process.env.PLATFORM_MODE !== "hosted") {
    return <LegacyAnnotate />;
  }
  const profile = await requireProfile();
  const supabase = await createClient();
  const [videosResult, assignmentsResult, draftsResult, answersResult] = await Promise.all([
    supabase.from("videos").select("id,filename,duration_s,status,available").eq("status", "active").order("filename"),
    supabase.from("video_assignments").select("video_id,status").eq("annotator_id", profile.id),
    supabase.from("video_drafts").select("id,video_id"),
    supabase.from("qa_annotations").select("draft_id").eq("annotator_id", profile.id),
  ]);
  const error = videosResult.error ?? assignmentsResult.error ?? draftsResult.error ?? answersResult.error;
  if (error) throw new Error(error.message);
  const videos = videosResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const drafts = draftsResult.data ?? [];
  const answered = new Set((answersResult.data ?? []).map((item) => item.draft_id));
  const completed = assignments.filter((assignment) => assignment.status === "completed").length;
  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Video gán nhãn</h2>
        <p className="mt-1 text-sm text-muted">{profile.name} · {completed}/{assignments.length} video đã hoàn thành</p></div>
      {profile.role === "admin" && <Link href="/admin" className="text-sm text-accent">Bảng quản trị</Link>}
    </div>
    {videos.length === 0 && <div className="rounded-md border border-border bg-surface p-4 text-sm text-muted">Chưa có video. Hãy liên hệ admin để thêm video từ Drive.</div>}
    <div className="grid gap-3 sm:grid-cols-2">{videos.map((video) => {
      const assignment = assignments.find((item) => item.video_id === video.id);
      const videoDrafts = drafts.filter((draft) => draft.video_id === video.id);
      const doneQuestions = videoDrafts.filter((draft) => answered.has(draft.id)).length;
      return <Link key={video.id} href={`/annotate/${video.id}`} className="rounded-md border border-border bg-surface p-4 hover:border-accent">
        <div className="truncate font-medium">{video.filename}</div>
        <div className="mt-2 flex justify-between text-xs text-muted"><span>{Number(video.duration_s).toFixed(2)}s · {videoDrafts.length}/9 bản nháp · {doneQuestions} câu đã duyệt</span>
          <span>{videoDrafts.length !== 9 ? "Chờ bản nháp" : assignment?.status === "completed" ? "Hoàn thành" : assignment ? "Đang gán nhãn" : "Có thể nhận"}</span></div>
      </Link>;
    })}</div>
  </div>;
}
