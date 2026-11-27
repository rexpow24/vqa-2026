"use client";

import Link from "next/link";
import { useState } from "react";

type Reason = "overcut" | "too_difficult";
type Status = "open" | "needs_relabel" | "dismissed";
export type VideoReportRow = {
  id: string; video_id: string; annotator_id: string; reason: Reason; note: string | null;
  status: Status; created_at: string; resolved_at: string | null;
  video: { id: string; seq: number; filename: string } | null;
  annotator: { id: string; name: string | null; email: string | null } | null;
};
const reasonLabel: Record<Reason, string> = {
  overcut: "Video bị cắt quá mức",
  too_difficult: "Tình huống quá khó",
};
const statusLabel: Record<Status, string> = {
  open: "Chờ xử lý", needs_relabel: "Cần gán nhãn lại", dismissed: "Đã bỏ qua",
};

export function VideoReports({ initialReports }: { initialReports: VideoReportRow[] }) {
  const [reports, setReports] = useState(initialReports);
  const [filter, setFilter] = useState<Status | "all">("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const visible = filter === "all" ? reports : reports.filter((report) => report.status === filter);

  async function resolve(report: VideoReportRow, action: Exclude<Status, "open">) {
    setBusy(report.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/video-reports/${report.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? `Lỗi ${response.status}`);
      setReports((current) => current.map((row) => row.id === report.id ? {
        ...row, status: action, resolved_at: new Date().toISOString(),
      } : row));
      setMessage(action === "needs_relabel"
        ? `Đã đánh dấu video #${report.video?.seq ?? "?"} cần gán nhãn lại. Bài gán nhãn cũ được giữ để người báo cáo xem và cập nhật.`
        : `Đã bỏ qua báo cáo video #${report.video?.seq ?? "?"}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không xử lý được báo cáo.");
    } finally { setBusy(null); }
  }

  return <div className="flex flex-col gap-5">
    <div>
      <h2 className="text-xl font-semibold">Báo cáo video</h2>
      <p className="mt-1 text-sm text-muted">Xem video bị cắt quá mức hoặc có tình huống khó, rồi đánh dấu cần gán nhãn lại.</p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {(["open", "needs_relabel", "dismissed", "all"] as const).map((value) => <button key={value} type="button"
        onClick={() => setFilter(value)} className={`rounded border px-3 py-1.5 text-sm ${filter === value ? "border-accent bg-accent/15 text-foreground" : "border-border text-muted hover:text-foreground"}`}>
        {value === "all" ? "Tất cả" : statusLabel[value]} <span className="ml-1 text-xs">{value === "all" ? reports.length : reports.filter((row) => row.status === value).length}</span>
      </button>)}
    </div>
    {message && <p role="status" className="rounded border border-green/40 bg-green/10 p-3 text-sm text-green">{message}</p>}
    {error && <p role="alert" className="rounded border border-red/40 bg-red/10 p-3 text-sm text-red">{error}</p>}
    {visible.length === 0 ? <p className="rounded-md border border-border bg-surface p-5 text-sm text-muted">Không có báo cáo trong mục này.</p>
      : <div className="flex flex-col gap-3">{visible.map((report) => <article key={report.id} className="rounded-md border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold">{report.video ? <><span className="text-accent">#{report.video.seq}</span> {report.video.filename}</> : "Video không còn tồn tại"}</h3>
            <p className="mt-1 text-sm text-amber">{reasonLabel[report.reason]}</p>
            <p className="mt-1 text-xs text-muted">Báo cáo bởi {report.annotator?.name || report.annotator?.email || "người gán nhãn"} · {new Date(report.created_at).toLocaleString("vi-VN")}</p>
          </div>
          <span className={`rounded border px-2 py-1 text-xs ${report.status === "open" ? "border-amber/50 text-amber" : report.status === "needs_relabel" ? "border-accent/50 text-accent" : "border-border text-muted"}`}>
            {statusLabel[report.status]}
          </span>
        </div>
        {report.note && <p className="mt-3 whitespace-pre-wrap rounded border border-border bg-background p-3 text-sm">{report.note}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {report.video && <Link href={`/annotate/${report.video.id}`} className="rounded border border-border px-3 py-1.5 text-sm hover:border-accent">Mở video</Link>}
          {report.status === "open" && <>
            <button type="button" disabled={busy !== null} onClick={() => void resolve(report, "needs_relabel")}
              className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {busy === report.id ? "Đang xử lý…" : "Đánh dấu cần gán nhãn lại"}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => void resolve(report, "dismissed")}
              className="rounded border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground disabled:opacity-50">Bỏ qua</button>
          </>}
        </div>
      </article>)}</div>}
  </div>;
}
