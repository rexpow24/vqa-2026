"use client";

import { useState } from "react";
import { BTN, FOCUS } from "@/components/slots/styles";
import { IMPACT_PAD_S, impactMark, impactWindow } from "@/lib/keyframes";

/**
 * The evidence span of a C/Attr answer from one mark (features/impact-keyframe):
 * the annotator sets the collision frame, from the playhead or typed seconds,
 * and the span becomes [mark - 2 s, mark + 2 s] clamped to the clip. A stored
 * pair that no mark produces (set by hand under the earlier rule) is shown as
 * it is and stays valid until the annotator sets a mark, which replaces it.
 */
export function ImpactKeyframes({ value, playhead, duration, onSeek, onChange, error }: {
  value: [number, number] | null; playhead: number; duration: number;
  onSeek: (time: number) => void; onChange: (pair: [number, number] | null) => void;
  /** A save-blocking message from the card, e.g. no mark yet. */
  error?: string;
}) {
  const [typed, setTyped] = useState("");
  const [markError, setMarkError] = useState("");
  // The mark set on this page; a stored pair recovers its mark from the span,
  // which a clip shorter than the window cannot (both ends are clamped).
  const [setAt, setSetAt] = useState<number | null>(null);
  const local = setAt !== null && value ? impactWindow(setAt, duration) : null;
  const mark = !value ? null : local && local[0] === value[0] && local[1] === value[1] ? setAt : impactMark(value, duration);
  function set(time: number) {
    const pair = impactWindow(time, duration);
    if (!pair) return setMarkError("Mốc nằm ngoài video.");
    setMarkError(""); setSetAt(Number(time.toFixed(3))); onChange(pair);
  }
  const time = (label: string, at: number) => <button type="button" onClick={() => onSeek(at)} aria-label={`Tua tới ${label} ${at.toFixed(2)} giây`}
    className={`rounded-md border border-border-strong bg-background px-2 py-1 tabular-nums text-foreground hover:bg-surface-3 ${FOCUS}`}>
    {label} {at.toFixed(2)}s</button>;
  const message = markError || error;

  return <div className="flex flex-col gap-2 text-xs">
    <span className="text-foreground/80">
      Tua tới khung va chạm (suýt va chạm: lúc hai bên gần nhau nhất) rồi bấm &quot;Đặt mốc va chạm&quot;.
      Start và End tự đặt ±{IMPACT_PAD_S} giây quanh mốc.</span>
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background/60 p-2">
      <button type="button" onClick={() => set(playhead)} className={`${BTN} px-3 py-1.5 font-semibold tabular-nums`}>
        Đặt mốc va chạm = {playhead.toFixed(2)}s</button>
      <input type="number" step="0.05" min={0} max={duration} placeholder="giây" value={typed} aria-label="Mốc va chạm (giây)"
        onChange={(event) => setTyped(event.target.value)}
        className={`w-20 rounded-md border border-border-strong bg-background px-2 py-1 tabular-nums text-foreground placeholder:text-foreground/40 ${FOCUS}`} />
      <button type="button" disabled={!typed.trim()} onClick={() => {
        if (!typed.trim()) return;
        set(Number(typed.replace(",", "."))); setTyped("");
      }} className={`${BTN} px-2 py-1`}>Đặt</button>
    </div>
    {value ? <div className="flex flex-wrap items-center gap-2">
      {mark !== null ? <span className="flex items-center rounded-md border border-accent bg-accent/20 text-foreground">
        <button type="button" onClick={() => onSeek(mark)} aria-label={`Tua tới mốc va chạm ${mark.toFixed(2)} giây`}
          className={`rounded-l-md px-2 py-1 font-semibold tabular-nums hover:bg-accent/30 ${FOCUS}`}>Mốc {mark.toFixed(2)}s</button>
        <button type="button" aria-label="Xóa mốc va chạm" onClick={() => { setMarkError(""); onChange(null); }}
          className={`rounded-r-md px-2 py-1 text-foreground/70 hover:bg-red/20 hover:text-red ${FOCUS}`}>✕</button>
      </span> : <span className="text-amber">Mốc đặt tay theo quy tắc cũ; bấm &quot;Đặt mốc va chạm&quot; để thay.</span>}
      <span className="text-foreground/60">→</span>
      {time("Start", value[0])}
      {time("End", value[1])}
    </div> : <span className="text-foreground/50">Chưa đặt mốc.</span>}
    {message && <span role="alert" className="font-medium text-red">{message}</span>}
  </div>;
}
