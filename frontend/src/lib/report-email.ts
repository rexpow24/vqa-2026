import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type ReportForEmail = {
  id: string;
  video_id: string;
  reason: string;
  question_group: string | null;
  entity_key: string | null;
  target_label: string | null;
  target_cell: string | null;
  target_index: number | null;
  note: string | null;
  created_at: string;
};

type Reporter = { name: string; email: string };

const reasonLabels: Record<string, string> = {
  overcut: "Video bị cắt quá mức",
  too_difficult: "Tình huống quá khó",
  entity_color_unclear: "Màu xe khó nhìn hoặc không rõ",
  cause_too_difficult: "Tình huống ở nhóm C quá khó",
  cell_conflict: "Xin hỗ trợ phân xử một ô",
};

export async function notifyAdminsOfVideoReport(report: ReportForEmail, reporter: Reporter): Promise<"sent" | "unconfigured"> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_EMAIL_FROM;
  if (!apiKey || !from) return "unconfigured";

  const db = createAdminClient();
  const [videoResult, adminsResult] = await Promise.all([
    db.from("videos").select("seq,filename").eq("id", report.video_id).single(),
    db.from("user_profiles").select("email").eq("role", "admin").eq("enabled", true),
  ]);
  if (videoResult.error || adminsResult.error || !videoResult.data) {
    throw new Error(videoResult.error?.message ?? adminsResult.error?.message ?? "Video not found");
  }
  const recipients = [...new Set((adminsResult.data ?? []).map((row) => row.email.trim().toLowerCase()).filter(Boolean))];
  if (!recipients.length) throw new Error("No enabled admin email address is available");

  const video = videoResult.data;
  const reason = reasonLabels[report.reason] ?? report.reason;
  const time = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(report.created_at));
  const cell = report.target_label || report.target_cell;
  const side = report.entity_key ? `Bên ${report.entity_key}`
    : report.target_index !== null ? `Bên ${report.target_index + 1}` : null;
  const lines = [
    "Có báo cáo mới cần admin xem trên VQA Clip Pipeline.",
    "",
    `STT video: #${video.seq}`,
    `Tên video: ${video.filename}`,
    `video_id: ${report.video_id}`,
    `report_id: ${report.id}`,
    `Người gửi: ${reporter.name} <${reporter.email}>`,
    `Thời gian: ${time} (Việt Nam)`,
    `Lý do: ${reason}`,
    ...(report.question_group ? [`Nhóm: ${report.question_group}`] : []),
    ...(side ? [`Bên: ${side}`] : []),
    ...(cell ? [`Ô: ${cell}${report.target_cell && report.target_label ? ` (${report.target_cell})` : ""}`] : []),
    ...(report.note ? [`Ghi chú: ${report.note}`] : []),
    "",
    "Xem và xử lý báo cáo: https://vqa-vn-traffic-labeling.vercel.app/admin/reports",
  ];
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `video-report/${report.id}`,
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `[VQA Traffic] Báo cáo mới - video #${video.seq} - ${reason}`,
      text: lines.join("\n"),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Resend rejected report email (HTTP ${response.status})`);
  return "sent";
}
