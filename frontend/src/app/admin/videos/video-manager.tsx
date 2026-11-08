"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QGROUPS } from "@/lib/qgroups";
import { VideoImport } from "./video-import";

export type VideoRow = {
  id: string; seq: number; drive_file_id: string; filename: string; duration_s: number; status: string;
  available: boolean; agreement_sample: boolean; drafts: number; reference: string | null; assignees: string[];
};
const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

// Video intake (CSV import, single add, draft upload) and one page of the
// video list. Assigning videos lives on /admin/assignments.
export function VideoManager({ rows: videos, total, query }: { rows: VideoRow[]; total: number; query: string }) {
  const router = useRouter();
  const [fileId, setFileId] = useState("");
  const [filename, setFilename] = useState("");
  const [duration, setDuration] = useState("");
  const [videoId, setVideoId] = useState(videos[0]?.id ?? "");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: object) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể lưu.");
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu.");
      return false;
    } finally { setBusy(false); }
  }

  function downloadTemplate() {
    if (!videoId) return;
    const lines = ["video_id,qgroup,question,answer,difficulty,event_label",
      ...QGROUPS.map((group) => [videoId, group.code, group.question, "", "", ""].map(csvCell).join(","))];
    const blob = new Blob(["\uFEFF", lines.join("\r\n"), "\r\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `labeling-${videoId}.csv`; link.click();
    URL.revokeObjectURL(url);
  }

  async function uploadCsv() {
    if (!videoId || !csvFile) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const body = new FormData();
      body.set("file", csvFile);
      const response = await fetch(`/api/admin/videos/${videoId}/drafts`, { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Không thể nhập CSV.");
      setCsvFile(null);
      setMessage(`Đã nhập ${result.imported} câu hỏi và trả lời vào Supabase.`);
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể nhập CSV."); }
    finally { setBusy(false); }
  }

  return <>
    <VideoImport />
    <section className="rounded-md border border-border bg-surface p-4">
      <h3 className="mb-3 font-medium">Thêm video từ Drive</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">Drive file ID<input value={fileId} onChange={(event) => setFileId(event.target.value)} className="rounded border border-border bg-background px-2 py-1.5" /></label>
        <label className="flex flex-col gap-1 text-sm">Tên file<input value={filename} onChange={(event) => setFilename(event.target.value)} className="rounded border border-border bg-background px-2 py-1.5" /></label>
        <label className="flex flex-col gap-1 text-sm">Thời lượng (giây)<input type="number" min="0.01" step="0.001" value={duration} onChange={(event) => setDuration(event.target.value)} className="rounded border border-border bg-background px-2 py-1.5" /></label>
      </div>
      <button type="button" disabled={busy || !fileId || !filename || !duration} onClick={async () => {
        if (await post("/api/admin/videos", { drive_file_id: fileId, filename, duration_s: Number(duration) })) {
          setFileId(""); setFilename(""); setDuration("");
        }
      }} className="mt-3 rounded bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-40">Thêm video</button>
    </section>
    <section className="rounded-md border border-border bg-surface p-4">
      <h3 className="mb-2 font-medium">Tải lên 9 câu hỏi và trả lời</h3>
      <p className="mb-3 text-xs text-muted">CSV UTF-8 gồm video_id,qgroup,question,answer,difficulty,event_label. Nhãn tham chiếu chỉ admin xem. Không thể thay bản nháp khi đã có người gán nhãn.</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">Video (trong trang đang xem)<select value={videoId} onChange={(event) => setVideoId(event.target.value)} className="max-w-72 rounded border border-border bg-background px-2 py-1.5">
          {videos.map((video) => <option key={video.id} value={video.id}>{`#${video.seq} ${video.filename}`}</option>)}
        </select></label>
        <button type="button" disabled={!videoId} onClick={downloadTemplate} className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-40">Tải mẫu CSV</button>
        <label className="flex flex-col gap-1 text-sm">File CSV<input type="file" accept=".csv,text/csv" onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)} className="max-w-64 text-xs" /></label>
        <button type="button" disabled={busy || !videoId || !csvFile} onClick={uploadCsv} className="rounded bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-40">Tải lên và lưu</button>
      </div>
      {message && <p role="status" className="mt-2 text-sm text-green">{message}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red">{error}</p>}
    </section>
    <form action="/admin/videos" role="search" className="flex flex-wrap items-center gap-2">
      <label htmlFor="videos-search" className="sr-only">Tìm video</label>
      <input id="videos-search" name="q" defaultValue={query} placeholder="Số thứ tự hoặc tên file"
        className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm sm:max-w-sm" />
      <button type="submit" className="rounded bg-accent px-3 py-1.5 text-sm text-white">Tìm</button>
      {query && <Link href="/admin/videos" className="text-sm text-muted">Xóa tìm kiếm</Link>}
      <span className="ml-auto text-sm text-muted tabular-nums">{total} video</span>
    </form>
    {videos.length === 0 && <p className="rounded-md border border-border bg-surface p-4 text-sm text-muted">Không có video nào khớp.</p>}
    <div className="flex flex-col gap-2">{videos.map((video) => <div key={video.id} className="rounded-md border border-border bg-surface p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold tabular-nums text-accent">{`#${video.seq}`}</span>
        <span className="min-w-0 break-all font-medium">{video.filename}</span>
        <span className="text-muted">{Number(video.duration_s).toFixed(2)}s</span>
        {video.agreement_sample && <span className="rounded border border-accent/50 px-1.5 text-xs text-accent">Agreement</span>}
        {!video.available && <span className="rounded border border-amber/50 px-1.5 text-xs text-amber">Không giao được</span>}
        <Link href={`/annotate/${video.id}`} className="ml-auto text-accent">Xem video</Link></div>
      <div className="mt-1 break-all text-xs text-muted">Video ID: <code>{video.id}</code> · Drive ID: {video.drive_file_id}</div>
      <div className="mt-1 text-xs text-muted">
        <span className={video.drafts === 9 ? "" : "text-amber"}>Bản nháp: {video.drafts}/9</span>
        {video.reference && <span className="ml-2">· Nhãn tham chiếu: {video.reference}</span>}
      </div>
      <div className="mt-1 text-xs text-muted">{video.assignees.join(" · ") || "Chưa phân công"}</div>
    </div>)}</div>
  </>;
}
