"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { REMOVABLE, RETRYABLE, type RunStatus, type Video, type VideoStatus } from "@/lib/types";

export default function QueuePage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [pasteText, setPasteText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // In-flight state for whatever action was just clicked.
  const [pending, setPending] = useState(false);
  // A run in progress: retry/remove act on the same table run_pipeline.py is
  // writing, so app.py disables them while busy and this page follows suit.
  const [runBusy, setRunBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [data, status] = await Promise.all([
        api<{ videos: Video[] }>("/videos"),
        api<RunStatus>("/run/status"),
      ]);
      setVideos(data.videos);
      setRunBusy(status.busy);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // `load` is reused after every mutation (add/remove/retry), not just on
    // mount, so it can't be inlined as a one-off effect body -- the rule
    // below assumes a data-fetching library; we don't have one for this
    // pass and a REST proxy fetch-on-mount is otherwise the standard idiom.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function run(label: string, fn: () => Promise<void>) {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(label);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  const removable = videos.filter((v) => REMOVABLE.includes(v.status));
  const strandedCount = videos.filter(
    (v) => v.status === "DOWNLOADING" || v.status === "PROCESSING",
  ).length;
  const locked = pending || runBusy;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-sm font-medium text-muted mb-2">Add videos</h2>
        <textarea
          className="w-full h-28 rounded-md bg-surface border border-border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent"
          placeholder="Paste one YouTube URL per line"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
        />
        <div className="mt-2 flex gap-2">
          <button
            className="px-3 py-1.5 text-sm rounded-md bg-accent text-white disabled:opacity-40"
            disabled={pending || !pasteText.trim()}
            onClick={() =>
              run("Added to queue.", async () => {
                const res = await api<{ added: number; dupes: number; bad: string[] }>(
                  "/videos/enqueue",
                  { method: "POST", body: JSON.stringify({ text: pasteText }) },
                );
                setPasteText("");
                setMessage(
                  `Added ${res.added}, ${res.dupes} duplicate(s)${
                    res.bad.length ? `, ${res.bad.length} unparsable line(s)` : ""
                  }.`,
                );
              })
            }
          >
            Add to queue
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-muted">Videos ({videos.length})</h2>
          <div className="flex gap-2">
            {RETRYABLE.map((status) => (
              <button
                key={status}
                className="px-3 py-1.5 text-xs rounded-md border border-border text-muted hover:text-foreground disabled:opacity-40"
                disabled={locked}
                onClick={() =>
                  run(`Requeued ${status}.`, async () => {
                    const res = await api<{ requeued: number }>(`/videos/retry/${status}`, {
                      method: "POST",
                    });
                    setMessage(`Requeued ${res.requeued} video(s) that were ${status}.`);
                  })
                }
              >
                Retry {status}
              </button>
            ))}
          </div>
        </div>

        {strandedCount > 0 && !runBusy && (
          <div className="mb-3 flex items-center justify-between rounded-md border border-amber/40 bg-surface px-3 py-2 text-sm">
            <span className="text-amber">
              {strandedCount} video(s) sit at DOWNLOADING/PROCESSING with no run in progress --
              a crash, a reboot, or a run started from another tab.
            </span>
            <button
              className="px-2 py-1 text-xs rounded-md border border-border hover:text-foreground disabled:opacity-40"
              disabled={pending}
              onClick={() =>
                run("Marked stranded rows STOPPED.", async () => {
                  const res = await api<{ marked: number }>("/videos/mark-stopped", {
                    method: "POST",
                  });
                  setMessage(`Marked ${res.marked} row(s) STOPPED -- now resumable and removable.`);
                })
              }
            >
              Mark STOPPED
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : videos.length === 0 ? (
          <p className="text-sm text-muted">Queue is empty.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Min</th>
                  <th className="px-3 py-2">Bounds</th>
                  <th className="px-3 py-2">Clips</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => (
                  <tr key={v.youtube_video_id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      {REMOVABLE.includes(v.status) && (
                        <input
                          type="checkbox"
                          checked={selected.has(v.youtube_video_id)}
                          onChange={() => toggle(v.youtube_video_id)}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate">
                      {v.title ?? v.youtube_video_id}
                    </td>
                    <td className="px-3 py-2 max-w-40 truncate text-muted">
                      {v.channel_name ?? ""}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={v.status} />
                    </td>
                    <td className="px-3 py-2 text-muted">{v.stage ?? "-"}</td>
                    <td className="px-3 py-2 text-muted">
                      {v.duration_s ? (v.duration_s / 60).toFixed(1) : "-"}
                    </td>
                    <td className="px-3 py-2 text-muted">{v.n_boundaries ?? 0}</td>
                    <td className="px-3 py-2 text-muted">{v.n_clips ?? 0}</td>
                    <td className="px-3 py-2 max-w-xs truncate text-red">
                      {v.error_code ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {removable.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted mb-1.5">
              Drops the URL and, for a STOPPED video, any clips it produced -- including files
              already approved into <code>trimmed/</code>. The download stays on disk.
            </p>
            <button
              className="px-3 py-1.5 text-sm rounded-md border border-red/40 text-red hover:bg-red/10 disabled:opacity-40"
              disabled={locked || selected.size === 0}
              onClick={() =>
                run("Removed selected video(s).", async () => {
                  for (const id of selected) {
                    await api(`/videos/${id}/remove`, { method: "POST" });
                  }
                  setSelected(new Set());
                })
              }
            >
              Remove selected ({selected.size})
            </button>
          </div>
        )}
      </section>

      {message && <p className="text-sm text-green">{message}</p>}
      {error && <p className="text-sm text-red">{error}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: VideoStatus }) {
  const color =
    status === "READY_FOR_REVIEW" || status === "DONE"
      ? "text-green"
      : status === "FAILED" || status === "DOWNLOAD_FAILED"
        ? "text-red"
        : status === "STOPPED"
          ? "text-amber"
          : "text-muted";
  return <span className={color}>{status}</span>;
}
