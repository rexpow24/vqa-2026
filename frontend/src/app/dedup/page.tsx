"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { AnonymizeStatus, DedupItem, DedupRun, DedupStatus } from "@/lib/types";

function mediaUrl(path: string): string {
  return `/api/media/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function name(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function score(value: number): string {
  return value.toFixed(4);
}

export default function DedupPage() {
  const [status, setStatus] = useState<DedupStatus | null>(null);
  const [anon, setAnon] = useState<AnonymizeStatus | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState("0.80");
  const thresholdLoaded = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [next, nextAnon] = await Promise.all([
        api<DedupStatus>("/dedup/status"),
        api<AnonymizeStatus>("/anonymize/status"),
      ]);
      setStatus(next);
      setAnon(nextAnon);
      if (!thresholdLoaded.current) {
        setThresholdDraft(next.threshold.toFixed(2));
        thresholdLoaded.current = true;
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    // Dedup analysis and anonymization both run outside the browser process.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [load]);

  async function act(work: () => Promise<unknown>, success?: string) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await work();
      if (success) setMessage(success);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  async function decide(item: DedupItem, decision: "keep" | "duplicate" | "pending", duplicateOf?: string) {
    await act(async () => {
      const next = await api<DedupStatus>("/dedup/decision", {
        method: "POST",
        body: JSON.stringify({ query_path: item.path, decision, duplicate_of: duplicateOf ?? null }),
      });
      setStatus((previous) => previous ? { ...previous, ...next } : previous);
      const nextPending = next.items.find((candidate) => candidate.path !== item.path && !candidate.decision);
      if (decision !== "pending" && nextPending) setSelectedPath(nextPending.path);
    });
  }

  const items = status?.items ?? [];
  const item = items.find((candidate) => candidate.path === selectedPath) ?? items[0];
  const position = item ? items.findIndex((candidate) => candidate.path === item.path) : -1;
  const canAnonymize = Boolean(status?.ready && !status.busy && status.pending === 0 && !anon?.dedup_problem);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Trim → Dedup → Anonymize</p>
            <h1 className="mt-2 text-2xl font-semibold">Dedup video đã trim</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              DINOv2 Base và pHash so 8 frame mỗi clip. Chỉ clip có điểm top 1 fusion lớn hơn
              ngưỡng mới cần xem thủ công. Mỗi clip hiện cùng 5 ứng viên gần nhất.
            </p>
          </div>
          <button
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            disabled={pending || status?.busy || anon?.busy}
            onClick={() => act(() => api("/dedup/start", { method: "POST" }), "Đã bắt đầu so sánh các clip trimmed.")}
          >
            {status?.busy ? "Đang so sánh..." : !status?.has_index
              ? "Phân tích trimmed/"
              : !status.pair_baseline_ready ? "Tạo mốc so sánh"
                : status.source_changes.added + status.source_changes.changed + status.source_changes.removed > 0
                  ? "So sánh clip mới / cập nhật" : "Chạy lại so sánh Dedup"}
          </button>
        </div>
        {status && <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-3 text-xs text-muted">
          <span>Thay đổi: {status.source_changes.added} mới · {status.source_changes.changed} sửa · {status.source_changes.removed} đã xóa</span>
          <span>Cặp đã lưu: {status.pairs_cached} / {status.pairs_total}</span>
          {!status.pair_baseline_ready && status.has_index && <span className="text-amber">Lượt này sẽ tạo baseline đầy đủ một lần</span>}
        </div>}
        <div className="mt-5 flex flex-wrap items-end gap-4 border-t border-border pt-4">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Ngưỡng top 1 sau fusion
            <input
              type="number" min="0" max="0.99" step="0.01" value={thresholdDraft}
              onChange={(event) => setThresholdDraft(event.target.value)}
              className="w-28 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <button
            className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-40"
            disabled={pending || status?.busy || anon?.busy || Number(thresholdDraft) === status?.threshold}
            onClick={() => act(async () => {
              const next = await api<DedupStatus>("/dedup/threshold", {
                method: "POST", body: JSON.stringify({ threshold: Number(thresholdDraft) }),
              });
              setThresholdDraft(next.threshold.toFixed(2));
            }, "Đã lưu ngưỡng Dedup.")}
          >
            Lưu ngưỡng
          </button>
          <span className="text-sm text-muted">Điều kiện: top 1 &gt; {status?.threshold.toFixed(2) ?? "0.80"}</span>
        </div>
      </header>

      <div className="grid gap-3 text-sm sm:grid-cols-4">
        <Metric label="Trimmed clips" value={status?.total ?? "..."} />
        <Metric label="Vượt ngưỡng" value={status?.suggested ?? "..."} />
        <Metric label="Chưa quyết định" value={status?.pending ?? "..."} />
        <Metric label="Đánh dấu trùng" value={status?.duplicates ?? "..."} />
      </div>

      {error && <p role="alert" className="rounded-md border border-red p-3 text-sm text-red">{error}</p>}
      {message && <p className="text-sm text-green">{message}</p>}
      {status?.problem && <p className="rounded-md border border-amber p-4 text-sm text-amber">{status.problem}</p>}
      {!status?.ready && status?.has_index && !status.busy && <p className="rounded-md border border-amber p-4 text-sm text-amber">
        Danh sách trimmed/ đã thay đổi. Chạy so sánh để cập nhật kết quả trước khi anonymize.
      </p>}
      {status?.busy && <p className="text-sm text-accent">Đang so sánh các cặp còn thiếu trên GPU. Có thể đóng trang và quay lại.</p>}
      {status?.exit_code !== null && status?.exit_code !== undefined && status.exit_code !== 0 && !status.busy && (
        <p className="text-sm text-red">Phân tích dừng với mã {status.exit_code}. Kiểm tra log rồi bấm Phân tích lại.</p>
      )}
      {status?.log_tail && <pre className="max-h-32 overflow-auto rounded-md border border-border bg-surface p-3 text-xs text-muted">{status.log_tail}</pre>}

      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">Lịch sử so sánh</h2>
          <span className="text-xs text-muted">20 lượt gần nhất</span>
        </div>
        {status?.history.length ? <div className="mt-3 divide-y divide-border">
          {status.history.map((run) => <RunRow key={run.run_id} run={run} />)}
        </div> : <p className="mt-3 text-sm text-muted">Chưa có lượt so sánh nào.</p>}
      </section>

      {status?.ready && !status.busy && (
        items.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted">
            Không có clip nào có top 1 fusion &gt; {status.threshold.toFixed(2)}.
            {status.max_score !== null && <> Điểm cao nhất hiện là {score(status.max_score)}.</>}
            {" "}Toàn bộ clip hiện tại đã qua cổng Dedup và có thể anonymize.
          </div>
        ) : item && (
          <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-xs text-muted">ĐỀ XUẤT {position + 1} / {items.length}</p>
                <h2 className="mt-1 text-lg font-semibold">{name(item.path)}</h2>
                <p className="text-sm text-accent">Top 1 fusion {score(item.top_score)} · {item.decision === "duplicate"
                  ? "Đã đánh dấu trùng" : item.decision === "keep" ? "Đã giữ" : "Cần quyết định"}</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-40"
                  disabled={position <= 0} onClick={() => setSelectedPath(items[position - 1].path)}>← Trước</button>
                <button className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-40"
                  disabled={position >= items.length - 1} onClick={() => setSelectedPath(items[position + 1].path)}>Tiếp →</button>
              </div>
            </div>
            <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
              <div className="self-start lg:sticky lg:top-4">
                <p className="mb-2 text-xs uppercase tracking-wider text-muted">Clip đã trim</p>
                <video key={item.path} controls preload="metadata" src={mediaUrl(item.path)}
                  className="w-full rounded-md bg-black" />
                <p className="mt-2 break-all text-xs text-muted">{item.path} · {item.duration_s.toFixed(1)}s</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className={`rounded-md border px-3 py-2 text-sm disabled:opacity-40 ${item.decision === "keep" ? "border-green text-green" : "border-border"}`}
                    disabled={pending} onClick={() => decide(item, "keep")}>Không trùng top 5 · Giữ clip</button>
                  {item.decision && <button className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-40"
                    disabled={pending} onClick={() => decide(item, "pending")}>Bỏ quyết định</button>}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {item.matches.map((match, index) => (
                  <article key={match.path} className={`rounded-md border p-3 ${item.duplicate_of === match.path ? "border-accent bg-surface-2" : "border-border bg-background"}`}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <strong>#{index + 1} · {score(match.score)}</strong>
                      <span className="text-xs text-muted">{match.duration_s.toFixed(1)}s</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">DINO {score(match.dino_score)} · pHash {score(match.phash_score)}</p>
                    <video controls preload="metadata" src={mediaUrl(match.path)} className="mt-2 w-full rounded-md bg-black" />
                    <p className="mt-1 break-all text-xs text-muted">{name(match.path)}</p>
                    <button className={`mt-3 rounded-md border px-3 py-2 text-xs disabled:opacity-40 ${item.duplicate_of === match.path ? "border-accent text-accent" : "border-border"}`}
                      disabled={pending} onClick={() => decide(item, "duplicate", match.path)}>
                      {item.duplicate_of === match.path ? "Đã chọn là bản trùng" : "Trùng với clip này"}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )
      )}

      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Anonymize sau Dedup</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Chỉ xử lý clip đã qua Dedup. Clip đánh dấu trùng vẫn nằm trong trimmed/ để sửa quyết định;
              bản finished/ cũ được chuyển vào artifacts/dedup/excluded_finished/.
            </p>
            {anon?.dedup_problem && <p className="mt-2 text-sm text-amber">{anon.dedup_problem}</p>}
            {anon && <p className="mt-2 text-sm text-muted">
              {anon.completed} / {anon.total} {anon.dedup_problem ? "clip trimmed đã có" : "clip hợp lệ đã có"} bản finished/.
            </p>}
          </div>
          <div className="flex gap-2">
            <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              disabled={pending || !canAnonymize || anon?.busy}
              onClick={() => act(() => api("/anonymize/start", { method: "POST" }), "Đã bắt đầu anonymize.")}>
              {anon?.busy ? "Đang anonymize..." : anon?.paused ? "Tiếp tục anonymize" : "Anonymize clip đã qua Dedup"}
            </button>
            {anon?.pause_supported && <button className="rounded-md border border-border px-3 py-2 text-sm disabled:opacity-40"
              disabled={pending || !anon.busy || anon.pause_requested}
              onClick={() => act(() => api("/anonymize/pause", { method: "POST" }), "Sẽ tạm dừng sau clip hiện tại.")}>
              {anon.pause_requested ? "Đang tạm dừng..." : "Tạm dừng sau clip này"}
            </button>}
          </div>
        </div>
        {anon && anon.total > 0 && <div role="progressbar" aria-valuemin={0} aria-valuemax={anon.total}
          aria-valuenow={anon.completed} className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-accent" style={{ width: `${Math.min(100, anon.completed / anon.total * 100)}%` }} />
        </div>}
        {anon?.exit_code !== null && anon?.exit_code !== undefined && anon.exit_code !== 0 && (
          <p className="mt-2 text-sm text-red">Anonymize dừng với mã {anon.exit_code}. Có thể chạy lại sau khi xử lý lỗi.</p>
        )}
      </section>
    </div>
  );
}

function RunRow({ run }: { run: DedupRun }) {
  const statusLabel = run.status === "running" ? "Đang chạy" : run.status === "completed" ? "Hoàn tất" : "Thất bại";
  const color = run.status === "running" ? "text-accent" : run.status === "completed" ? "text-green" : "text-red";
  return <article className="py-3 first:pt-1 last:pb-1">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <strong className={color}>{statusLabel}</strong>
      <time className="text-muted">{new Date(run.started_at).toLocaleString()}</time>
      <span className="text-muted">{run.source_count} clip · +{run.added_count} mới · {run.changed_count} sửa · {run.removed_count} xóa · {run.pairs_computed} cặp tính</span>
    </div>
    {run.error && <p className="mt-1 break-words text-xs text-red">{run.error}</p>}
  </article>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-md border border-border bg-surface px-4 py-3">
    <div className="text-xs text-muted">{label}</div>
    <div className="mt-1 text-xl font-semibold">{value}</div>
  </div>;
}
