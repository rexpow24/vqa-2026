"use client";

import { useState, type FormEvent } from "react";
import { BTN_BASE, FOCUS } from "@/components/slots/styles";

type Reason = "overcut" | "too_difficult";
const choices: { value: Reason; label: string; detail: string }[] = [
  { value: "overcut", label: "Video bị cắt quá mức", detail: "Đoạn video thiếu phần trước hoặc sau để hiểu tình huống." },
  { value: "too_difficult", label: "Tình huống quá khó", detail: "Không đủ thông tin rõ ràng để gán nhãn chính xác." },
];

export function VideoReportButton({ videoId }: { videoId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/videos/${videoId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, note }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? `Lỗi ${response.status}`);
      setSent(true);
      setOpen(false);
      if (result.notification_status !== "sent") {
        setError("Báo cáo đã lưu nhưng email thông báo admin chưa gửi được.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không gửi được báo cáo.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="relative">
    <button type="button" className={`${BTN_BASE} inline-flex min-h-11 min-w-40 items-center justify-center gap-2 px-4 py-2 text-sm font-bold shadow-sm ${sent
      ? "border-green/60 bg-green/10 text-green hover:border-green hover:bg-green/15"
      : "border-amber/80 bg-amber text-background hover:border-amber hover:bg-amber/90"}`}
      aria-expanded={open} onClick={() => { setOpen((value) => !value); setError(""); }}>
      {sent ? <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg> : <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path d="M10 2.5 1.9 17h16.2L10 2.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M10 7v4m0 2.8v.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>}
      {sent ? "Đã báo cáo" : "Báo cáo video"}
    </button>
    {open && <form onSubmit={submit} className="absolute right-0 top-full z-20 mt-2 w-[min(24rem,calc(100vw-3rem))] rounded-md border border-border-strong bg-surface p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Báo cáo video</h3>
        <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => setOpen(false)}>Đóng</button>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs text-muted">Chọn lý do</legend>
        {choices.map((choice) => <label key={choice.value} className={`flex cursor-pointer gap-2 rounded border p-2 text-sm ${reason === choice.value ? "border-accent bg-accent/10" : "border-border"}`}>
          <input type="radio" name="video-report-reason" value={choice.value} checked={reason === choice.value}
            onChange={() => setReason(choice.value)} className="mt-0.5 accent-accent" />
          <span><span className="block font-medium">{choice.label}</span><span className="block text-xs text-muted">{choice.detail}</span></span>
        </label>)}
      </fieldset>
      <label className="mt-3 block text-xs text-muted">Mô tả thêm (không bắt buộc)
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3}
          className="mt-1 w-full resize-y rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          placeholder="Ví dụ: video bắt đầu sau khi va chạm đã xảy ra." />
      </label>
      {error && <p role="alert" className="mt-2 text-xs text-red">{error}</p>}
      <button type="submit" disabled={busy || !reason}
        className={`mt-3 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}>
        {busy ? "Đang gửi…" : "Gửi báo cáo"}
      </button>
    </form>}
    {error && !open && <p role="alert" className="mt-2 max-w-80 text-xs text-amber">{error}</p>}
  </div>;
}
