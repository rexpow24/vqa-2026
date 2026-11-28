"use client";

import Link from "next/link";
import { useState } from "react";
import type { Training } from "@/lib/trainings";
import { BTN } from "@/components/slots/styles";
import { DriveLinkPreview } from "@/components/DriveLinkPreview";

/**
 * One training video on /huong-dan (features/welcome-gate). Played to the end by
 * an annotator who has not completed it, it records the completion, the same
 * POST the in-form gate (TrainingGate.tsx) sends. Admins only watch (record=false).
 */
export function TrainingVideo({ training, heading, done, record, welcome = false }: {
  training: Training; heading: string; done: boolean; record: boolean; welcome?: boolean;
}) {
  const [state, setState] = useState<"idle" | "saving" | "error" | "done">(done ? "done" : "idle");
  const [missing, setMissing] = useState(false);
  async function complete() {
    if (!record || state === "done" || state === "saving") return;
    setState("saving");
    try {
      const response = await fetch(`/api/trainings/${training.id}/complete`, { method: "POST" });
      if (!response.ok) throw new Error(String(response.status));
      setState("done");
    } catch { setState("error"); }
  }
  return <section aria-label={heading} data-training={training.id}
    className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-base font-semibold">{heading}</h3>
      {record && <span className={`text-xs ${state === "done" ? "text-green" : "text-amber"}`}>
        {state === "done" ? "Đã xem" : "Chưa xem"}</span>}
    </div>
    <div className="text-sm text-muted">{training.title}</div>
    {missing
      ? <p className="rounded border border-border px-3 py-2 text-sm text-muted">Video chưa sẵn sàng. Hãy quay lại sau.</p>
      : <video src={`/api/references/${training.video}/stream`} poster={welcome ? "/welcome-poster.jpg" : undefined} controls playsInline preload="metadata"
        onEnded={() => { void complete(); }} onError={() => setMissing(true)}
        className="max-h-[60vh] w-full rounded-md border border-border-strong bg-black object-contain" />}
    <DriveLinkPreview streamPath={`/api/references/${training.video}/stream`} />
    {state === "saving" && <span role="status" className="text-xs text-muted">Đang ghi nhận đã xem…</span>}
    {state === "error" && <span role="alert" className="flex items-center gap-2 text-xs text-red">
      Chưa ghi nhận được.
      <button type="button" onClick={() => { void complete(); }} className={`${BTN} px-2 py-0.5`}>Thử lại</button>
    </span>}
    {welcome && record && !done && state === "done" && <Link href="/annotate"
      className="self-start rounded bg-accent px-3 py-1.5 text-sm text-white">Bắt đầu gán nhãn</Link>}
    {welcome && record && !done && state !== "done" && <p className="text-xs text-muted">
      Xem hết video để mở trang gán nhãn.</p>}
  </section>;
}
