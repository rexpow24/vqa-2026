import Link from "next/link";

/** `/path?page=n&q=…`, omitting defaults. */
export function pageHref(path: string, page: number, query: string) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (query) params.set("q", query);
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

/** 1 … 4 5 [6] 7 8 … 20: first, last and two either side of the current page. */
function pageList(current: number, last: number): (number | "gap")[] {
  const pages = new Set([1, last, current - 2, current - 1, current, current + 1, current + 2]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= last).sort((a, b) => a - b);
  return sorted.flatMap((page, index) => index > 0 && page - sorted[index - 1] > 1 ? ["gap" as const, page] : [page]);
}

// Numbered pages plus a "go to page" box; plain links and a GET form, so it
// works as a server component and keeps the search in the URL.
export function Pagination({ path, page, lastPage, query }: { path: string; page: number; lastPage: number; query: string }) {
  if (lastPage <= 1) return null;
  const id = `${path.replaceAll("/", "-")}-page`;
  return <nav aria-label="Phân trang" className="flex flex-wrap items-center gap-1.5 text-sm">
    {page > 1 ? <Link href={pageHref(path, page - 1, query)} className="rounded border border-border px-2.5 py-1">‹ Trước</Link>
      : <span className="rounded border border-border px-2.5 py-1 opacity-40">‹ Trước</span>}
    {pageList(page, lastPage).map((item, index) => item === "gap"
      ? <span key={`gap-${index}`} className="px-1 text-muted">…</span>
      : item === page
        ? <span key={item} aria-current="page" className="rounded border border-accent bg-accent/20 px-2.5 py-1 tabular-nums">{`Trang ${item}`}</span>
        : <Link key={item} href={pageHref(path, item, query)} className="rounded border border-border px-2.5 py-1 tabular-nums">{item}</Link>)}
    {page < lastPage ? <Link href={pageHref(path, page + 1, query)} className="rounded border border-border px-2.5 py-1">Sau ›</Link>
      : <span className="rounded border border-border px-2.5 py-1 opacity-40">Sau ›</span>}
    <form action={path} className="ml-2 flex items-center gap-1.5">
      {query && <input type="hidden" name="q" value={query} />}
      <label htmlFor={id} className="text-muted">Đến trang</label>
      <input id={id} name="page" type="number" min={1} max={lastPage} defaultValue={page}
        className="w-16 rounded border border-border bg-background px-2 py-1 tabular-nums" />
      <span className="text-muted">{`/ ${lastPage}`}</span>
      <button type="submit" className="rounded border border-border px-2.5 py-1">Đi</button>
    </form>
  </nav>;
}

/** Page number from `?page=`, at least 1. */
export function readPage(value: string | string[] | undefined) {
  const raw = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(raw) && raw > 1 ? Math.floor(raw) : 1;
}
