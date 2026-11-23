"use client";

import { useState } from "react";
import { conflictCode, conflictCodes, conflictHint } from "@/lib/references";
import { BTN, FOCUS } from "@/components/slots/styles";

/** A reference clip the labeling page plays beside the video (features/c-reference-hints). */
export type ReferenceClip = { id: string; title: string; cues: string[]; chosen: string | null };

/**
 * The reminder under group C's conflict type: what to check for the chosen K,
 * the K it is easily confused with, and buttons that open the reference clips.
 * It never blocks the form.
 */
export function ConflictHint({ option, onOpen }: { option: string | undefined; onOpen: (clip: ReferenceClip) => void }) {
  const [other, setOther] = useState("");
  const code = conflictCode(option);
  const hint = code ? conflictHint(code) : null;
  if (!code || !hint) return null;
  const open = (id: string, title: string, cues: string[]) => onOpen({ id, title, cues, chosen: code });
  const compare = (target: string) => {
    const item = hint.confusable.find((candidate) => candidate.code === target);
    if (item?.pair) return open(item.pair.id, item.pair.title, item.pair.cues);
    const single = conflictHint(target);
    if (single) open(target, `${target} · ${single.title}`, single.cues);
  };
  return <div data-conflict-hint={code} className="flex flex-col gap-2 rounded-md border border-amber/50 bg-amber/10 px-3 py-2.5 text-xs">
    <div className="font-semibold text-foreground">Bạn đã xem kĩ chưa? {code} · {hint.title}</div>
    <ul className="list-disc pl-4 text-foreground/85">{hint.cues.map((cue) => <li key={cue}>{cue}</li>)}</ul>
    {hint.confusable.length > 0 && <div className="flex flex-col gap-1.5">
      <span className="font-medium text-amber">Bạn có nhầm với {hint.confusable.map((item) => item.code).join(" hay ")} không?</span>
      <div className="flex flex-wrap gap-1.5">{hint.confusable.map((item) => <button key={item.code} type="button"
        onClick={() => compare(item.code)} title={item.title}
        className={`${BTN} px-2 py-1 text-left text-xs`}>
        {item.pair ? `So sánh ${code} ↔ ${item.code}` : `Xem ${item.code}`}
        <span className="ml-1 text-foreground/60">{item.title}</span>
      </button>)}</div>
    </div>}
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={() => open(code, `${code} · ${hint.title}`, hint.cues)}
        className={`${BTN} px-2 py-1 text-xs font-medium`}>Xem lại reference {code}</button>
      <label className="flex min-w-0 items-center gap-1.5 text-foreground/75"><span className="whitespace-nowrap">Đang phân vân với</span>
        <select value={other} onChange={(event) => { setOther(event.target.value); if (event.target.value) compare(event.target.value); }}
          className={`min-w-0 max-w-56 rounded border border-border-strong bg-background px-1.5 py-1 text-xs ${FOCUS}`}>
          <option value="">K…</option>
          {conflictCodes().filter((item) => item !== code).map((item) => <option key={item} value={item}>
            {item} · {conflictHint(item)?.title}</option>)}
        </select></label>
    </div>
  </div>;
}
