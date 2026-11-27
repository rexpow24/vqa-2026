"use client";

import Link from "next/link";
import { useState } from "react";
import { ReportVideoEvidence } from "./report-video-evidence";

type Reason = "overcut" | "too_difficult" | "entity_color_unclear" | "cause_too_difficult" | "cell_conflict";
type Status = "open" | "needs_relabel" | "dismissed" | "resolved";
type Vote = { id: string; answer: string; created_at: string; annotator: { id: string; name: string | null } | null };
export type VideoReportRow = {
  id: string; video_id: string; annotator_id: string; reason: Reason; question_group: "S" | "E" | "C" | "R" | "O" | null;
  entity_key: string | null; target_label: string | null; target_cell: string | null; target_index: number | null;
  report_snapshot: Record<string, unknown> | null; final_answer: string | null; vote_summary: string | null; note: string | null;
  status: Status; created_at: string; resolved_at: string | null; votes: Vote[];
  video: { id: string; seq: number; filename: string } | null;
  annotator: { id: string; name: string | null; email: string | null } | null;
};
const reasonLabel: Record<Reason, string> = {
  overcut: "Video bị cắt quá mức", too_difficult: "Tình huống quá khó",
  entity_color_unclear: "Màu xe khó nhìn hoặc không rõ", cause_too_difficult: "Tình huống ở nhóm C quá khó",
  cell_conflict: "Xin phân xử một ô",
};
const statusLabel: Record<Status, string> = { open: "Còn cần xử lý", resolved: "Admin đã chốt", needs_relabel: "Cần gán nhãn lại", dismissed: "Đã đóng" };

function zaloSummary(report: VideoReportRow, answer: string) {
  return [`video_id: ${report.video_id}`, `nhóm: ${report.question_group ?? "-"}`,
    `ô: ${report.entity_key ? `Bên ${report.entity_key} · ` : report.target_index !== null ? `Bên ${report.target_index + 1} · ` : ""}${report.target_label ?? "-"}`,
    `đáp án sau phân xử: ${answer}`].join("\n");
}

export function VideoReports({ initialReports }: { initialReports: VideoReportRow[] }) {
  const [reports, setReports] = useState(initialReports);
  const [filter, setFilter] = useState<Status | "all">("open");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const conflictReports = reports.filter((report) => report.reason === "cell_conflict");
  const openCount = conflictReports.filter((report) => report.status === "open").length;
  const resolvedCount = conflictReports.length - openCount;
  const visible = filter === "all" ? reports : reports.filter((report) => filter === "open" ? report.status === "open" : report.status === filter);

  async function finalize(report: VideoReportRow) {
    setBusy(report.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/reports/${report.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: answers[report.id] ?? "" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? `Lỗi ${response.status}`);
      setReports((current) => current.map((row) => row.id === report.id ? { ...row, status: "resolved", final_answer: result.final_answer, resolved_at: new Date().toISOString() } : row));
      setMessage(`Đã chốt đáp án cho video #${report.video?.seq ?? "?"}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được kết quả."); }
    finally { setBusy(null); }
  }

  async function closeLegacy(report: VideoReportRow, action: "needs_relabel" | "dismissed") {
    setBusy(report.id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/video-reports/${report.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, vote_summary: summaries[report.id] ?? "" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? `Lỗi ${response.status}`);
      setReports((current) => current.map((row) => row.id === report.id ? { ...row, status: action, vote_summary: summaries[report.id]?.trim() || null, resolved_at: new Date().toISOString() } : row));
      setMessage(`Đã lưu kết quả xử lý video #${report.video?.seq ?? "?"}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không xử lý được báo cáo."); }
    finally { setBusy(null); }
  }

  async function copySummary(report: VideoReportRow) {
    try { await navigator.clipboard.writeText(zaloSummary(report, report.final_answer ?? "")); setMessage("Đã chép nội dung báo lại cho annotator."); }
    catch { setError("Không truy cập được clipboard trên trình duyệt này."); }
  }

  return <div className="flex flex-col gap-5">
    <header><h2 className="text-xl font-semibold">Báo cáo và phân xử</h2>
      <p className="mt-1 text-sm text-muted">Annotator bỏ phiếu trên web. Admin xem các ý kiến, chốt đáp án rồi chép nội dung kết quả để gửi annotator cập nhật.</p></header>
    <section aria-label="Thống kê conflict" className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-border bg-surface p-4"><p className="text-sm text-muted">Tổng conflict theo ô</p><p className="mt-1 text-3xl font-semibold">{conflictReports.length}</p></div>
      <div className="rounded-lg border border-amber/40 bg-amber/5 p-4"><p className="text-sm text-amber">Còn dư / chưa chốt</p><p className="mt-1 text-3xl font-semibold">{openCount}</p></div>
      <div className="rounded-lg border border-green/40 bg-green/5 p-4"><p className="text-sm text-green">Đã xử lý / chốt</p><p className="mt-1 text-3xl font-semibold">{resolvedCount}</p></div>
    </section>
    <div className="flex flex-wrap gap-2">
      {(["open", "resolved", "needs_relabel", "dismissed", "all"] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)}
        className={`rounded border px-3 py-1.5 text-sm ${filter === value ? "border-accent bg-accent/15 text-foreground" : "border-border text-muted hover:text-foreground"}`}>
        {value === "all" ? "Tất cả" : statusLabel[value]} <span className="ml-1 text-xs">{value === "all" ? reports.length : reports.filter((row) => row.status === value).length}</span>
      </button>)}
    </div>
    {message && <p role="status" className="rounded border border-green/40 bg-green/10 p-3 text-sm text-green">{message}</p>}
    {error && <p role="alert" className="rounded border border-red/40 bg-red/10 p-3 text-sm text-red">{error}</p>}
    {visible.length === 0 ? <p className="rounded-md border border-border bg-surface p-5 text-sm text-muted">Không có conflict trong mục này.</p>
      : <div className="flex flex-col gap-3">{visible.map((report) => <article key={report.id} className="rounded-md border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0">
          <h3 className="font-semibold">{report.video ? <><span className="text-accent">#{report.video.seq}</span> {report.video.filename}</> : "Video không còn tồn tại"}</h3>
          <p className="mt-1 text-sm text-amber">{reasonLabel[report.reason]}{report.question_group ? ` · Nhóm ${report.question_group}` : ""}</p>
          {report.target_label && <p className="mt-1 text-sm">{report.entity_key ? `Bên ${report.entity_key} · ` : report.target_index !== null ? `Bên ${report.target_index + 1} · ` : ""}{report.target_label}</p>}
          <p className="mt-1 text-xs text-muted">Báo cáo bởi {report.annotator?.name || report.annotator?.email || "annotator"} · {new Date(report.created_at).toLocaleString("vi-VN")}</p>
        </div><span className={`rounded border px-2 py-1 text-xs ${report.status === "open" ? "border-amber/50 text-amber" : "border-green/50 text-green"}`}>{statusLabel[report.status]}</span></div>
        {report.note && <p className="mt-3 whitespace-pre-wrap rounded border border-border bg-background p-3 text-sm">{report.note}</p>}
        {report.reason === "cell_conflict" && report.report_snapshot && <details className="mt-3 rounded border border-border bg-background p-3"><summary className="cursor-pointer text-sm">Câu trả lời đã che ô cần phân xử</summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(report.report_snapshot, null, 2)}</pre></details>}
        {report.video && <ReportVideoEvidence videoId={report.video.id} seq={report.video.seq} />}
        {report.reason === "cell_conflict" && <div className="mt-3 rounded border border-border p-3">
          <h4 className="text-sm font-semibold">Ý kiến annotator ({report.votes.length})</h4>
          {report.votes.length ? <ul className="mt-2 flex flex-col gap-1 text-sm">{report.votes.map((vote) => <li key={vote.id} className="rounded bg-background p-2"><strong>{vote.annotator?.name ?? "Annotator"}:</strong> {vote.answer}</li>)}</ul>
            : <p className="mt-2 text-sm text-muted">Chưa có annotator gửi lựa chọn.</p>}
          {report.status === "open" ? <><label className="mt-3 block text-sm font-medium">Đáp án cuối cùng do admin chốt
            <input value={answers[report.id] ?? ""} maxLength={1000} onChange={(event) => setAnswers((current) => ({ ...current, [report.id]: event.target.value }))}
              className="mt-1 block w-full max-w-2xl rounded border border-border bg-background px-3 py-2 text-foreground" placeholder="Nhập đáp án chính thức" />
          </label><button type="button" disabled={busy !== null} onClick={() => void finalize(report)} className="mt-3 rounded bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === report.id ? "Đang chốt…" : "Chốt đáp án"}</button></>
            : report.final_answer && <div className="mt-3 rounded border border-green/30 bg-green/10 p-3"><p className="text-sm"><strong>Đáp án admin:</strong> {report.final_answer}</p>
              <pre className="mt-2 whitespace-pre-wrap text-xs">{zaloSummary(report, report.final_answer)}</pre><button type="button" onClick={() => void copySummary(report)} className="mt-2 rounded border border-green/40 px-3 py-1.5 text-sm text-green">Chép kết quả gửi annotator</button></div>}
        </div>}
        {report.reason !== "cell_conflict" && report.status === "open" && <div className="mt-3 flex flex-wrap gap-2">
          <label className="basis-full text-xs text-muted">Ghi chú xử lý<input value={summaries[report.id] ?? ""} maxLength={500} onChange={(event) => setSummaries((current) => ({ ...current, [report.id]: event.target.value }))}
            className="mt-1 block w-full max-w-xl rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground" /></label>
          <button type="button" disabled={busy !== null} onClick={() => void closeLegacy(report, "needs_relabel")} className="rounded bg-accent px-3 py-1.5 text-sm text-white">Cần gán nhãn lại</button>
          <button type="button" disabled={busy !== null} onClick={() => void closeLegacy(report, "dismissed")} className="rounded border border-border px-3 py-1.5 text-sm text-muted">Đóng báo cáo</button>
        </div>}
        {report.reason !== "cell_conflict" && report.vote_summary && <p className="mt-3 rounded border border-border bg-background p-2 text-sm">Ghi chú xử lý: {report.vote_summary}</p>}
        {report.video && <Link href={`/annotate/${report.video.id}`} className="mt-3 inline-block rounded border border-border px-3 py-1.5 text-sm hover:border-accent">Mở video gán nhãn</Link>}
      </article>)}</div>}
  </div>;
}
