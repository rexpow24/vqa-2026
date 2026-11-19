// Form logic of the slot form (P4), kept pure so node --test can pin it:
// which cells a group shows for the current choices, the slots payload the
// save route takes (architecture.md of slot-data-model, "Hình dạng slots"),
// the problems that block a save before anything is sent, and the Vietnamese
// text of a 422 the server answers with.
//
// The form state is close to the stored shape on purpose: `cells` are the
// outer cells, `parties` the per-party cells (C "cả hai bên", Prev), `refs`
// the O parties. The state may keep a value a later choice made irrelevant
// (an action of another conflict type); `buildSlots` drops it, so switching
// back and forth never loses a choice nor sends a stale one.

import { getCodebook, currentVersion, type Codebook, type CodebookCell, type CodebookOption } from "./index.ts";
import { compose, type Entity, type SlotValue, type Slots } from "./compose.ts";

export type Cells = Record<string, SlotValue>;
export type PartyState = { entity?: string; cells: Cells };
export type FormState = { cells: Cells; parties: PartyState[]; refs: string[] };
/** `entities`: the annotator's saved E list; `cause`: the saved C cells, which R and O read. */
export type FormContext = { entities: Entity[]; cause?: Slots | null };

/**
 * One visible input. `scope` is "outer" or a party index; `kind` is a cell
 * choice, the entity of a party (C "cả hai bên", Prev), or the O parties.
 */
export type Field = {
  key: string;
  scope: "outer" | number;
  kind: "choice" | "party" | "refs";
  cellId: string;
  label: string;
  required: boolean;
  multiple?: boolean;
  options: CodebookOption[];
  /** Entity keys the field offers, or null when it takes no entity. */
  entities: string[] | null;
  /** Entity keys for an option that names one (C "chạm vào thực thể khác"). */
  optionEntities?: string[];
  note?: string;
};

export const MAX_TEXT = 200;

export const emptyState = (): FormState => ({ cells: {}, parties: [], refs: [] });

function bookOf(qgroup: string): Codebook {
  const book = getCodebook(currentVersion(qgroup) ?? "");
  if (!book) throw new Error(`No codebook for group ${qgroup}`);
  return book;
}

const cellOf = (book: Codebook, id: string): CodebookCell => {
  const cell = book.cells.find((candidate) => candidate.id === id);
  if (!cell) throw new Error(`No cell ${id} in ${book.group}`);
  return cell;
};

const keysOf = (context: FormContext) => [...context.entities].map((entity) => entity.key).sort();

/** The C pair R and O read: [subject, object] of an entity subject, the two parties in key order for "cả hai bên". */
export function causePair(cause: Slots | null | undefined): string[] {
  if (!cause) return [];
  const subject = cause.subject as SlotValue | undefined;
  if (subject?.option === "subject.both") {
    return (Array.isArray(cause.parties) ? cause.parties as Slots[] : [])
      .map((party) => (party.party as SlotValue | undefined)?.entity).filter((key): key is string => !!key).sort();
  }
  if (subject?.entity === undefined) return [];
  const object = (cause.object as SlotValue | undefined)?.entity;
  return object === undefined ? [subject.entity] : [subject.entity, object];
}

function field(book: Codebook, cellId: string, scope: "outer" | number, extra: Partial<Field> = {}): Field {
  const cell = cellOf(book, cellId);
  return {
    key: `${scope}.${cellId}`, scope, kind: "choice", cellId, label: cell.label, required: cell.required,
    multiple: cell.multiple, options: cell.options ?? [], entities: null, ...extra,
  };
}

/** Children of the chosen parent option (C action under conflict type, O sign under level). */
function childOptions(book: Codebook, cellId: string, parentOption: string | undefined): CodebookOption[] {
  return (cellOf(book, cellId).options ?? []).filter((option) => option.parent === parentOption);
}

const optionOf = (value: SlotValue | undefined) => value?.option;

/** The fields a group shows for these choices, in the codebook's order. */
export function fields(qgroup: string, state: FormState, context: FormContext): Field[] {
  const book = bookOf(qgroup);
  const keys = keysOf(context);
  const out: Field[] = [];
  const cells = state.cells;
  switch (qgroup) {
    case "S":
      return book.cells.map((cell) => field(book, cell.id, "outer"));
    case "V":
      out.push(field(book, "result", "outer"));
      if (optionOf(cells.result) === "result.yes") {
        out.push(field(book, "violator", "outer", { required: true, entities: keys }));
        // V.v2 "cả hai bên": one behaviour per party, as C does for subject.both.
        if (optionOf(cells.violator) === "violator.both") {
          for (const index of [0, 1]) {
            out.push(field(book, "violator", index, { kind: "party", key: `${index}.party`, cellId: "party",
              label: "Chọn bên", required: true, options: [], entities: keys }),
            field(book, "behavior", index, { required: true }));
          }
        } else {
          out.push(field(book, "behavior", "outer", { required: true }));
        }
      }
      return out;
    case "Attr":
      // One or two parties from E, or "không rõ"; not tied to the C subject (codebook v2).
      out.push(field(book, "parties", "outer", { kind: "refs", key: "outer.parties", entities: keys,
        note: "Chọn 1 hoặc 2 bên; không xác định được thì chọn \"không rõ\"." }));
      return out;
    case "O": {
      out.push(field(book, "level", "outer"));
      const signs = childOptions(book, "sign", optionOf(cells.level));
      if (signs.length) out.push(field(book, "sign", "outer", { options: signs }));
      if (signs.some((option) => option.parent !== "level.none")) {
        out.push(field(book, "parties", "outer", { kind: "refs", key: "outer.parties", entities: keys,
          note: "Tự điền từ chủ thể và đối tượng của nhóm C; chọn 1 hoặc 2 bên." }));
      }
      return out;
    }
    case "R": {
      out.push(field(book, "has_aftermath", "outer"));
      if (optionOf(cells.has_aftermath) !== "has_aftermath.yes") return out;
      const pair = causePair(context.cause);
      out.push(field(book, "subject", "outer", { label: pair[0] ? `Chủ thể (${pair[0]})` : "Chủ thể" }));
      // C without an object (K18, one party) has no object part in R.
      if (!context.cause || pair.length === 2) {
        out.push(field(book, "object", "outer", { label: pair[1] ? `Đối tượng (${pair[1]})` : "Đối tượng" }));
      }
      out.push(field(book, "bystanders", "outer"));
      return out;
    }
    case "C": {
      out.push(field(book, "event_type", "outer"), field(book, "subject", "outer", { entities: keys }));
      const both = optionOf(cells.subject) === "subject.both";
      const subjectKey = cells.subject?.entity;
      if (!both) {
        out.push(field(book, "object", "outer", { entities: keys.filter((key) => key !== subjectKey),
          note: keys.length === 2 ? "Video có 2 bên: tự điền bên còn lại." : undefined }));
      }
      out.push(field(book, "conflict_type", "outer"));
      const actions = childOptions(book, "action", optionOf(cells.conflict_type));
      if (both) {
        for (const index of [0, 1]) {
          out.push({ ...field(book, "subject", index, { kind: "party", key: `${index}.party`, cellId: "party",
            label: "Chọn bên", required: true, options: [], entities: keys }) });
          if (actions.length) out.push(field(book, "action", index, { options: actions }));
        }
        return out;
      }
      if (actions.length) out.push(field(book, "action", "outer", { options: actions }));
      out.push(field(book, "speed", "outer"));
      // C.v1 only: the evasion cells were removed in C.v2.
      if (optionOf(cells.event_type) === "event_type.near_miss" && book.cells.some((cell) => cell.id === "evader")) {
        out.push(field(book, "evader", "outer", { entities: keys }), field(book, "evasion", "outer"),
          field(book, "evasion_result", "outer", { optionEntities: keys }));
      }
      return out;
    }
    case "Prev": {
      out.push(field(book, "party", "outer", { entities: keys }));
      const party = cells.party;
      const scopes = party?.entity !== undefined ? [0] : party?.option === "party.both" ? [0, 1] : [];
      for (const index of scopes) {
        if (scopes.length === 2) {
          out.push({ ...field(book, "party", index, { kind: "party", key: `${index}.party`,
            label: "Chọn bên", required: true, options: [], entities: keys }) });
        }
        out.push(field(book, "main_action", index), field(book, "extra_action", index));
      }
      return out;
    }
    default:
      throw new Error(`Group ${qgroup} has no slot form`);
  }
}

const cellsOf = (state: FormState, scope: "outer" | number): Cells =>
  scope === "outer" ? state.cells : state.parties[scope]?.cells ?? {};

/** The raw value of a field, whatever later choices made of it. */
export function rawValue(state: FormState, item: Field): SlotValue | string[] | undefined {
  if (item.kind === "refs") return state.refs;
  if (item.kind === "party") {
    const key = typeof item.scope === "number" ? state.parties[item.scope]?.entity : undefined;
    return key === undefined ? undefined : { entity: key };
  }
  return cellsOf(state, item.scope)[item.cellId];
}

/** The value of a field if it is still valid for the field as shown now; undefined otherwise. */
export function currentValue(state: FormState, item: Field): SlotValue | undefined {
  if (item.kind === "refs") return undefined;
  const value = rawValue(state, item) as SlotValue | undefined;
  if (!value) return undefined;
  if (item.multiple) {
    const selected = value.options ?? (value.option ? [value.option] : []);
    const selectedIds = new Set(selected);
    const options = item.options.filter((option) => selectedIds.has(option.id)).map((option) => option.id);
    if (!options.length) return undefined;
    const kept: SlotValue = { options };
    if (options.some((id) => item.options.find((option) => option.id === id)?.free_text)) kept.text = value.text ?? "";
    return kept;
  }
  if (value.option !== undefined) {
    const option = item.options.find((candidate) => candidate.id === value.option);
    if (!option) return undefined;
    const kept: SlotValue = { option: option.id };
    if (option.from_entities && value.entity !== undefined && item.optionEntities?.includes(value.entity)) kept.entity = value.entity;
    if (option.free_text) kept.text = value.text ?? "";
    return kept;
  }
  if (value.entity !== undefined && item.entities?.includes(value.entity)) return { entity: value.entity };
  return undefined;
}

const validRefs = (state: FormState, item: Field) =>
  state.refs.filter((key, index) => item.entities?.includes(key) && state.refs.indexOf(key) === index).slice(0, 2);

/** Trimmed text for the payload: the database checks the trimmed length. */
function payloadValue(value: SlotValue): SlotValue {
  return value.text === undefined ? value : { ...value, text: value.text.trim() };
}

/** The slots payload of the save route for these choices; hidden or stale values are left out. */
export function buildSlots(qgroup: string, state: FormState, context: FormContext): Slots {
  const visible = fields(qgroup, state, context);
  const slots: Slots = {};
  const parties: Slots[] = [];
  for (const item of visible) {
    if (item.kind === "refs") {
      // Attr "không rõ" is an option of the same cell, kept instead of any party.
      const unclear = item.options.find((option) => option.id === state.cells[item.cellId]?.option);
      const refs = validRefs(state, item);
      if (unclear) slots.parties = { option: unclear.id };
      else if (refs.length) slots.parties = refs.map((key) => ({ entity: key }));
      continue;
    }
    const value = currentValue(state, item);
    if (!value) continue;
    if (item.scope === "outer") {
      // Prev stores its party inside `parties`, never as an outer cell.
      if (qgroup !== "Prev" || item.cellId !== "party") slots[item.cellId] = payloadValue(value);
      continue;
    }
    const party = (parties[item.scope] ??= {});
    if (item.kind === "party") party.party = value;
    else party[item.cellId] = payloadValue(value);
  }
  // per_party_when (C subject.both, V.v2 violator.both): the per-party cells live in two parties.
  if (visible.some((item) => item.kind === "party") && qgroup !== "Prev") {
    slots.parties = [0, 1].map((index) => parties[index] ?? {});
  }
  if (qgroup === "Prev") {
    const party = state.cells.party;
    if (party?.option === "party.unclear") slots.parties = [{ party: { option: "party.unclear" } }];
    else if (party?.option === "party.both") slots.parties = [0, 1].map((index) => parties[index] ?? {});
    else if (party?.entity !== undefined && keysOf(context).includes(party.entity)) {
      slots.parties = [{ ...(parties[0] ?? {}), party: { entity: party.entity } }];
    }
  }
  return slots;
}

/** Back from stored slots to form state (the inverse of buildSlots). */
export function stateFromSlots(qgroup: string, slots: Slots | null | undefined, context: FormContext): FormState {
  if (!slots) return defaultState(qgroup, context);
  const { parties, ...rest } = slots;
  const list = Array.isArray(parties) ? parties as Slots[] : [];
  const partyState = (party: Slots): PartyState => {
    const { party: who, ...cells } = party;
    return { entity: (who as SlotValue | undefined)?.entity, cells: cells as Cells };
  };
  if (qgroup === "O" || qgroup === "Attr") {
    const cells = (Array.isArray(parties) || parties === undefined ? rest : { ...rest, parties }) as Cells;
    return { cells, parties: [], refs: list.map((ref) => (ref as SlotValue).entity).filter((key): key is string => !!key) };
  }
  if (qgroup === "Prev") {
    if (list.length === 1 && (list[0].party as SlotValue | undefined)?.option === "party.unclear") {
      return { cells: { party: { option: "party.unclear" } }, parties: [], refs: [] };
    }
    if (list.length === 2) return { cells: { party: { option: "party.both" } }, parties: list.map(partyState), refs: [] };
    const only = list[0] ? partyState(list[0]) : undefined;
    return { cells: only?.entity ? { party: { entity: only.entity } } : {}, parties: only ? [only] : [], refs: [] };
  }
  return { cells: rest as Cells, parties: list.map(partyState), refs: [] };
}

type PrefillRule = { conflict_types: string[]; c_actions?: string[]; option: string };

/** The V behaviour the codebook's `prefill_from_c` gives for a C conflict type and action, if any. */
function prefillBehavior(book: Codebook, conflict: string | undefined, action: string | undefined): Cells {
  const code = getCodebook(currentVersion("C") ?? "")?.cells.find((cell) => cell.id === "conflict_type")
    ?.options?.find((option) => option.id === conflict)?.code;
  const rules = (Array.isArray(book.prefill_from_c) ? book.prefill_from_c : []) as PrefillRule[];
  const rule = rules.find((candidate) => typeof code === "string" && candidate.conflict_types.includes(code)
    && (!candidate.c_actions || (action !== undefined && candidate.c_actions.includes(action))));
  return rule ? { behavior: { option: rule.option } } : {};
}

/**
 * F-V (codebook v2): the V form filled from the saved C answer, for a V that
 * was never saved. The violator is the C subject ("cả hai bên" included), the
 * result "có", and each behaviour comes from `prefill_from_c` of the V
 * codebook by C conflict type and action; no rule leaves it empty. A C
 * subject that is "không rõ" fills nothing. Null when there is nothing to fill.
 */
export function prefillFromCause(qgroup: string, context: FormContext): FormState | null {
  const cause = context.cause;
  if (qgroup !== "V" || !cause) return null;
  const book = bookOf("V");
  const keys = keysOf(context);
  const conflict = optionOf(cause.conflict_type as SlotValue | undefined);
  const subject = cause.subject as SlotValue | undefined;
  if (subject?.option === "subject.both") {
    if (!book.cells.find((cell) => cell.id === "violator")?.options?.some((option) => option.id === "violator.both")) return null;
    const parties = (Array.isArray(cause.parties) ? cause.parties as Slots[] : [])
      .map((party) => ({ entity: (party.party as SlotValue | undefined)?.entity,
        cells: prefillBehavior(book, conflict, optionOf(party.action as SlotValue | undefined)) }))
      .filter((party) => party.entity !== undefined && keys.includes(party.entity));
    if (parties.length !== 2) return null;
    return { cells: { result: { option: "result.yes" }, violator: { option: "violator.both" } }, parties, refs: [] };
  }
  if (subject?.entity === undefined || !keys.includes(subject.entity)) return null;
  return { cells: { result: { option: "result.yes" }, violator: { entity: subject.entity },
    ...prefillBehavior(book, conflict, optionOf(cause.action as SlotValue | undefined)) }, parties: [], refs: [] };
}

/** The keys of the fields whose value is still the one `prefill` gave them. */
export function prefilledKeys(qgroup: string, state: FormState, prefill: FormState | null, context: FormContext): Set<string> {
  const out = new Set<string>();
  if (!prefill) return out;
  for (const item of fields(qgroup, state, context)) {
    const value = currentValue(state, item);
    const given = fields(qgroup, prefill, context).find((candidate) => candidate.key === item.key);
    if (value && given && sameSlots(value, currentValue(prefill, given))) out.add(item.key);
  }
  return out;
}

/**
 * F-v1: what an answer saved with an older codebook loses in the current one.
 * `cells`: cell id -> the label of an old choice that is no longer an option
 * (the field shows empty with this note); `removed`: labels of cells the
 * current codebook no longer has. Both empty when the versions are equal.
 */
export function staleChoices(qgroup: string, savedVersion: string | null, slots: Slots | null | undefined):
  { cells: Record<string, string>; removed: string[] } {
  const out = { cells: {} as Record<string, string>, removed: [] as string[] };
  const current = currentVersion(qgroup);
  const old = savedVersion ? getCodebook(savedVersion) : undefined;
  if (!slots || !old || savedVersion === current) return out;
  const book = bookOf(qgroup);
  const scan = (cells: Slots) => {
    for (const [cellId, value] of Object.entries(cells)) {
      const oldCell = old.cells.find((cell) => cell.id === cellId);
      if (!oldCell) continue;
      const cell = book.cells.find((candidate) => candidate.id === cellId);
      if (!cell) {
        if (!out.removed.includes(oldCell.label)) out.removed.push(oldCell.label);
        continue;
      }
      const answer = value as SlotValue | undefined;
      const optionIds = answer?.options ?? (answer?.option ? [answer.option] : []);
      const stale = optionIds.filter((optionId) => !cell.options?.some((option) => option.id === optionId));
      if (stale.length) {
        out.cells[cellId] = stale.map((optionId) => oldCell.options?.find((option) => option.id === optionId)?.label ?? optionId)
          .join(", ");
      }
    }
  };
  const { parties, ...rest } = slots;
  scan(rest);
  if (Array.isArray(parties)) for (const party of parties) if (party && typeof party === "object" && !("entity" in party)) scan(party as Slots);
  return out;
}

/** A new, empty form; O starts with the C pair (codebook O, "auto_fill"). */
export function defaultState(qgroup: string, context: FormContext): FormState {
  const state = emptyState();
  if (qgroup === "O") state.refs = causePair(context.cause);
  return state;
}

/**
 * The state after choosing `value` in a field. Besides setting it, this does
 * what the codebook says is filled for the annotator: the other party as C
 * object when the video has two, the two parties of "cả hai bên", and a
 * child cell that has exactly one option (O "không va chạm" → "không có").
 */
export function choose(qgroup: string, state: FormState, item: Field, value: SlotValue | string[] | undefined,
  context: FormContext): FormState {
  const next: FormState = { cells: { ...state.cells }, parties: state.parties.map((party) => ({ ...party, cells: { ...party.cells } })),
    refs: [...state.refs] };
  if (item.kind === "refs") {
    // Parties and "không rõ" (Attr) exclude each other.
    if (Array.isArray(value) || value === undefined) {
      next.refs = (value as string[] | undefined ?? []).slice(0, 2);
      delete next.cells[item.cellId];
    } else {
      next.cells[item.cellId] = value;
      next.refs = [];
    }
    return next;
  }
  const slot = value as SlotValue | undefined;
  if (item.kind === "party") {
    const index = item.scope as number;
    next.parties[index] = { ...(next.parties[index] ?? { cells: {} }), entity: slot?.entity };
    return next;
  }
  const target = item.scope === "outer" ? next.cells : (next.parties[item.scope] ??= { cells: {} }).cells;
  if (slot === undefined) delete target[item.cellId];
  else target[item.cellId] = slot;
  const keys = keysOf(context);
  if (qgroup === "C" && item.cellId === "subject" && item.scope === "outer") {
    if (slot?.entity !== undefined && keys.length === 2) {
      const other = keys.find((key) => key !== slot.entity)!;
      if (!next.cells.object || next.cells.object.entity === slot.entity) next.cells.object = { entity: other };
    }
    if (slot?.option === "subject.both") fillTwoParties(next, keys);
  }
  if (qgroup === "V" && item.cellId === "violator" && item.scope === "outer" && slot?.option === "violator.both") {
    fillTwoParties(next, keys);
  }
  if (qgroup === "Prev" && item.cellId === "party" && item.scope === "outer") {
    if (slot?.option === "party.both") fillTwoParties(next, keys);
    else if (slot?.entity !== undefined) {
      const kept = next.parties.find((party) => party.entity === slot.entity) ?? next.parties[0];
      next.parties = [{ entity: slot.entity, cells: kept?.cells ?? {} }];
    }
  }
  // A parent whose only child is one option takes it at once.
  const after = fields(qgroup, next, context);
  for (const child of after) {
    if (child.kind === "choice" && child.required && child.options.length === 1 && !child.entities
        && !currentValue(next, child)) {
      const cells = child.scope === "outer" ? next.cells : (next.parties[child.scope] ??= { cells: {} }).cells;
      cells[child.cellId] = { option: child.options[0].id };
    }
  }
  return next;
}

function fillTwoParties(state: FormState, keys: string[]) {
  const chosen = state.parties.map((party) => party.entity).filter((key): key is string => !!key && keys.includes(key));
  for (const key of keys) if (chosen.length < 2 && !chosen.includes(key)) chosen.push(key);
  state.parties = [0, 1].map((index) => ({ entity: chosen[index], cells: state.parties[index]?.cells ?? {} }));
}

const suffix = (option: string | undefined) => option?.split(".").slice(1).join(".");

/**
 * What blocks a save, by field key ("" for the form as a whole). Mirrors the
 * database's rules so the annotator sees them next to the cell before sending,
 * plus the C/O rule the database leaves to the form (spec, Non-goals).
 */
export function problems(qgroup: string, state: FormState, context: FormContext): Record<string, string> {
  const out: Record<string, string> = {};
  const visible = fields(qgroup, state, context);
  for (const item of visible) {
    if (item.kind === "refs") {
      const chosen = item.options.some((option) => option.id === state.cells[item.cellId]?.option) || validRefs(state, item).length > 0;
      if (item.required && !chosen) {
        out[item.key] = item.entities?.length === 0 && !item.options.length
          ? "Chưa có bên nào: khai báo các bên ở nhóm E trước." : "Chưa chọn.";
      }
      continue;
    }
    const value = currentValue(state, item);
    if (!value) {
      if (item.required) out[item.key] = item.entities?.length === 0 && !item.options.length
        ? "Chưa có bên nào: khai báo các bên ở nhóm E trước." : "Chưa chọn.";
      continue;
    }
    const selectedIds = value.options ?? (value.option ? [value.option] : []);
    const option = item.options.find((candidate) => candidate.id === value.option);
    const freeTextOption = item.options.find((candidate) => candidate.free_text && selectedIds.includes(candidate.id));
    if (freeTextOption) {
      const text = value.text?.trim() ?? "";
      if (!text) out[item.key] = "Ghi ngắn nội dung cho lựa chọn \"khác\".";
      else if (text.length > MAX_TEXT) out[item.key] = `Tối đa ${MAX_TEXT} ký tự.`;
    }
    if (option?.from_entities && value.entity === undefined) out[item.key] = "Chọn bên.";
  }
  for (const index of [0, 1]) {
    const extra = state.parties[index]?.cells.extra_action;
    const main = state.parties[index]?.cells.main_action;
    const extraField = visible.find((item) => item.key === `${index}.extra_action`);
    if (extraField && extra?.option && suffix(extra.option) === suffix(main?.option)) {
      out[extraField.key] = "Hành động thêm phải khác hành động chính.";
    }
  }
  const partyFields = visible.filter((item) => item.kind === "party");
  if (partyFields.length === 2) {
    const [first, second] = partyFields.map((item) => currentValue(state, item)?.entity);
    if (first !== undefined && first === second) out[partyFields[1].key] = "Hai bên phải khác nhau.";
  }
  const refs = visible.find((item) => item.kind === "refs");
  if (refs && state.refs.length > 2) out[refs.key] = "Chọn tối đa 2 bên.";
  if (qgroup === "O") {
    const level = optionOf(state.cells.level);
    const event = optionOf(context.cause?.event_type as SlotValue | undefined);
    // A C.v1 answer may carry the evasion cells; C.v2 dropped them, and its
    // near miss means no damage at all (C-nguyen-nhan.md), so O must be none.
    const v1Evasion = context.cause?.evader !== undefined;
    const avoided = optionOf(context.cause?.evasion_result as SlotValue | undefined) === "evasion_result.avoided";
    if (event === "event_type.collision" && level === "level.none") {
      out["outer.level"] = "Nhóm C là \"va chạm\" nên mức độ không được là \"không va chạm\".";
    } else if (event === "event_type.near_miss" && v1Evasion && avoided && level && level !== "level.none") {
      out["outer.level"] = "Nhóm C là \"suýt va chạm\", né \"tránh được\" nên mức độ là \"không va chạm\".";
    } else if (event === "event_type.near_miss" && !v1Evasion && level && level !== "level.none" && level !== "level.unclear") {
      out["outer.level"] = "Nhóm C là \"suýt va chạm\" nên mức độ là \"không va chạm\".";
    }
  }
  return out;
}

/** The sentence these choices compose to, or null while they cannot compose one. */
export function preview(qgroup: string, slots: Slots, context: FormContext): string | null {
  try {
    return compose(qgroup, slots, { entities: context.entities, cause: context.cause ?? undefined });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- E entities

const E_BOOK = () => bookOf("E");

/**
 * The E cells shown for an entity, by the codebook's "when" conditions
 * (E.v1.json `when`): size only for bus and truck, dashcam only for a car,
 * no vehicle colour for a car with a dashcam, a pedestrian or an animal,
 * clothing colour for a two-wheeler (motorbike, or electric in E.v2) or a
 * pedestrian, riders for a two-wheeler.
 */
export function entityCells(cells: Cells): CodebookCell[] {
  const book = E_BOOK();
  const type = cells.type?.option;
  const shown = new Set(["type"]);
  if (type === "type.bus" || type === "type.truck") shown.add("size");
  if (type === "type.car") shown.add("dashcam");
  if (type && !["type.pedestrian", "type.animal"].includes(type)
      && !(type === "type.car" && cells.dashcam?.option === "dashcam.yes")) shown.add("vehicle_color");
  const twoWheeler = type === "type.motorbike" || type === "type.electric_two_wheeler"; // E.v2 adds the electric one
  if (twoWheeler || type === "type.pedestrian") shown.add("clothing_color");
  if (twoWheeler) shown.add("riders");
  return book.cells.filter((cell) => shown.has(cell.id));
}

/** An entity's cells as the entities route takes them: shown cells only, trimmed free text. */
export function buildEntityCells(cells: Cells): Cells {
  const out: Cells = {};
  for (const cell of entityCells(cells)) {
    const value = cells[cell.id];
    const option = cell.options?.find((candidate) => candidate.id === value?.option);
    if (!option) continue;
    out[cell.id] = option.free_text ? { option: option.id, text: (value?.text ?? "").trim() } : { option: option.id };
  }
  return out;
}

/** What blocks saving the entity list, by "<key>.<cell>". */
export function entityProblems(entities: Entity[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entity of entities) {
    const cells = buildEntityCells(entity.cells as Cells);
    if (!cells.type) out[`${entity.key}.type`] = "Chưa chọn loại.";
    else if (cells.type.text !== undefined && !cells.type.text) out[`${entity.key}.type`] = "Ghi ngắn loại cho lựa chọn \"khác\".";
    else if ((cells.type.text?.length ?? 0) > MAX_TEXT) out[`${entity.key}.type`] = `Tối đa ${MAX_TEXT} ký tự.`;
  }
  return out;
}

/** The first free capital letter, for a new entity. */
export function nextEntityKey(keys: string[]): string | null {
  for (let code = 65; code <= 90; code += 1) {
    const key = String.fromCharCode(code);
    if (!keys.includes(key)) return key;
  }
  return null;
}

/** A short name for pickers: "A · xe máy màu đỏ". */
export function entityLabel(entity: Entity): string {
  try {
    const phrase = compose("E", { entities: [{ key: entity.key, cells: buildEntityCells(entity.cells as Cells) }] });
    return `${entity.key} · ${phrase.charAt(0).toLowerCase()}${phrase.slice(1).replace(/\.$/, "")}`;
  } catch {
    return entity.key;
  }
}

// ---------------------------------------------------------------- 422 codes

const ID_PATTERN = /\b([a-z_]+\.[a-z0-9_]+(?:\.[a-z0-9_]+)?)\b/;

function cellLabel(qgroup: string, cellId: string | undefined): string | undefined {
  if (!cellId) return undefined;
  try {
    return cellOf(bookOf(qgroup), cellId).label;
  } catch {
    return undefined;
  }
}

function optionLabel(qgroup: string, optionId: string | undefined): string | undefined {
  if (!optionId) return undefined;
  const book = getCodebook(currentVersion(qgroup) ?? "");
  return book?.cells.flatMap((cell) => cell.options ?? []).find((option) => option.id === optionId)?.label;
}

/**
 * The Vietnamese text of a refused save, and the cell it is about when the
 * error names one. Route and compose errors are already Vietnamese and are
 * kept; database errors ("Slot answer: ...", English, with the rule in
 * HINT, which the route passes on as `code`) are translated by their code.
 */
export function errorText(qgroup: string, code: string | undefined, message: string | undefined): { message: string; cellId?: string } {
  const raw = message ?? "";
  const english = /^(Slot|Text) answer:/.test(raw);
  const cellId = /cell (\w+)/.exec(raw)?.[1] ?? /no cell (\w+)/.exec(raw)?.[1];
  const option = ID_PATTERN.exec(raw.replace(/^(Slot|Text) answer:/, ""))?.[1];
  const optionCell = option?.split(".")[0];
  const label = cellLabel(qgroup, cellId) ?? cellLabel(qgroup, optionCell);
  const named = label ? ` "${label}"` : "";
  const target = cellId ?? (cellLabel(qgroup, optionCell) ? optionCell : undefined);
  if (!english && raw) return { message: raw, cellId: target };
  const text: Record<string, string> = {
    missing_cell: `Chưa chọn ô${named}.`,
    unknown_cell: `Ô${named} không dùng với lựa chọn hiện tại.`,
    unexpected_cell: `Ô${named} phải để trống với lựa chọn hiện tại.`,
    conditional_cell: `Ô${named} phải để trống với lựa chọn hiện tại.`,
    unknown_option: `Lựa chọn không thuộc ô${named}. Tải lại trang rồi chọn lại.`,
    wrong_parent: `"${optionLabel(qgroup, option) ?? option ?? ""}" không thuộc lựa chọn ở ô cha; chọn lại${named ? ` ô${named}` : ""}.`,
    unknown_entity: "Có bên chưa được khai báo ở nhóm E. Lưu nhóm E trước.",
    unexpected_entity: `Ô${named} không chọn bên.`,
    missing_entity: `Chọn bên cho "${optionLabel(qgroup, option) ?? "lựa chọn này"}".`,
    missing_text: "Ghi ngắn nội dung cho lựa chọn \"khác\".",
    unexpected_text: `Ô${named} không ghi chữ.`,
    text_too_long: `Chữ ghi ở lựa chọn "khác" dài quá ${MAX_TEXT} ký tự.`,
    must_differ: "Hành động thêm phải khác hành động chính.",
    parties: "Chọn đúng các bên: \"cả hai bên\" là hai bên khác nhau đã khai báo ở nhóm E.",
    per_party: "Với \"cả hai bên\", mỗi bên một ô hành động.",
    cause_missing: "Lưu nhóm C trước khi lưu nhóm R.",
    keyframes: "Đặt đủ 2 keyframe: start trước end.",
    missing_slots: "Chưa chọn ô nào.",
    missing_answer: "Chưa ghép được câu từ các ô đã chọn.",
    codebook_version: "Codebook đã đổi. Tải lại trang.",
    stale_page: "Trang này đã cũ. Tải lại trang.",
    text_group: "Nhóm này trả lời bằng chữ, không chọn ô.",
    slot_group: "Nhóm này trả lời bằng ô. Tải lại trang.",
    unexpected_slots: "Câu trả lời dạng chữ không gửi ô. Tải lại trang.",
    reason: "Câu trả lời dạng ô không mang lý do. Tải lại trang.",
    entity_key: "Mỗi bên là một chữ cái in hoa khác nhau.",
    forbidden: "Video này không được giao cho bạn dạng chọn ô.",
    adjudicated: "Câu này đã được thống nhất, không sửa được nữa.",
    invalid_value: "Dữ liệu ô không hợp lệ. Tải lại trang rồi chọn lại.",
  };
  return { message: text[code ?? ""] ?? `Không lưu được (${code ?? "lỗi"}). Tải lại trang rồi thử lại.`, cellId: target };
}

/** Whether two slot payloads are the same, whatever their key order (stored jsonb has its own). */
export function sameSlots(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).sort(([x], [y]) => x.localeCompare(y)).map(([key, item]) => [key, canonical(item)]))
      : value;
  return JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null));
}
