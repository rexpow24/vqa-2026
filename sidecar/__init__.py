"""Python sidecar for the Next.js frontend.

See features/nextjs-frontend-migration/architecture.md for why this exists
and what it is and is not allowed to do.

Boundary: `sidecar/` may import `vqa/`. `vqa/` never imports `sidecar/`.
No new SQL is written here — every write goes through `vqa.db` / `vqa.review`,
the same functions `app.py` already calls.
"""
