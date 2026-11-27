"use client";

import Link from "next/link";
import { useState } from "react";

type Option = { id: string; label: string };
export type ResolutionCase = {
  id: string; video_id: string; seq: number; filename: string; question_group: string; target_cell: string;
  target_label: string; entity_key: string | null; target_index: number | null; note: string | null;
  report_snapshot: Record<string, unknown>; created_at: string; reporter_name: string | null;
  my_answer: string | null; options: Option[]; optionLabels: Record<string, string>;
};

function readable(value: unknown, labels: Record<string, string>): unknown {
  if (Array.isArray(value)) return value.map((item) => readable(item, labels));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key,
    key === "option" && typeof child === "string" ? labels[child] ?? child
      : key === "options" && Array.isArray(child) ? child.map((id) => typeof id === "string" ? labels[id] ?? id : id)
      : readable(child, labels)]));
  return value;
}

export function ResolutionQueue({ initialCases }: { initialCases: ResolutionCase[] }) {
  const [cases, setCases] = useState(initialCases);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(item: ResolutionCase) {
    setBusy(item.id); setError(""); setNotice("");
    try {
      const selected = answers[item.id] === "__other__" ? answers[`${item.id}:other`] ?? "" : answers[item.id] ?? "";
      const response = await fetch("/api/resolution-queue", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: item.id, answer: selected }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? `Lỗi ${response.status}`);
      setCases((current) => current.filter((row) => row.id !== item.id));
      setNotice(`Đã gửi lựa chọn cho video #${item.seq}. Admin sẽ xem các ý kiến và chốt đáp án.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không lưu được lựa chọn."); }
    finally { setBusy(null); }
  }

  return <div className="flex flex-col gap-5">
    <header>
      <h2 className="text-2xl font-semibold">Cần annotator hỗ trợ</h2>
      <p className="mt-1 text-sm text-muted">Có <strong className="text-accent">{cases.length}</strong> ô đang cần bạn xem và chọn đáp án. Người tạo báo cáo không được biểu quyết trường hợp của mình.</p>
    </header>
    {notice && <p role="status" className="rounded border border-green/40 bg-green/10 p-3 text-sm text-green">{notice}</p>}
    {error && <p role="alert" className="rounded border border-red/40 bg-red/10 p-3 text-sm text-red">{error}</p>}
    {!cases.length ? <p className="rounded-md border border-border bg-surface p-5 text-sm text-muted">Hiện không còn ô nào cần bạn phân xử. Hãy quay lại sau.</p>
      : <div className="flex flex-col gap-4">{cases.map((item) => {
        const snapshot = item.report_snapshot as { answer?: unknown };
        return <article key={item.id} className="rounded-lg border border-border-strong bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h3 className="font-semibold"><span className="text-accent">#{item.seq}</span> {item.filename}</h3>
              <p className="mt-1 text-sm">Nhóm {item.question_group} · {item.entity_key ? `Bên ${item.entity_key} · ` : item.target_index !== null ? `Bên ${item.target_index + 1} · ` : ""}{item.target_label}</p>
              <p className="mt-1 text-xs text-muted">Xin hỗ trợ bởi {item.reporter_name || "annotator"}</p></div>
            <Link href={`/annotate/${item.video_id}`} className="rounded border border-border px-3 py-1.5 text-sm hover:border-accent">Mở video</Link>
          </div>
          {item.note && <p className="mt-3 rounded border border-border bg-background p-3 text-sm">Ghi chú: {item.note}</p>}
          <details className="mt-3 rounded border border-border bg-background p-3">
            <summary className="cursor-pointer text-sm font-medium">Xem câu trả lời hiện tại (đã che ô cần phân xử)</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-foreground/80">{JSON.stringify(readable(snapshot.answer, item.optionLabels), null, 2)}</pre>
          </details>
          <label className="mt-4 block text-sm font-medium">Bạn chọn đáp án nào cho ô “{item.target_label}”?
            <select value={answers[item.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))}
              className="mt-1 block w-full max-w-xl rounded border border-border bg-background px-3 py-2 text-foreground">
              <option value="">Chọn đáp án…</option>
              {item.options.map((option) => <option key={option.id} value={option.label}>{option.label}</option>)}
              <option value="__other__">Khác / cần ghi rõ</option>
            </select>
          </label>
          {(answers[item.id] === "__other__" || item.options.length === 0) && <label className="mt-2 block text-sm text-muted">Nhập đáp án
            <input value={answers[`${item.id}:other`] ?? ""} maxLength={1000} onChange={(event) => setAnswers((current) => ({ ...current, [`${item.id}:other`]: event.target.value }))}
              className="mt-1 block w-full max-w-xl rounded border border-border bg-background px-3 py-2 text-foreground" />
          </label>}
          <button type="button" disabled={busy !== null} onClick={() => void submit(item)}
            className="mt-3 rounded bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy === item.id ? "Đang gửi…" : "Gửi lựa chọn"}
          </button>
        </article>;
      })}</div>}
  </div>;
}
