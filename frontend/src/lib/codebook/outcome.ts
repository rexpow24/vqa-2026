// O.v2 rows the server writes for the annotator (features/o-codebook-v2,
// architecture.md "One derivation, three callers"). Pure: the routes read the
// rows and pass them in; this decides what O must say for a given C.

import { currentVersion, getCodebook } from "./index.ts";
import { compose, type Entity, type SlotValue, type Slots } from "./compose.ts";
import { deriveOutcome, outcomeNeedsAnnotator } from "./derivation.ts";
import { sameSlots } from "./form.ts";

export type StoredOutcome = { slots: Slots; codebook_version: string; edited_answer: string | null } | null;

/**
 * The O row to write after C is saved or synced, or null when O must be left as
 * it is: on a near miss (or a legacy unclear event) O is fully derived; on a
 * collision only an O.v2 answer that already has signs is re-derived (its
 * parties and sentence follow C); anything else waits for the annotator.
 * A row equal to the stored one is not written again.
 */
export function outcomeRow(cause: Slots, stored: StoredOutcome, entities: Entity[], draftId: string | null):
  Record<string, unknown> | null {
  if (!draftId) return null;
  const version = currentVersion("O")!;
  const keepSigns = stored?.codebook_version === version && (stored.slots.signs as SlotValue | undefined)?.options?.length;
  if (outcomeNeedsAnnotator(cause) && !keepSigns) return null;
  const slots = deriveOutcome(cause, outcomeNeedsAnnotator(cause) ? stored!.slots : null);
  if (!slots?.level) return null;
  if (getCodebook(version)?.cells.find((cell) => cell.id === "parties")?.read_only) {
    slots.parties = entities.map((entity) => entity.key).sort().slice(0, 2).map((key) => ({ entity: key }));
  }
  const sentence = compose("O", slots, { version, entities });
  if (stored?.codebook_version === version && sameSlots(stored.slots, slots) && stored.edited_answer === sentence) return null;
  return { draft_id: draftId, codebook_version: version, slots, human_keyframes_s: [], edited_answer: sentence };
}

/**
 * Why a stored O contradicts the stored C, or null when it does not (or is O.v1,
 * which predates the derivation and is checked by no one).
 */
export function outcomeConflict(cause: Slots | null, stored: StoredOutcome): string | null {
  if (!cause || !stored || stored.codebook_version !== currentVersion("O")) return null;
  const expected = deriveOutcome(cause, stored.slots);
  const level = (stored.slots.level as SlotValue | undefined)?.option;
  if ((expected?.level as SlotValue | undefined)?.option === level) return null;
  return outcomeNeedsAnnotator(cause)
    ? "Nhóm C là va chạm nhưng nhóm O chưa chọn dấu hiệu: mở nhóm O, chọn dấu hiệu rồi lưu."
    : "Nhóm O chưa khớp với nhóm C: tải lại trang để hệ thống suy ra lại nhóm O.";
}
