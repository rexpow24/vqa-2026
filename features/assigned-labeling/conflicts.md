# Conflict audit

| # | Existing thing | Collision | Evidence | Resolution |
|---|---|---|---|---|
| 1 | `videos_read` + link-shared Drive files | Any annotator lists every Drive id and downloads originals anonymously | Probe: 1496 ids readable, anonymous fetch 206 `video/mp4` | Column privilege revoked; videos readable only when assigned |
| 2 | Self-claim (`assignments_insert`, claim route, "Nhận video" button) | Defeats "only assigned videos" and exclusivity | Probe: self-claim allowed | Admin-only insert; claim route 403; button removed |
| 3 | `annotator_queue` agreement ordering (Decision Log, Agreement sample) | Ordering by "who else took it" is meaningless when work is assigned | Decision Log | Superseded by `my_assignments` ordered by number; `annotator_queue` dropped |
| 4 | `videos.agreement_sample` = 224 videos | New group is 50-100, stratified | User answer | Reset and repopulated by `create_agreement_group` |
| 5 | Admin pages and import read `drive_file_id` through the session client | Revoking the column breaks them | grep: `admin/videos/page.tsx`, `api/admin/videos`, `api/admin/videos/import` | Those reads use the privileged client after `requireProfile("admin")` |
| 6 | Adjudication views and export join `videos` | Must not need the revoked column | `final_answers`, `adjudication_export` read `filename` only | Unaffected; verified by `verify-adjudication` |
| 7 | `verify-annotator-queue.mjs`, `verify-labeling.mjs` and other scripts self-claim | They would fail | grep `video_assignments` inserts by annotator clients | Fixtures create assignments with the privileged client; queue test rewritten for `my_assignments` |
| 8 | Video labels on deleted legacy assignments | Orphan rows | 5 `video_labels`, some on pending videos | Deleted with their assignment |
| 9 | Renumbering after ranges are handed out | A person's "101-200" silently changes | Design | Regrouping refused once a non-legacy assignment exists |

## Verdict

**PASS.**
