# Project Context

Handoff of 2026-11-23: codebook changes after the agreement audit of videos #1-#40, waiting for a teammate's form review before production.

## Project Goal

VQA-VN-Traffic-2026 builds a Vietnamese traffic-accident VQA dataset.
Annotators label each clip through the hosted Next.js labeling app (Supabase backend) with slot-based codebooks per question group (S, E, N, C, O, R, Attr, Prev).
Agreement rounds on the shared "agreement group" videos measure inter-annotator reliability (target kappa/alpha >= 0.8 by round 3).
This session audited groups O, C (subject) and R on videos #1-#40, then changed codebooks, guidelines, forms and the agreement scripts to remove the main sources of disagreement.

## Key Requirements

- Every rule must cite a reputable source or project data (memory rule "Methods need a cited basis").
- Guideline edits stay minimal: only the change that was decided, no extra rules invented by the agent.
- Stored answers under older codebook versions stay valid as stored (legacy pattern: triggers re-check only changed content).
- Nothing reaches production before a human reviews the forms and composed sentences on a local copy.

## Non-Goals / Out of Scope

- Training videos for O (planned in the O proposal, not started).
- VLM draft prompt update (`vlm/prompts.py` still asks for colours).
- Re-labelling old agreement videos.

## Constraints & Decisions (all made by the project owner on 2026-11-23)

1. **O.v2 (outcome):** annotators tick every clearly visible sign (multi-select); the level is derived as the highest sign, never chosen.
   "không rõ" / "Không thể xác định" removed ("nó gần nghĩa với suýt va chạm").
   C near miss gives O "không va chạm" automatically.
   Signs: nhẹ = có chạm, các bên giữ thăng bằng; vừa = ngã tại chỗ, xoay ngang/lệch hướng mất lái; mạnh = lật, người bị hất văng, xe bị hất khỏi quỹ đạo, biến dạng lớn, va chạm thứ cấp.
   Basis: GraDE (Darji & Gondaliya 2026, doi:10.36548/jtcsst.2026.4.006), SHRP 2 crash levels. Audit: level alpha 0.588 nominal, 0.864 ordinal.
2. **Agreement scripts compare entities by E identity, not by letter** (`scripts/entity_match.py`, `--entity-match identity|identity-nocolor|letter`). C subject alpha #21-#40: 0.288 by letter, 0.660 by identity.
3. **E.v5: at most 2 main parties** (first collision pair, else first near-miss pair; single-vehicle K18 = 1). C object auto-fills the other party.
4. **C subject rules from SHRP 2 Precipitating Event** (Hankey, Perez & McClafferty 2016, VTTI): but-for test, no fault, simultaneous actions go to the larger effect ("cả hai bên" only when undecidable), dashcam vehicle is A but not the subject by default.
5. **E.v6: no vehicle colour, no clothing colour.** Naming by position: dashcam vehicle A, else left to right, then top to bottom. Same-type parties read "xe máy A, xe máy B".
6. **C guideline: speed cell removed** (already gone from C.v3 JSON, guideline was stale). **Mốc End** defined as SHRP 2 Event End: all parties stopped or back to normal movement.
7. **R ô 0 "Clip có đoạn sau sự kiện":** "có" when after C's End the clip continues and at least one party of the C pair is seen doing a cell 1/2 behaviour; "không" when the clip ends at or before End, or no party of the pair is visible after it.

Full rows: `CLAUDE.md` Decision Log ("Group O.v2", "E two main parties + C subject rules", "E.v6 no colours", "Agreement computation").

## Open Questions (owner has not answered yet)

1. O: move "xoay ngang/quay vòng" to **mạnh** (GraDE lists "spun or thrown off its path" as Major) and keep "lệch hướng, chao đảo mất lái" at vừa?
2. O: "va chạm thứ cấp" broad (any further impact) or narrow (GraDE: further impact with a third party or fixed object)? Guideline must state it.
3. Same-type parties ("A · xe máy" / "B · xe máy"): annotators must remember which is A, and "xe máy A" means nothing in a dataset answer. Options: (a) show position in the name ("xe máy bên trái/bên phải", one extra E cell for left-right vs top-bottom), (b) also store the reference frame time with a "xem khung" button, (c) click the vehicle on a frame. Agent recommended a + b.
4. Pre-existing UI issues found in the local review, not fixed: R template "Các bên [1]." drops the bystander part; O still shows a greyed "không đánh giá" button (recommend hiding); E cells reflow when a type is chosen; video player shows 0:00 after the ±0.25s seek buttons.
5. Should "C is K18 means E has exactly 1 party" and "E needs at least 1 party" be enforced? Currently guideline text only.
