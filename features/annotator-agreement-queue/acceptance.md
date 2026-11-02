# Acceptance

1. Exactly 224 active videos are in the sample, and the unplayable Facebook video is not one of them.
2. A sample video completed by one annotator comes before every untouched sample video for a second annotator.
3. Every sample video needing a label comes before every non-sample video needing one.
4. A sample video completed by two annotators drops behind unlabelled non-sample videos for a third.
5. A non-sample video completed or claimed by one annotator drops behind unlabelled non-sample videos for another.
6. The caller's own open claim is first in their queue.
7. A completed video stays out of the annotator's own queue, and others still see it.
8. `/complete` still returns a next video that is not the one just finished, and a page of the queue stays fast.
