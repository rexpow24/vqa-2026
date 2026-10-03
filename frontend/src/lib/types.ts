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

// Sweeps every work/<id>/trimmed/ into a sibling finished/ -- separate from
// RunStatus because it's a different subprocess (sidecar's /anonymize/*),
// tracked independently of the main pipeline run.
export interface AnonymizeStatus {
  busy: boolean;
  pause_supported?: boolean;
  pause_requested: boolean;
  paused: boolean;
  exit_code: number | null;
  total: number;
  completed: number;
  completed_files: {
    video_id: string;
    file_name: string;
    completed_at: number;
  }[];
}

export interface Shot {
  start: number;
  end: number;
  auto: boolean;
  default: boolean;
  difficulty?: Difficulty | null;
  event_label?: EventLabel | null;
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

export type Difficulty = "easy" | "medium" | "high";
export type EventLabel = "accident" | "near-miss";

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

// A clip decided before difficulty/event_label existed -- already
// APPROVED/REJECTED/FLAGGED, just missing one or both labels.
export interface RelabelClip {
  clip_id: string;
  youtube_video_id: string;
  duration_s: number;
  flags: string[];
  video_path: string;
  decision: string;
}

export interface RelabelNextResponse {
  clip: RelabelClip | null;
  remaining: number;
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

// ── Team B annotation over VLM drafts ──────────────────────────────────
//
// Three verdicts, not two. NOT_ANSWERABLE says the video holds no event the
// question could be about -- a property of the clip, not a model failure.

export type Verdict = "AGREE" | "NOT_ANSWERABLE" | "DISAGREE";

export interface Annotator {
  annotator_id: string;
  name: string;
  team: "A" | "B";
}

export interface ShotSummary {
  clip_id: string;
  shot: number;
  n_drafts: number;
  n_done: number;
  available: boolean;
}

export interface AnnotateShotsResponse {
  shots: ShotSummary[];
}

export interface DraftItem {
  draft_id: string;
  qgroup: string;
  group_name: string;
  question: string;
  answer: string;
  truncated: boolean;
  completion_tokens: number | null;
  latency_ms: number | null;
  prompt_version: number;
  /** null until this annotator has saved their own marks -- withheld on
   *  purpose so the human evidence timestamps stay independent of the
   *  prediction they are measured against. */
  predicted_keyframes_s: number[] | null;
  verdict: Verdict | null;
  reason_code: string | null;
  reason_note: string | null;
  edited_question: string | null;
  edited_answer: string | null;
  human_keyframes_s: number[];
  annotated_at: string | null;
}

export interface AnnotateShot {
  clip_id: string;
  shot: number;
  video_path: string | null;
  /** the trimmed/ file is gone -- rejected or re-cut after drafting */
  stale: boolean;
  duration_s: number | null;
  frame_times_s: number[];
  /** The earlier reviewer's label is intentionally absent: showing it on the
   *  labelling screen would anchor this annotator to it. */
  my_label: { difficulty: string; event_label: string } | null;
  drafts: DraftItem[];
  vocab: {
    verdicts: Verdict[];
    reasons: string[];
    difficulties: string[];
    event_labels: string[];
  };
}

// Majority vote across annotators (DC.pdf steps 6-7). `tied` is reported
// rather than broken: an arbitrary winner would hide the item from the
// adjudication pass it is supposed to go to.
export interface FieldConsensus {
  counts: Record<string, number>;
  majority: string | null;
  votes: number;
  total: number;
  unanimous: boolean;
  tied: boolean;
}

export interface LabelVote {
  annotator_id: string;
  name: string | null;
  team: "A" | "B" | null;
  difficulty: string | null;
  event_label: string | null;
  labeled_at: string | null;
}

export interface VerdictConsensus {
  draft_id: string;
  qgroup: string;
  votes: { annotator_id: string; verdict: Verdict; reason_code: string | null }[];
  counts: Record<string, number>;
  majority: string | null;
  n_votes: number;
  total: number;
  tied: boolean;
}

export interface ConsensusResponse {
  labels: {
    votes: LabelVote[];
    n: number;
    difficulty: FieldConsensus;
    event_label: FieldConsensus;
  };
  verdicts: VerdictConsensus[];
}

export interface PromptGroup {
  code: string;
  name: string;
  question: string;
  max_tokens: number;
}

export interface PromptUsage {
  prompt_name: string;
  prompt_version: number;
  qgroup: string;
  n_drafts: number;
  n_truncated: number | null;
  avg_out_tokens: number | null;
  avg_latency_ms: number | null;
  first_used: string | null;
  last_used: string | null;
  agree?: number | null;
  not_answerable?: number | null;
  disagree?: number | null;
}

/** The prompt exactly as it was sent, recorded per version. vlm/prompts.py only
 *  ever holds the latest wording, so this is the only way to read an older one. */
export interface PromptVersion {
  prompt_name: string;
  prompt_version: number;
  qgroup: string;
  group_name: string | null;
  question: string;
  prompt_text: string;
  max_tokens: number | null;
  model: string | null;
  first_seen: string | null;
}

export interface PromptRegistry {
  draft: {
    name: string;
    version: number;
    preamble: string;
    repeat_penalty: number;
    groups: PromptGroup[];
  };
  versions: PromptVersion[];
  judge: {
    name: string;
    version: number;
    rubrics: { key: string; groups: string[]; title: string; rubric: string }[];
  };
  usage: PromptUsage[];
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
