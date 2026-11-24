import { requireProfile } from "@/lib/supabase/auth";
import { getAdminStats } from "@/lib/admin-stats";
import { createClient } from "@/lib/supabase/server";
import { AdjudicationPanel, type AdjudicationSummary } from "./adjudication-panel";

export default async function AdminPage() {
  await requireProfile("admin");
  const supabase = await createClient();
  const [stats, summary, references] = await Promise.all([getAdminStats(), supabase.rpc("adjudication_summary"),
    supabase.rpc("reference_view_stats")]);
  if (summary.error) throw new Error(summary.error.message);
  if (references.error) throw new Error(references.error.message);
  // features/c-reference-hints: least opens first, so whoever skips the references tops the list.
  const referenceRows = (references.data ?? []) as { annotator_id: string; name: string; label: string | null; opens: number;
    videos_opened: number; c_answers: number; last_opened_at: string | null; training_c_completed_at: string | null;
    training_e_completed_at: string | null }[];
  const cards = [
    ["Người gán nhãn", stats.totalAnnotators],
    ["Video", stats.totalVideos],
    ["Video hoàn thành", stats.completedVideos],
    ["Video còn lại", stats.pendingVideos],
    ["Câu đã duyệt", stats.totalAnnotations],
  ] as const;
  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-center gap-4">
      <h2 className="text-xl font-semibold">Dashboard tiến độ</h2>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(([label, value]) => <div key={label} className="rounded-md border border-border bg-surface p-4">
        <div className="text-xs text-muted">{label}</div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      </div>)}
    </div>
    <AdjudicationPanel summary={(summary.data ?? { answers: {}, labels: {} }) as AdjudicationSummary} />
    <p className="text-sm text-muted">Lượt gán nhãn đã hoàn thành: {stats.completedAssignments}/{stats.totalAssignments}</p>
    <div className="overflow-x-auto rounded-md border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs text-muted"><tr>
          <th className="p-3">Người gán nhãn</th><th className="p-3">Đã giao</th><th className="p-3">Hoàn thành</th>
          <th className="p-3">Còn lại</th><th className="p-3">Tiến độ</th><th className="p-3">Câu đã duyệt</th><th className="p-3">Hoạt động gần nhất</th>
        </tr></thead>
        <tbody>{stats.users.map((item) => <tr key={item.profile.id} className="border-b border-border last:border-0">
          <td className="p-3">{item.profile.name}{!item.profile.enabled && <span className="ml-2 text-xs text-amber">Tạm khóa</span>}</td>
          <td className="p-3 tabular-nums">{item.assigned}</td><td className="p-3 tabular-nums">{item.completed}</td>
          <td className="p-3 tabular-nums">{item.remaining}</td><td className="p-3 tabular-nums">{item.completionRate}%</td>
          <td className="p-3 tabular-nums">{item.annotations}</td>
          <td className="p-3 text-muted">{item.lastActivity ? new Date(item.lastActivity).toLocaleString("vi-VN") : "Chưa có"}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <section className="flex flex-col gap-2">
      <h3 className="text-base font-semibold">Video hướng dẫn (nhóm C, E) và tham khảo nhóm C</h3>
      <p className="text-xs text-muted">Số lần mở video K hoặc video so sánh từ thẻ nhắc ở ô &quot;kiểu xung đột&quot;, cạnh số câu C đã lưu. Ít nhất xếp trên cùng.</p>
      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted"><tr>
            <th className="p-3">Người gán nhãn</th><th className="p-3">Lượt mở</th><th className="p-3">Số video đã mở</th>
            <th className="p-3">Câu C đã lưu</th><th className="p-3">Lần mở gần nhất</th><th className="p-3">Đã xem hướng dẫn C</th><th className="p-3">Đã xem hướng dẫn E</th>
          </tr></thead>
          <tbody>{referenceRows.map((row) => <tr key={row.annotator_id} className="border-b border-border last:border-0">
            <td className="p-3">{row.name}{row.label && <span className="ml-2 text-xs text-muted">{row.label}</span>}</td>
            <td className={`p-3 tabular-nums ${Number(row.opens) === 0 ? "text-amber" : ""}`}>{row.opens}</td>
            <td className="p-3 tabular-nums">{row.videos_opened}</td><td className="p-3 tabular-nums">{row.c_answers}</td>
            <td className="p-3 text-muted">{row.last_opened_at ? new Date(row.last_opened_at).toLocaleString("vi-VN") : "Chưa mở"}</td>
            <td className={`p-3 ${row.training_c_completed_at ? "text-muted" : "text-amber"}`}>
              {row.training_c_completed_at ? new Date(row.training_c_completed_at).toLocaleString("vi-VN") : "Chưa xem"}</td>
            <td className={`p-3 ${row.training_e_completed_at ? "text-muted" : "text-amber"}`}>
              {row.training_e_completed_at ? new Date(row.training_e_completed_at).toLocaleString("vi-VN") : "Chưa xem"}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </div>;
}
