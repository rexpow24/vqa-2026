// CSV writer for downloads (reading uses csv-parse). A UTF-8 BOM and CRLF make
// Excel open Vietnamese text correctly; fields with commas, quotes or line
// breaks are quoted per RFC 4180.

function cell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(header: string[], rows: Record<string, unknown>[]): string {
  return "﻿" + [header, ...rows.map((row) => header.map((name) => row[name]))]
    .map((cells) => cells.map(cell).join(",")).join("\r\n") + "\r\n";
}
