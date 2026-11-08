# Ship review

## Shipped

- Migration `20261107_answer_adjudication.sql`, applied to production on 2026-11-07:
  - verdict/answer consistency trigger;
  - decision tables with RLS;
  - `final_answers` / `final_video_labels` views;
  - `import_adjudications`, `adjudication_export` and `adjudication_summary`;
  - lock triggers with a cascade escape.
- API: `POST /api/drafts/[id]/annotation` refuses inconsistent answers (422) and reports a locked answer (409). New: `GET /api/admin/adjudications/export`, `POST /api/admin/adjudications/import`.
- UI:
  - "Sửa đáp án" only under Không đồng ý;
  - a warning plus "Dùng đáp án gốc" for legacy rows;
  - a locked card with the final answer, and a locked event label;
  - the `/admin` "Thống nhất đáp án" section.
- `annotator-report.mjs` flags legacy rows and shows final-answer sources.

## Verification

- `verify-adjudication.mjs`: 39 checks against a hosted-mode local server (`PLATFORM_MODE=hosted`, port 3006) and the production database.
- Regression on the same server, all passing:
  - `verify-labeling`;
  - `verify-difficulty` (17);
  - `verify-revisions` (10);
  - `verify-annotator-queue` (23).
- `tsc`, `eslint`, and `pytest` (164) are clean.
- Browser:
  - the decided card and the locked label render;
  - Không đồng ý opens the editor and refuses to save without a changed answer;
  - switching back to Đồng ý restores the draft (1 save);
  - "Dùng đáp án gốc" fixes a legacy row (1 save);
  - admin download, fill and upload reports "2 đã lưu".

## Found while testing

- Auto-save loop: switching Không đồng ý → Đồng ý re-posted the answer every 600 ms (about 40 requests observed). The bug predates this feature (auto-save commit `525b5d5`) and is fixed here.
- 5 production AGREE rows with rewritten answers. Their video `-8mCpnb02Z4_222200_237433_t01.mp4` was completed before the migration, so its difficulty reads 0 errors / easy. The annotator must reopen it and either choose Không đồng ý or restore the draft.

## Not done

- Kappa computation.
- Production frontend deploy: done 2026-11-08 together with `features/assigned-labeling/`. `verify-adjudication` passes against production (39 checks).
