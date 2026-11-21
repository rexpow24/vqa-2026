"use client";

import type { ReactNode } from "react";
import type { CodebookOption } from "@/lib/codebook";
import type { SlotValue } from "@/lib/codebook/compose";
import { MAX_TEXT } from "@/lib/codebook/form";
import { BTN, BTN_BASE, FOCUS } from "@/components/slots/styles";

const ON = `${BTN_BASE} border-accent bg-accent/30 font-semibold text-foreground hover:bg-accent/40`;

/** One choice button; `pressed` styles it as chosen. */
export function Chip({ pressed, onClick, children, title, disabled = false }: {
  pressed: boolean; onClick: () => void; children: ReactNode; title?: string; disabled?: boolean;
}) {
  return <button type="button" aria-pressed={pressed} title={title} onClick={onClick} disabled={disabled}
    className={`max-w-full px-2.5 py-1 text-left text-sm leading-snug ${pressed ? ON : BTN} ${disabled ? "cursor-not-allowed opacity-70" : ""}`}>{children}</button>;
}

/** An entity as a chip: its letter, then its E phrase. */
export function EntityChip({ entityKey, label, pressed, onClick, disabled = false }: {
  entityKey: string; label: string; pressed: boolean; onClick: () => void; disabled?: boolean;
}) {
  const phrase = label.replace(/^[A-Z] · /, "");
  return <Chip pressed={pressed} onClick={onClick} disabled={disabled}>
    <span className="font-bold text-accent">{entityKey}</span>{phrase !== entityKey && <span> · {phrase}</span>}
  </Chip>;
}

/** The row frame of one cell: label on the left (on top when narrow), the input on the right. */
export function FieldRow({ label, optional, error, note, badge, children }: {
  label: string; optional?: boolean; error?: string; note?: string; badge?: string; children: ReactNode;
}) {
  return <div data-field={label} className="grid gap-1.5 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-3">
    <div className="pt-1 text-xs font-medium text-foreground/85">{label}
      {optional && <span className="block font-normal text-foreground/50">không bắt buộc</span>}
      {/* A value generated from its source annotation and intentionally locked. */}
      {badge && <span data-badge className="mt-1 block w-fit rounded border border-accent/60 bg-accent/15 px-1.5 py-px
        text-[11px] font-medium text-accent">{badge}</span>}</div>
    <div className="flex min-w-0 flex-col gap-1.5">
      {children}
      {note && <span className="text-xs text-foreground/55">{note}</span>}
      {error && <span role="alert" className="text-xs font-medium text-red">{error}</span>}
    </div>
  </div>;
}

/** The short text of a "khác" choice, at most MAX_TEXT characters. */
export function FreeText({ value, onChange, label, disabled = false }: { value: string; onChange: (text: string) => void; label: string; disabled?: boolean }) {
  return <label className="flex flex-col gap-1">
    <span className="sr-only">{label}</span>
    <input value={value} maxLength={MAX_TEXT} disabled={disabled} onChange={(event) => onChange(event.target.value)}
      placeholder="Ghi ngắn điều nhìn thấy" aria-label={label}
      className={`w-full rounded-md border border-border-strong bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-foreground/40 ${FOCUS}`} />
    <span className="self-end text-[11px] tabular-nums text-foreground/50">{value.length}/{MAX_TEXT}</span>
  </label>;
}

/**
 * The options of one cell, plus entity chips when the cell names a party.
 * Options that carry a `group` (C conflict types) are listed under their
 * group, with their code. Clicking the chosen chip of an optional cell clears it.
 */
export function OptionPicker({ options, entities, labels, value, required, multiple = false, onChange, disabled = false }: {
  options: CodebookOption[]; entities: string[] | null; labels: Record<string, string>;
  value: SlotValue | undefined; required: boolean; multiple?: boolean;
  onChange: (value: SlotValue | undefined) => void; disabled?: boolean;
}) {
  const pick = (next: SlotValue, same: boolean) => onChange(same && !required ? undefined : next);
  const optionChip = (option: CodebookOption) => {
    const selected = value?.options ?? (value?.option ? [value.option] : []);
    const pressed = multiple ? selected.includes(option.id) : value?.option === option.id;
    const onOptionClick = () => {
      if (!multiple) {
        pick({ option: option.id, ...(option.free_text ? { text: value?.option === option.id ? value.text : "" } : {}) }, pressed);
        return;
      }
      const next = pressed ? selected.filter((id) => id !== option.id) : [...selected, option.id];
      const needsText = options.some((candidate) => candidate.free_text && next.includes(candidate.id));
      onChange(next.length ? { options: next, ...(needsText && value?.text !== undefined ? { text: value.text } : {}) } : undefined);
    };
    return <Chip key={option.id} pressed={pressed} disabled={disabled} title={typeof option.condition === "string" ? option.condition : undefined}
      onClick={onOptionClick}>
      {typeof option.code === "string" && <span className="mr-1.5 font-mono text-xs text-foreground/55">{option.code}</span>}
      {option.label}
    </Chip>;
  };
  const groups = options.some((option) => typeof option.group === "string")
    ? [...new Set(options.map((option) => (typeof option.group === "string" ? option.group : "")))] : null;
  return <>
    {(entities?.length || (!groups && options.length > 0)) ? <div className="flex flex-wrap gap-1.5">
        {entities?.map((key) => <EntityChip key={key} entityKey={key} label={labels[key] ?? key} disabled={disabled}
        pressed={value?.entity === key && value.option === undefined}
        onClick={() => pick({ entity: key }, value?.entity === key && value.option === undefined)} />)}
      {!groups && options.map(optionChip)}
    </div> : null}
    {groups && <div className="flex flex-col gap-2">
      {groups.map((group) => <div key={group} className="flex flex-col gap-1">
        {group && <span className="text-[11px] uppercase tracking-wide text-foreground/50">{group}</span>}
        <div className="flex flex-wrap gap-1.5">{options.filter((option) => (option.group ?? "") === group).map(optionChip)}</div>
      </div>)}
    </div>}
    {multiple && <span className="text-xs text-foreground/55">Có thể chọn nhiều lựa chọn.</span>}
  </>;
}
