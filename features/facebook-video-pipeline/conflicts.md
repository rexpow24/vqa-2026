# Facebook branch conflict audit

| Existing owner / invariant | Potential collision | Resolution |
|---|---|---|
| `run_pipeline.py` consumes queued videos and runs YouTube preprocessing | Facebook rows could enter scene detection and blur | YouTube runner selects `source='youtube'`; a dedicated worker selects `source='facebook'`. Sidecar prevents simultaneous video ingest runs. |
| Existing rows and clip IDs are keyed by `youtube_video_id` | Schema rewrite could invalidate existing queue, clips, and review records | Add a `source` column with `DEFAULT 'youtube'`; preserve all current IDs and store generated `fb_<uuid>` IDs in the legacy key column for new source rows. |
| Review is shared across all `UNREVIEWED` clips | Facebook original may be treated as a missing delivered asset | Insert one clip with both file paths pointing to its downloaded original; return source metadata to the shared Review UI. |
| `dedup.current_sources()` scans `work/*/trimmed/*.mp4` | Facebook could be compared with YouTube and block anonymize | Store Facebook one directory deeper at `work/facebook/<id>/trimmed/`; add a filesystem-scope test. |
| YouTube anonymize requires a current, fully reviewed Dedup index | Facebook must not be deduped | Dedicated Facebook anonymize endpoint points to the Facebook work/output roots and explicitly passes `--skip-dedup`; it does not call `dedup.allowed_sources()`. |
| Stop, retry, and stranded-row repair affect shared status rows | One source's controls could mutate the other source's work | Add source predicates to queue selection, retry, and stop; keep remove keyed to the unique internal ID. |
| Media route permits only approved top-level roots | New source path may fail to play in Review | Keep the downloaded file below the existing `work` root; anonymized output stays below `finished`. |

No unresolved BLOCK remains with these boundaries. Tests cover legacy-source
migration, worker selection, review source propagation, and Dedup path
isolation.
