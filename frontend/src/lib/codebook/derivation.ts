import { currentVersion, getCodebook } from "./index.ts";
import type { Entity, SlotValue, Slots } from "./compose.ts";

const option = (value: unknown) => (value as SlotValue | undefined)?.option;
const entity = (value: unknown) => (value as SlotValue | undefined)?.entity;
const animals = (entities: Entity[]) => new Set(entities.filter((item) =>
  option(item.cells.type) === "type.animal").map((item) => item.key));

function cCode(cause: Slots) {
  const cell = getCodebook(currentVersion("C") ?? "")?.cells.find((item) => item.id === "conflict_type");
  return cell?.options?.find((item) => item.id === option(cause.conflict_type))?.code;
}

/** Infer only the explicitly coded wrong-way event; all other C cases lack legal context. */
export function deriveViolation(cause: Slots | null | undefined, entities: Entity[], saved?: Slots | null): Slots {
  const nonAnimal = new Set(entities.map((item) => item.key).filter((key) => !animals(entities).has(key)));
  const core: Slots = { result: { option: "result.unclear" } };
  if (cause && cCode(cause) === "K09") {
    const subject = cause.subject as SlotValue | undefined;
    if (subject?.entity && nonAnimal.has(subject.entity)) {
      core.result = { option: "result.yes" };
      core.violator = { entity: subject.entity };
      core.behavior = { option: "behavior.wrong_way" };
    } else if (subject?.option === "subject.both") {
      const parties = (Array.isArray(cause.parties) ? cause.parties : []) as Slots[];
      const wrongWay = parties.map((party) => ({
        entity: entity(party.party),
        action: option(party.action),
      })).filter((item) => item.entity && nonAnimal.has(item.entity) && item.action === "action.k09.wrong_way_straight");
      if (wrongWay.length === 2) {
        core.result = { option: "result.yes" };
        core.violator = { option: "violator.both" };
        core.parties = wrongWay.map((item) => ({ party: { entity: item.entity }, behavior: { option: "behavior.wrong_way" } }));
      } else if (wrongWay.length === 1) {
        core.result = { option: "result.yes" };
        core.violator = { entity: wrongWay[0].entity };
        core.behavior = { option: "behavior.wrong_way" };
      }
    }
  }
  const additions: Slots = {};
  const actor = saved?.additional_violator as SlotValue | undefined;
  const behavior = saved?.additional_behavior as SlotValue | undefined;
  const validActor = !!actor?.entity && nonAnimal.has(actor.entity);
  const behaviorIds = behavior?.options ?? (behavior?.option ? [behavior.option] : []);
  if (validActor && behaviorIds.length) {
    additions.additional_violator = { entity: actor!.entity };
    additions.additional_behavior = { options: [...new Set(behaviorIds)] };
    if (option(core.result) !== "result.yes") {
      // V's existing database rule requires violator + behavior for result.yes.
      // Mirror user-added evidence in those slots while keeping editable additions separate.
      core.result = { option: "result.yes" };
      core.violator = { entity: actor!.entity };
      core.behavior = { options: [...new Set(behaviorIds)] };
    }
  }
  return { ...core, ...additions };
}

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

/** The sign options of O.v2, in codebook order, each with the level it stands for. */
function outcomeSigns(): { id: string; level: string; exclusive: boolean }[] {
  const cell = getCodebook(currentVersion("O") ?? "")?.cells.find((item) => item.id === "signs");
  return (cell?.options ?? []).map((item) => ({ id: item.id, level: String(item.level), exclusive: item.exclusive === true }));
}

/** The rank of an O.v2 level (none 0 ... severe 3). */
function levelRank(level: string): number {
  const cell = getCodebook(currentVersion("O") ?? "")?.cells.find((item) => item.id === "level");
  const rank = cell?.options?.find((item) => item.id === level)?.rank;
  return typeof rank === "number" ? rank : -1;
}

/** The level of a set of O.v2 signs: the highest level among them, or undefined for none. */
export function outcomeLevel(signIds: string[]): string | undefined {
  const levels = outcomeSigns().filter((sign) => signIds.includes(sign.id)).map((sign) => sign.level);
  return levels.reduce<string | undefined>((best, level) =>
    best === undefined || levelRank(level) > levelRank(best) ? level : best, undefined);
}

/** The label of each O.v2 sign's level ("va chạm vừa"), which the form shows as the sign's group. */
export function signLevelLabels(): Record<string, string> {
  const levels = getCodebook(currentVersion("O") ?? "")?.cells.find((item) => item.id === "level")?.options ?? [];
  return Object.fromEntries(outcomeSigns().map((sign) => [sign.id, levels.find((item) => item.id === sign.level)?.label ?? ""]));
}

/** Whether O needs the annotator's signs (a C collision), as opposed to being fully derived from C. */
export function outcomeNeedsAnnotator(cause: Slots | null | undefined): boolean {
  return option(cause?.event_type) === "event_type.collision";
}

/**
 * O.v2 from the caller's C and the signs the annotator ticked (codebook O.v2, `inferred_from`):
 * near miss and a legacy C with an unclear event are "không va chạm" ("không đánh giá" was
 * merged into it, features/o-v2-sign-revision). A collision keeps the known signs in codebook
 * order with the highest of their levels (features/o-signs-max-grouped, after the level-first
 * trial of features/o-level-first). A collision without a sign has no level yet (the save is
 * refused); no C gives null. The level the client sent is never used.
 */
export function deriveOutcome(cause: Slots | null | undefined, submitted: Slots | null | undefined): Slots | null {
  const event = option(cause?.event_type);
  if (!cause || !event) return null;
  if (event !== "event_type.collision") return { level: { option: "level.none" } };
  const value = submitted?.signs as SlotValue | undefined;
  const chosen = new Set(value?.options ?? (value?.option ? [value.option] : []));
  const signs = outcomeSigns().filter((sign) => chosen.has(sign.id)).map((sign) => sign.id);
  const given = Array.isArray(submitted?.parties) ? (submitted!.parties as SlotValue[]).map((ref) => ref?.entity) : [];
  const parties = given.length && given.every((key): key is string => typeof key === "string") ? given : causePair(cause);
  const out: Slots = {};
  const level = outcomeLevel(signs);
  if (level) {
    out.level = { option: level };
    out.signs = { options: signs };
  }
  if (parties.length) out.parties = parties.slice(0, 2).map((key) => ({ entity: key }));
  return out;
}

const PREVENTION: Record<string, string> = {
  "behavior.wrong_way": "main_action.stay_in_lane",
  "behavior.wrong_lane": "main_action.stay_in_lane",
  "behavior.tailgating": "main_action.keep_distance",
  "behavior.red_light": "main_action.obey_signals",
  "behavior.sign_or_marking": "main_action.obey_signals",
  "behavior.fail_to_yield": "main_action.observe_and_yield",
  "behavior.no_helmet": "main_action.wear_helmet",
};

/** Generate Prev only when every attributed behavior maps to one unambiguous action. */
export function derivePrevention(violation: Slots, entities: Entity[]): Slots {
  const participants: { actor?: string; behavior: string }[] = [];
  const add = (actor: string | undefined, value: unknown) => {
    const slot = value as SlotValue | undefined;
    const ids = slot?.options ?? (slot?.option ? [slot.option] : []);
    ids.forEach((behavior) => participants.push({ actor, behavior }));
  };
  if ((violation.violator as SlotValue | undefined)?.option === "violator.both") {
    for (const party of (Array.isArray(violation.parties) ? violation.parties : []) as Slots[]) {
      add(entity(party.party), party.behavior);
    }
  } else {
    add(entity(violation.violator), violation.behavior);
  }
  add(entity(violation.additional_violator), violation.additional_behavior);

  const animalKeys = animals(entities);
  const byActor = new Map<string, Set<string>>();
  for (const participant of participants) {
    if (!participant.actor || animalKeys.has(participant.actor)) return { parties: [{ party: { option: "party.unclear" } }] };
    const action = PREVENTION[participant.behavior];
    if (!action) return { parties: [{ party: { option: "party.unclear" } }] };
    const actions = byActor.get(participant.actor) ?? new Set<string>();
    actions.add(action);
    byActor.set(participant.actor, actions);
  }
  if (!byActor.size || [...byActor.values()].some((actions) => actions.size !== 1)) {
    return { parties: [{ party: { option: "party.unclear" } }] };
  }
  return { parties: [...byActor.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([actor, actions]) => ({
    party: { entity: actor }, main_action: { option: [...actions][0] },
  })) };
}

const entityType = (entities: Entity[], key: string | undefined) => {
  const found = entities.find((item) => item.key === key);
  return found ? option(found.cells.type) : undefined;
};

const uncertainPrevention = (): Slots => ({ parties: [{ party: { option: "party.unclear" } }] });

/**
 * Infer a preventive action from the observed C scenario, not from a legal violation.
 * The mapping is intentionally conservative where a road user's role or cause is unclear.
 */
export function derivePreventionFromCause(cause: Slots | null | undefined, entities: Entity[]): Slots {
  if (!cause) return uncertainPrevention();
  const code = cCode(cause);
  const action = option(cause.action);
  const subject = cause.subject as SlotValue | undefined;
  const object = cause.object as SlotValue | undefined;
  const nameFor = (key: string | undefined) => entities.some((item) => item.key === key) ? key : undefined;
  const one = (actor: string | undefined, prevention: string): Slots => actor
    ? { parties: [{ party: { entity: actor }, main_action: { option: prevention } }] }
    : uncertainPrevention();
  const both = (keys: (string | undefined)[], prevention: string): Slots => {
    const actors = [...new Set(keys.map(nameFor).filter((key): key is string => !!key))].sort();
    return actors.length === 2 ? { parties: actors.map((actor) => ({
      party: { entity: actor }, main_action: { option: prevention },
    })) } : uncertainPrevention();
  };
  const subjectKey = nameFor(subject?.entity);
  const objectKey = nameFor(object?.entity);
  const subjectIsPedestrian = entityType(entities, subjectKey) === "type.pedestrian";
  const objectIsPedestrian = entityType(entities, objectKey) === "type.pedestrian";
  const subjectIsAnimal = entityType(entities, subjectKey) === "type.animal";
  const objectIsAnimal = entityType(entities, objectKey) === "type.animal";

  if (subject?.option === "subject.both") {
    const actors = (Array.isArray(cause.parties) ? cause.parties : []) as Slots[];
    const keys = actors.map((party) => (party.party as SlotValue | undefined)?.entity);
    if (code === "K11") return both(keys, "main_action.slow_down");
    return uncertainPrevention();
  }
  if (!subjectKey) return uncertainPrevention();

  switch (code) {
    case "K01":
    case "K03": return one(subjectKey, "main_action.keep_distance");
    case "K02": return one(objectKey, "main_action.keep_distance");
    case "K04": return one(subjectKey, "main_action.change_lane_safely");
    case "K05": return one(subjectKey, "main_action.overtake_safely");
    case "K06": return one(subjectKey, "main_action.observe_and_yield");
    case "K07": return one(subjectKey, "main_action.check_surroundings");
    case "K08": return one(subjectKey, action === "action.k08.encroach_overtaking"
      ? "main_action.overtake_safely" : "main_action.stay_in_lane");
    case "K09": return one(subjectKey, "main_action.stay_in_lane");
    case "K10": return one(subjectKey, "main_action.observe_and_yield");
    case "K11": return objectKey ? both([subjectKey, objectKey], "main_action.slow_down")
      : one(subjectKey, "main_action.slow_down");
    case "K12":
    case "K13": return one(subjectKey, "main_action.observe_and_yield");
    case "K14":
      // Prev guideline, K14: a pedestrian crossing stops and looks; a vehicle crossing observes
      // and yields. A driver meeting a pedestrian slows down (as in K15); no Prev for an animal.
      if (subjectIsPedestrian) return one(subjectKey, "main_action.stop_and_look");
      if (objectIsPedestrian) return one(subjectKey, "main_action.slow_down");
      if (subjectIsAnimal || objectIsAnimal) return uncertainPrevention();
      return one(subjectKey, "main_action.observe_and_yield");
    case "K15":
      if (subjectIsPedestrian) return one(subjectKey, action === "action.k15.along_road"
        ? "main_action.use_pedestrian_path" : "main_action.stop_and_look");
      if (objectIsPedestrian) return one(subjectKey, "main_action.slow_down");
      return uncertainPrevention();
    case "K16":
      if (subjectIsAnimal) return one(objectKey, "main_action.slow_down");
      if (objectIsAnimal) return one(subjectKey, "main_action.slow_down");
      return uncertainPrevention();
    case "K17": return one(subjectKey, "main_action.check_surroundings");
    case "K18":
    default: return uncertainPrevention();
  }
}
