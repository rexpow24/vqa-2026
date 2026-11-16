"use client";

import { useState } from "react";
import { BTN, FOCUS } from "@/components/slots/styles";

// One end of the evidence span: shows the frame (click to seek there), and
// sets it from the playhead or from typed seconds.
export function KeyframeSlot({ label, value, playhead, duration, onSeek, onSet, onClear }: {
  label: string; value: number | null; playhead: number; duration: number;
  onSeek: (time: number) => void; onSet: (time: number) => void; onClear: () => void;
}) {
  const [typed, setTyped] = useState("");
  return <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background/60 p-2">
    <span className="w-9 font-semibold text-foreground">{label}</span>
    {value === null ? <span className="text-foreground/50">chưa đặt</span>
      : <span className="flex items-center rounded-md border border-accent bg-accent/20 text-foreground">
        <button type="button" onClick={() => onSeek(value)} className={`rounded-l-md px-2 py-1 tabular-nums hover:bg-accent/30 ${FOCUS}`}>{value.toFixed(2)}s</button>
        <button type="button" aria-label={`Xóa ${label} ${value.toFixed(2)} giây`} onClick={onClear}
          className={`rounded-r-md px-2 py-1 text-foreground/70 hover:bg-red/20 hover:text-red ${FOCUS}`}>✕</button>
      </span>}
    <button type="button" onClick={() => onSet(playhead)} className={`${BTN} px-2 py-1 tabular-nums`}>= {playhead.toFixed(2)}s</button>
    <input type="number" step="0.05" min={0} max={duration} placeholder="giây" value={typed} aria-label={`${label} (giây)`}
      onChange={(event) => setTyped(event.target.value)}
      className={`w-20 rounded-md border border-border-strong bg-background px-2 py-1 tabular-nums text-foreground placeholder:text-foreground/40 ${FOCUS}`} />
    <button type="button" disabled={!typed.trim()} onClick={() => {
      if (!typed.trim()) return;
      onSet(Number(typed.replace(",", "."))); setTyped("");
    }} className={`${BTN} px-2 py-1`}>Đặt</button>
  </div>;
}
