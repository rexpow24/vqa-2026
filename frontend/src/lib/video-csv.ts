// videos.csv as written by scripts/drive-upload.mjs. No imports, so the
// browser, the import route and the verify script all share this file.
export const VIDEO_CSV_COLUMNS = ["filename", "drive_file_id", "duration_s"];
export const VIDEO_CSV_MAX_ROWS = 100;

/** Null when the header names exactly the three columns, in any order. */
export function headerError(headerLine: string): string | null {
  const columns = headerLine.replace(/^﻿/, "").split(",").map((column) => column.trim());
  const ok = columns.length === VIDEO_CSV_COLUMNS.length && VIDEO_CSV_COLUMNS.every((column) => columns.includes(column));
  return ok ? null : `Dòng đầu phải là ${VIDEO_CSV_COLUMNS.join(",")}.`;
}

/**
 * Split a file into chunks of at most `size` data rows, each repeating the
 * header. `lines` holds each row's 1-based line number in the original file,
 * so a report can point at the line the admin sees in their editor.
 */
export function chunkVideoCsv(text: string, size = VIDEO_CSV_MAX_ROWS) {
  const all = text.replace(/^﻿/, "").split(/\r?\n/);
  const header = all[0] ?? "";
  const rows = all.slice(1).map((line, i) => ({ line, number: i + 2 })).filter((row) => row.line.trim());
  const chunks: { csv: string; lines: number[] }[] = [];
  for (let start = 0; start < rows.length; start += size) {
    const part = rows.slice(start, start + size);
    chunks.push({ csv: [header, ...part.map((row) => row.line)].join("\n"), lines: part.map((row) => row.number) });
  }
  return { header, chunks, total: rows.length };
}
