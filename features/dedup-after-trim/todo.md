# Dedup after trim tasks

- [x] Inspect review, trimmed, anonymize, model cache, and frontend routes.
- [x] Build a full-corpus dedup index with an atomic result and source signatures.
- [x] Persist threshold and one review decision per query.
- [x] Add sidecar scan, status, queue, and decision endpoints.
- [x] Add a one-query-at-a-time Next.js review page and navigation tab.
- [x] Gate anonymization on a fresh index and completed reviews.
- [x] Verify live UI, stale-file recovery, anonymize gate, and existing checks.

## Evidence

- Indexed all 408 current canonical trimmed clips with cached DINOv2 embeddings and pHashes.
- At threshold 0.80, zero queries are suggested; the highest fused top-1 score is 0.792706.
- At threshold 0.78, the live page showed 19 suggested clips, top-five videos, and one-query navigation.
- The anonymize start endpoint returned HTTP 409 while 19 queries were pending.
- Python suite: 137 passed; focused dedup tests passed; frontend lint and TypeScript checks passed.
