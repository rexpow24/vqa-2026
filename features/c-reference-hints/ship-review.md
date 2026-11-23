# Ship review: group C confusion hints and reference videos

## Shipped

- Choosing a K in group C shows a hint under the conflict-type field: what to check (narration cues), "Bạn có nhầm với ... không?" for the K codes the guideline names plus the measured confusion pairs, buttons that open the pair comparison (or the single K clip), "Xem lại reference", and a "Đang phân vân với" picker.
- The chosen clip plays beside the labelling video, muted and looping, with its cues and a close button.
- `/api/references/[id]/stream` streams only ids listed in `lib/references/C.json` from the shared Drive folder, to signed-in users; `lib/drive-stream.ts` is now shared with the dataset stream route.
- Every open is logged in `reference_views`; `/admin` lists opens per annotator next to their saved C answers, least first (`reference_view_stats()`).

## Verified

- `verify-references.mjs` 9/9 on local (401 anonymous, 206 byte range, 404 unlisted id, own-row logging, RLS, admin-only stats).
- Browser walk-through on the local review collision video: K08 hint, K08 ↔ K09 comparison beside the clip.
  Found and fixed there: the fixed 1080px video column squeezed the form and caused horizontal scroll; the picker label wrapped.
- Node tests 79/79, tsc and eslint clean, pytest unchanged from baseline.

## Not done

- Missing comparison clips for measured pairs without one (K04-K12, K14-K15, K01-K02, K02-K03, K03-K05, K08-K18): these fall back to the single K clip.
- The admin table was checked through the RPC, not visually.
- Other groups (S, R, E, Attr) are not covered yet.
