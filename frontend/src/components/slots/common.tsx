"use client";

import type { Slots } from "@/lib/codebook/compose";
import type { StoredVerdict } from "@/lib/types";
import { FOCUS, QUESTION } from "@/components/slots/styles";

/** What the slot form reads of a question; HostedDraft in HostedLabeling.tsx carries all of it. */
export type SlotDraft = {
  id: string; qgroup: string; group_name: string; question: string; answer: string; truncated: boolean;
  verdict: StoredVerdict | null; edited_answer: string | null; human_keyframes_s: number[];
  slots: Slots | null; codebook_version: string | null;
};

/** A refused request: the route's Vietnamese `error`, its machine `code`, and the cell it names if any. */
export type SaveError = { message: string; code?: string; status?: number; cellId?: string; groups?: string[]; entity?: string };

export async function postJson<T>(url: string, method: "POST" | "PUT", body: object): Promise<T> {
  const response = await fetch(url, { method, cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw { message: result.error ?? `Lỗi ${response.status}`, code: result.code, status: response.status,
      groups: result.groups, entity: result.entity } satisfies SaveError;
  }
  return result as T;
}

export function CardHeader({ draft, saved }: { draft: SlotDraft; saved: boolean }) {
  return <header className="flex items-start gap-3 border-b border-border px-4 py-3">
    <span className="shrink-0 rounded border border-accent/60 bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">{draft.qgroup}</span>
    <div className="min-w-0"><div className="text-base font-semibold text-foreground">{draft.group_name}</div>
      <div data-question className={QUESTION}>{draft.question}</div></div>
    {saved && <span className="ml-auto shrink-0 text-xs font-medium text-green">✓ Đã chọn ô</span>}
  </header>;
}

/** The Gemini draft, for reference only: the slot form starts empty and never agrees with it. */
export function DraftReference({ draft }: { draft: SlotDraft }) {
  return <div className="px-4 py-3">
    <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-foreground/50">Bản nháp Gemini (chỉ để tham khảo)</div>
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/75">{draft.answer}</p>
    {draft.truncated && <span className="mt-1 block text-xs text-amber">Bản nháp bị cắt vì chạm trần token</span>}
  </div>;
}

/** The composed sentence: the server's after a save, the local preview while choices differ from it. */
export function Sentence({ dirty, preview, saved }: { dirty: boolean; preview: string | null; saved: string | null }) {
  if (!dirty && saved) {
    return <div className="border-t border-border px-4 py-3">
      <div className="rounded-md border border-green/40 bg-green/10 px-3 py-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-green">Câu đã lưu (server ghép)</div>
        <p className="mt-0.5 text-[15px] leading-relaxed text-foreground">{saved}</p>
      </div>
    </div>;
  }
  return <div className="border-t border-border px-4 py-3">
    <div className="rounded-md border border-border bg-background/60 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-foreground/50">Câu ghép (xem trước, chưa lưu)</div>
      <p className={`mt-0.5 text-[15px] leading-relaxed ${preview ? "text-foreground" : "text-foreground/45"}`}>
        {preview ?? "Chọn đủ các ô để thấy câu."}</p>
      {saved && <p className="mt-1.5 text-xs text-foreground/55">Câu đang lưu: {saved}</p>}
    </div>
  </div>;
}

/**
 * The composed sentence of a slot answer, editable by adding words only
 * (edit.ts). `edit` is null while the annotator keeps the composed sentence;
 * `composed` is the sentence the current choices give (null while incomplete).
 */
export function EditableSentence({ composed, edit, problem, notice, dirty, saved, onEdit }: {
  composed: string | null; edit: string | null; problem: string | null; notice: string | null; dirty: boolean;
  saved: string | null; onEdit: (text: string | null) => void;
}) {
  const savedView = !dirty && saved;
  return <div className="border-t border-border px-4 py-3">
    <div className={`rounded-md border px-3 py-2 ${savedView ? "border-green/40 bg-green/10" : "border-border bg-background/60"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`text-[11px] font-medium uppercase tracking-wide ${savedView ? "text-green" : "text-foreground/50"}`}>
          {savedView ? (edit !== null ? "Câu đã lưu (đã sửa)" : "Câu đã lưu (server ghép)")
            : edit !== null ? "Câu sửa (chưa lưu)" : "Câu ghép (xem trước, chưa lưu)"}</span>
        {composed && (edit === null
          ? <button type="button" onClick={() => onEdit(composed)}
            className={`rounded border border-border-strong px-2 py-0.5 text-xs text-foreground/80 hover:bg-surface ${FOCUS}`}>Sửa câu</button>
          : <button type="button" onClick={() => onEdit(null)}
            className={`rounded border border-border-strong px-2 py-0.5 text-xs text-foreground/80 hover:bg-surface ${FOCUS}`}>Bỏ sửa, dùng câu ghép</button>)}
      </div>
      {edit === null
        ? <p className={`mt-0.5 text-[15px] leading-relaxed ${composed ? "text-foreground" : "text-foreground/45"}`}>
          {composed ?? (saved && !dirty ? saved : "Chọn đủ các ô để thấy câu.")}</p>
        : <>
          <textarea value={edit} onChange={(event) => onEdit(event.target.value)} rows={3} aria-label="Câu sửa"
            className={`mt-1 w-full resize-y rounded-md border border-border-strong bg-background px-2 py-1.5 text-[15px] leading-relaxed text-foreground ${FOCUS}`} />
          <p className="mt-1 text-xs text-foreground/60">Chỉ thêm từ nối cho câu mạch lạc; không xóa, đổi hay đảo chữ của câu ghép.</p>
          {composed && <p className="mt-1 text-xs text-foreground/55">Câu ghép gốc: {composed}</p>}
          {problem && <p role="alert" className="mt-1 text-xs font-medium text-red">{problem}</p>}
        </>}
      {notice && <p className="mt-1 text-xs text-amber">{notice}</p>}
      {saved && dirty && <p className="mt-1.5 text-xs text-foreground/55">Câu đang lưu: {saved}</p>}
    </div>
  </div>;
}

export function SaveBar({ canSave, saving, dirty, status, error, onSave, label = "Lưu" }: {
  canSave: boolean; saving: boolean; dirty: boolean; status: string; error?: string; onSave: () => void; label?: string;
}) {
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-4 py-3">
    <button type="button" disabled={!canSave || saving || !dirty} onClick={onSave}
      className={`rounded-md border border-accent bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors
        hover:brightness-110 disabled:cursor-not-allowed disabled:border-border-strong disabled:bg-surface-2
        disabled:text-foreground/50 max-sm:w-full ${FOCUS}`}>{saving ? "Đang lưu…" : label}</button>
    {error ? <span role="alert" className="min-w-0 flex-1 text-sm font-medium text-red">{error}</span>
      : <span className={`text-xs ${status.startsWith("✓") ? "text-green" : "text-foreground/70"}`}>
        {canSave ? status : "Chỉ xem"}</span>}
  </div>;
}
