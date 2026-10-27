# Video CSV import - progress

- [x] T1 - valid rows inserted via shared Drive probe            status: verified 2026-10-27 (A1, A10; fixtures cleaned: 0 left)
- [x] T2 - collisions with existing data classified               status: verified 2026-10-27 (A2, A3, A7, A8)
- [x] T3 - bad input never writes; auth                           status: verified 2026-10-27 (A4, A5, A6, A9)
- [x] T4 - browser chunking + header check                        status: verified 2026-10-27 (A11, A12)
- [~] T5 - admin UI: progress, report, refresh                    status: page renders the import box (200, server HTML); videos.smoke.csv imported 3 then skipped 3 through the route the UI calls; lint, tsc, build, pytest (141) pass. Not clicked in a real browser (browser tools unavailable this session).

## Notes

- 2026-10-27: verify runs need `PLATFORM_MODE=hosted npx next dev -p 3005`; the first compile of a new route can take ~90 s (Turbopack cache compaction), so the first run after a restart is not a timing measurement.

## Bugs found by testing, not by reading

| Bug | Symptom | Cause |
|---|---|---|
| Drive probe hangs inside the Next.js server | Import of 3 rows took 5.1 min and the client died with `HeadersTimeoutError`; reproduced twice | `await probe.body.cancel()` after a `206` never settled under the Next dev server (headers arrived in 2.0 s, measured with timing logs). The same probe in plain Node finished 60 requests in 11 s. Fixed by aborting the request with an `AbortController` instead. The single-add route had the same `cancel()`; whether it also hung on Vercel was not verified. |
