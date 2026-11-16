// Composes the answer sentence of a slot answer from its cells.
//
// The one implementation of the guideline sentence patterns: the save routes
// call it to write qa_annotations.edited_answer (clients never send a
// sentence), and the slot form calls it for the preview. Pure: no I/O, only
// the codebooks bundled beside it. Only patterns from a codebook's own
// `template`/`templates` are used, never a sentence invented here.

import { currentVersion, getCodebook, type Codebook, type CodebookOption } from "./index.ts";

/** One cell value: `{ option }`, `{ entity }`, or both, plus `text` for a free-text option. */
export type SlotValue = { option?: string; entity?: string; text?: string };
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

/** The label to print for a chosen option: the annotator's own words for a free-text "khác". */
function labelOf(option: CodebookOption, value: unknown): string {
  const text = (value as SlotValue | undefined)?.text?.trim();
  return option.free_text && text ? text : option.label;
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
  const color = clearLabel(book, cells, "vehicle_color");
  const colored = (name: string) => (color ? `${name} màu ${color}` : name);
  const clothing = clearLabel(book, cells, "clothing_color");
  switch (type.id) {
    case "type.car": // "Ô tô có camera hành trình" / "Ô tô khác"
      return { core: (cells.dashcam as SlotValue | undefined)?.option === "dashcam.yes"
        ? "xe ô tô (có camera hành trình)" : colored("xe ô tô"), rest: "" };
    case "type.bus":
    case "type.truck": { // "Xe khách, xe tải": [1] [2] màu [4]
      const size = clearLabel(book, cells, "size");
      return { core: colored(size ? `${type.label} ${size}` : type.label), rest: "" };
    }
    case "type.motorbike": { // "Xe máy, xe hai bánh"; riders only from two
      const riders = cells.riders === undefined ? null : chosenOption(book, "riders", cells.riders);
      // "chở [6] người": the count goes before "người", any qualifier after
      // it ("3 trở lên" reads "chở 3 người trở lên").
      const [count, ...qualifier] = riders ? riders.label.split(" ") : [];
      return { core: colored("xe máy"),
        rest: (clothing ? ` do người mặc áo ${clothing} điều khiển` : "")
          + (riders && riders.id !== "riders.one" ? ` chở ${[count, "người", ...qualifier].join(" ")}` : "") };
    }
    case "type.pedestrian": // "Người đi bộ mặc áo [5]"
      return { core: clothing ? `người đi bộ mặc áo ${clothing}` : "người đi bộ", rest: "" };
    case "type.animal": // "Động vật"
      return { core: "động vật", rest: "" };
    default: // "Xe ba gác, khác": [1] màu [4]
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

/** V: "Có" is [bên vi phạm] [hành vi]; the other two results are fixed sentences. */
function composeViolation(book: Codebook, slots: Slots, context: ComposeContext): string {
  const result = chosenOption(book, "result", slots.result);
  if (result.id === "result.none_observed") return templateText(book, "Không quan sát thấy");
  if (result.id !== "result.yes") return templateText(book, "Không rõ");
  const behavior = chosenOption(book, "behavior", slots.behavior);
  return sentence([`${namer(context)(slots.violator)} ${labelOf(behavior, slots.behavior)}`]);
}

/**
 * O: "[Chủ thể] và [đối tượng] [1], [2]." with both parties, "[Chủ thể] [2]."
 * with one; no collision and unclear are fixed sentences. `parties` holds the
 * C pair the form fills in: one or two entity references.
 */
function composeOutcome(book: Codebook, slots: Slots, context: ComposeContext): string {
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
 * Prev: "[Bên] nên [2] (và [3])." per party, in key order, joined with a
 * semicolon; party.unclear is "C và Attr đều không rõ", a fixed sentence.
 * party.both is never stored: the form sends it as two parties.
 */
function composePrevention(book: Codebook, slots: Slots, context: ComposeContext): string {
  const name = namer(context);
  const parties = Array.isArray(slots.parties) ? slots.parties as Slots[] : [];
  const options = parties.map((party) => (party.party as SlotValue | undefined)?.option).filter(Boolean);
  if (options.length === 1 && options[0] === "party.unclear" && parties.length === 1) {
    return templateText(book, "C và Attr đều không rõ");
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
      return `${name(party.party)} nên ${labelOf(main, party.main_action)}`
        + (extra ? ` và ${labelOf(extra, party.extra_action)}` : "");
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

/** S: one template whose `{cell}` placeholders take the chosen labels. */
function composeTemplate(book: Codebook, slots: Slots): string {
  return book.template!.replace(/\{(\w+)\}/g, (_, cellId: string) => chosenOption(book, cellId, slots[cellId]).label);
}

/** The answer sentence for these cells, by the group's guideline pattern. */
export function compose(qgroup: string, slots: Slots, context: ComposeContext = {}): string {
  const book = codebookFor(qgroup, context);
  if (book.template) return composeTemplate(book, slots);
  switch (qgroup) {
    case "E": return composeEntities(slots);
    case "C": return composeCause(book, slots, context);
    case "V": return composeViolation(book, slots, context);
    case "O": return composeOutcome(book, slots, context);
    case "R": return composeAftermath(book, slots, context);
    case "Prev": return composePrevention(book, slots, context);
    default: throw new ComposeError("unsupported_group", `Chưa ghép được câu cho nhóm ${qgroup}.`);
  }
}
