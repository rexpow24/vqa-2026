# Overview

## Desire (user, 2026-11-08, translated)

After recruiting annotators, work has to be handed out:

- A small group (about 3 people) labels the same 50-100 videos, to measure initial agreement.
- The other ~1400 videos are split into ranges, one range per person (for example 101-200 for person 1, 201-300 for person 2), across 10-15 people, to finish the dataset faster.
- The annotator page needs numbered pages (10 videos per page, pages 1..n) and a search by video id.

Technical asks:

- Admin assigns videos; an annotator can label only the videos assigned to them.
- Admin can put a label on each annotator (for example "Agreement group" or "Videos 1-100").
- Pagination with navigation over pages 1..n.
- Annotators must not be able to reach the original Drive that holds the dataset.
- Each annotator works independently; nobody edits the same row as someone else.

## User answers (2026-11-08)

- The agreement group size is not fixed at 100: 50-100 videos.
- Agreement videos are sampled stratified by `event_label` × `difficulty`, the labels the user and a teammate gave during clip review. The teammate's labels are not uploaded yet; the user will provide them later.
- Numbering: the agreement group comes first (1..N), the rest follows by filename.
- Existing self-claims: keep the ones that already have answers, drop the rest.
- Annotator label: free text set by an admin.
