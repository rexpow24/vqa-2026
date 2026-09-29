# Pause anonymization

## Outcome and boundary

The Review tab can request a pause during an anonymize sweep.
The worker finishes its current clip, then stops before starting another.
Resume starts a new sweep that skips existing `finished/` outputs.
The pause control does not interrupt frame processing within a clip.

## System relationship

The Review page calls the sidecar.
The sidecar writes a pause marker that the standalone anonymize script checks between clips.
The existing output rename remains the completion boundary, and the progress display continues to count finished files on disk.
No database schema changes are needed.

## Flow and states

```mermaid
flowchart LR
  Idle --> Running: Start
  Running --> Pausing: Request pause
  Pausing --> Paused: Current clip completes
  Running --> Done: All clips complete
  Pausing --> Done: Current clip was last
  Paused --> Running: Resume
  Running --> Failed: Worker error
  Pausing --> Failed: Worker error
  Failed --> Running: Retry
```

The pause marker survives a sidecar restart.
If the sidecar restarts during a sweep, the worker still honors an existing pause request, but the new sidecar cannot control that already running process.
Start or Resume clears it before launching a worker.
Completed clips remain in `finished/` and are skipped on resume.
An interrupted `.part.mp4` is not counted as completed.
An already running worker launched before this feature cannot honor a pause request.
The Review tab hides Pause while connected to an older backend and explains when it becomes available.

## Recovery and acceptance

- Clicking Pause keeps the current clip running and shows a pending pause state.
- The worker starts no further clip after that clip finishes, including clips in another video folder.
- Resume processes only clips without a corresponding finished output.
- A pause requested during the last clip ends with full progress rather than a paused state.
- A failed worker remains retryable through the existing Start control.
