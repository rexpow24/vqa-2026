// The nine question groups, in the one order the whole system agrees on.
//
// These used to be re-declared in six files -- three under src/ and three
// scripts -- and the admin CSV template kept its prompts in a *separate*
// array matched to the codes by position, so reordering one list silently
// paired every question with the wrong group. Code, Vietnamese name and
// prompt now travel together in qgroups.json, which the scripts read as JSON
// too, so there is exactly one place to edit.
//
// The order is not cosmetic: the database enforces
// `qgroup in ('S','E','N','C','V','O','R','Attr','Prev')` and the labelling
// page sorts drafts by it. Changing codes here needs a migration.

import data from "./qgroups.json";

export type QGroup = { code: string; name: string; question: string };

export const QGROUPS: readonly QGroup[] = data;
export const GROUP_CODES: readonly string[] = QGROUPS.map((group) => group.code);
export const GROUP_NAMES: Readonly<Record<string, string>> =
  Object.fromEntries(QGROUPS.map((group) => [group.code, group.name]));

/** Position of a group in the canonical order; -1 when the code is unknown. */
export function groupOrder(code: string): number {
  return GROUP_CODES.indexOf(code);
}
