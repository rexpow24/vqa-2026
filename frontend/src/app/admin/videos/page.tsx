import { requireProfile } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Pagination, readPage } from "@/components/Pagination";
import { VideoManager, type VideoRow } from "./video-manager";

const PAGE_SIZE = 25;

// One page of videos by number, with their draft count, reference label and
// assignees. Counts are read for the page's videos only: selecting every
// draft hit PostgREST's 1000-row cap and showed 111 of 1496 videos as ready.
export default async function VideosPage({ searchParams }: PageProps<"/admin/videos">) {
  await requireProfile("admin");
  const params = await searchParams;
  const query = (Array.isArray(params.q) ? params.q[0] : params.q ?? "").trim().slice(0, 100);
  const page = readPage(params.page);
  // Privileged: drive_file_id is readable by no session client; this page is admin-only.
  const admin = createAdminClient();
  let list = admin.from("videos")
    .select("id,seq,drive_file_id,filename,duration_s,status,available,agreement_sample", { count: "exact" });
  if (/^\d+$/.test(query)) list = list.eq("seq", Number(query));
  else if (query) list = list.ilike("filename", `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`);
  const videos = await list.order("seq").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (videos.error) throw new Error(videos.error.message);
  const ids = (videos.data ?? []).map((video) => video.id);
  const [drafts, references, assignments] = ids.length ? await Promise.all([
    admin.from("video_drafts").select("video_id").in("video_id", ids),
    admin.from("video_reference_labels").select("video_id,difficulty,event_label").in("video_id", ids),
    admin.from("video_assignments").select("video_id,status,user_profiles(name)").in("video_id", ids),
  ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
  const error = drafts.error ?? references.error ?? assignments.error;
  if (error) throw new Error(error.message);

  const rows: VideoRow[] = (videos.data ?? []).map((video) => {
    const reference = references.data?.find((item) => item.video_id === video.id);
    return {
      ...video,
      drafts: (drafts.data ?? []).filter((item) => item.video_id === video.id).length,
      reference: reference ? `${reference.difficulty} / ${reference.event_label}` : null,
      assignees: (assignments.data ?? []).filter((item) => item.video_id === video.id).map((item) => {
        const profile = item.user_profiles as unknown as { name: string } | null;
        return `${profile?.name ?? "?"}: ${item.status}`;
      }),
    };
  });
  const total = videos.count ?? 0;
  return <div className="flex flex-col gap-5">
    <h2 className="text-xl font-semibold">Video</h2>
    <VideoManager rows={rows} total={total} query={query} />
    <Pagination path="/admin/videos" page={page} lastPage={Math.max(1, Math.ceil(total / PAGE_SIZE))} query={query} />
  </div>;
}
