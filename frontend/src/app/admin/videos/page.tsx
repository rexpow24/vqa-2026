import Link from "next/link";
import { requireProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VideoManager } from "./video-manager";

export default async function VideosPage() {
  await requireProfile("admin");
  const supabase = await createClient();
  const [videosResult, usersResult, assignmentsResult, draftsResult, referencesResult] = await Promise.all([
    // drive_file_id is readable by no session client; this page is admin-only.
    createAdminClient().from("videos").select("id,seq,drive_file_id,filename,duration_s,status,available").order("seq"),
    supabase.from("user_profiles").select("id,name,email").eq("role", "annotator").eq("enabled", true),
    supabase.from("video_assignments").select("id,video_id,annotator_id,status"),
    supabase.from("video_drafts").select("video_id,qgroup"),
    supabase.from("video_reference_labels").select("video_id,difficulty,event_label"),
  ]);
  const error = videosResult.error ?? usersResult.error ?? assignmentsResult.error ?? draftsResult.error ?? referencesResult.error;
  if (error) throw new Error(error.message);
  return <div className="flex flex-col gap-5">
    <div className="flex items-center"><h2 className="text-xl font-semibold">Video và phân công</h2>
      <Link href="/admin" className="ml-auto text-sm text-accent">Dashboard</Link></div>
    <VideoManager videos={videosResult.data ?? []} users={usersResult.data ?? []}
      assignments={assignmentsResult.data ?? []} drafts={draftsResult.data ?? []} references={referencesResult.data ?? []} />
  </div>;
}
