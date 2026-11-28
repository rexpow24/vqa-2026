"use client";

import { useState } from "react";
import { currentVersion } from "@/lib/codebook";
import type { SlotValue } from "@/lib/codebook/compose";
import {
  buildSlots, causePair, choose, currentValue, errorText, fields, outcomeState, prefilledKeys, prefillFromCause, preview, problems,
  rawValue, sameSlots, staleChoices, stateFromSlots, type Field, type FormContext,
} from "@/lib/codebook/form";
import { needsKeyframes } from "@/lib/qgroups";
import { ImpactKeyframes } from "@/components/slots/ImpactKeyframes";
import { CardHeader, DraftReference, EditableSentence, SaveBar, postJson, type SaveError, type SlotDraft } from "@/components/slots/common";
import { editProblem } from "@/lib/codebook/edit";
import { Chip, EntityChip, FieldRow, FreeText, OptionPicker } from "@/components/slots/SlotField";
import { ConflictHint, type ReferenceClip } from "@/components/slots/ConflictHint";
import { TrainingGate } from "@/components/slots/TrainingGate";
import { requiredTraining } from "@/lib/trainings";
import { GroupReportButton } from "@/components/GroupReportButton";

/** The draft rows the save route returns: the saved row, and the caller's R when C re-composed it. */
export type SavedSlotRow = Partial<SlotDraft> & { draft_id: string };
type Saved = SavedSlotRow & { also?: SavedSlotRow[] };

/**
 * The slot form of one question (S, C, O, R, Attr, Prev). Starts empty
 * (decision 3 of the slot data model: no prefill from the draft), except Prev,
 * which is derived from the saved C answer, and an unsaved R, whose
 * has_aftermath is suggested from the C End mark (features/impact-keyframe);
 * saves with the button, and shows the sentence the server composed. A
 * refused save keeps every choice. An answer saved with an older codebook
 * opens with what the current one still has and saves with the current one (F-v1).
 */
export function SlotCard({ videoId, draft, context, labels, duration, playhead, canSave, onSeek, onSaved, onReference,
  trainingsDone = null, onTrained, onCleared }: {
    videoId: string; draft: SlotDraft; context: FormContext; labels: Record<string, string>; duration: number; playhead: number;
  canSave: boolean; onSeek: (time: number) => void; onSaved: (saved: Saved) => void;
  /** Group C: open a reference clip beside the video (features/c-reference-hints). */
  onReference?: (clip: ReferenceClip) => void;
  /** Training ids the caller completed; null when not gated (features/c-training-gate). */
  trainingsDone?: string[] | null; onTrained?: (id: string) => void;
  onCleared: (dependentGroups: string[]) => void;
}) {
  const qgroup = draft.qgroup;
  const savedSlots = draft.verdict === "SLOTS" ? draft.slots : null;
  const version = currentVersion(qgroup);
  const stale = staleChoices(qgroup, savedSlots ? draft.codebook_version : null, savedSlots);
  const [state, setState] = useState(() => stateFromSlots(qgroup, savedSlots, context));
  // Prev is derived from C and cannot be manually edited.
  const derived = qgroup === "Prev" ? prefillFromCause(qgroup, context, savedSlots) : null;
  const prefill = qgroup === "Prev" ? derived : savedSlots ? null : prefillFromCause(qgroup, context);
  const [touched, setTouched] = useState(false);
  const chosen = qgroup === "Prev" && derived ? derived : prefill && !touched ? prefill : state;
  // O.v2 shows the level it will store: derived from C and the ticked signs, never chosen (features/o-signs-max-grouped).
  const form = qgroup === "O" ? outcomeState(chosen, context) : chosen;
  const prefilled = prefilledKeys(qgroup, form, prefill, context);
  const savedMarks = draft.human_keyframes_s.map(Number);
  const savedPair = savedMarks.length === 2 && savedMarks[0] < savedMarks[1];
  // [start, end] from one impact mark (features/impact-keyframe); a saved pair is kept as stored.
  const [span, setSpan] = useState<[number, number] | null>(savedPair ? [savedMarks[0], savedMarks[1]] : null);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState<SaveError | null>(null);
  const needsMarks = needsKeyframes(qgroup);
  // The stored sentence is a hand edit when it differs from what the stored cells compose to.
  const [edit, setEdit] = useState<string | null>(() => {
    if (!savedSlots || !draft.edited_answer) return null;
    const current = preview(qgroup, savedSlots, context);
    // Keep compatible hand edits when upgrading an otherwise unchanged codebook sentence.
    return !current || current === draft.edited_answer || editProblem(current, draft.edited_answer)
      ? null : draft.edited_answer;
  });
  const [editNotice, setEditNotice] = useState<string | null>(null);

  const visible = fields(qgroup, form, context);
  const slots = buildSlots(qgroup, form, context);
  const found = problems(qgroup, form, context);
  const marks = needsMarks && span ? [...span] : [];
  if (needsMarks && marks.length !== 2) found.keyframes = "Đặt mốc va chạm.";
  // No preview while a cell still blocks the save: an empty Prev composed to "Không thể xác định.",
  // which read as an answer nobody gave.
  const sentence = Object.keys(found).some((key) => key !== "keyframes") ? null : preview(qgroup, slots, context);
  const editError = edit !== null && sentence && edit.trim() !== sentence ? editProblem(sentence, edit) : null;
  if (editError) found.sentence = editError;
  const stored = edit !== null && edit.trim() && edit.trim() !== sentence ? edit.trim() : sentence;
  const dirty = !savedSlots || !sameSlots(slots, savedSlots) || draft.codebook_version !== version
    || (needsMarks && !sameSlots(marks, savedMarks)) || (stored !== null && stored !== draft.edited_answer);

  function update(item: Field, value: SlotValue | string[] | undefined) {
    if (item.readOnly) return;
    setTouched(true);
    setState(choose(qgroup, form, item, value, context));
    setServerError(null);
    // A hand edit is of the old sentence; a changed cell starts again from the new composed one.
    if (edit !== null) { setEdit(null); setEditNotice("Đã đổi ô nên câu sửa tay được bỏ; bấm \"Sửa câu\" để sửa lại."); }
  }
  async function save() {
    setTried(true); setServerError(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const saved = await postJson<Saved>(`/api/drafts/${draft.id}/annotation`, "POST", {
        verdict: "SLOTS", codebook_version: version, slots, human_keyframes_s: marks,
        ...(edit !== null && stored !== sentence ? { edited_answer: edit } : {}),
      });
      if (edit !== null && stored === sentence) setEdit(null);
      // A saved suggestion (R has_aftermath) becomes the form's own state: once
      // R is saved no prefill is computed, and the untouched state is empty.
      if (prefill && !touched && qgroup !== "Prev") { setState(chosen); setTouched(true); }
      setEditNotice(null);
      setTried(false);
      onSaved(saved);
    } catch (cause) {
      const error = cause as SaveError;
      setServerError({ ...error, ...errorText(qgroup, error.code, error.message) });
    } finally { setSaving(false); }
  }
  async function clearAnswer() {
    setClearing(true); setServerError(null);
    try {
      const result = await postJson<{ deleted: boolean; dependent_groups: string[] }>(`/api/drafts/${draft.id}/annotation`, "DELETE", {});
      setState(stateFromSlots(qgroup, null, context));
      setTouched(false); setSpan(null); setEdit(null); setEditNotice(null); setTried(false);
      onCleared(result.dependent_groups);
    } catch (cause) {
      const error = cause as SaveError;
      setServerError({ ...error, ...errorText(qgroup, error.code, error.message) });
    } finally { setClearing(false); }
  }

  // A server error about one cell shows next to the first field of that cell.
  const errorField = serverError?.cellId ? visible.find((item) => item.cellId === serverError.cellId)?.key : undefined;
  const errorOf = (item: Field) => (tried ? found[item.key] : undefined) ?? (item.key === errorField ? serverError?.message : undefined);
  // F-v1: an old choice the current codebook dropped shows as a note on its now empty field.
  const noteOf = (item: Field) => {
    const old = item.scope === "outer" && !currentValue(form, item) ? stale.cells[item.cellId] : undefined;
    return [item.note, old && `Bản cũ chọn "${old}"; lựa chọn này đã bỏ ở bản mới, chọn lại.`].filter(Boolean).join(" ") || undefined;
  };
  const badgeOf = (item: Field) => item.readOnly && (qgroup === "Prev" || qgroup === "O")
    ? "tự suy ra, không sửa" : !prefilled.has(item.key) ? undefined
    : qgroup === "R" ? "gợi ý từ mốc C" : "điền sẵn từ C";
  const outer = visible.filter((item) => item.scope === "outer");
  const scopes = [...new Set(visible.filter((item) => item.scope !== "outer").map((item) => item.scope as number))];
  const twoParties = visible.some((item) => item.kind === "party");
  const needsEntities = visible.some((item) => item.entities !== null) && context.entities.length === 0;
  const needsOutcomeEntities = qgroup === "O" && context.entities.length < 2;
  const pair = causePair(context.cause);
  const status = saving ? "Đang lưu…" : !dirty ? "✓ Đã lưu" : savedSlots ? "Có thay đổi chưa lưu" : "";

  const renderField = (item: Field) => {
    if (item.kind === "refs") {
      const option = form.cells[item.cellId]?.option;
      return <FieldRow key={item.key} label={item.label} note={item.note} optional={!item.required} error={errorOf(item)}>
        <div className="flex flex-wrap gap-1.5">{item.entities?.map((key) => {
          const pressed = form.refs.includes(key) && !option;
          return <EntityChip key={key} entityKey={key} label={labels[key] ?? key} pressed={pressed} disabled={item.readOnly}
            onClick={() => update(item, pressed ? form.refs.filter((ref) => ref !== key)
              : [...(option ? [] : form.refs), key].slice(-2))} />;
        })}
        {item.options.map((choice) => <Chip key={choice.id} pressed={option === choice.id} disabled={item.readOnly}
          onClick={() => update(item, option === choice.id ? [] : { option: choice.id })}>{choice.label}</Chip>)}</div>
        {(["S", "C", "R", "O"] as string[]).includes(qgroup) && <GroupReportButton videoId={videoId}
          questionGroup={qgroup as "S" | "C" | "R" | "O"} targetCell={item.cellId} targetLabel={item.label}
          targetIndex={typeof item.scope === "number" ? item.scope : undefined} disabled={!canSave} />}
      </FieldRow>;
    }
    if (item.kind === "party") {
      const value = rawValue(form, item) as SlotValue | undefined;
      return <FieldRow key={item.key} label={item.label} badge={badgeOf(item)} error={errorOf(item)}>
        <OptionPicker options={item.options} entities={item.entities} labels={labels} value={value}
          required={item.required} disabled={item.readOnly} onChange={(next) => update(item, next)} />
        {(["S", "C", "R", "O"] as string[]).includes(qgroup) && <GroupReportButton videoId={videoId}
          questionGroup={qgroup as "S" | "C" | "R" | "O"} targetCell={item.cellId} targetLabel={item.label}
          targetIndex={typeof item.scope === "number" ? item.scope : undefined} disabled={!canSave} />}
      </FieldRow>;
    }
    const value = currentValue(form, item);
    const selectedIds = value?.options ?? (value?.option ? [value.option] : []);
    const option = item.options.find((candidate) => candidate.id === value?.option);
    const freeTextOption = item.options.find((candidate) => candidate.free_text && selectedIds.includes(candidate.id));
    return <FieldRow key={item.key} label={item.label} optional={!item.required} note={noteOf(item)} badge={badgeOf(item)}
      error={errorOf(item)}>
        <OptionPicker options={item.options} entities={item.entities} labels={labels} value={value}
          required={item.required} multiple={item.multiple} disabled={item.readOnly} onChange={(next) => update(item, next)} />
      {(["S", "C", "R", "O"] as string[]).includes(qgroup) && <GroupReportButton videoId={videoId}
        questionGroup={qgroup as "S" | "C" | "R" | "O"} targetCell={item.cellId} targetLabel={item.label}
        targetIndex={typeof item.scope === "number" ? item.scope : undefined} disabled={!canSave} />}
      {freeTextOption && <FreeText label={`${item.label}: khác`} value={value?.text ?? ""}
        disabled={item.readOnly} onChange={(text) => update(item, item.multiple ? { options: selectedIds, text } : { option: freeTextOption.id, text })} />}
      {option?.from_entities && <div className="flex flex-wrap items-center gap-1.5 border-l-2 border-accent/40 pl-2">
        <span className="text-xs text-foreground/70">Bên nào:</span>
        {item.optionEntities?.map((key) => <EntityChip key={key} entityKey={key} label={labels[key] ?? key}
          pressed={value?.entity === key} onClick={() => update(item, { option: option.id, entity: key })} />)}
      </div>}
      {qgroup === "C" && item.cellId === "conflict_type" && onReference
        && <ConflictHint option={value?.option} onOpen={onReference} />}
    </FieldRow>;
  };

  const training = trainingsDone ? requiredTraining(qgroup) : null;
  if (training && canSave && !trainingsDone!.includes(training.id)) {
    return <article className="rounded-lg border border-border-strong bg-surface" data-qgroup={qgroup}>
      <CardHeader draft={draft} saved={!!savedSlots} />
      <TrainingGate training={training} qgroup={qgroup} onDone={() => onTrained?.(training.id)} />
    </article>;
  }

  return <article className="rounded-lg border border-border-strong bg-surface" data-qgroup={qgroup}>
    <CardHeader draft={draft} saved={!!savedSlots} />
    <DraftReference draft={draft} />
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
      {needsEntities && <p className="rounded border border-amber/50 bg-amber/10 px-3 py-2 text-xs text-amber">
        Chưa có bên nào: khai báo và lưu các bên ở nhóm E trước.</p>}
      {needsOutcomeEntities && <p className="rounded border border-amber/50 bg-amber/10 px-3 py-2 text-xs text-amber" role="alert">
        Lưu đủ bên A và B ở nhóm E trước khi lưu nhóm O.</p>}
      {qgroup === "Prev" && <p className="rounded border border-accent/50 bg-accent/10 px-3 py-2 text-xs text-foreground/85">
        Hành động phòng tránh được suy ra trực tiếp từ tình huống C; nếu thiếu căn cứ về bên hoặc hành động, hệ thống ghi &quot;không thể xác định&quot;.</p>}
      {savedSlots && draft.codebook_version !== version && <p
        className="rounded border border-amber/50 bg-amber/10 px-3 py-2 text-xs text-amber">
        Câu này lưu bằng codebook {draft.codebook_version}; bấm Lưu để lưu lại bằng {version}.
        {stale.removed.length > 0 && ` Ô đã bỏ ở bản mới, không lưu lại: ${stale.removed.join(", ")}.`}</p>}
      {!savedSlots && draft.verdict && <p className="rounded border border-amber/50 bg-amber/10 px-3 py-2 text-xs text-amber">
        Câu này đã lưu dạng chữ trước khi nhóm {qgroup} có ô{draft.edited_answer ? `: "${draft.edited_answer}"` : ""}.
        Chọn ô rồi bấm Lưu để thay.</p>}
      {qgroup === "O" && !context.cause && <p className="rounded border border-amber/50 bg-amber/10 px-3 py-2 text-xs text-amber">
        Mức độ của O suy ra từ nhóm C: lưu nhóm C trước.</p>}
      {qgroup === "R" && !context.cause && <p className="rounded border border-amber/50 bg-amber/10 px-3 py-2 text-xs text-amber">
        Chủ thể và đối tượng của R lấy từ nhóm C: lưu nhóm C trước.</p>}
      {qgroup === "R" && context.cause && pair.length === 0 && <p className="text-xs text-foreground/60">
        Nhóm C không rõ chủ thể nên câu R sẽ là &quot;Không thể xác định.&quot;</p>}
      {outer.map(renderField)}
      {scopes.map((scope) => {
        const items = visible.filter((item) => item.scope === scope);
        return twoParties
          ? <fieldset key={scope} className="flex flex-col gap-3 rounded-md border border-border bg-background/40 p-3">
            <legend className="sr-only">Bên {scope + 1}</legend>
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Bên {scope + 1}</span>
            {items.map(renderField)}
          </fieldset>
          : items.map(renderField);
      })}
    </div>
    {needsMarks && <div className="border-t border-border px-4 py-3">
      <ImpactKeyframes value={span} playhead={playhead} duration={duration} onSeek={onSeek}
        onChange={(pair) => { setServerError(null); setSpan(pair); }} error={tried ? found.keyframes : undefined} />
    </div>}
    <EditableSentence composed={sentence} edit={edit} problem={editError} notice={editNotice} dirty={dirty}
      saved={savedSlots ? draft.edited_answer : null}
      onEdit={(text) => { setEdit(text); setEditNotice(null); setServerError(null); }} />
    <SaveBar canSave={canSave} saving={saving} dirty={dirty} status={status}
      error={serverError?.message
        ?? (tried && Object.keys(found).length ? "Còn ô chưa chọn hoặc chưa hợp lệ, xem chữ đỏ ở trên." : undefined)}
      onSave={() => { void save(); }} onClear={savedSlots ? () => { void clearAnswer(); } : undefined} clearing={clearing} />
  </article>;
}
