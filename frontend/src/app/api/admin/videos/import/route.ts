import { parse } from "csv-parse/sync";
import { requireApiProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { probeDriveVideo } from "@/lib/drive";
import { headerError, VIDEO_CSV_MAX_ROWS } from "@/lib/video-csv";

// One chunk of videos.csv per call; the browser splits larger files. A chunk
// is at most 10 rounds of 10 concurrent Drive probes (~3s each), which fits
// the 60s every Vercel plan allows.
export const maxDuration = 60;
const PROBE_CONCURRENCY = 10;

type RowResult = {
  index: number; filename: string; status: "inserted" | "skipped" | "conflict" | "failed";
  reason?: string; existing_drive_file_id?: string;
};

export async function POST(request: Request) {
  const caller = await requireApiProfile("admin");
  if (caller instanceof Response) return caller;
  let csv: unknown;
  try { csv = (await request.json()).csv; } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (typeof csv !== "string" || csv.length > 2_000_000) {
    return Response.json({ error: "Cần nội dung CSV tối đa 2 MB." }, { status: 422 });
  }
  const header = headerError(csv.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "");
  if (header) return Response.json({ error: header }, { status: 422 });
  let rows: Record<string, string>[];
  try {
    rows = parse(csv, { columns: true, bom: true, skip_empty_lines: true, trim: true });
  } catch {
    return Response.json({ error: "CSV không hợp lệ." }, { status: 422 });
  }
  if (rows.length === 0 || rows.length > VIDEO_CSV_MAX_ROWS) {
    return Response.json({ error: `Mỗi lần gửi cần từ 1 đến ${VIDEO_CSV_MAX_ROWS} dòng.` }, { status: 422 });
  }

  const results: RowResult[] = [];
  const pending: { index: number; filename: string; driveFileId: string; duration: number }[] = [];
  const seen = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const filename = row.filename ?? "";
    const driveFileId = row.drive_file_id ?? "";
    const duration = Number(row.duration_s);
    if (!filename || !/^[\w-]{10,}$/.test(driveFileId)) {
      results.push({ index, filename, status: "failed", reason: "Thiếu tên file hoặc Drive ID không hợp lệ" });
    } else if (seen.has(filename)) {
      results.push({ index, filename, status: "skipped", reason: "Trùng tên với dòng trước trong file" });
    } else if (!Number.isFinite(duration) || duration <= 0) {
      seen.add(filename);
      results.push({ index, filename, status: "failed", reason: "duration_s phải là số dương" });
    } else {
      seen.add(filename);
      pending.push({ index, filename, driveFileId, duration });
    }
  }

  // Classify against what is already stored before spending a Drive probe,
  // so a re-run of the same file costs one query instead of a probe per row.
  const supabase = await createClient();
  const [byName, byId] = await Promise.all([
    supabase.from("videos").select("filename,drive_file_id").in("filename", pending.map((row) => row.filename)),
    supabase.from("videos").select("filename,drive_file_id").in("drive_file_id", pending.map((row) => row.driveFileId)),
  ]);
  const lookupError = byName.error ?? byId.error;
  if (lookupError) return Response.json({ error: lookupError.message }, { status: 500 });
  const idOfName = new Map((byName.data ?? []).map((video) => [video.filename, video.drive_file_id]));
  const nameOfId = new Map((byId.data ?? []).map((video) => [video.drive_file_id, video.filename]));
  const fresh = pending.filter((row) => {
    const storedId = idOfName.get(row.filename);
    if (storedId === row.driveFileId) {
      results.push({ index: row.index, filename: row.filename, status: "skipped", reason: "Đã có" });
    } else if (storedId !== undefined) {
      results.push({ index: row.index, filename: row.filename, status: "conflict",
        reason: "Trùng tên, khác Drive ID", existing_drive_file_id: storedId });
    } else if (nameOfId.has(row.driveFileId)) {
      results.push({ index: row.index, filename: row.filename, status: "failed",
        reason: `Drive ID đã dùng cho ${nameOfId.get(row.driveFileId)}` });
    } else return true;
    return false;
  });

  const probes = new Map<number, Awaited<ReturnType<typeof probeDriveVideo>>>();
  let next = 0;
  await Promise.all(Array.from({ length: PROBE_CONCURRENCY }, async () => {
    while (next < fresh.length) {
      const row = fresh[next++];
      probes.set(row.index, await probeDriveVideo(row.driveFileId));
    }
  }));

  for (const row of fresh) {
    const probe = probes.get(row.index);
    if (probe !== "ok") {
      results.push({ index: row.index, filename: row.filename, status: "failed",
        reason: probe === "unreachable" ? "Không kết nối được Drive" : "Drive không trả về video phát được" });
      continue;
    }
    const { error } = await supabase.from("videos").insert({
      drive_file_id: row.driveFileId, filename: row.filename, duration_s: row.duration, status: "active", available: true,
    });
    if (!error) results.push({ index: row.index, filename: row.filename, status: "inserted" });
    // A concurrent add of the same file between the lookup and this insert.
    else if (error.code === "23505" && error.message.includes("videos_filename_key")) {
      results.push({ index: row.index, filename: row.filename, status: "skipped", reason: "Đã có" });
    } else results.push({ index: row.index, filename: row.filename, status: "failed", reason: error.message });
  }
  return Response.json({ results: results.sort((a, b) => a.index - b.index) });
}
