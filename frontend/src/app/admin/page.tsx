import Link from "next/link";
import { requireProfile } from "@/lib/supabase/auth";
import { getAdminStats } from "@/lib/admin-stats";

export default async function AdminPage() {
  await requireProfile("admin");
  const stats = await getAdminStats();
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
      <Link href="/admin/users" className="ml-auto text-sm text-accent">Quản lý người dùng</Link>
      <Link href="/admin/videos" className="text-sm text-accent">Quản lý video</Link>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(([label, value]) => <div key={label} className="rounded-md border border-border bg-surface p-4">
        <div className="text-xs text-muted">{label}</div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      </div>)}
    </div>
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
  </div>;
}
