"use client";

import { useState, type FormEvent } from "react";

type Props = {
  videoId: string;
  reason: "entity_color_unclear" | "cause_too_difficult";
  questionGroup: "E" | "C";
  targetLabel?: string;
  entityKey?: string;
  disabled?: boolean;
};

export function GroupReportButton({ videoId, reason, questionGroup, targetLabel, entityKey, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const buttonLabel = questionGroup === "E" ? "Báo cáo màu xe khó nhìn" : "Báo cáo tình huống K quá khó";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/videos/${videoId}/report`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, question_group: questionGroup, entity_key: entityKey, target_label: targetLabel, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? `Lỗi ${response.status}`);
      setSent(true); setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không gửi được báo cáo.");
    } finally { setBusy(false); }
  }

  return <div className="mt-2">
    <button type="button" disabled={disabled} aria-expanded={open} onClick={() => { setOpen((value) => !value); setError(""); }}
      className="rounded border border-amber/70 px-2.5 py-1.5 text-xs font-medium text-amber hover:bg-amber/10 disabled:cursor-not-allowed disabled:opacity-50">
      {sent ? "Đã gửi báo cáo" : buttonLabel}
    </button>
    {open && <form onSubmit={(event) => void submit(event)} className="mt-2 flex flex-col gap-2 rounded border border-border-strong bg-surface p-3">
      <p className="text-xs text-foreground/75">Admin sẽ xem video, lấy ảnh gửi nhóm Zalo để mọi người biểu quyết.</p>
      <label className="text-xs text-muted">Mô tả thêm (không bắt buộc)
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={2}
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          placeholder="Nêu màu hoặc tình huống khó xác định ở đoạn nào." />
      </label>
      {error && <p role="alert" className="text-xs text-red">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          {busy ? "Đang gửi…" : "Gửi cho admin biểu quyết"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border border-border px-3 py-1.5 text-xs text-muted">Đóng</button>
      </div>
    </form>}
  </div>;
}
