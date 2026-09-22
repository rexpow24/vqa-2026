"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Timeline } from "@/components/Timeline";
import {
  fmtTime,
  type ReviewClip,
  type ReviewNextResponse,
  type ReviewSummary,
  type Shot,
  type ValidateResponse,
} from "@/lib/types";

function isUntouched(shots: Shot[]): boolean {
  return shots.length === 1 && shots[0].default;
}

export default function ReviewPage() {
  const [clip, setClip] = useState<ReviewClip | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);
  const [lastDecision, setLastDecision] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMarkError(null);
    try {
      const data = await api<ReviewNextResponse>("/review/next");
      setClip(data.clip);
      setShots(data.initial_shots);
      setSummary(data.summary);
      if (data.clip) {
        setPlayhead(Math.round((data.clip.duration_rounded / 2) * 10) / 10);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Reused after every decision (Approve/Reject/Flag), not just on mount --
    // see the note in queue/page.tsx's identical effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNext();
  }, [loadNext]);

  // Re-validate on every shot-list change -- this is exactly the stateless
  // RPC pattern architecture.md describes: trim.py's pure functions take the
  // current list and return derived data, called on every interaction.
  useEffect(() => {
    if (!clip) {
      // Nothing to validate -- and the editor below doesn't render without a
      // clip anyway, so stale validation state here is simply never read.
      return;
    }
    let cancelled = false;
    api<ValidateResponse>("/trim/validate", {
      method: "POST",
      body: JSON.stringify({ shots, duration: clip.duration_rounded }),
    })
      .then((v) => {
        if (!cancelled) setValidation(v);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [shots, clip]);

  if (loading && !clip) {
    return <p className="text-sm text-muted">Loading...</p>;
  }

  if (error) {
    return <p className="text-sm text-red">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {summary && (
        <div className="grid grid-cols-4 gap-3 text-sm">
          <Metric label="Top priority left" value={summary.top_left} />
          <Metric label="Low priority left" value={summary.low_left} />
          <Metric label="Reviewed" value={summary.reviewed} />
          <Metric label="Approved" value={summary.approved} />
        </div>
      )}

      {lastDecision && <p className="text-sm text-green">{lastDecision}</p>}

      {!clip ? (
        <p className="text-sm text-green">Nothing left to review.</p>
      ) : (
        <ReviewClipEditor
          key={clip.clip_id}
          clip={clip}
          shots={shots}
          setShots={setShots}
          validation={validation}
          playhead={playhead}
          setPlayhead={setPlayhead}
          markError={markError}
          setMarkError={setMarkError}
          deciding={deciding}
          setDeciding={setDeciding}
          videoRef={videoRef}
          onDecided={(msg) => {
            setLastDecision(msg);
            loadNext();
          }}
        />
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg">{value}</div>
    </div>
  );
}

interface EditorProps {
  clip: ReviewClip;
  shots: Shot[];
  setShots: (s: Shot[]) => void;
  validation: ValidateResponse | null;
  playhead: number;
  setPlayhead: (n: number) => void;
  markError: string | null;
  setMarkError: (s: string | null) => void;
  deciding: boolean;
  setDeciding: (b: boolean) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onDecided: (message: string) => void;
}

function ReviewClipEditor({
  clip,
  shots,
  setShots,
  validation,
  playhead,
  setPlayhead,
  markError,
  setMarkError,
  deciding,
  setDeciding,
  videoRef,
  onDecided,
}: EditorProps) {
  const dmax = clip.duration_rounded;
  const full = shots.length >= clip.max_shots && !isUntouched(shots);
  const errors = validation?.errors ?? [];
  const conflicts = validation?.conflicts ?? [];
  const segments = validation?.segments ?? [];
  const segError = errors.length > 0;

  const videoSrc = `/api/media/${clip.video_path.split("/").map(encodeURIComponent).join("/")}`;

  async function markCut() {
    setMarkError(null);
    try {
      const res = await api<{ shots: Shot[] | null; error: string | null }>("/trim/mark", {
        method: "POST",
        body: JSON.stringify({ shots, duration: dmax, x: playhead, pad: clip.pad_default }),
      });
      if (res.shots === null) {
        setMarkError(res.error);
      } else {
        setShots(res.shots);
      }
    } catch (e) {
      setMarkError(e instanceof Error ? e.message : String(e));
    }
  }

  async function addShot() {
    try {
      const res = await api<{ shots: Shot[] | null; error: string | null }>("/trim/add", {
        method: "POST",
        body: JSON.stringify({ shots, duration: dmax, pad: clip.pad_default }),
      });
      if (res.shots) setShots(res.shots);
    } catch (e) {
      setMarkError(e instanceof Error ? e.message : String(e));
    }
  }

  async function resolveConflict(j: number) {
    try {
      const res = await api<{ shots: Shot[] | null; error: string | null }>("/trim/resolve", {
        method: "POST",
        body: JSON.stringify({ shots, duration: dmax, idx: j }),
      });
      if (res.shots === null) {
        setMarkError(res.error ?? "Cannot resolve automatically - adjust Start/End manually.");
      } else {
        setShots(res.shots);
      }
    } catch (e) {
      setMarkError(e instanceof Error ? e.message : String(e));
    }
  }

  async function reshapeShot(i: number, start: number, end: number) {
    try {
      const res = await api<{ shot: Shot }>("/trim/reshape", {
        method: "POST",
        body: JSON.stringify({ shot: shots[i], start, end }),
      });
      const next = shots.slice();
      next[i] = res.shot;
      setShots(next);
    } catch (e) {
      setMarkError(e instanceof Error ? e.message : String(e));
    }
  }

  function deleteShot(i: number) {
    setShots(shots.filter((_, k) => k !== i));
  }

  async function decide(decision: "APPROVED" | "REJECTED" | "FLAGGED") {
    setDeciding(true);
    try {
      const res = await api<{ decision: string; detail: string }>(
        `/review/${clip.clip_id}/decision`,
        { method: "POST", body: JSON.stringify({ decision, shots }) },
      );
      const icon = { APPROVED: "Approved", REJECTED: "Rejected", FLAGGED: "Flagged" }[
        res.decision as "APPROVED" | "REJECTED" | "FLAGGED"
      ];
      onDecided(`${icon} \`${clip.clip_id}\` -- ${res.detail}`);
    } catch (e) {
      setMarkError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeciding(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm">
          <span className={clip.band === "TOP" ? "text-amber" : "text-muted"}>
            {clip.band === "TOP" ? "TOP PRIORITY" : "Low priority"}
          </span>{" "}
          <code className="text-foreground">{clip.clip_id}</code>{" "}
          <span className="text-muted">{clip.duration_s.toFixed(1)}s</span>
          {clip.flags.length > 0 && (
            <span className="text-amber"> -- {clip.flags.join(", ")}</span>
          )}
        </h2>
      </div>

      <video
        ref={videoRef}
        key={videoSrc}
        src={videoSrc}
        controls
        autoPlay
        loop
        className="w-full rounded-md border border-border bg-black max-h-[480px]"
      />

      {clip.already_materialized > 0 && (
        <p className="text-xs text-amber">
          Already materialized as {clip.already_materialized} file(s) in trimmed/. Approving
          again overwrites them; Reject deletes them.
        </p>
      )}

      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-medium mb-1">Trim</h3>
        <p className="text-xs text-muted mb-3">
          Park the playhead on the impact and press Mark cut: that becomes impact +/-
          {clip.pad_default}s, shrunk automatically if it runs off the clip or into another
          shot. Up to {clip.max_shots} shots, one output file each.
        </p>

        <div className="flex items-center gap-3 mb-3">
          <input
            type="range"
            min={0}
            max={dmax}
            step={0.1}
            value={playhead}
            onChange={(e) => setPlayhead(parseFloat(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="text-sm text-muted w-14 text-right">{playhead.toFixed(1)}s</span>
          <button
            className="px-2 py-1 text-xs rounded-md border border-border text-muted hover:text-foreground"
            onClick={() => {
              const t = videoRef.current?.currentTime;
              if (t !== undefined) setPlayhead(Math.round(t * 10) / 10);
            }}
          >
            Use video time
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded-md bg-accent text-white disabled:opacity-40"
            disabled={full}
            onClick={markCut}
          >
            Mark cut
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded-md border border-border disabled:opacity-40"
            disabled={full}
            onClick={addShot}
          >
            Add shot
          </button>
        </div>

        <Timeline shots={shots} duration={dmax} conflicts={conflicts} />

        {conflicts.map((c) => (
          <div
            key={`${c.i}-${c.j}`}
            className="flex items-center justify-between rounded-md border border-red/40 bg-surface px-3 py-2 text-sm mb-2"
          >
            <span className="text-red">
              Shots {c.i + 1} and {c.j + 1} overlap by {c.amount.toFixed(1)}s (
              {c.start.toFixed(1)}-{c.end.toFixed(1)}s).
            </span>
            <button
              className="px-2 py-1 text-xs rounded-md border border-border hover:text-foreground"
              onClick={() => resolveConflict(c.j)}
            >
              Resolve conflict
            </button>
          </div>
        ))}

        <div className="flex flex-col gap-2 mt-2">
          {shots.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <span
                className="w-3.5 h-3.5 rounded-sm shrink-0"
                style={{ background: ["#22C55E", "#3B82F6", "#F59E0B"][i % 3] }}
              />
              <span className="text-sm w-4">{i + 1}</span>
              <label className="flex items-center gap-1.5 text-xs text-muted">
                Start
                <input
                  type="number"
                  min={0}
                  max={dmax}
                  step={0.1}
                  value={s.start}
                  onChange={(e) => {
                    const next = shots.slice();
                    next[i] = { ...next[i], start: parseFloat(e.target.value) };
                    setShots(next);
                  }}
                  onBlur={(e) => reshapeShot(i, parseFloat(e.target.value), s.end)}
                  className="w-20 rounded border border-border bg-surface px-2 py-1 text-foreground"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted">
                End
                <input
                  type="number"
                  min={0}
                  max={dmax}
                  step={0.1}
                  value={s.end}
                  onChange={(e) => {
                    const next = shots.slice();
                    next[i] = { ...next[i], end: parseFloat(e.target.value) };
                    setShots(next);
                  }}
                  onBlur={(e) => reshapeShot(i, s.start, parseFloat(e.target.value))}
                  className="w-20 rounded border border-border bg-surface px-2 py-1 text-foreground"
                />
              </label>
              <button
                className="ml-auto px-2 py-1 text-xs rounded-md border border-border text-muted hover:text-red"
                onClick={() => deleteShot(i)}
                title="Remove this shot"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {markError && <p className="text-sm text-red mt-2">{markError}</p>}

        {errors.map((msg, i) => (
          <p key={i} className="text-sm text-amber mt-2">
            {msg}
          </p>
        ))}
        {!segError && segments.length > 0 && (
          <p className="text-xs text-muted mt-2">
            Approve writes {segments.length} file(s) to trimmed/:{" "}
            {segments.map(([a, b]) => `${fmtTime(a)} -> ${fmtTime(b)}`).join(", ")}. The master
            and the delivered clip are never modified.
          </p>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-xs text-muted mb-3">
          Approve or Reject is required to advance -- there is no Skip. Approve stays disabled
          while any conflict or out-of-range shot remains.
        </p>
        <div className="flex gap-3">
          <button
            className="flex-1 px-4 py-2 text-sm rounded-md bg-green text-black font-medium disabled:opacity-40"
            disabled={segError || deciding}
            onClick={() => decide("APPROVED")}
          >
            Approve
          </button>
          <button
            className="flex-1 px-4 py-2 text-sm rounded-md border border-border disabled:opacity-40"
            disabled={deciding}
            onClick={() => decide("REJECTED")}
          >
            Reject
          </button>
          <button
            className="flex-1 px-4 py-2 text-sm rounded-md border border-amber/40 text-amber disabled:opacity-40"
            disabled={deciding}
            onClick={() => decide("FLAGGED")}
          >
            Flag
          </button>
        </div>
      </div>
    </div>
  );
}
