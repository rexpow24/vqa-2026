// The eight active question groups, in the one order the whole system agrees on.
//
// These used to be re-declared in six files -- three under src/ and three
// scripts -- and the admin CSV template kept its prompts in a *separate*
// array matched to the codes by position, so reordering one list silently
// paired every question with the wrong group. Code, Vietnamese name and
// prompt now travel together in qgroups.json, which the scripts read as JSON
// too, so there is exactly one place to edit.
//
// V remains in the database only for historical records and is no longer
// included in active assignments. New imports and the UI use this list.

import data from "./qgroups.json" with { type: "json" };

// `keyframes` marks the groups whose answer rests on one event (C, V, Attr):
// annotators mark exactly two frames there, the event's start and end.
// The others describe the whole clip, where frames carry no evidence.
// The database trigger keeps its own copy of this list; change both together.
export type QGroup = { code: string; name: string; question: string; keyframes: boolean };

export const QGROUPS: readonly QGroup[] = data;
export const GROUP_CODES: readonly string[] = QGROUPS.map((group) => group.code);
export const GROUP_NAMES: Readonly<Record<string, string>> =
  Object.fromEntries(QGROUPS.map((group) => [group.code, group.name]));

/**
 * The full name a card shows for a group ("Hậu quả" for O). `video_drafts.group_name`
 * is whatever the importing CSV or script wrote (the local review seed wrote the
 * code itself), so the configured name wins and the stored one is only a fallback.
 */
export function groupName(code: string, stored?: string | null): string {
  return GROUP_NAMES[code] ?? (stored || code);
}

/** Whether annotators must mark the start and end frames for this active group. */
export function needsKeyframes(code: string): boolean {
  return QGROUPS.some((group) => group.code === code && group.keyframes);
}

/** Position of a group in the canonical order; -1 when the code is unknown. */
export function groupOrder(code: string): number {
  return GROUP_CODES.indexOf(code);
}
