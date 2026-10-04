import Link from "next/link";
import LegacyAnnotate from "@/components/LegacyAnnotate";
import { requireProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 10;

type QueueRow = {
  video_id: string;
  filename: string;
  duration_s: number;
  coverage: number;
  answered: number;
  assignment_status: string;
};

const STATUS_LABEL: Record<string, string> = {
  available: "Có thể nhận",
  pending: "Đã nhận",
  in_progress: "Đang gán nhãn",
};

export default async function AnnotatePage({ searchParams }: PageProps<"/annotate">) {
  if (process.env.VERCEL !== "1" && process.env.PLATFORM_MODE !== "hosted") {
    return <LegacyAnnotate />;
  }
  await requireProfile();
  const params = await searchParams;
  const rawPage = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const page = Number.isFinite(rawPage) && rawPage > 1 ? Math.floor(rawPage) : 1;

  const supabase = await createClient();
  // One bounded page plus two counters, instead of selecting every video,
  // every draft and every answer and joining them in the browser. The queue
  // already drops videos this annotator finished and orders what is left so
  // the least-covered videos come first.
  const [queueResult, progressResult] = await Promise.all([
    supabase.rpc("annotator_queue", { page_size: PAGE_SIZE, page_offset: (page - 1) * PAGE_SIZE }),
    supabase.rpc("annotator_progress"),
  ]);
  const error = queueResult.error ?? progressResult.error;
  if (error) throw new Error(error.message);

  const queue = (queueResult.data ?? []) as QueueRow[];
  const progress = (progressResult.data ?? [])[0] as { completed: number; total: number } | undefined;
  const completed = Number(progress?.completed ?? 0);
  const total = Number(progress?.total ?? 0);
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = Math.max(0, total - completed);

  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-xl font-semibold">Video gán nhãn</h2>
      <Link href="/admin" className="text-sm text-accent">Bảng quản trị</Link>
    </div>

    <section aria-label="Tiến trình của bạn" className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          Bạn đã gán nhãn <span className="tabular-nums text-accent">{completed}</span>
          {" / "}<span className="tabular-nums">{total}</span> video
        </span>
        <span className="tabular-nums text-muted">{percent}% · còn {remaining}</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed}
        className="h-2 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </section>

    {queue.length === 0 ? <div className="rounded-md border border-border bg-surface p-4 text-sm text-muted">
      {completed > 0 && completed >= total
        ? "Bạn đã gán nhãn hết video hiện có. Cảm ơn bạn!"
        : page > 1
          ? "Trang này không còn video nào. Hãy quay lại trang trước."
          : "Chưa có video nào sẵn sàng. Video cần đủ 9 bản nháp trước khi gán nhãn được."}
    </div> : <div className="grid gap-3 sm:grid-cols-2">
      {queue.map((row) => <Link key={row.video_id} href={`/annotate/${row.video_id}`}
        className="rounded-md border border-border bg-surface p-4 hover:border-accent">
        <div className="truncate font-medium">{row.filename}</div>
        <div className="mt-2 flex justify-between gap-2 text-xs text-muted">
          <span className="tabular-nums">
            {Number(row.duration_s).toFixed(2)}s · {Number(row.answered)}/9 câu đã duyệt
          </span>
          <span>{STATUS_LABEL[row.assignment_status] ?? row.assignment_status}</span>
        </div>
        {Number(row.coverage) === 0 && <div className="mt-1 text-xs text-amber">Chưa ai gán nhãn</div>}
      </Link>)}
    </div>}

    {(page > 1 || queue.length === PAGE_SIZE) && <nav aria-label="Phân trang" className="flex items-center gap-3 text-sm">
      {page > 1
        ? <Link href={`/annotate?page=${page - 1}`} className="rounded border border-border px-3 py-1.5">Trang trước</Link>
        : <span className="rounded border border-border px-3 py-1.5 text-muted opacity-40">Trang trước</span>}
      <span className="tabular-nums text-muted">Trang {page}</span>
      {queue.length === PAGE_SIZE
        ? <Link href={`/annotate?page=${page + 1}`} className="rounded border border-border px-3 py-1.5">Trang sau</Link>
        : <span className="rounded border border-border px-3 py-1.5 text-muted opacity-40">Trang sau</span>}
    </nav>}
  </div>;
}
