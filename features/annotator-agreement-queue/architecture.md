# Architecture

`videos.agreement_sample boolean` marks the sample.

`annotator_queue` keeps its signature and exclusions and changes only its ordering.
`taken` = assignments on the video by other annotators, completed or still open.
`target` = 2 for a sample video, otherwise 1.

| Rank | Rows | Inside the rank |
|---|---|---|
| 0 | The caller's own open claims | filename |
| 1 | Sample, `taken < 2` | `taken` desc (finish open pairs first), filename |
| 2 | Non-sample, `taken = 0` | filename |
| 3 | Target already met | filename |

Two annotators reach the same sample videos because rank 1 is one shared order.
They split the rest because a claim moves a video out of rank 2 for the other person.

A claim abandoned by someone else only lowers priority, so nothing becomes unreachable.
