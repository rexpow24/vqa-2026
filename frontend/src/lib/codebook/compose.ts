// Composes the answer sentence of a slot answer from its cells.
//
// The one implementation of the guideline sentence patterns: the save routes
// call it to write qa_annotations.edited_answer (clients never send a
// sentence), and the slot form calls it for the preview. Pure: no I/O, only
// the codebooks bundled beside it. Only patterns from a codebook's own
// `template`/`templates` are used, never a sentence invented here.
//
// Two generations of codebook. The v1 books (and every E, O, R, Prev book)
// carry their patterns as guideline prose ("[Chủ thể] [hành động]"), which the
// functions below follow by hand. Books from codebook v2 on (S.v2, C.v2, V.v2,
// Attr.v1) write their patterns with `{name}` placeholders, rendered by
// `render`: the connecting words live in the codebook, so rewording a sentence
// is a change of data, while which pattern applies and what fills each
// placeholder stays here.

import { currentVersion, getCodebook, type Codebook, type CodebookOption } from "./index.ts";

/** One cell value: `{ option }`, `{ options }`, `{ entity }`, or both, plus `text` for free-text options. */
export type SlotValue = { option?: string; options?: string[]; entity?: string; text?: string };
export type Slots = Record<string, unknown>;
/** An entity as declared in E: its key and its E cells. */
export type Entity = { key: string; cells: Slots };
/**
 * `entities`: the annotator's E list on this video, which every entity reference is named from.
 * `cause`: the cells of the annotator's C answer on this video, which R takes its subject and object from.
 */
export type ComposeContext = { version?: string; entities?: Entity[]; cause?: Slots };

/** Input the sentence cannot be built from. `code` is machine-readable, `message` is for the annotator. */
export class ComposeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ComposeError";
  }
}

function codebookFor(qgroup: string, context: ComposeContext): Codebook {
  const version = context.version ?? currentVersion(qgroup);
  const book = version ? getCodebook(version) : undefined;
  if (!book || book.group !== qgroup) {
    throw new ComposeError("codebook_version", `Nhóm ${qgroup} không có codebook ${version ?? ""}.`.trim());
  }
  return book;
}

function chosenOption(book: Codebook, cellId: string, value: unknown): CodebookOption {
  const cell = book.cells.find((candidate) => candidate.id === cellId);
  const optionId = (value as SlotValue | undefined)?.option;
  if (!cell) throw new ComposeError("unknown_cell", `Ô "${cellId}" không có trong codebook ${book.group}.`);
  if (!optionId) throw new ComposeError("missing_cell", `Chưa chọn ô "${cell.label}".`);
  const option = cell.options?.find((candidate) => candidate.id === optionId);
  if (!option) throw new ComposeError("unknown_option", `Lựa chọn "${optionId}" không thuộc ô "${cell.label}".`);
  return option;
}

/**
 * The words to print for a chosen option: the annotator's own words for a
 * free-text "khác", else the option's `phrase` when the codebook gives one
 * for the sentence (C.v2 "tốc độ cao" reads "chạy tốc độ cao"), else its label.
 */
function labelOf(option: CodebookOption, value: unknown): string {
  const text = (value as SlotValue | undefined)?.text?.trim();
  if (option.free_text && text) return text;
  return typeof option.phrase === "string" ? option.phrase : option.label;
}

/** The label of an optional cell, or null when it is empty or "không rõ" (guideline: drop that part). */
function clearLabel(book: Codebook, cells: Slots, cellId: string): string | null {
  if (cells[cellId] === undefined) return null;
  const option = chosenOption(book, cellId, cells[cellId]);
  return option.id.endsWith(".unclear") ? null : labelOf(option, cells[cellId]);
}

export const UNDETERMINED = "Không thể xác định.";

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Joins the parts that are left with commas; with no part left the answer cannot be determined. */
function sentence(clauses: (string | null)[]): string {
  const kept = clauses.filter((clause): clause is string => Boolean(clause));
  return kept.length ? `${capitalize(kept.join(", "))}.` : UNDETERMINED;
}

/** Whether a book writes its patterns with `{name}` placeholders (codebook v2 on). */
function placeholders(book: Codebook): boolean {
  return Boolean(book.templates?.some((template) => template.text.includes("{")));
}

const PLACEHOLDER = /\{(\w+)\}/g;
const missing = (values: Record<string, string | null | undefined>, name: string) => !values[name];

/**
 * Renders a codebook pattern written with `{name}` placeholders:
 * - `( ... )` is an optional part, dropped whole when any placeholder in it is empty;
 * - the pattern is split into parts at ", " and "; "; a part whose placeholders
 *   are all empty is dropped (guideline rule: an empty or unclear cell drops
 *   its part), and an empty placeholder in a kept part is left out;
 * - the first letter is capitalised and the closing full stop kept; with no
 *   part left the answer cannot be determined.
 * Values are filled in after the pattern is split, so a label holding a comma
 * ("đi sai làn, lấn làn") never splits a part.
 */
export function render(pattern: string, values: Record<string, string | null | undefined>): string {
  const body = pattern.trim().replace(/\.$/, "").replace(/\(([^()]*)\)/g, (_, inner: string) =>
    [...inner.matchAll(PLACEHOLDER)].some(([, name]) => missing(values, name)) ? "" : inner);
  const pieces = body.split(/(, |; )/);
  const kept: string[] = [];
  for (let index = 0; index < pieces.length; index += 2) {
    const part = pieces[index];
    const names = [...part.matchAll(PLACEHOLDER)].map(([, name]) => name);
    if (names.length && names.every((name) => missing(values, name))) continue;
    const text = part.replace(PLACEHOLDER, (_, name: string) => values[name] ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    kept.push(kept.length ? `${pieces[index - 1] ?? ", "}${text}` : text);
  }
  return kept.length ? `${capitalize(kept.join(""))}.` : UNDETERMINED;
}

/** A fixed sentence of the codebook, by its case name. */
function templateText(book: Codebook, name: string): string {
  const found = book.templates?.find((template) => template.case === name);
  if (!found) throw new ComposeError("unsupported_group", `Codebook ${book.group} không có mẫu "${name}".`);
  return found.text;
}

/**
 * One E phrase, by the codebook's case for the entity's type
 * (E-thuc-the.md, "Mẫu câu"), split into a core and the rest: the core is the
 * entity's name in every other group, and two entities whose cores are equal
 * get their letter right after it ("xe máy màu trắng A").
 */
function entityPhrase(book: Codebook, cells: Slots): { core: string; rest: string } {
  const type = chosenOption(book, "type", cells.type);
  // E.v6 asks no colour (features/e-v6-no-colors); a party stored under an
  // older book keeps its colour cells, which the current book cannot name, so
  // a cell the book does not define is left out instead of refused.
  const defined = (cellId: string) => book.cells.some((cell) => cell.id === cellId);
  const color = defined("vehicle_color") ? clearLabel(book, cells, "vehicle_color") : null;
  const colored = (name: string) => (color ? `${name} màu ${color}` : name);
  const clothing = defined("clothing_color") ? clearLabel(book, cells, "clothing_color") : null;
  switch (type.id) {
    case "type.car": {
      const dashcamChoice = (cells.dashcam as SlotValue | undefined)?.option;
      const dashcam = dashcamChoice === "dashcam.yes" ? "(có camera hành trình)"
        : dashcamChoice === "dashcam.no" ? "(không có camera hành trình)" : "";
      return { core: [dashcamChoice === "dashcam.yes" ? "xe ô tô" : colored("xe ô tô"), dashcam].filter(Boolean).join(" "), rest: "" };
    }
    case "type.bus":
    case "type.truck": { // "Xe khách, xe tải": [1] [2] màu [4]
      const size = clearLabel(book, cells, "size");
      return { core: colored(size ? `${type.label} ${size}` : type.label), rest: "" };
    }
    case "type.motorbike":
      return { core: colored(type.label), rest: "" };
    case "type.bicycle":
      return { core: type.label, rest: "" };
    case "type.pedestrian":
      return { core: clothing ? `người đi bộ mặc áo ${clothing}` : "người đi bộ", rest: "" };
    case "type.animal": // "Động vật"
      return { core: "động vật", rest: "" };
    default: // "Xe cứu thương, xe ba gác, khác": [1] màu [4]
      return { core: colored(labelOf(type, cells.type)), rest: "" };
  }
}

/** Every entity's phrase in key order, with its name (the core, plus the letter when cores collide). */
function entityPhrases(entities: Entity[]) {
  const book = getCodebook(currentVersion("E")!)!;
  const phrases = [...entities].sort((a, b) => a.key.localeCompare(b.key))
    .map(({ key, cells }) => ({ key, ...entityPhrase(book, cells) }));
  return phrases.map((phrase) => ({ ...phrase,
    name: phrases.filter((other) => other.core === phrase.core).length > 1 ? `${phrase.core} ${phrase.key}` : phrase.core }));
}

/** Names entity references (`{ entity: "B" }`) from the annotator's E list. */
function namer(context: ComposeContext) {
  const names = new Map(entityPhrases(context.entities ?? []).map((phrase) => [phrase.key, phrase.name]));
  return (value: unknown): string => {
    const key = (value as SlotValue | undefined)?.entity;
    const name = key === undefined ? undefined : names.get(key);
    if (name === undefined) throw new ComposeError("unknown_entity", `Bên ${key ?? "?"} chưa được khai báo ở nhóm E.`);
    return name;
  };
}

/** E: the entities in key order, joined with commas; none declared cannot be determined. */
function composeEntities(slots: Slots): string {
  const entities = Array.isArray(slots.entities) ? slots.entities as Entity[] : [];
  return entities.length
    ? `${capitalize(entityPhrases(entities).map(({ name, rest }) => `${name}${rest}`).join(", "))}.`
    : UNDETERMINED;
}

/**
 * C, "Va chạm" and "Suýt va chạm": [Chủ thể] [hành động] (và [tốc độ]),
 * [quan hệ] [đối tượng], then "dẫn đến va chạm" or [bên né] phải [cách né],
 * [kết quả né]. The relation comes from the conflict type; an empty or unclear
 * cell drops its part (guideline rule), and a type without relation (K18)
 * drops the object part.
 */
function composeCause(book: Codebook, slots: Slots, context: ComposeContext): string {
  if (placeholders(book)) return composeCauseV2(book, slots, context);
  const name = namer(context);
  const event = chosenOption(book, "event_type", slots.event_type);
  const subjectValue = slots.subject as SlotValue | undefined;
  if (subjectValue?.option === "subject.both") return composeBothParties(book, slots, name, event);
  let subject: string | null = null;
  if (subjectValue?.entity !== undefined) subject = name(subjectValue);
  else chosenOption(book, "subject", subjectValue);
  const conflict = chosenOption(book, "conflict_type", slots.conflict_type);
  const action = slots.action === undefined ? null : chosenOption(book, "action", slots.action).label;
  const speed = clearLabel(book, slots, "speed");
  const relation = typeof conflict.relation === "string" && conflict.relation !== "không có" ? conflict.relation : null;
  const object = slots.object === undefined ? null : name(slots.object);
  const head = [subject, action].filter(Boolean).join(" ");
  const clauses = [head ? `${head}${speed ? ` và ${speed}` : ""}` : null,
    relation && object ? `${relation} ${object}` : null];
  if (event.id === "event_type.collision") clauses.push("dẫn đến va chạm");
  if (event.id === "event_type.near_miss") {
    const evaderValue = slots.evader as SlotValue | undefined;
    const evader = evaderValue === undefined ? null
      : evaderValue.entity !== undefined ? name(evaderValue) : chosenOption(book, "evader", evaderValue).label;
    const evasion = clearLabel(book, slots, "evasion");
    clauses.push(evasion ? [evader, `phải ${evasion}`].filter(Boolean).join(" ") : null);
    const result = slots.evasion_result === undefined ? null : chosenOption(book, "evasion_result", slots.evasion_result);
    clauses.push(result?.from_entities ? `chạm vào ${name(slots.evasion_result)}` : result?.label ?? null);
  }
  return sentence(clauses);
}

/**
 * C, "Cả A và B": [A] [hành động của A], đồng thời [B] [hành động của B], đi
 * vào đường đi của nhau, dẫn đến [va chạm hoặc suýt va chạm]. A and B are the
 * two parties in E key order, whatever their order in `parties`; an unclear
 * event drops the last part, as an unclear cell drops its part elsewhere.
 */
function composeBothParties(book: Codebook, slots: Slots, name: (value: unknown) => string, event: CodebookOption): string {
  const parties = Array.isArray(slots.parties) ? slots.parties as Slots[] : [];
  const keys = parties.map((party) => (party.party as SlotValue | undefined)?.entity);
  if (parties.length !== 2 || keys.some((key) => key === undefined) || keys[0] === keys[1]) {
    throw new ComposeError("parties", "Chọn \"cả hai bên\" thì khai báo đúng hai bên khác nhau, mỗi bên một hành động.");
  }
  chosenOption(book, "conflict_type", slots.conflict_type);
  const [first, second] = [...parties]
    .sort((a, b) => (a.party as SlotValue).entity!.localeCompare((b.party as SlotValue).entity!))
    .map((party) => [name(party.party), party.action === undefined ? null : chosenOption(book, "action", party.action).label]
      .filter(Boolean).join(" "));
  return sentence([first, `đồng thời ${second}`, "đi vào đường đi của nhau",
    event.id === "event_type.unclear" ? null : `dẫn đến ${event.label}`]);
}

/** Two distinct parties, with entity references first and explicitly allowed non-entity options last. */
function twoParties(slots: Slots, message: string, options: CodebookOption[] = []): Slots[] {
  const parties = Array.isArray(slots.parties) ? slots.parties as Slots[] : [];
  const keyOf = (party: Slots) => {
    const value = party.party as SlotValue | undefined;
    if (!value || Object.keys(value).length !== 1) return undefined;
    if (typeof value.entity === "string") return `entity:${value.entity}`;
    if (options.some((option) => option.id === value.option)) return `option:${value.option}`;
    return undefined;
  };
  const keys = parties.map(keyOf);
  if (parties.length !== 2 || keys.some((key) => key === undefined) || keys[0] === keys[1]) {
    throw new ComposeError("parties", message);
  }
  return [...parties].sort((a, b) => keyOf(a)!.localeCompare(keyOf(b)!));
}

const EVENT_CASE: Record<string, string> = {
  "event_type.collision": "Va chạm", "event_type.near_miss": "Suýt va chạm", "event_type.unclear": "Không rõ loại sự kiện",
};

/**
 * C from codebook v2: the pattern of the event type ("Va chạm", "Suýt va
 * chạm", "Không rõ loại sự kiện"), or its "Cả A và B" counterpart for
 * subject.both. The relation comes from the conflict type and is left out
 * with the object it relates to (K18 has none).
 */
function composeCauseV2(book: Codebook, slots: Slots, context: ComposeContext): string {
  const name = namer(context);
  const event = chosenOption(book, "event_type", slots.event_type);
  const conflict = chosenOption(book, "conflict_type", slots.conflict_type);
  const action = (cells: Slots) => cells.action === undefined ? null : labelOf(chosenOption(book, "action", cells.action), cells.action);
  const subjectValue = slots.subject as SlotValue | undefined;
  if (subjectValue?.option === "subject.both") {
    const [first, second] = twoParties(slots, "Chọn \"cả hai bên\" thì khai báo đúng hai bên khác nhau, mỗi bên một hành động.");
    return render(templateText(book, `Cả A và B, ${EVENT_CASE[event.id].toLowerCase()}`), {
      A: name(first.party), action_A: action(first), B: name(second.party), action_B: action(second),
    });
  }
  let subject: string | null = null;
  if (subjectValue?.entity !== undefined) subject = name(subjectValue);
  else chosenOption(book, "subject", subjectValue);
  const object = slots.object === undefined ? null : name(slots.object);
  const relation = typeof conflict.relation === "string" && conflict.relation !== "không có" && object ? conflict.relation : null;
  return render(templateText(book, EVENT_CASE[event.id]), {
    subject, action: action(slots), speed: clearLabel(book, slots, "speed"), relation, object,
  });
}

/**
 * V: "Có" is [bên vi phạm] [hành vi]; the other two results are fixed
 * sentences. V.v2 adds "cả hai bên", V.v3 allows multiple behaviour tags,
 * and V.v4 can state that no animal handler is visible. Additional behavior is optional.
 */
function composeViolation(book: Codebook, slots: Slots, context: ComposeContext): string {
  if (book.version < 8) return composeViolationLegacy(book, slots, context);
  const additions = slots.additional_behavior as SlotValue | undefined;
  const additionIds = additions?.options ?? (additions?.option ? [additions.option] : []);
  const actor = slots.additional_violator;
  if (additionIds.length && !(actor as SlotValue | undefined)?.entity) {
    throw new ComposeError("parties", "Chọn bên thực hiện hành vi bổ sung.");
  }
  const base = { ...slots };
  delete base.additional_violator;
  delete base.additional_behavior;
  const result = chosenOption(book, "result", base.result);
  if (result.id !== "result.yes") return composeViolationLegacy(book, base, context);
  const baseActor = base.violator as SlotValue | undefined;
  const mirroredAddition = baseActor?.entity === (actor as SlotValue | undefined)?.entity
    && JSON.stringify((base.behavior as SlotValue | undefined)?.options ?? [(base.behavior as SlotValue | undefined)?.option].filter(Boolean))
      === JSON.stringify(additionIds);
  const core = !mirroredAddition ? composeViolationLegacy(book, base, context) : "";
  if (!additionIds.length) return core || templateText(book, "Không rõ");
  const cell = book.cells.find((candidate) => candidate.id === "additional_behavior");
  if (!cell) throw new ComposeError("unknown_cell", "Thiếu ô hành vi bổ sung trong codebook V.");
  const labels = [...new Set(additionIds)].map((id) => {
    const option = cell.options?.find((candidate) => candidate.id === id);
    if (!option) throw new ComposeError("unknown_option", `Lựa chọn "${id}" không thuộc ô hành vi bổ sung.`);
    return labelOf(option, { ...additions, option: id });
  });
  const addition = `${namer(context)(actor)} có hành vi bổ sung: ${labels.join(", ")}`;
  return core ? `${core.replace(/\.$/, "")}; ngoài ra, ${addition}.` : `${capitalize(addition)}.`;
}

function composeViolationLegacy(book: Codebook, slots: Slots, context: ComposeContext): string {
  const result = chosenOption(book, "result", slots.result);
  if (result.id === "result.none_observed") return templateText(book, "Không quan sát thấy");
  if (result.id !== "result.yes") return templateText(book, "Không rõ");
  if (placeholders(book)) {
    const name = namer(context);
    const behavior = (cells: Slots) => {
      const cell = book.cells.find((candidate) => candidate.id === "behavior");
      if (!cell) throw new ComposeError("unknown_cell", `Ô "behavior" không có trong codebook ${book.group}.`);
      const value = cells.behavior as SlotValue | undefined;
      const ids = cell.multiple
        ? value?.options ?? (value?.option ? [value.option] : [])
        : value?.option ? [value.option] : [];
      if (!ids.length) throw new ComposeError("missing_cell", `Chưa chọn ô "${cell.label}".`);
      const uniqueIds = [...new Set(ids)];
      if (uniqueIds.length !== ids.length) {
        throw new ComposeError("invalid_value", `Ô "${cell.label}" có lựa chọn trùng nhau.`);
      }
      const order = new Map((cell.options ?? []).map((option, index) => [option.id, index]));
      uniqueIds.sort((left, right) => (order.get(left) ?? Number.MAX_SAFE_INTEGER) - (order.get(right) ?? Number.MAX_SAFE_INTEGER));
      const options = uniqueIds.map((id) => {
        const option = cell.options?.find((candidate) => candidate.id === id);
        if (!option) throw new ComposeError("unknown_option", `Lựa chọn "${id}" không thuộc ô "${cell.label}".`);
        return labelOf(option, { ...value, option: id });
      });
      return options.length === 1 ? options[0] : `${options.slice(0, -1).join(", ")} và ${options[options.length - 1]}`;
    };
    if ((slots.violator as SlotValue | undefined)?.option === "violator.both") {
      const cell = book.cells.find((candidate) => candidate.id === "violator");
      const options = (cell?.options ?? []).filter((option) => cell?.per_party_options?.includes(option.id));
      const partyName = (value: unknown) => {
        const option = options.find((candidate) => candidate.id === (value as SlotValue | undefined)?.option);
        return option ? String(option.party_label ?? option.label) : name(value);
      };
      const [first, second] = twoParties(slots, "Chọn \"cả hai bên\" thì khai báo đúng hai bên khác nhau, mỗi bên một hành vi.", options);
      const [a, b] = [behavior(first), behavior(second)];
      return a === b
        ? render(templateText(book, "Có, cả hai bên cùng hành vi"), { A: partyName(first.party), B: partyName(second.party), behavior: a })
        : render(templateText(book, "Có, cả hai bên"), { A: partyName(first.party), behavior_A: a, B: partyName(second.party), behavior_B: b });
    }
    if ((slots.violator as SlotValue | undefined)?.option === "violator.unidentified") {
      return render(templateText(book, "Có, chưa xác định người điều khiển vật nuôi"), { behavior: behavior(slots) });
    }
    return render(templateText(book, "Có"), { violator: name(slots.violator), behavior: behavior(slots) });
  }
  const behavior = chosenOption(book, "behavior", slots.behavior);
  return sentence([`${namer(context)(slots.violator)} ${labelOf(behavior, slots.behavior)}`]);
}

/**
 * O: "[Chủ thể] và [đối tượng] [1], [2]." with both parties, "[Chủ thể] [2]."
 * with one; no collision and unclear are fixed sentences. `parties` holds the
 * C pair the form fills in: one or two entity references.
 */
function composeOutcome(book: Codebook, slots: Slots, context: ComposeContext): string {
  if (book.version >= 2) return composeOutcomeSigns(book, slots, context);
  const level = chosenOption(book, "level", slots.level);
  if (level.id === "level.none") return templateText(book, "Không va chạm");
  if (level.id === "level.unclear") return templateText(book, "Không rõ");
  const sign = chosenOption(book, "sign", slots.sign).label;
  const name = namer(context);
  const parties = Array.isArray(slots.parties) ? slots.parties.map(name) : [];
  if (parties.length === 1) return sentence([`${parties[0]} ${sign}`]);
  return sentence([parties.length === 2 ? `${parties[0]} và ${parties[1]} ${level.label}` : level.label, sign]);
}

/**
 * O.v2: the sentence checks the level against the signs instead of trusting
 * it: none carries no sign and uses its fixed sentence; a collision level is
 * chosen first and every sign must be a sign of that level
 * (features/o-level-first), and the "giữ thăng bằng" sign stands alone.
 * Signs print in codebook order.
 */
function composeOutcomeSigns(book: Codebook, slots: Slots, context: ComposeContext): string {
  const level = chosenOption(book, "level", slots.level);
  const signCell = book.cells.find((cell) => cell.id === "signs")!;
  const value = slots.signs as SlotValue | undefined;
  const ids = value?.options ?? (value?.option ? [value.option] : []);
  const signs = ids.map((id) => {
    const found = signCell.options?.find((candidate) => candidate.id === id);
    if (!found) throw new ComposeError("unknown_option", `Lựa chọn "${id}" không thuộc ô "${signCell.label}".`);
    return found;
  });
  if (level.id === "level.none") {
    if (signs.length) throw new ComposeError("level_mismatch", `"${level.label}" không đi cùng dấu hiệu nào.`);
    return templateText(book, "Không va chạm");
  }
  if (!signs.length) throw new ComposeError("missing_cell", `Chưa chọn ô "${signCell.label}".`);
  if (signs.length > 1 && signs.some((sign) => sign.exclusive === true)) {
    throw new ComposeError("exclusive_sign", "\"có chạm nhưng các bên vẫn giữ thăng bằng\" không đi cùng dấu hiệu khác.");
  }
  if (signs.some((sign) => sign.level !== level.id)) {
    throw new ComposeError("level_mismatch", "Mọi dấu hiệu đã chọn phải thuộc mức độ đã chọn.");
  }
  const order = (signCell.options ?? []).map((item) => item.id);
  const text = signs.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)).map((sign) => sign.label).join(", ");
  const name = namer(context);
  const parties = Array.isArray(slots.parties) ? slots.parties.map(name) : [];
  // One party takes a colon and no level ("[Chủ thể]: [2]."): the O.v2 sign labels
  // are noun phrases ("người ngã tại chỗ") and cannot follow the party directly.
  if (parties.length === 1) return sentence([`${parties[0]}: ${text}`]);
  return sentence([parties.length === 2 ? `${parties[0]} và ${parties[1]} ${level.label}` : level.label, text]);
}

/**
 * Prev: one main action per party, ordered by entity key and joined with a
 * semicolon; party.unclear is a fixed insufficient-evidence sentence.
 * party.both is never stored: the form sends it as two parties.
 */
function composePrevention(book: Codebook, slots: Slots, context: ComposeContext): string {
  const name = namer(context);
  const parties = Array.isArray(slots.parties) ? slots.parties as Slots[] : [];
  const options = parties.map((party) => (party.party as SlotValue | undefined)?.option).filter(Boolean);
  if (options.length === 1 && options[0] === "party.unclear" && parties.length === 1) {
    return templateText(book, book.version >= 4 ? "C không đủ căn cứ" : "C và Attr đều không rõ");
  }
  if (parties.some((party) => (party.party as SlotValue | undefined)?.entity === undefined)) {
    throw new ComposeError("parties", "Mỗi bên của Prev là một bên đã khai báo ở E; \"không rõ\" là bên duy nhất.");
  }
  const clauses = parties
    .map((party) => ({ key: (party.party as SlotValue).entity!, party }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ party }) => {
      const main = chosenOption(book, "main_action", party.main_action);
      const extra = party.extra_action === undefined ? null : chosenOption(book, "extra_action", party.extra_action);
      const first = labelOf(main, party.main_action);
      const second = extra ? labelOf(extra, party.extra_action) : null;
      // "nên quan sát và nhường đường và giảm tốc" repeats "và": when either
      // action already holds one, the two are joined with ", đồng thời".
      const joiner = second && ` ${first} ${second} `.includes(" và ") ? ", đồng thời " : " và ";
      return `${name(party.party)} nên ${first}${second ? `${joiner}${second}` : ""}`;
    });
  return clauses.length ? `${capitalize(clauses.join("; "))}.` : UNDETERMINED;
}

/**
 * R, from R-ung-xu.md "Mẫu câu": "[Chủ thể] [1], [đối tượng] [2], người và xe
 * xung quanh [3]."; "Các bên [1]." when both parties did the same; "Không thể
 * xác định." without aftermath. An unclear cell drops its part, and
 * "không thấy ai dừng lại" drops the bystanders part (guideline rule).
 * Subject and object are those of the C answer (spec Open 6, decided
 * 2026-11-16): its subject entity and object; for subject.both the first and
 * second party in E key order; for subject.unclear the answer cannot be
 * determined.
 */
function composeAftermath(book: Codebook, slots: Slots, context: ComposeContext): string {
  const aftermath = chosenOption(book, "has_aftermath", slots.has_aftermath);
  if (aftermath.id === "has_aftermath.no") return templateText(book, "Không có đoạn sau");
  const cause = context.cause;
  if (!cause) throw new ComposeError("cause_missing", "Lưu nhóm C trước khi lưu nhóm R.");
  const name = namer(context);
  const causeSubject = cause.subject as SlotValue | undefined;
  let subjectRef: unknown;
  let objectRef: unknown;
  if (causeSubject?.option === "subject.both") {
    const parties = Array.isArray(cause.parties) ? cause.parties as Slots[] : [];
    [subjectRef, objectRef] = parties.map((party) => party.party)
      .sort((a, b) => ((a as SlotValue).entity ?? "").localeCompare((b as SlotValue).entity ?? ""));
  } else if (causeSubject?.entity !== undefined) {
    [subjectRef, objectRef] = [causeSubject, cause.object];
  } else {
    return UNDETERMINED;
  }
  const subject = chosenOption(book, "subject", slots.subject);
  const object = slots.object === undefined ? null : chosenOption(book, "object", slots.object);
  const behaviour = (option: CodebookOption | null) =>
    option && !option.id.endsWith(".unclear") ? option.label : null;
  if (objectRef !== undefined && object && behaviour(subject) && behaviour(object)
      && subject.id.split(".")[1] === object.id.split(".")[1]) {
    return templateText(book, "Hai bên cùng hành vi").replace("[1]", subject.label);
  }
  const bystanders = chosenOption(book, "bystanders", slots.bystanders);
  return sentence([
    behaviour(subject) ? `${name(subjectRef)} ${subject.label}` : null,
    objectRef !== undefined && behaviour(object) ? `${name(objectRef)} ${object!.label}` : null,
    bystanders.id === "bystanders.helped" ? `người và xe xung quanh ${bystanders.label}` : null,
  ]);
}

/** S.v1: one template whose `{cell}` placeholders take the chosen labels, "không rõ" included. */
function composeTemplate(book: Codebook, slots: Slots): string {
  return book.template!.replace(/\{(\w+)\}/g, (_, cellId: string) => chosenOption(book, cellId, slots[cellId]).label);
}

/**
 * S from v2 on: every cell is required and checked, and an unclear one
 * leaves its part out as in every other group (S.v1 printed "không rõ", which
 * read badly: "Trời không rõ, không rõ, ...").
 */
function composeScene(book: Codebook, slots: Slots): string {
  const values = Object.fromEntries(book.cells.map((cell) => {
    chosenOption(book, cell.id, slots[cell.id]);
    return [cell.id, clearLabel(book, slots, cell.id)];
  }));
  return render(templateText(book, "Mặc định"), values);
}

/**
 * Attr: the one or two parties that contributed most, in E key order, or
 * "không rõ". Since codebook v2 it is chosen here, not copied from the C subject.
 */
function composeAttribution(book: Codebook, slots: Slots, context: ComposeContext): string {
  const value = slots.parties;
  const name = namer(context);
  if (!Array.isArray(value)) {
    if ((value as SlotValue | undefined)?.entity !== undefined) return render(templateText(book, "Một bên"), { A: name(value) });
    chosenOption(book, "parties", value);
    return templateText(book, "Không rõ");
  }
  const keys = value.map((ref) => (ref as SlotValue | undefined)?.entity);
  if (!value.length || value.length > 2 || keys.some((key) => key === undefined) || keys[0] === keys[1]) {
    throw new ComposeError("parties", "Chọn một hoặc hai bên khác nhau đã khai báo ở nhóm E, hoặc \"không rõ\".");
  }
  const names = [...value].sort((a, b) => (a as SlotValue).entity!.localeCompare((b as SlotValue).entity!)).map(name);
  return names.length === 1 ? render(templateText(book, "Một bên"), { A: names[0] })
    : render(templateText(book, "Hai bên"), { A: names[0], B: names[1] });
}

/** The answer sentence for these cells, by the group's guideline pattern. */
export function compose(qgroup: string, slots: Slots, context: ComposeContext = {}): string {
  const book = codebookFor(qgroup, context);
  if (book.template) return composeTemplate(book, slots);
  switch (qgroup) {
    case "S": return composeScene(book, slots);
    case "Attr": return composeAttribution(book, slots, context);
    case "E": return composeEntities(slots);
    case "C": return composeCause(book, slots, context);
    case "V": return composeViolation(book, slots, context);
    case "O": return composeOutcome(book, slots, context);
    case "R": return composeAftermath(book, slots, context);
    case "Prev": return composePrevention(book, slots, context);
    default: throw new ComposeError("unsupported_group", `Chưa ghép được câu cho nhóm ${qgroup}.`);
  }
}
