"use client";

import { useState } from "react";
import { currentVersion } from "@/lib/codebook";
import type { Entity } from "@/lib/codebook/compose";
import {
  buildEntityCells, entityCells, entityLimit, entityProblems, errorText, nextEntityKey, preview, sameSlots, type Cells,
} from "@/lib/codebook/form";
import { CardHeader, DraftReference, SaveBar, Sentence, postJson, type SaveError, type SlotDraft } from "@/components/slots/common";
import { FieldRow, FreeText, OptionPicker } from "@/components/slots/SlotField";
import { BTN, FOCUS } from "@/components/slots/styles";

type SavedEntities = { entities: Entity[] | null; edited_answer: string; slots: { entities: Entity[] } };

/**
 * Group E: the parties A, B, C... of the video, each with the E cells its
 * type calls for. Saved through PUT /api/videos/[id]/entities; every other
 * group then picks its parties from the saved list. A party another group
 * still points to cannot be removed or changed (409 from the database).
 */
export function EntityCard({ videoId, draft, saved, canSave, onSaved }: {
  videoId: string; draft: SlotDraft; saved: Entity[]; canSave: boolean;
  onSaved: (entities: Entity[], row: { edited_answer: string; slots: { entities: Entity[] } }) => void;
}) {
  const [list, setList] = useState<Entity[]>(() => saved.length ? saved : [{ key: "A", cells: {} }]);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const [serverError, setServerError] = useState<SaveError | null>(null);
  const built = list.map((entity) => ({ key: entity.key, cells: buildEntityCells(entity.cells as Cells) }));
  const found = entityProblems(list);
  const stored = draft.verdict === "SLOTS";
  const dirty = !stored || !sameSlots(built, saved);
  const sentence = preview("E", { entities: built }, { entities: built });

  function setCell(key: string, cellId: string, value: Cells[string] | undefined) {
    setServerError(null);
    setList((current) => current.map((entity) => {
      if (entity.key !== key) return entity;
      const cells = { ...(entity.cells as Cells) };
      if (value === undefined) delete cells[cellId]; else cells[cellId] = value;
      return { ...entity, cells };
    }));
  }
  async function save() {
    setTried(true); setServerError(null);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const result = await postJson<SavedEntities>(`/api/videos/${videoId}/entities`, "PUT",
        { codebook_version: currentVersion("E"), entities: built });
      setTried(false);
      onSaved(result.entities ?? [], { edited_answer: result.edited_answer, slots: result.slots });
    } catch (cause) {
      const error = cause as SaveError;
      setServerError({ ...error, ...errorText("E", error.code, error.message) });
      // A party another group points to stays: put back its saved cells, so removing it cost nothing.
      const kept = error.code === "entity_referenced" ? saved.find((entity) => entity.key === error.entity) : undefined;
      if (kept) {
        setList((current) => [...current.filter((entity) => entity.key !== kept.key), kept]
          .sort((a, b) => a.key.localeCompare(b.key)));
      }
    } finally { setSaving(false); }
  }
  const limit = entityLimit();
  // E.v5: at most the two main parties, so no add button at the limit.
  const nextKey = limit !== null && list.length >= limit ? null : nextEntityKey(list.map((entity) => entity.key));

  return <article className="rounded-lg border border-border-strong bg-surface" data-qgroup="E">
    <CardHeader draft={draft} saved={stored} />
    <DraftReference draft={draft} />
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
      <p className="text-xs text-foreground/70">{limit === null
        ? "Khai báo từng bên liên quan (A, B, C...). Các nhóm khác chọn bên từ danh sách đã lưu ở đây."
        : `Khai báo tối đa ${limit} bên chính: cặp va chạm đầu tiên, không có va chạm thì cặp suýt va chạm đầu tiên; xe tự trượt hoặc tự lật thì 1 bên. Các nhóm khác chọn bên từ danh sách đã lưu ở đây.`}</p>
      {found._list && <p role="alert" className="text-sm text-red">{found._list}</p>}
      {list.map((entity) => {
        const cells = entity.cells as Cells;
        const usedBy = serverError?.code === "entity_referenced" && serverError.entity === entity.key;
        return <fieldset key={entity.key} className={`flex flex-col gap-3 rounded-md border bg-background/40 p-3 ${usedBy ? "border-red/60" : "border-border"}`}>
          <legend className="sr-only">Bên {entity.key}</legend>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-accent">Bên {entity.key}</span>
            <button type="button" onClick={() => { setServerError(null); setList((current) => current.filter((item) => item.key !== entity.key)); }}
              aria-label={`Xóa bên ${entity.key}`}
              className={`rounded-md border border-border-strong px-2 py-0.5 text-xs text-foreground/70 hover:border-red hover:text-red ${FOCUS}`}>
              Xóa bên {entity.key}</button>
          </div>
          {entityCells(cells).map((cell) => {
            const value = cells[cell.id];
            const option = cell.options?.find((candidate) => candidate.id === value?.option);
            return <FieldRow key={cell.id} label={cell.label} optional={!cell.required}
              error={tried ? found[`${entity.key}.${cell.id}`] : undefined}>
              <OptionPicker options={cell.options ?? []} entities={null} labels={{}} value={option ? value : undefined}
                required={cell.required} onChange={(next) => setCell(entity.key, cell.id, next)} />
              {option?.free_text && <FreeText label={`Bên ${entity.key}: loại khác`} value={value?.text ?? ""}
                onChange={(text) => setCell(entity.key, cell.id, { option: option.id, text })} />}
            </FieldRow>;
          })}
        </fieldset>;
      })}
      {nextKey && <button type="button" onClick={() => setList((current) => [...current, { key: nextKey, cells: {} }])}
        className={`${BTN} self-start px-3 py-1.5 text-sm`}>+ Thêm bên {nextKey}</button>}
    </div>
    <Sentence dirty={dirty} preview={sentence} saved={stored ? draft.edited_answer : null} />
    <SaveBar canSave={canSave} saving={saving} dirty={dirty} label="Lưu các bên"
      status={saving ? "Đang lưu…" : !dirty ? "✓ Đã lưu" : stored ? "Có thay đổi chưa lưu" : ""}
      error={serverError?.message ?? (tried && Object.keys(found).length
        ? found._list ?? "Mỗi bên cần chọn loại, xem chữ đỏ ở trên." : undefined)}
      onSave={() => { void save(); }} />
  </article>;
}
