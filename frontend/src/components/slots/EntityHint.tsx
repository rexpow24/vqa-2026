"use client";

import type { ReferenceClip } from "@/components/slots/ConflictHint";
import { NAMING_RULES, namingChecks } from "@/lib/codebook/entity-naming";
import { BTN } from "@/components/slots/styles";

type Party = { key: string; cells: Record<string, unknown> };

/**
 * The reminder under group E's parties (features/e-naming-hint), styled like the
 * group C hint: what to check before saving A/B, the lines that follow from the
 * declared parties, and the E training video. It never blocks the form.
 */
export function EntityHint({ parties, onOpen }: { parties: Party[]; onOpen?: (clip: ReferenceClip) => void }) {
  if (!parties.some((party) => party.cells.type)) return null;
  const checks = namingChecks(parties);
  return <div data-entity-hint className="flex flex-col gap-2 rounded-md border border-amber/50 bg-amber/10 px-3 py-2.5 text-xs">
    <div className="font-semibold text-foreground">Bạn đã kiểm tra kĩ tên A, B chưa?</div>
    <ul className="list-disc pl-4 text-foreground/85">{NAMING_RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul>
    {checks.length > 0 && <div className="flex flex-col gap-1">
      {checks.map((line) => <span key={line} className="font-medium text-amber">{line}</span>)}
    </div>}
    {onOpen && <button type="button" className={`${BTN} self-start px-2 py-1 text-xs font-medium`}
      onClick={() => onOpen({ id: "E-training-full", title: "Video hướng dẫn nhóm E: chọn bên, đặt tên A/B và chọn loại xe",
        cues: [], chosen: null })}>Xem lại video hướng dẫn E</button>}
  </div>;
}
