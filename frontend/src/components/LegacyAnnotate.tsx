"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { LabelGroup } from "@/components/LabelGroup";
import type {
  AnnotateShot,
  AnnotateShotsResponse,
  Annotator,
  ConsensusResponse,
  Difficulty,
  DraftItem,
  EventLabel,
  ShotSummary,
  Verdict,
  VerdictConsensus,
} from "@/lib/types";

// Team B works one shot at a time: watch the clip, read the nine drafts the
// VLM wrote for it, and judge each one. A verdict is three-valued --
// NOT_ANSWERABLE means the video contains no event the question could be about,
// which is a legitimate property of the clip rather than a model mistake, and
// is what DC.pdf step 4 calls a "câu hỏi không đáp án".
//
// The model's own evidence timestamps stay hidden until the annotator has saved
// their own. Showing them first would anchor the human marks to the prediction
// they are supposed to be measured against.

const VERDICT_LABEL: Record<Verdict, string> = {
  AGREE: "Đồng ý",
  NOT_ANSWERABLE: "Không trả lời được",
  DISAGREE: "Không đồng ý",
};

const VIDEO_STEP_OPTIONS = [0.25, 0.20] as const;

export default function AnnotatePage() {
  const [annotators, setAnnotators] = useState<Annotator[]>([]);
  const [who, setWho] = useState<string>("");
  const [shots, setShots] = useState<ShotSummary[]>([]);
  const [picked, setPicked] = useState<{ clip_id: string; shot: number } | null>(null);
  const [data, setData] = useState<AnnotateShot | null>(null);
  const [consensus, setConsensus] = useState<ConsensusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [videoStep, setVideoStep] = useState<number>(VIDEO_STEP_OPTIONS[0]);

  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [eventLabel, setEventLabel] = useState<EventLabel | null>(null);
  const [savingLabel, setSavingLabel] = useState(false);

  // ── loading ───────────────────────────────────────────────────────────

  const loadShots = useCallback(async (annotatorId: string) => {
    const q = annotatorId ? `?annotator_id=${encodeURIComponent(annotatorId)}` : "";
    const res = await api<AnnotateShotsResponse>(`/annotate/shots${q}`);
    setShots(res.shots);
    return res.shots;
  }, []);

  const loadShot = useCallback(
    async (clipId: string, shot: number, annotatorId: string) => {
      const q = annotatorId ? `&annotator_id=${encodeURIComponent(annotatorId)}` : "";
      const [res, cons] = await Promise.all([
        api<AnnotateShot>(
          `/annotate/shot?clip_id=${encodeURIComponent(clipId)}&shot=${shot}${q}`,
        ),
        api<ConsensusResponse>(
          `/annotate/consensus?clip_id=${encodeURIComponent(clipId)}&shot=${shot}`,
        ),
      ]);
      setData(res);
      setConsensus(cons);
      setDifficulty((res.my_label?.difficulty as Difficulty) ?? null);
      setEventLabel((res.my_label?.event_label as EventLabel) ?? null);
    },
    [],
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await api<{ annotators: Annotator[] }>("/annotate/annotators");
        setAnnotators(res.annotators);
        const first = res.annotators.find((a) => a.team === "B") ?? res.annotators[0];
        const id = first?.annotator_id ?? "";
        setWho(id);
        const list = await loadShots(id);
        const next = list.find((s) => s.available && s.n_done < s.n_drafts) ?? list[0];
        if (next) setPicked({ clip_id: next.clip_id, shot: next.shot });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [loadShots]);

  useEffect(() => {
    if (!picked) return;
    const timer = window.setTimeout(() => {
      void loadShot(picked.clip_id, picked.shot, who).catch((e) =>
        setError(e instanceof Error ? e.message : String(e)),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [picked, who, loadShot]);

  const stepVideo = useCallback((direction: -1 | 1) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    const limit = Number.isFinite(video.duration) ? video.duration : Infinity;
    const next = Math.min(limit, Math.max(0, video.currentTime + direction * videoStep));
    video.currentTime = next;
    setPlayhead(next);
  }, [videoStep]);

  const toggleVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => {
        // Browser playback errors remain visible in the native video controls.
      });
    } else {
      video.pause();
    }
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, button, [contenteditable]")) return;
      if (!videoRef.current) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) toggleVideo();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        stepVideo(event.key === "ArrowLeft" ? -1 : 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepVideo, toggleVideo]);

  // ── actions ───────────────────────────────────────────────────────────

  async function saveLabel() {
    if (!data || !difficulty || !eventLabel || !who) return;
    setSavingLabel(true);
    try {
      await api("/annotate/label", {
        method: "POST",
        body: JSON.stringify({
          annotator_id: who, clip_id: data.clip_id, shot: data.shot,
          difficulty, event_label: eventLabel,
        }),
      });
      setToast(`Đã lưu nhãn shot: ${difficulty} / ${eventLabel}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingLabel(false);
    }
  }

  async function afterDraftSaved() {
    if (!picked) return;
    await Promise.all([loadShot(picked.clip_id, picked.shot, who), loadShots(who)]);
  }

  if (loading) return <p className="text-sm text-muted">Đang tải…</p>;

  const videoSrc = data?.video_path
    ? `/api/media/${data.video_path.split("/").map(encodeURIComponent).join("/")}`
    : null;

  const done = data?.drafts.filter((d) => d.verdict).length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      {/* who is annotating + which shot */}
      <div className="flex flex-wrap items-end gap-4 rounded-md border border-border bg-surface px-4 py-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Người gán nhãn</span>
          <select
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={who}
            onChange={(e) => setWho(e.target.value)}
          >
            <option value="">— chọn —</option>
            {annotators.map((a) => (
              <option key={a.annotator_id} value={a.annotator_id}>
                {a.name} (Team {a.team})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 min-w-[18rem]">
          <span className="text-xs text-muted">Shot ({shots.length} shot có bản nháp)</span>
          <select
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            value={picked ? `${picked.clip_id}|${picked.shot}` : ""}
            onChange={(e) => {
              const [c, s] = e.target.value.split("|");
              setPicked({ clip_id: c, shot: Number(s) });
            }}
          >
            {shots.map((s) => (
              <option key={`${s.clip_id}|${s.shot}`} value={`${s.clip_id}|${s.shot}`}>
                {s.n_done >= s.n_drafts ? "✓ " : ""}
                {s.clip_id} t{String(s.shot).padStart(2, "0")} — {s.n_done}/{s.n_drafts}
                {s.available ? "" : " (file đã mất)"}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto text-sm text-muted">
          <span className="text-foreground font-medium">{done}</span>/{data?.drafts.length ?? 0} câu đã duyệt
        </div>
      </div>

      {error && <p className="text-sm text-red">{error}</p>}
      {toast && <p className="text-sm text-green">{toast}</p>}
      {!who && (
        <p className="text-sm text-amber">
          Chọn người gán nhãn trước khi lưu. Chưa có ai thì thêm ở mục dưới cùng trang.
        </p>
      )}

      {data && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start">
          {/* ── left: video + shot-level labels ── */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-4">
            {data.stale ? (
              <div className="rounded-md border border-amber bg-surface p-4 text-sm text-amber">
                File của shot này không còn trong <code>trimmed/</code> — có thể đã bị
                Reject hoặc cắt lại sau khi sinh bản nháp. Các bản nháp vẫn giữ nguyên
                để tra cứu, nhưng không xem được video.
              </div>
            ) : (
              <video
                key={videoSrc}
                ref={videoRef}
                src={videoSrc ?? undefined}
                controls
                autoPlay
                loop
                onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
                className="w-full rounded-md border border-border bg-black"
              />
            )}

            {!data.stale && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button type="button" className="rounded border border-border px-3 py-1.5" onClick={() => stepVideo(-1)} aria-label={`Back ${videoStep.toFixed(2)} seconds`}>
                  -{videoStep.toFixed(2)}s
                </button>
                <button type="button" className="rounded border border-border px-3 py-1.5" onClick={toggleVideo}>
                  Play / Pause
                </button>
                <button type="button" className="rounded border border-border px-3 py-1.5" onClick={() => stepVideo(1)} aria-label={`Forward ${videoStep.toFixed(2)} seconds`}>
                  +{videoStep.toFixed(2)}s
                </button>
                <label className="ml-auto flex items-center gap-2 text-xs text-muted">
                  Step
                  <select className="rounded border border-border bg-background px-2 py-1.5 text-foreground" value={videoStep} onChange={(event) => setVideoStep(Number(event.target.value))}>
                    {VIDEO_STEP_OPTIONS.map((step) => <option key={step} value={step}>{step.toFixed(2)}s</option>)}
                  </select>
                </label>
                <span className="w-full text-xs text-muted">Space: play/pause · ← / →: step</span>
              </div>
            )}

            <div className="rounded-md border border-border bg-surface p-3 text-xs text-muted">
              <div className="flex justify-between">
                <span>
                  <code className="text-foreground">{data.clip_id}</code> t
                  {String(data.shot).padStart(2, "0")}
                </span>
                <span className="tabular-nums">{playhead.toFixed(2)}s</span>
              </div>
              <div className="mt-1">
                8 mốc ảnh đã gửi cho model:{" "}
                <span className="tabular-nums text-foreground">
                  {data.frame_times_s.map((t) => t.toFixed(1)).join(" · ")}
                </span>
              </div>
            </div>

            {/* Second, independent ballot. pipeline.db keeps the reviewer's own
                label untouched; this one is per annotator, for agreement. */}
            <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3">
              {/* No other label is shown here on purpose. Displaying the
                  earlier reviewer's difficulty/event would anchor this
                  annotator to it, which is the same contamination the hidden
                  keyframe predictions exist to avoid. */}
              <div className="text-xs text-muted">Nhãn của shot (1 cặp cho cả 9 câu)</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <LabelGroup
                  legend="Difficulty"
                  value={difficulty}
                  options={data.vocab.difficulties as Difficulty[]}
                  onChange={setDifficulty}
                />
                <LabelGroup
                  legend="Event"
                  value={eventLabel}
                  options={data.vocab.event_labels as EventLabel[]}
                  onChange={setEventLabel}
                />
              </div>
              <button
                className="self-start rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                disabled={!who || !difficulty || !eventLabel || savingLabel}
                onClick={saveLabel}
              >
                {data.my_label ? "Cập nhật nhãn shot" : "Lưu nhãn shot"}
              </button>

              {/* Majority vote across annotators. A tie is shown as a tie --
                  breaking it arbitrarily would hide the item from the
                  adjudication pass (DC.pdf step 8). */}
              {consensus && consensus.labels.n > 1 && (
                <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-xs">
                  <div className="text-muted">
                    Đồng thuận · {consensus.labels.n} người đã gán
                  </div>
                  {(["difficulty", "event_label"] as const).map((f) => {
                    const c = consensus.labels[f];
                    if (!c.total) return null;
                    return (
                      <div key={f} className="flex flex-wrap items-center gap-2">
                        <span className="w-20 text-muted">
                          {f === "difficulty" ? "Difficulty" : "Event"}
                        </span>
                        {c.tied ? (
                          <span className="text-amber">
                            hoà phiếu — cần Team A phân xử
                          </span>
                        ) : (
                          <span
                            className={c.unanimous ? "text-green" : "text-foreground"}
                          >
                            <b className="tabular-nums">
                              {c.votes}/{c.total}
                            </b>{" "}
                            {c.majority}
                            {c.unanimous && " (nhất trí)"}
                          </span>
                        )}
                        <span className="text-muted">
                          {Object.entries(c.counts)
                            .map(([k, n]) => `${k}:${n}`)
                            .join(" · ")}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap gap-2 text-muted">
                    {consensus.labels.votes.map((v) => (
                      <span key={v.annotator_id} className="rounded border border-border px-1.5 py-0.5">
                        {v.name ?? v.annotator_id}
                        {v.team ? ` (${v.team})` : ""}: {v.difficulty}/{v.event_label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── right: the nine drafts ── */}
          <div className="flex flex-col gap-3">
            {data.drafts.map((d) => (
              <DraftCard
                key={d.draft_id}
                draft={d}
                reasons={data.vocab.reasons}
                who={who}
                playhead={playhead}
                duration={data.duration_s}
                consensus={consensus?.verdicts.find((v) => v.draft_id === d.draft_id)}
                onSeek={(t) => {
                  if (videoRef.current) videoRef.current.currentTime = t;
                }}
                onSaved={afterDraftSaved}
                onError={setError}
              />
            ))}
          </div>
        </div>
      )}

      <AddAnnotator
        onAdded={async () => {
          const res = await api<{ annotators: Annotator[] }>("/annotate/annotators");
          setAnnotators(res.annotators);
        }}
      />
    </div>
  );
}

// ── one draft ───────────────────────────────────────────────────────────

function DraftCard({
  draft, reasons, who, playhead, duration, consensus, onSeek, onSaved, onError,
}: {
  draft: DraftItem;
  reasons: string[];
  who: string;
  playhead: number;
  duration: number | null;
  consensus?: VerdictConsensus;
  onSeek: (t: number) => void;
  onSaved: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [verdict, setVerdict] = useState<Verdict | null>(draft.verdict);
  const [reason, setReason] = useState<string | null>(draft.reason_code);
  const [note, setNote] = useState(draft.reason_note ?? "");
  const [answer, setAnswer] = useState(draft.edited_answer ?? draft.answer);
  const [editing, setEditing] = useState(false);
  const [marks, setMarks] = useState<number[]>(draft.human_keyframes_s ?? []);
  const [typed, setTyped] = useState("");
  const [markError, setMarkError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function addMark(t: number) {
    setMarkError(null);
    if (marks.length >= 3) return setMarkError("tối đa 3 mốc");
    if (!Number.isFinite(t) || t < 0) return setMarkError("giây không hợp lệ");
    if (duration !== null && t > duration)
      return setMarkError(`clip chỉ dài ${duration.toFixed(2)}s`);
    const v = Number(t.toFixed(3));
    if (marks.some((m) => Math.abs(m - v) < 0.001)) return setMarkError("đã có mốc này");
    setMarks([...marks, v].sort((a, b) => a - b));
  }

  function commitTyped() {
    const t = Number(typed.replace(",", "."));
    if (typed.trim() === "" || Number.isNaN(t)) return setMarkError("nhập một số giây");
    addMark(t);
    setTyped("");
  }

  const dirty =
    verdict !== draft.verdict ||
    reason !== draft.reason_code ||
    note !== (draft.reason_note ?? "") ||
    answer !== (draft.edited_answer ?? draft.answer) ||
    JSON.stringify(marks) !== JSON.stringify(draft.human_keyframes_s ?? []);

  const blocked =
    !who ||
    !verdict ||
    (verdict === "DISAGREE" && !reason) ||
    (verdict === "DISAGREE" && reason === "khác" && !note.trim());

  async function save() {
    if (blocked) return;
    setSaving(true);
    try {
      await api(`/annotate/draft/${draft.draft_id}`, {
        method: "POST",
        body: JSON.stringify({
          annotator_id: who,
          verdict,
          reason_code: verdict === "DISAGREE" ? reason : null,
          reason_note: verdict === "DISAGREE" ? note || null : null,
          answer: answer !== draft.answer ? answer : null,
          keyframes_s: marks,
        }),
      });
      await onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-md border border-border bg-surface">
      <header className="flex items-start gap-3 border-b border-border px-4 py-2.5">
        <span className="shrink-0 rounded border border-border bg-background px-2 py-0.5 text-xs font-semibold text-accent">
          {draft.qgroup}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{draft.group_name}</div>
          <div className="text-xs text-muted">{draft.question}</div>
        </div>
        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs">
          {consensus && consensus.total > 1 && (
            <span
              className={consensus.tied ? "text-amber" : "text-muted"}
              title={Object.entries(consensus.counts)
                .map(([v, n]) => `${VERDICT_LABEL[v as Verdict]}: ${n}`)
                .join(" · ")}
            >
              {consensus.tied
                ? `hoà ${consensus.total} phiếu`
                : `${consensus.n_votes}/${consensus.total} ${
                    VERDICT_LABEL[consensus.majority as Verdict]
                  }`}
            </span>
          )}
          {draft.verdict && (
            <span className="text-green">✓ {VERDICT_LABEL[draft.verdict]}</span>
          )}
        </span>
      </header>

      <div className="px-4 py-3">
        {editing ? (
          <textarea
            className="w-full rounded-md border border-border bg-background p-2 text-sm"
            rows={6}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm">{answer}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <button
            className="rounded border border-border px-2 py-1 hover:text-foreground"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Xong" : "Sửa đáp án"}
          </button>
          {draft.truncated && (
            <span className="text-amber">bản nháp bị cắt vì chạm trần token</span>
          )}
          <span className="tabular-nums">
            {draft.completion_tokens} token · {draft.latency_ms} ms · prompt v
            {draft.prompt_version}
          </span>
        </div>
      </div>

      {/* evidence marks: either grab the playhead or type the second directly,
          so marking does not require scrubbing the video to the exact frame */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5 text-xs">
        <span className="text-muted">Mốc bằng chứng (tối đa 3):</span>
        {marks.map((t, i) => (
          <button
            key={`${t}-${i}`}
            className="rounded border border-accent bg-accent/20 px-2 py-1 tabular-nums text-foreground"
            title="Bấm để tua tới mốc, giữ Shift để xoá"
            onClick={(e) =>
              e.shiftKey ? setMarks(marks.filter((_, j) => j !== i)) : onSeek(t)
            }
          >
            {t.toFixed(2)}s
            <span
              className="ml-1.5 text-muted hover:text-red"
              role="button"
              tabIndex={0}
              aria-label={`Xoá mốc ${t.toFixed(2)} giây`}
              onClick={(e) => {
                e.stopPropagation();
                setMarks(marks.filter((_, j) => j !== i));
              }}
            >
              ✕
            </span>
          </button>
        ))}
        <button
          className="rounded border border-border px-2 py-1 hover:text-foreground disabled:opacity-40"
          disabled={marks.length >= 3}
          onClick={() => addMark(playhead)}
        >
          + tại {playhead.toFixed(2)}s
        </button>
        <span className="text-muted">hoặc</span>
        <input
          type="number"
          step="0.05"
          min={0}
          max={duration ?? undefined}
          placeholder="giây"
          className="w-20 rounded border border-border bg-background px-2 py-1 tabular-nums"
          value={typed}
          disabled={marks.length >= 3}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTyped();
            }
          }}
        />
        <button
          className="rounded border border-border px-2 py-1 hover:text-foreground disabled:opacity-40"
          disabled={marks.length >= 3 || typed.trim() === ""}
          onClick={commitTyped}
        >
          thêm
        </button>
        {markError && <span className="text-red">{markError}</span>}
        {/* Only ever shown after this annotator saved -- see page header comment. */}
        {draft.predicted_keyframes_s && draft.predicted_keyframes_s.length > 0 && (
          <span className="text-muted">
            · model đoán:{" "}
            <span className="tabular-nums">
              {draft.predicted_keyframes_s.map((t) => t.toFixed(2)).join(", ")}
            </span>
          </span>
        )}
      </div>

      {/* verdict */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
        {(Object.keys(VERDICT_LABEL) as Verdict[]).map((v) => (
          <button
            key={v}
            aria-pressed={verdict === v}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              verdict === v
                ? v === "AGREE"
                  ? "border-green bg-green/20 text-foreground"
                  : v === "DISAGREE"
                    ? "border-red bg-red/20 text-foreground"
                    : "border-amber bg-amber/20 text-foreground"
                : "border-border text-muted"
            }`}
            onClick={() => setVerdict(v)}
          >
            {VERDICT_LABEL[v]}
          </button>
        ))}

        <button
          className="ml-auto rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          disabled={blocked || saving || (!dirty && !!draft.verdict)}
          onClick={save}
        >
          {saving ? "Đang lưu…" : draft.verdict ? "Cập nhật" : "Lưu"}
        </button>
      </div>

      {verdict === "DISAGREE" && (
        <div className="flex flex-col gap-2 border-t border-border px-4 py-2.5">
          <div className="flex flex-wrap gap-2">
            {reasons.map((r) => (
              <button
                key={r}
                aria-pressed={reason === r}
                className={`rounded border px-2 py-1 text-xs ${
                  reason === r ? "border-accent bg-accent/20 text-foreground" : "border-border text-muted"
                }`}
                onClick={() => setReason(r)}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            placeholder={
              reason === "khác" ? "Bắt buộc: sai ở chỗ nào?" : "Ghi chú (không bắt buộc)"
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}
    </article>
  );
}

// ── annotator roster ────────────────────────────────────────────────────

function AddAnnotator({ onAdded }: { onAdded: () => Promise<void> }) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [team, setTeam] = useState<"A" | "B">("B");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface px-4 py-3">
      <span className="text-xs text-muted">Thêm người gán nhãn</span>
      <input
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        placeholder="mã (vd: quyen)"
        value={id}
        onChange={(e) => setId(e.target.value)}
      />
      <input
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        placeholder="tên hiển thị"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        value={team}
        onChange={(e) => setTeam(e.target.value as "A" | "B")}
      >
        <option value="B">Team B</option>
        <option value="A">Team A</option>
      </select>
      <button
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:text-foreground disabled:opacity-40"
        disabled={!id.trim() || !name.trim()}
        onClick={async () => {
          try {
            await api("/annotate/annotators", {
              method: "POST",
              body: JSON.stringify({ annotator_id: id.trim(), name: name.trim(), team }),
            });
            setId("");
            setName("");
            setErr(null);
            await onAdded();
          } catch (e) {
            setErr(e instanceof Error ? e.message : String(e));
          }
        }}
      >
        Thêm
      </button>
      {err && <span className="text-xs text-red">{err}</span>}
    </div>
  );
}
