"use client";

import { useState, type FormEvent } from "react";

type Props = { videoId: string; questionGroup: "S" | "E" | "C" | "R" | "O"; targetCell: string;
  targetLabel: string; entityKey?: string; targetIndex?: number; disabled?: boolean };

export function GroupReportButton({ videoId, questionGroup, targetCell, targetLabel, entityKey, targetIndex, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`/api/videos/${videoId}/report`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "cell_conflict", question_group: questionGroup, target_cell: targetCell,
          target_index: targetIndex, entity_key: entityKey, target_label: targetLabel, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? `Lỗi ${response.status}`);
      setSent(true); setOpen(false);
      if (result.notification_status !== "sent") {
        setError("Báo cáo đã lưu nhưng email thông báo admin chưa gửi được.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không gửi được báo cáo."); }
    finally { setBusy(false); }
  }

  return <div className="mt-2">
    <button type="button" disabled={disabled} aria-expanded={open} onClick={() => { setOpen((value) => !value); setError(""); }}
      className="rounded border border-amber/60 px-2.5 py-1.5 text-xs font-medium text-amber hover:bg-amber/10 disabled:cursor-not-allowed disabled:opacity-50">
      {sent ? "Đã xin hỗ trợ" : "Xin hỗ trợ phân xử ô này"}
    </button>
    {open && <form onSubmit={(event) => void submit(event)} className="mt-2 flex flex-col gap-2 rounded border border-border-strong bg-surface p-3">
      <p className="text-xs text-foreground/75">Câu trả lời của bạn sẽ được hiện cho annotator khác, riêng ô “{targetLabel}” sẽ được che.</p>
      <label className="text-xs text-muted">Ghi chú (không bắt buộc)
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={2}
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
      </label>
      {error && <p role="alert" className="text-xs text-red">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          {busy ? "Đang gửi…" : "Gửi xin phân xử"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border border-border px-3 py-1.5 text-xs text-muted">Đóng</button>
      </div>
    </form>}
    {error && !open && <p role="alert" className="mt-2 text-xs text-amber">{error}</p>}
  </div>;
}
