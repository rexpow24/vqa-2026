"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { chunkVideoCsv, headerError } from "@/lib/video-csv";

type RowResult = {
  index: number; filename: string; status: "inserted" | "skipped" | "conflict" | "failed";
  reason?: string; existing_drive_file_id?: string;
};
type Reported = RowResult & { line: number };
const LABELS = { inserted: "đã nhập", skipped: "bỏ qua", conflict: "trùng tên khác Drive ID", failed: "lỗi" };

export function VideoImport() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<Reported[]>([]);
  const [error, setError] = useState("");

  async function run() {
    if (!file) return;
    setError(""); setReport([]);
    const { header, chunks, total } = chunkVideoCsv(await file.text());
    const problem = headerError(header) ?? (total === 0 ? "File không có dòng dữ liệu." : null);
    if (problem) { setError(problem); return; }
    const collected: Reported[] = [];
    setProgress({ done: 0, total });
    try {
      for (const chunk of chunks) {
        const response = await fetch("/api/admin/videos/import", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv: chunk.csv }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Không thể nhập CSV.");
        collected.push(...(result.results as RowResult[]).map((row) => ({ ...row, line: chunk.lines[row.index] })));
        setReport([...collected]);
        setProgress({ done: collected.length, total });
      }
      setFile(null);
    } catch (cause) {
      setError(`${cause instanceof Error ? cause.message : "Không thể nhập CSV."} Các dòng đã xử lý ở trên vẫn được giữ; chạy lại cùng file sẽ bỏ qua chúng.`);
    } finally {
      setProgress(null);
      router.refresh();
    }
  }

  const counts = (["inserted", "skipped", "conflict", "failed"] as const)
    .map((status) => `${report.filter((row) => row.status === status).length} ${LABELS[status]}`).join(" · ");
  const notInserted = report.filter((row) => row.status !== "inserted");

  return <section className="rounded-md border border-border bg-surface p-4">
    <h3 className="mb-2 font-medium">Nhập video từ CSV</h3>
    <p className="mb-3 text-xs text-muted">File videos.csv từ drive-upload.mjs: filename,drive_file_id,duration_s. Mỗi dòng được kiểm tra trên Drive; video trùng tên được bỏ qua.</p>
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">File CSV<input type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="max-w-64 text-xs" /></label>
      <button type="button" disabled={!file || progress !== null} onClick={run} className="rounded bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-40">Nhập video</button>
      {progress && <span role="status" className="text-sm text-muted">Đang kiểm tra {progress.done}/{progress.total}…</span>}
    </div>
    {report.length > 0 && <p role="status" className="mt-3 text-sm text-green">{counts}</p>}
    {notInserted.length > 0 && <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
      {notInserted.map((row) => <li key={row.line} className="break-all">
        Dòng {row.line} · {row.filename} · {LABELS[row.status]}{row.reason ? `: ${row.reason}` : ""}
        {row.existing_drive_file_id && ` (đang lưu ${row.existing_drive_file_id})`}
      </li>)}
    </ul>}
    {error && <p role="alert" className="mt-2 text-sm text-red">{error}</p>}
  </section>;
}
