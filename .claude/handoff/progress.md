# Progress Tracker

## Last Updated

2026-11-23, end of the audit session (context heavily used).

## Current Status

Phases 1-5 are implemented, tested locally and committed; nothing is applied to production or deployed. Next: Phase 6, teammate review of the forms on a local copy.

## Completed Work

### Phases 1-5 ✅
- Decisions and sources: `project-context.md`, CLAUDE.md Decision Log.
- Verification at handoff (local): pytest 430 pass / 6 fail (all 6 are pre-existing `test_codebook_map` guideline-table mismatches for S, E, V, Prev, not caused by this work), node codebook tests 76/76, tsc and eslint clean, migrations dry-run in a transaction then applied to the local DB, `verify-entities.mjs` 13/13, `verify-outcome.mjs` all PASS, browser walk-through of the collision video.
- Bugs caught by tests: IAA ignored O.v2 `signs`; `save_video_entities` "column reference version is ambiguous"; switching to E.v6 broke sentence composition for every group (colour cells read through the new book); missing `;` in the E.v6 migration.

## In Progress

### Phase 6: teammate review on local 🔄
- Next immediate step: set up the local review environment (below), then walk the checklist.

#### Setting up the local review
1. Docker Desktop running; from the repo root `npx supabase start`, then `npx supabase db reset` (applies every migration including the three 20261123 ones).
2. `frontend/.env.local` for LOCAL only (never copy production keys into a review copy):
   `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` from `npx supabase status`, `PLATFORM_MODE=hosted`.
   If you already have a production `.env.local`, back it up first and restore it after the review.
3. `cd frontend && node scripts/seed-review.mjs` (refuses non-local URLs). It prints three `/annotate/<id>` links: collision of two motorbikes, near miss, single-vehicle K18. Videos stream from Drive.
4. `npm run dev`, log in as `review-annotator@local.test` / `review-annotator-2026` (admin: `review-admin@local.test` / `review-admin-2026`, local only).
5. On the author's Windows machine port 54321 was refused from Node and a temporary proxy container on another port was used; if that happens, forward a free port to the Kong container and point `NEXT_PUBLIC_SUPABASE_URL` at it.

#### Review checklist (for each of the three videos)
- **E (E.v6):** no colour cells; "+ Thêm bên" disappears at 2 parties; dashcam cell required for cars; names follow the positional rule; sentence like "Xe máy A, xe máy B."
- **C:** no speed cell; event type only va chạm / suýt va chạm; object auto-filled with the other party; subject chips "A · xe máy"; try the SHRP 2 subject rules from the guideline on the clip; sentence reads correctly.
- **O (O.v2):** signs multi-select, level read-only and equal to the highest sign; "có chạm, các bên giữ thăng bằng" excludes the others; C = suýt va chạm turns O into "không va chạm"; switching C back to va chạm blocks completion until O is re-saved; sentence.
- **R (R.v2):** subject/object follow C; ô 0 per the new rule (End of C, a party visible); bystanders only "dừng lại hoặc đến hỗ trợ" / "không rõ"; check the "Các bên [1]." case.
- **Prev (Prev.v4):** party and action derived from C, not editable; sentence.
- **Attr, S, N:** quick look that nothing broke after E.v6 (party names without colour).
- Complete each video once; check the guideline pages (`annotator-guidelines/huong-dan/*.html`) read consistently with the forms.

## Review findings

(teammate: add findings here, one line each: group, video, what you saw, screenshot path)

## Pending

### Phase 7: owner decisions ⏳
Open questions 1-5 in `project-context.md`.

### Phase 8: production ⏳
See `plan.md` Phase 8.

## Resume Instructions
1. Read `project-context.md`, then `plan.md`.
2. Follow "Setting up the local review" above, open the app in the browser and walk the checklist with the teammate.
3. Write findings under "Review findings"; fix only confirmed bugs (through `quyen:ship-feature`, tests first); route open questions to the owner, do not decide them.
4. Do not apply migrations to production or deploy until the owner says so.
