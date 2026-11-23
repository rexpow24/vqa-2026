# Architecture

- The limit is data: `max_entities` in the E book.
  Form, route and database read the same number, so the next E book (colour removal) only copies the key.
- Enforcement points:
  - `form.ts entityProblems(entities)`: problem `_list` when the list is longer than the limit.
  - `EntityCard`: hides the add button at the limit.
  - `PUT /api/videos/[id]/entities`: version is `currentVersion("E")`; 422 `too_many_entities` over the limit, before the RPC, so the message is Vietnamese.
  - `save_video_entities`: reads `content->>'max_entities'` of the version; raises hint `too_many_entities`.
    It already locks the assignment row, so two tabs cannot race past the count.
- Stored rows are not re-checked: nothing re-runs `save_video_entities` on old lists.
- C: unchanged code path; `object` auto-fills from the other key when there are two keys.
