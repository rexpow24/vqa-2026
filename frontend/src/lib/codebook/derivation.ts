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
