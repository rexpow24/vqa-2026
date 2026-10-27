# Video CSV import - tasks

| id | Slice | Touches | The test that proves it | Covers | Depends on |
|----|-------|---------|-------------------------|--------|------------|
| T1 | A chunk of valid new rows becomes `videos` rows, checked by the same Drive probe as the single-add form | `lib/drive.ts`, `api/admin/videos/route.ts`, `api/admin/videos/import/route.ts`, `scripts/verify-video-import.mjs` | "valid rows are inserted with the CSV's values" + "single-add still accepts a video and rejects a Drive 404" | A1, A10 | - |
| T2 | Rows that meet existing data are classified, not inserted: same name+id skipped, same name other id conflict, id owned by another name failed, repeated name in chunk skipped | `import/route.ts` | "re-posting the same chunk skips every row" + one check per collision kind | A2, A3, A7, A8 | T1 |
| T3 | Bad input never writes: invalid fields and Drive 404 fail per row; malformed chunk is a 422 before any probe; non-admins are refused | `import/route.ts` | "mixed chunk inserts only the good row" + "malformed chunk is rejected in < 1.5 s with nothing written" + "annotator 403, anonymous 401" | A4, A5, A6, A9 | T1 |
| T4 | The browser can split any `videos.csv` into ≤ 100-row chunks that remember original line numbers, and can reject a bad header | `lib/video-csv.ts` | "250-row CRLF file with a blank line → 100/100/50 with original line numbers" + header cases | A11, A12 | - |
| T5 | Admin imports a file from `/admin/videos` and sees progress, one combined report and the refreshed list | `admin/videos/video-import.tsx`, `video-manager.tsx` | Manual run of `videos.smoke.csv` twice on the dev server, then lint + build + pytest | A13, A14, A15 | T2, T3, T4 |

Every id A1-A15 appears in one row.
T1 is the tracer: route, shared probe, DB write and the verify harness, all thin.
