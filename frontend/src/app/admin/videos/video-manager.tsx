"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QGROUPS } from "@/lib/qgroups";

type Video = { id: string; drive_file_id: string; filename: string; duration_s: number; status: string; available: boolean };
type User = { id: string; name: string; email: string };
type Assignment = { id: string; video_id: string; annotator_id: string; status: string };
type Draft = { video_id: string; qgroup: string };
type Reference = { video_id: string; difficulty: string; event_label: string };
const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

export function VideoManager({ videos, users, assignments, drafts, references }: {
  videos: Video[]; users: User[]; assignments: Assignment[]; drafts: Draft[]; references: Reference[];
}) {
  const router = useRouter();
  const [fileId, setFileId] = useState("");
  const [filename, setFilename] = useState("");
  const [duration, setDuration] = useState("");
  const [videoId, setVideoId] = useState(videos[0]?.id ?? "");
  const [userId, setUserId] = useState(users[0]?.id ?? "");
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
        <label className="flex flex-col gap-1 text-sm">Video<select value={videoId} onChange={(event) => setVideoId(event.target.value)} className="max-w-72 rounded border border-border bg-background px-2 py-1.5">
          {videos.map((video) => <option key={video.id} value={video.id}>{video.filename}</option>)}
        </select></label>
        <button type="button" disabled={!videoId} onClick={downloadTemplate} className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-40">Tải mẫu CSV</button>
        <label className="flex flex-col gap-1 text-sm">File CSV<input type="file" accept=".csv,text/csv" onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)} className="max-w-64 text-xs" /></label>
        <button type="button" disabled={busy || !videoId || !csvFile} onClick={uploadCsv} className="rounded bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-40">Tải lên và lưu</button>
      </div>
      {message && <p role="status" className="mt-2 text-sm text-green">{message}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red">{error}</p>}
    </section>
    <section className="rounded-md border border-border bg-surface p-4">
      <h3 className="mb-3 font-medium">Phân công</h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">Video<select value={videoId} onChange={(event) => setVideoId(event.target.value)} className="max-w-64 rounded border border-border bg-background px-2 py-1.5">{videos.map((video) => <option key={video.id} value={video.id}>{video.filename}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm">Người gán nhãn<select value={userId} onChange={(event) => setUserId(event.target.value)} className="rounded border border-border bg-background px-2 py-1.5">{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
        <button type="button" disabled={busy || !videoId || !userId} onClick={() => void post("/api/admin/assignments", { video_id: videoId, annotator_id: userId })} className="rounded border border-border px-3 py-1.5 text-sm disabled:opacity-40">Giao video</button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red">{error}</p>}
    </section>
    <div className="flex flex-col gap-2">{videos.map((video) => <div key={video.id} className="rounded-md border border-border bg-surface p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{video.filename}</span>
        <span className="text-muted">{Number(video.duration_s).toFixed(2)}s</span>
        <Link href={`/annotate/${video.id}`} className="ml-auto text-accent">Xem video và gán nhãn</Link></div>
      <div className="mt-1 break-all text-xs text-muted">Video ID: <code>{video.id}</code> · Drive ID: {video.drive_file_id}</div>
      <div className="mt-1 text-xs text-muted">Bản nháp: {drafts.filter((draft) => draft.video_id === video.id).length}/9
        {references.find((item) => item.video_id === video.id) && <span className="ml-2">· Nhãn tham chiếu: {references.find((item) => item.video_id === video.id)?.difficulty} / {references.find((item) => item.video_id === video.id)?.event_label}</span>}</div>
      <div className="mt-2 text-xs text-muted">{assignments.filter((assignment) => assignment.video_id === video.id).map((assignment) => {
        const user = users.find((item) => item.id === assignment.annotator_id);
        return `${user?.name ?? assignment.annotator_id}: ${assignment.status}`;
      }).join(" · ") || "Chưa phân công"}</div>
    </div>)}</div>
  </>;
}
