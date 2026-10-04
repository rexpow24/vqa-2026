// Same nine question groups the app uses, read from the one JSON file that
// defines them. Scripts cannot import the TypeScript wrapper in src/lib, so
// they read the data directly -- still a single source, no second copy.

import QGROUPS from "../../src/lib/qgroups.json" with { type: "json" };

export { QGROUPS };
export const GROUP_CODES = QGROUPS.map((group) => group.code);
export const GROUP_NAMES = Object.fromEntries(QGROUPS.map((group) => [group.code, group.name]));
