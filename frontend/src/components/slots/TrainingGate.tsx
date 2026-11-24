"use client";

import { useState } from "react";
import type { Training } from "@/lib/trainings";
import { BTN } from "@/components/slots/styles";

/**
 * Shown in place of a group's form until the annotator has watched its training
 * video to the end (features/c-training-gate). The server refuses the group's
 * answers until then too; this only explains why and plays the video.
 */
export function TrainingGate({ training, qgroup, onDone }: { training: Training; qgroup: string; onDone: () => void }) {
  const [state, setState] = useState<"watching" | "saving" | "error">("watching");
  async function record() {
    setState("saving");
    try {
      const response = await fetch(`/api/trainings/${training.id}/complete`, { method: "POST" });
      if (!response.ok) throw new Error(String(response.status));
      onDone();
    } catch { setState("error"); }
  }
  return <div data-training={training.id} className="flex flex-col gap-3 border-t border-border px-4 py-3">
    <p className="rounded border border-amber/50 bg-amber/10 px-3 py-2 text-sm text-foreground">
      <b className="text-amber">Bắt buộc:</b> xem hết video hướng dẫn trước khi gán nhãn nhóm {qgroup}.
      Xem xong, form nhóm {qgroup} sẽ tự mở; các nhóm khác vẫn làm bình thường.
    </p>
    <div className="text-sm font-medium text-foreground">{training.title}</div>
    <video src={`/api/references/${training.video}/stream`} controls playsInline preload="metadata"
      onEnded={() => { void record(); }}
      className="max-h-[60vh] w-full rounded-md border border-border-strong bg-black object-contain" />
    {state === "saving" && <span role="status" className="text-xs text-muted">Đang ghi nhận đã xem…</span>}
    {state === "error" && <span role="alert" className="flex items-center gap-2 text-xs text-red">
      Chưa ghi nhận được.
      <button type="button" onClick={() => { void record(); }} className={`${BTN} px-2 py-0.5`}>Thử lại</button>
    </span>}
  </div>;
}
