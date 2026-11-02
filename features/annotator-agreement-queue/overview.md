# Annotator agreement queue

User, 2026-11-02: two annotators labelling the same video must be possible so agreement can be computed later; after reviewing the analysis, the user chose "Sửa hàng đợi".

`annotator_queue` orders by completed coverage ascending, so a video with one annotator sinks below every untouched video and pairs form last.
With 1496 videos, two annotators would barely overlap.
