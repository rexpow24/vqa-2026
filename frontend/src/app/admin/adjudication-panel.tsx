"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AdjudicationSummary = {
  answers: Partial<Record<"single" | "consensus" | "conflict" | "adjudicated", number>>;
  labels: Partial<Record<"single" | "consensus" | "conflict" | "adjudicated", number>>;
};
type Result = { line: number; status: string; reason: string | null; filename: string; qgroup: string };
const STATUS = { saved: "đã lưu", skipped: "chưa quyết định", stale: "đã cũ", not_conflict: "không còn mâu thuẫn", invalid: "lỗi" } as const;

// Download the open conflicts, decide them outside the app, upload the file back.
export function AdjudicationPanel({ summary }: { summary: AdjudicationSummary }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");

  async function upload() {
    if (!file) return;
    setBusy(true); setError(""); setResults([]);
    try {
      const response = await fetch("/api/admin/adjudications/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv: await file.text() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `Lỗi ${response.status}`);
      setResults(body.results); setFile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải lên.");
    } finally { setBusy(false); router.refresh(); }
  }

  const open = (summary.answers.conflict ?? 0) + (summary.labels.conflict ?? 0);
  const counts = (Object.keys(STATUS) as (keyof typeof STATUS)[])
    .map((status) => [status, results.filter((row) => row.status === status).length] as const).filter(([, n]) => n > 0);
  const problems = results.filter((row) => !["saved", "skipped"].includes(row.status));

  return <section className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
    <h3 className="font-medium">Thống nhất đáp án</h3>
    <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      <div><dt className="inline text-muted">Câu chờ thống nhất: </dt><dd className="inline tabular-nums">{summary.answers.conflict ?? 0}</dd></div>
      <div><dt className="inline text-muted">Nhãn sự kiện chờ thống nhất: </dt><dd className="inline tabular-nums">{summary.labels.conflict ?? 0}</dd></div>
      <div><dt className="inline text-muted">Câu đã thống nhất: </dt><dd className="inline tabular-nums">{summary.answers.adjudicated ?? 0}</dd></div>
      <div><dt className="inline text-muted">Câu 2 người trùng nhau / 1 người: </dt>
        <dd className="inline tabular-nums">{summary.answers.consensus ?? 0} / {summary.answers.single ?? 0}</dd></div>
    </dl>
    <p className="text-xs text-muted">
      Tải file, điền final_verdict (AGREE / DISAGREE / NOT_ANSWERABLE), final_answer khi DISAGREE, final_event_label với dòng EVENT,
      followed_llm (có / không) và llm_suggestion nếu có, rồi tải lên lại. Dòng chưa điền được bỏ qua. Câu đã thống nhất sẽ khóa với hai người đã đánh.
    </p>
    <div className="flex flex-wrap items-end gap-3">
      <a href="/api/admin/adjudications/export" download
        className={`rounded border border-accent px-3 py-1.5 text-sm text-accent ${open ? "" : "pointer-events-none opacity-40"}`}>
        Tải CSV mâu thuẫn ({open})</a>
      <label className="flex flex-col gap-1 text-sm">File đã điền<input type="file" accept=".csv,text/csv"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="max-w-64 text-xs" /></label>
      <button type="button" disabled={!file || busy} onClick={upload}
        className="rounded bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-40">{busy ? "Đang tải lên…" : "Tải lên quyết định"}</button>
    </div>
    {error && <p role="alert" className="text-sm text-red">{error}</p>}
    {results.length > 0 && <p role="status" className="text-sm">{counts.map(([status, n]) => `${n} ${STATUS[status]}`).join(" · ")}</p>}
    {problems.length > 0 && <ul className="max-h-60 overflow-auto text-xs text-muted">
      {problems.map((row) => <li key={row.line}>Dòng {row.line} · {row.filename} {row.qgroup}: {STATUS[row.status as keyof typeof STATUS] ?? row.status}
        {row.reason ? ` - ${row.reason}` : ""}</li>)}
    </ul>}
  </section>;
}
