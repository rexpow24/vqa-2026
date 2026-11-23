# Group C: confusion hints and reference videos

User request, 2026-11-24: when an annotator picks a conflict type K in group C, show a small reminder ("bạn xem kĩ chưa, có nhầm với K.. không?"), offer the reference video, and play it beside the clip being labelled.
Log every reference opened so the admin can see who opens them least.
Start with C; other groups later.

## Evidence

- Round #21-#40 (6 annotators, 20 videos, C.v4): pairwise exact agreement by cell: event type 0.98, subject 0.63, conflict type 0.57, action 0.43 (0.75 when K agrees).
  The conflict type is the bottleneck.
- Most confused K pairs (annotator pairs): K08-K09 15, K11-K12 10, K12-K14 10, K10-K14 9, K11-K14 8, K09-K14 8, K04-K12 8, K14-K15 6, K01-K02 5, K02-K03 5, K03-K05 5, K08-K18 5.
- Content source: `annotator-guidelines/tham-khao-C/video-training/narration.vi.json` (per-K `cues` and `edge`, six pair comparisons).
- Videos: the rendered K01-K18 and pair clips, on the shared Drive folder `1ybYUK9k00qBVikEFq2ATwlZbd5eZyUGq` (anyone with the link), streamed through the app like dataset videos.

## Decisions

- Hint content lives outside the codebook (`frontend/src/lib/references/C.json`, built by `frontend/scripts/build-c-references.mjs`), so no codebook version changes.
- The hint never blocks: no modal, no confirmation.
- Every K shows its cues and "Có nhầm với ...?" for the K codes its guideline `edge` names plus the measured confusion pairs.
- A pair comparison video is offered when one exists; otherwise the single K video.
- Reference opens are logged in `reference_views` (annotator, video, code); admins read per-annotator counts on the statistics page.

## Acceptance

- A1 Choosing a K in C shows its cues and its confusable K codes under the conflict-type field.
- A2 "Xem video" plays the reference beside the clip; a pair video is used when it exists.
- A3 `/api/references/{code}/stream` streams only codes in `C.json`, to a signed-in user; unknown code 404, anonymous 401.
- A4 Each open writes one `reference_views` row for the caller; an annotator cannot read another's rows.
- A5 The admin statistics page lists opens per annotator next to their saved C answers.
