"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { RunStatus } from "@/lib/types";

export default function RunPage() {
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await api<RunStatus>("/run/status"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    // Poll while this tab is open. `run_pipeline.py` is a subprocess the
    // sidecar owns, not this browser tab, so polling (not push) is the
    // simplest correct way to reflect its progress -- mirrors app.py's
    // st.fragment(run_every=2) for the same reason. `load` is also reused
    // after Start/Stop, so it can't be inlined as a one-off effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [load]);

  async function start() {
    setPending(true);
    setError(null);
    try {
      await api("/run/start", { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  async function stop() {
    setPending(true);
    setError(null);
    try {
      await api("/run/stop", { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  if (!status) {
    return <p className="text-sm text-muted">Loading...</p>;
  }

  const pct = status.total > 0 ? Math.round((status.done / status.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center gap-3">
        <button
          className="px-4 py-2 text-sm rounded-md bg-accent text-white disabled:opacity-40"
          disabled={pending || status.busy || status.queued === 0}
          onClick={start}
        >
          Start run
        </button>
        <button
          className="px-4 py-2 text-sm rounded-md border border-border disabled:opacity-40"
          disabled={pending || !status.busy}
          onClick={stop}
        >
          Stop
        </button>
        <span className={`text-sm ${status.busy ? "text-green" : "text-muted"}`}>
          {status.busy ? "Running" : "Idle"}
        </span>
      </section>

      <section>
        <div className="flex justify-between text-sm text-muted mb-1">
          <span>
            {status.done} / {status.total} videos done
          </span>
          <span>{status.queued} queued</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <div
            className="h-full bg-accent transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted mb-2">Log tail</h2>
        <pre className="rounded-md border border-border bg-surface p-3 text-xs text-muted overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap">
          {status.log_tail}
        </pre>
      </section>

      {error && <p className="text-sm text-red">{error}</p>}
    </div>
  );
}
