# Spec

## What

Admin-driven assignment of videos.

- A stratified agreement group, numbered 1..N and labelled by several annotators.
- Exclusive numbered ranges for everyone else.
- An annotator page that lists only the annotator's own videos, with numbered pages and search.
- Drive ids that no annotator can read.

## Behaviour

1. `/admin/assignments`:
   - reference labels upload and stratum counts;
   - create agreement group (N);
   - assign the group to selected annotators;
   - assign or unassign a range to one annotator with a batch label, with the next free range suggested;
   - a table of annotators with label, assigned ranges, completed/total.
2. `/admin/users`: edit each user's label.
3. `/annotate`:
   - the caller's assigned videos, 10 per page, ordered by number;
   - pages 1..n (with ellipsis) and "Đến trang";
   - a search box (number or filename);
   - status and progress per row.
4. `/annotate/[videoId]`: shows `#seq`. A video not assigned to the caller is not found (annotators); admins see it read-only. There is no "Nhận video".
5. Completing a video goes to the next unfinished assigned video by number.

## Non-goals

Kappa, private Drive streaming, hiding YouTube ids.
