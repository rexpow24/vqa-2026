"use client";

import { useState } from "react";

export function ReportVideoEvidence({ videoId }: { videoId: string; seq: number }) {
  const [open, setOpen] = useState(false);
  return <div className="mt-3">
    <button type="button" onClick={() => setOpen((value) => !value)}
      className="rounded border border-border px-3 py-1.5 text-sm text-foreground/80 hover:border-accent">
      {open ? "Ẩn video" : "Xem video"}
    </button>
    {open && <div className="mt-2 max-w-xl rounded border border-border bg-background p-3">
      <video src={`/api/videos/${videoId}/stream`} controls playsInline preload="metadata"
        className="max-h-[55vh] w-full rounded bg-black" />
    </div>}
  </div>;
}
