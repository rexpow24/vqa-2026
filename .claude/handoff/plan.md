# Implementation Plan

## Overview

Codebook and guideline changes are implemented and tested locally; a teammate reviews the forms and composed sentences on a local copy, the owner answers the open questions, then migrations go to production and the frontend is deployed.

## Phases

### Phase 1: O audit and O.v2
- **Goal**: derive the outcome level from visible signs.
- **Tasks**: audit, sources, codebook, form, derivation from C, migration, guideline, IAA scripts.
- **Status**: [x] Complete (local only)
- **Outputs**: `codebook/O.v2.json`, `frontend/src/lib/codebook/outcome.ts`, `supabase/migrations/20261123100000_o_v2_visible_signs.sql`, `annotator-guidelines/huong-dan/06-O-hau-qua.md`, `features/o-codebook-v2/`, `frontend/scripts/verify-outcome.mjs`.

### Phase 2: identity-matched agreement
- **Goal**: stop counting A/B naming differences as disagreement.
- **Status**: [x] Complete
- **Outputs**: `scripts/entity_match.py`, `tests/test_entity_match.py`, changes in `scripts/iaa_round.py`, `scripts/audit_slot_disagreements.py`.

### Phase 3: E.v5 two main parties + C subject rules
- **Status**: [x] Complete (local only)
- **Outputs**: `codebook/E.v5.json`, `supabase/migrations/20261123110000_e_v5_two_entities.sql`, guideline C/E edits, `features/two-entity-subject-rules/`, `frontend/scripts/verify-entities.mjs`.

### Phase 4: E.v6 no colours
- **Status**: [x] Complete (local only)
- **Outputs**: `codebook/E.v6.json`, `supabase/migrations/20261123120000_e_v6_no_colors.sql`, `features/e-v6-no-colors/`.

### Phase 5: guideline fixes C speed, C End, R ô 0
- **Status**: [x] Complete
- **Outputs**: `annotator-guidelines/huong-dan/03-C-nguyen-nhan.{md,html}`, `07-R-ung-xu.{md,html}`, `docs/guidelines/C-nguyen-nhan.md`, `docs/guidelines/R-ung-xu.md`.

### Phase 6: teammate review on local
- **Goal**: a human checks every changed form and the composed sentence of each group before production.
- **Tasks**: set up local Supabase + frontend, seed review fixtures, walk the checklist in `progress.md`, record findings.
- **Status**: [ ] Not started
- **Outputs**: review notes (append to `progress.md` "Review findings").

### Phase 7: owner decisions on open questions
- **Status**: [ ] Not started
- **Tasks**: answer questions 1-5 in `project-context.md`; implement the chosen ones through `quyen:ship-feature`.

### Phase 8: production
- **Status**: [ ] Not started
- **Tasks**: apply the three 20261123 migrations through the session pooler (see CLAUDE.md "Keyframe groups" row for the IPv4 gotcha), deploy with `npx --yes vercel@48.2.0 deploy --prod --yes` from `frontend/`, prove it landed, run `verify-outcome.mjs` and `verify-entities.mjs` with `TEST_BASE_URL=https://vqa-vn-traffic-labeling.vercel.app`, rebuild `annotator-guidelines.zip` and `huong-dan.zip`.
