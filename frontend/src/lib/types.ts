// Shapes mirror sidecar/main.py's JSON responses, which in turn mirror
// vqa/db.py rows. Kept intentionally loose (not 1:1 with every DB column)
// -- only fields the UI actually reads are typed.

export type VideoStatus =
  | "QUEUED"
  | "DOWNLOADING"
  | "DOWNLOAD_FAILED"
  | "PROCESSING"
  | "FAILED"
  | "READY_FOR_REVIEW"
  | "DONE"
  | "STOPPED";

// Must match vqa/db.py REMOVABLE / RETRYABLE exactly -- these are UI-side
// mirrors of Python constants, not a second source of truth for behavior
// (the sidecar still enforces the real rule server-side).
export const REMOVABLE: VideoStatus[] = [
  "QUEUED",
  "DOWNLOAD_FAILED",
  "FAILED",
  "STOPPED",
];
export const RETRYABLE: VideoStatus[] = ["DOWNLOAD_FAILED", "FAILED", "STOPPED"];

// Field names match vqa/db.py's `videos` table columns exactly (SELECT * FROM
// videos) -- this is a straight row shape, not a view model.
export interface Video {
  youtube_video_id: string;
  url: string;
  title: string | null;
  channel_name: string | null;
  status: VideoStatus;
  stage: string | null;
  error_code: string | null;
  duration_s: number | null;
  n_boundaries: number | null;
  n_clips: number | null;
  [key: string]: unknown;
}

export interface RunStatus {
  busy: boolean;
  queued: number;
  done: number;
  total: number;
  log_tail: string;
}

export interface Shot {
  start: number;
  end: number;
  auto: boolean;
  default: boolean;
}

export interface ReviewClip {
  clip_id: string;
  youtube_video_id: string;
  duration_s: number;
  duration_rounded: number;
  flags: string[];
  band: string;
  video_path: string;
  already_materialized: number;
  pad_default: number;
  max_shots: number;
}

export interface ReviewSummary {
  top_left: number;
  low_left: number;
  reviewed: number;
  approved: number;
}

export interface ReviewNextResponse {
  clip: ReviewClip | null;
  initial_shots: Shot[];
  summary: ReviewSummary;
}

export interface Conflict {
  i: number;
  j: number;
  start: number;
  end: number;
  amount: number;
}

export interface ValidateResponse {
  errors: string[];
  conflicts: Conflict[];
  segments: [number, number][];
}

export const SHOT_COLORS = ["#22C55E", "#3B82F6", "#F59E0B"];
export const CONFLICT_COLOR = "#EF4444";
export const AUTO_BORDER_COLOR = "#FACC15";

/** Seconds -> HH:MM:SS.s, matching vqa/media.py's fmt_time. */
export function fmtTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${sec
    .toFixed(1)
    .padStart(4, "0")}`;
}
