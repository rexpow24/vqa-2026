// The adjudication CSV round trip: the export lists open conflicts with every
// involved annotator's answer; the team fills the decision columns and uploads
// the same file. Ids and the fingerprint sit at the end so the content reads
// first in Excel. See features/answer-adjudication/.

export type ExportRow = {
  kind: "answer" | "event"; video_id: string; filename: string; draft_id: string | null; qgroup: string | null;
  question: string | null; draft_answer: string | null; fingerprint: string;
  annotators: { name: string; verdict?: string; reason?: string | null; note?: string | null; answer: string; keyframes?: number[] }[];
};

export const DECISION_COLUMNS = ["final_verdict", "final_answer", "final_keyframes_s", "final_event_label",
  "llm_suggestion", "followed_llm"] as const;
export const ID_COLUMNS = ["video_id", "draft_id", "fingerprint"] as const;
export const IMPORT_COLUMNS = ["kind", ...ID_COLUMNS, ...DECISION_COLUMNS];

export function exportTable(rows: ExportRow[], origin: string) {
  const width = Math.max(2, ...rows.map((row) => row.annotators?.length ?? 0));
  const annotatorColumns = Array.from({ length: width }, (_, index) =>
    ["annotator", "verdict", "reason", "answer", "keyframes"].map((name) => `${name}_${index + 1}`)).flat();
  const header = ["kind", "filename", "video_url", "qgroup", "question", "gemini_answer",
    ...annotatorColumns, ...DECISION_COLUMNS, ...ID_COLUMNS];
  const records = rows.map((row) => {
    const record: Record<string, unknown> = {
      kind: row.kind, filename: row.filename, video_url: `${origin}/annotate/${row.video_id}`,
      qgroup: row.kind === "event" ? "EVENT" : row.qgroup,
      question: row.kind === "event" ? "Nhãn sự kiện (accident / near-miss)" : row.question,
      gemini_answer: row.draft_answer, video_id: row.video_id, draft_id: row.draft_id, fingerprint: row.fingerprint,
    };
    (row.annotators ?? []).forEach((annotator, index) => {
      const n = index + 1;
      record[`annotator_${n}`] = annotator.name;
      record[`verdict_${n}`] = annotator.verdict ?? "";
      record[`reason_${n}`] = [annotator.reason, annotator.note].filter(Boolean).join(": ");
      record[`answer_${n}`] = annotator.answer;
      record[`keyframes_${n}`] = (annotator.keyframes ?? []).map(Number).join("; ");
    });
    return record;
  });
  return { header, records };
}

const YES = new Set(["có", "co", "yes", "y", "true", "1", "x"]);
const NO = new Set(["không", "khong", "no", "n", "false", "0"]);

/** Yes/no in Vietnamese or English; anything else stays null so the row is reported invalid. */
export function parseFollowed(value: string | undefined): boolean | null {
  const text = (value ?? "").trim().toLowerCase();
  return YES.has(text) ? true : NO.has(text) ? false : null;
}

/** "1.5; 3" (or "1,5; 3" from a Vietnamese Excel) → [1.5, 3]; a non-number is passed through for the database to reject. */
export function parseKeyframes(value: string | undefined): (number | string)[] {
  return (value ?? "").split(/[;\s]+/).map((part) => part.trim().replace(",", ".")).filter(Boolean)
    .map((part) => Number.isFinite(Number(part)) ? Number(part) : part);
}

/** A row the team has not decided yet: no verdict and no event label. */
export function isUndecided(record: Record<string, string>): boolean {
  return !(record.final_verdict ?? "").trim() && !(record.final_event_label ?? "").trim();
}
