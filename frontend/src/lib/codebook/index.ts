// The frozen codebooks the slot form and the save routes read.
//
// The JSON files here are byte-identical copies of codebook/<group>.v<n>.json at
// the repository root (tests/test_codebook_copies.py): Vercel uploads only
// frontend/, so the app cannot read the originals. The database seeds the same
// files into codebook_versions (20261116100000_slot_data_model.sql for v1,
// 20261116200000_codebook_v2.sql for S.v2, C.v2, V.v2 and Attr.v1,
// 20261119100000_v_behavior_multiselect.sql for V.v3 and
// 20261119120000_v_animal_responsibility.sql for V.v4 and
// 20261119140000_v_animal_owner_evidence.sql for V.v5 and
// 20261119150000_v_both_animal_keeper.sql for V.v6, and later migrations for
// the later versions, e.g. 20261123100000_o_v2_visible_signs.sql for O.v2 and
// 20261123110000_e_v5_two_entities.sql for E.v5 and
// 20261123120000_e_v6_no_colors.sql for E.v6).
//
// A group is answered with cells exactly when it has a codebook here; there is
// no second list of slot groups. Imports stay relative (no "@/") so that
// `node --test` can load this module and compose.ts without the Next.js resolver.

import C1 from "./C.v1.json" with { type: "json" };
import E1 from "./E.v1.json" with { type: "json" };
import O1 from "./O.v1.json" with { type: "json" };
import Prev1 from "./Prev.v1.json" with { type: "json" };
import R1 from "./R.v1.json" with { type: "json" };
import S1 from "./S.v1.json" with { type: "json" };
import V1 from "./V.v1.json" with { type: "json" };
import Attr1 from "./Attr.v1.json" with { type: "json" };
import C2 from "./C.v2.json" with { type: "json" };
import E2 from "./E.v2.json" with { type: "json" };
import S2 from "./S.v2.json" with { type: "json" };
import V2 from "./V.v2.json" with { type: "json" };
import V3 from "./V.v3.json" with { type: "json" };
import V4 from "./V.v4.json" with { type: "json" };
import V5 from "./V.v5.json" with { type: "json" };
import V6 from "./V.v6.json" with { type: "json" };
import C3 from "./C.v3.json" with { type: "json" };
import E3 from "./E.v3.json" with { type: "json" };
import R2 from "./R.v2.json" with { type: "json" };
import Prev2 from "./Prev.v2.json" with { type: "json" };
import V7 from "./V.v7.json" with { type: "json" };
import V8 from "./V.v8.json" with { type: "json" };
import Prev3 from "./Prev.v3.json" with { type: "json" };
import S3 from "./S.v3.json" with { type: "json" };
import E4 from "./E.v4.json" with { type: "json" };
import C4 from "./C.v4.json" with { type: "json" };
import V9 from "./V.v9.json" with { type: "json" };
import Prev4 from "./Prev.v4.json" with { type: "json" };
import O2 from "./O.v2.json" with { type: "json" };
import E5 from "./E.v5.json" with { type: "json" };
import E6 from "./E.v6.json" with { type: "json" };
import S4 from "./S.v4.json" with { type: "json" };
import O3 from "./O.v3.json" with { type: "json" };

export type CodebookOption = {
  id: string;
  label: string;
  parent?: string;
  free_text?: boolean;
  from_entities?: boolean;
  [key: string]: unknown;
};

export type CodebookCell = {
  id: string;
  label: string;
  required: boolean;
  options?: CodebookOption[];
  from_entities?: boolean;
  parent_cell?: string;
  per_party?: boolean;
  per_party_when?: string;
  multiple?: boolean;
  must_differ_from?: string;
  note?: string;
  per_party_options?: string[];
  [key: string]: unknown;
};

export type Codebook = {
  group: string;
  version: number;
  frozen_on: string;
  template?: string;
  templates?: { case: string; text: string; [key: string]: unknown }[];
  cells: CodebookCell[];
  [key: string]: unknown;
};

const CODEBOOKS: Readonly<Record<string, Codebook>> = Object.fromEntries(
  ([S1, E1, C1, V1, O1, R1, Prev1, S2, C2, V2, V3, V4, V5, V6, Attr1, E2, C3, E3, R2, Prev2, V7, V8, Prev3,
    S3, E4, C4, V9, Prev4, O2, E5, E6, S4, O3] as Codebook[]).map((book) => [`${book.group}.v${book.version}`, book]),
);

/** The codebook with this id ("C.v1"), or undefined when there is none. */
export function getCodebook(version: string): Codebook | undefined {
  return Object.hasOwn(CODEBOOKS, version) ? CODEBOOKS[version] : undefined;
}

/** The newest codebook id of a group ("S" gives "S.v2"), or undefined for a text group. */
export function currentVersion(qgroup: string): string | undefined {
  const versions = Object.values(CODEBOOKS).filter((book) => book.group === qgroup);
  if (!versions.length) return undefined;
  const newest = versions.reduce((best, book) => (book.version > best.version ? book : best));
  return `${newest.group}.v${newest.version}`;
}

/** Whether the group is answered with cells (it has a codebook). N is not; Attr is since codebook v2. */
export function isSlotGroup(qgroup: string): boolean {
  return currentVersion(qgroup) !== undefined;
}
