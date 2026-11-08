import Link from "next/link";
import LegacyAnnotate from "@/components/LegacyAnnotate";
import { requireProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 10;

type Row = {
  video_id: string; seq: number; filename: string; duration_s: number; status: string;
  answered: number; agreement: boolean; total: number;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Chưa làm",
  in_progress: "Đang gán nhãn",
  completed: "Đã hoàn thành",
};
const STATUS_CLASS: Record<string, string> = {
  pending: "text-muted", in_progress: "text-amber", completed: "text-green",
};

function href(page: number, query: string) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (query) params.set("q", query);
  const text = params.toString();
  return text ? `/annotate?${text}` : "/annotate";
}

/** 1 … 4 5 [6] 7 8 … 20: first, last and two either side of the current page. */
function pageList(current: number, last: number): (number | "gap")[] {
  const pages = new Set([1, last, current - 2, current - 1, current, current + 1, current + 2]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= last).sort((a, b) => a - b);
  return sorted.flatMap((page, index) => index > 0 && page - sorted[index - 1] > 1 ? ["gap" as const, page] : [page]);
}

// The annotator's own assigned videos, by number: numbered pages and a search
// by number or filename (my_assignments). Admins hand videos out on
// /admin/assignments; nobody claims videos here.
export default async function AnnotatePage({ searchParams }: PageProps<"/annotate">) {
  if (process.env.VERCEL !== "1" && process.env.PLATFORM_MODE !== "hosted") {
    return <LegacyAnnotate />;
  }
  const profile = await requireProfile();
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const query = first(params.q).trim().slice(0, 100);
  const rawPage = Number(first(params.page));
  const requested = Number.isFinite(rawPage) && rawPage > 1 ? Math.floor(rawPage) : 1;

  const supabase = await createClient();
  const [listResult, progressResult] = await Promise.all([
    supabase.rpc("my_assignments", { page_size: PAGE_SIZE, page_offset: (requested - 1) * PAGE_SIZE, search: query || null }),
    supabase.rpc("annotator_progress"),
  ]);
  const error = listResult.error ?? progressResult.error;
  if (error) throw new Error(error.message);

  const rows = (listResult.data ?? []) as Row[];
  const progress = (progressResult.data ?? [])[0] as { assigned: number; completed: number } | undefined;
  const assigned = Number(progress?.assigned ?? 0);
  const completed = Number(progress?.completed ?? 0);
  const percent = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
  // An out-of-range page returns no rows, so its total is unknown; send the
  // reader back to page 1 rather than showing an empty list with no pages.
  const total = Number(rows[0]?.total ?? 0);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-xl font-semibold">Video được giao</h2>
      {profile.role === "admin" && <Link href="/admin" className="text-sm text-accent">Bảng quản trị</Link>}
    </div>

    <section aria-label="Tiến trình của bạn" className="flex flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          Bạn đã gán nhãn <span className="tabular-nums text-accent">{completed}</span>
          {" / "}<span className="tabular-nums">{assigned}</span> video được giao
        </span>
        <span className="tabular-nums text-muted">{percent}% · còn {Math.max(0, assigned - completed)}</span>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={assigned} aria-valuenow={completed}
        className="h-2 overflow-hidden rounded-full bg-background">
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </section>

    <form action="/annotate" className="flex flex-wrap items-center gap-2" role="search">
      <label htmlFor="annotate-search" className="sr-only">Tìm video</label>
      <input id="annotate-search" name="q" defaultValue={query} placeholder="Số thứ tự (vd. 125) hoặc tên file"
        className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-1.5 text-sm sm:max-w-sm" />
      <button type="submit" className="rounded bg-accent px-3 py-1.5 text-sm text-white">Tìm</button>
      {query && <Link href="/annotate" className="text-sm text-muted">Xóa tìm kiếm</Link>}
    </form>

    {rows.length === 0 ? <div className="rounded-md border border-border bg-surface p-4 text-sm text-muted">
      {query ? `Không có video nào được giao cho bạn khớp với "${query}".`
        : requested > 1 ? <>Trang này không có video. <Link href={href(1, query)} className="text-accent">Về trang 1</Link></>
          : assigned === 0 ? "Bạn chưa được giao video nào. Hãy liên hệ admin."
            : "Không còn video nào."}
    </div> : <ol className="overflow-hidden rounded-md border border-border bg-surface">
      {rows.map((row) => <li key={row.video_id} className="border-b border-border last:border-0">
        <Link href={`/annotate/${row.video_id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-background">
          <span className="w-14 shrink-0 font-semibold tabular-nums text-accent">#{row.seq}</span>
          <span className="min-w-0 flex-1 truncate">{row.filename}</span>
          {row.agreement && <span className="rounded border border-accent/50 px-1.5 text-xs text-accent">Agreement</span>}
          <span className="tabular-nums text-xs text-muted">{Number(row.duration_s).toFixed(1)}s · {Number(row.answered)}/9 câu</span>
          <span className={`w-28 text-right text-xs ${STATUS_CLASS[row.status] ?? "text-muted"}`}>{STATUS_LABEL[row.status] ?? row.status}</span>
        </Link>
      </li>)}
    </ol>}

    {total > PAGE_SIZE && <nav aria-label="Phân trang" className="flex flex-wrap items-center gap-1.5 text-sm">
      {requested > 1 ? <Link href={href(requested - 1, query)} className="rounded border border-border px-2.5 py-1">‹ Trước</Link>
        : <span className="rounded border border-border px-2.5 py-1 opacity-40">‹ Trước</span>}
      {pageList(requested, lastPage).map((item, index) => item === "gap"
        ? <span key={`gap-${index}`} className="px-1 text-muted">…</span>
        : item === requested
          ? <span key={item} aria-current="page" className="rounded border border-accent bg-accent/20 px-2.5 py-1 tabular-nums">{`Trang ${item}`}</span>
          : <Link key={item} href={href(item, query)} className="rounded border border-border px-2.5 py-1 tabular-nums">{item}</Link>)}
      {requested < lastPage ? <Link href={href(requested + 1, query)} className="rounded border border-border px-2.5 py-1">Sau ›</Link>
        : <span className="rounded border border-border px-2.5 py-1 opacity-40">Sau ›</span>}
      <form action="/annotate" className="ml-2 flex items-center gap-1.5">
        {query && <input type="hidden" name="q" value={query} />}
        <label htmlFor="annotate-page" className="text-muted">Đến trang</label>
        <input id="annotate-page" name="page" type="number" min={1} max={lastPage} defaultValue={requested}
          className="w-16 rounded border border-border bg-background px-2 py-1 tabular-nums" />
        <span className="text-muted">/ {lastPage}</span>
        <button type="submit" className="rounded border border-border px-2.5 py-1">Đi</button>
      </form>
    </nav>}
  </div>;
}
