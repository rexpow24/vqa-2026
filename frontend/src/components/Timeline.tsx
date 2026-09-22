"use client";

import { AUTO_BORDER_COLOR, CONFLICT_COLOR, SHOT_COLORS, type Conflict, type Shot } from "@/lib/types";

interface Props {
  shots: Shot[];
  duration: number;
  conflicts: Conflict[];
}

// Native React/CSS port of vqa/trim.py's timeline_html -- same colors
// (SHOT_COLORS/CONFLICT_COLOR/AUTO_BORDER_COLOR mirror trim.COLORS exactly),
// same layout idea (absolutely positioned blocks over a track, red overlay
// for overlaps), redrawn as JSX instead of a server-rendered HTML string
// since React owns the shot list client-side now.
export function Timeline({ shots, duration, conflicts }: Props) {
  const dur = Math.max(duration, 0.001);
  const pct = (t: number) => Math.max(0, Math.min(100, (t / dur) * 100));

  return (
    <div>
      <div className="relative h-12 rounded-md border border-border bg-surface-2 overflow-hidden">
        {shots.map((s, i) => {
          const left = pct(s.start);
          const width = Math.max(pct(s.end) - left, 1.2);
          return (
            <div
              key={i}
              title={`Shot ${i + 1}: ${s.start.toFixed(1)}s -> ${s.end.toFixed(1)}s (${(s.end - s.start).toFixed(1)}s)${s.auto ? " - auto-adjusted to avoid overlap" : ""}`}
              className="absolute top-[5px] h-9 rounded flex items-center justify-between px-1.5 text-[11px] font-semibold overflow-hidden whitespace-nowrap"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: SHOT_COLORS[i % SHOT_COLORS.length],
                color: "#0b0f14",
                border: s.auto
                  ? `2px dashed ${AUTO_BORDER_COLOR}`
                  : "1px solid rgba(0,0,0,.35)",
              }}
            >
              <span>{s.start.toFixed(1)}</span>
              <span className="text-sm font-extrabold">{i + 1}</span>
              <span>{s.end.toFixed(1)}</span>
            </div>
          );
        })}
        {conflicts.map((c, k) => {
          const left = pct(c.start);
          const width = Math.max(pct(c.end) - left, 1.2);
          return (
            <div
              key={k}
              title={`Shots ${c.i + 1} and ${c.j + 1} overlap by ${c.amount.toFixed(1)}s`}
              className="absolute top-[5px] h-9 rounded z-10 animate-pulse"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: CONFLICT_COLOR,
                opacity: 0.85,
                border: `2px solid ${CONFLICT_COLOR}`,
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-muted mt-1.5 mb-1">
        <span>0.0s</span>
        <span>{(dur / 2).toFixed(1)}s</span>
        <span>{dur.toFixed(1)}s</span>
      </div>
    </div>
  );
}
