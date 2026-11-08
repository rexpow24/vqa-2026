"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LabelGroup } from "@/components/LabelGroup";
import { needsKeyframes } from "@/lib/qgroups";
import type { EventLabel, Verdict } from "@/lib/types";

type Video = { id: string; seq: number; filename: string; duration_s: number };
type Assignment = { id: string; status: string; completed_at: string | null };
// /api/videos/[id]/complete also reports where to go next, so finishing a
// video does not have to round-trip through the list page.
type CompletedAssignment = Assignment & {
  next_video_id: string | null; next_filename: string | null;
};
type Label = { event_label: EventLabel };
export type HostedDraft = {
  id: string; qgroup: string; group_name: string; question: string; answer: string;
  truncated: boolean; completion_tokens: number | null; latency_ms: number | null;
  prompt_version: number; frame_times_s: number[]; predicted_keyframes_s: number[] | null;
  source_kind: "vlm" | "admin_csv";
  verdict: Verdict | null; reason_code: string | null; reason_note: string | null;
  edited_answer: string | null; human_keyframes_s: number[];
  // Set once the annotators' disagreement on this question was decided; the
  // question is then locked for this annotator (answer_adjudications).
  decision: { final_verdict: Verdict; final_answer: string; final_keyframes_s: number[] } | null;
};
const normalize = (text: string) => text.trim().replace(/\s+/g, " ");
const STEP_OPTIONS = [0.25, 0.20] as const;
const VERDICT_LABEL: Record<Verdict, string> = {
  AGREE: "Đồng ý", NOT_ANSWERABLE: "Không trả lời được", DISAGREE: "Không đồng ý",
};
const REASONS = ["thiếu thực thể", "sai thực thể", "sai nhân quả", "sai mốc thời gian",
  "bịa chi tiết", "sai diễn đạt", "khác"];

async function requestJson<T>(url: string, body?: object): Promise<T> {
  const response = await fetch(url, { method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `Lỗi ${response.status}`);
  return result as T;
}

export function HostedLabeling({ video, initialAssignment, initialLabel, initialDrafts, labelDecision }: {
  video: Video; initialAssignment: Assignment | null; initialLabel: Label | null; initialDrafts: HostedDraft[];
  labelDecision: EventLabel | null;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(initialAssignment);
  const [label, setLabel] = useState(initialLabel);
  const [eventLabel, setEventLabel] = useState<EventLabel | null>(initialLabel?.event_label ?? null);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [playhead, setPlayhead] = useState(0);
  const [step, setStep] = useState<number>(STEP_OPTIONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const ready = drafts.length === 9;
  const done = drafts.filter((draft) => draft.verdict).length;

  const stepVideo = useCallback((direction: -1 | 1) => {
    const element = videoRef.current;
    if (!element) return;
    element.pause();
    const duration = Number.isFinite(element.duration) ? element.duration : Number(video.duration_s);
    const next = Math.min(duration, Math.max(0, element.currentTime + direction * step));
    element.currentTime = next;
    setPlayhead(next);
  }, [step, video.duration_s]);
  const togglePlay = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) void element.play().catch(() => setError("Không thể phát video."));
    else element.pause();
  }, []);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, button, [contenteditable]")) return;
      if (!videoRef.current) return;
      if (event.code === "Space") { event.preventDefault(); if (!event.repeat) togglePlay(); }
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault(); stepVideo(event.key === "ArrowLeft" ? -1 : 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepVideo, togglePlay]);

  // Saved on click: a separate save button was one more step per video.
  async function saveLabel(value: EventLabel) {
    setEventLabel(value);
    if (!assignment) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const saved = await requestJson<Label>(`/api/videos/${video.id}/label`, { event_label: value });
      setLabel(saved); setMessage("Đã lưu nhãn video.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu nhãn."); }
    finally { setBusy(false); }
  }
  async function complete() {
    setBusy(true); setError(""); setMessage("");
    try {
      const saved = await requestJson<CompletedAssignment>(`/api/videos/${video.id}/complete`);
      setAssignment(saved);
      // Go straight to the next video rather than back to the list: with
      // hundreds of videos per annotator, returning to the grid to pick the
      // next one is an extra decision on every single video. The list is
      // still one click away in the header.
      if (saved.next_video_id) {
        setMessage(`Đã hoàn thành. Đang mở video kế tiếp: ${saved.next_filename ?? ""}`);
        router.push(`/annotate/${saved.next_video_id}`);
      } else {
        setMessage("Đã hoàn thành video. Không còn video nào chờ bạn gán nhãn.");
        router.refresh();
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể hoàn thành video."); }
    finally { setBusy(false); }
  }
  function seek(time: number) {
    if (videoRef.current) videoRef.current.currentTime = time;
  }

  return <div className="flex flex-col gap-5">
    <div className="flex flex-wrap items-center gap-3">
      <Link href="/annotate" className="text-sm text-accent">← Danh sách video</Link>
      <h2 className="text-lg font-semibold"><span className="tabular-nums text-accent">{`#${video.seq}`}</span> {video.filename}</h2>
      <span className="ml-auto text-sm text-muted">{done}/{drafts.length} câu đã duyệt</span>
    </div>
    {error && <p role="alert" className="rounded border border-red/40 bg-red/10 p-3 text-sm text-red">{error}</p>}
    {message && <p role="status" className="text-sm text-green">{message}</p>}
    {!ready && <p className="rounded border border-amber bg-surface p-3 text-sm text-amber">
      Video này chưa có đủ 9 bản nháp VLM. Bạn vẫn có thể xem video; chức năng gán nhãn sẽ mở khi bản nháp được nhập.
    </p>}
    {/* Only an admin reaches a video not assigned to them; it is read-only. */}
    {ready && !assignment && <p className="rounded border border-amber bg-surface p-3 text-sm text-amber">
      Video này chưa được giao cho bạn nên chỉ xem được. Giao video ở trang Phân công.
    </p>}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4 lg:sticky lg:top-4">
        <video ref={videoRef} src={`/api/videos/${video.id}/stream`} controls loop playsInline preload="metadata"
          onTimeUpdate={(event) => setPlayhead(event.currentTarget.currentTime)}
          onError={() => setError("Không thể tải hoặc giải mã video. Hãy thử tải lại trang.")}
          className="w-full rounded-md border border-border bg-black" />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button type="button" onClick={() => stepVideo(-1)} className="rounded border border-border px-3 py-1.5">-{step.toFixed(2)}s</button>
          <button type="button" onClick={togglePlay} className="rounded border border-border px-3 py-1.5">Play / Pause</button>
          <button type="button" onClick={() => stepVideo(1)} className="rounded border border-border px-3 py-1.5">+{step.toFixed(2)}s</button>
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">Step
            <select value={step} onChange={(event) => setStep(Number(event.target.value))} className="rounded border border-border bg-background px-2 py-1.5 text-foreground">
              {STEP_OPTIONS.map((value) => <option key={value} value={value}>{value.toFixed(2)}s</option>)}
            </select></label>
          <span className="w-full text-xs text-muted">Space: play/pause · ← / →: tua từng bước</span>
        </div>
        <div className="rounded-md border border-border bg-surface p-3 text-xs text-muted">
          <div className="flex justify-between"><span>Vị trí hiện tại</span><span className="tabular-nums text-foreground">{playhead.toFixed(2)}s</span></div>
          {ready && drafts[0].frame_times_s.length > 0 && <div className="mt-1">8 mốc ảnh đã gửi cho model: <span className="tabular-nums text-foreground">
            {drafts[0].frame_times_s.map((time) => Number(time).toFixed(1)).join(" · ")}</span></div>}
        </div>
        {ready && <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3">
          <div className="text-xs text-muted">Nhãn của video (1 nhãn cho cả 9 câu)</div>
          {labelDecision ? <p className="text-sm">
            Bạn chọn <b>{label?.event_label ?? "-"}</b>. Nhãn đã thống nhất: <b className="text-green">{labelDecision}</b>
            <span className="block text-xs text-muted">Đã khóa sau khi thống nhất.</span>
          </p> : <>
            <LabelGroup legend="Event" value={eventLabel} options={["accident", "near-miss"] as EventLabel[]}
              onChange={(value) => { if (!busy) void saveLabel(value); }} />
            <span className="text-xs text-muted">{!assignment ? "Chỉ xem: video chưa được giao cho bạn."
              : label?.event_label === eventLabel ? "✓ Đã lưu" : busy ? "Đang lưu…" : "Chọn để lưu"}</span>
          </>}
        </div>}
      </div>
      <div className="flex flex-col gap-3">
        {drafts.map((draft) => draft.decision ? <DecidedCard key={draft.id} draft={draft} onSeek={seek} /> : <DraftCard key={draft.id} draft={draft} duration={Number(video.duration_s)}
          playhead={playhead} canSave={!!assignment} onSeek={seek} onSaved={(saved) => {
            setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, ...saved } : item));
            setAssignment((current) => current?.status === "pending" ? { ...current, status: "in_progress" } : current);
            setMessage(`Đã lưu câu ${draft.qgroup}.`); setError("");
          }} onError={setError} />)}
        {ready && <button type="button" disabled={busy || !label || done !== 9 || !assignment || assignment.status === "completed"}
          onClick={complete} className="self-end rounded border border-green px-3 py-2 text-sm text-green disabled:opacity-40">
          {assignment?.status === "completed" ? "Video đã hoàn thành" : "Hoàn thành video"}
        </button>}
      </div>
    </div>
  </div>;
}

function DraftCard({ draft, duration, playhead, canSave, onSeek, onSaved, onError }: {
  draft: HostedDraft; duration: number; playhead: number; canSave: boolean;
  onSeek: (time: number) => void; onSaved: (saved: Partial<HostedDraft>) => void; onError: (message: string) => void;
}) {
  const [verdict, setVerdict] = useState<Verdict | null>(draft.verdict);
  const [reason, setReason] = useState(draft.reason_code);
  const [note, setNote] = useState(draft.reason_note ?? "");
  const [answer, setAnswer] = useState(draft.edited_answer ?? draft.answer);
  const [editing, setEditing] = useState(false);
  const [marks, setMarks] = useState<number[]>(draft.human_keyframes_s.map(Number));
  const [typed, setTyped] = useState("");
  const [markError, setMarkError] = useState("");
  const [saving, setSaving] = useState(false);
  // The exact payload that last failed, so a failure is not retried in a loop.
  const [failed, setFailed] = useState<string | null>(null);
  const needsMarks = needsKeyframes(draft.qgroup);
  // AGREE means the draft is the answer, so only "Không đồng ý" carries an
  // edited answer, and it must carry one. `strayEdit` is an answer saved
  // before that rule, rewritten under AGREE.
  const answerChanged = normalize(answer) !== normalize(draft.answer);
  const strayEdit = !!verdict && verdict !== "DISAGREE" && answerChanged;
  const blocked = !canSave || !verdict || (needsMarks && (marks.length < 1 || marks.length > 3)) ||
    (verdict === "DISAGREE" && (!reason || (reason === "khác" && !note.trim()) || !answerChanged)) || strayEdit;
  function chooseVerdict(value: Verdict) {
    setVerdict(value);
    if (value === "DISAGREE") { if (!answerChanged) setEditing(true); }
    else { setAnswer(draft.answer); setEditing(false); }
  }

  function addMark(time: number) {
    setMarkError("");
    if (marks.length >= 3) return setMarkError("Tối đa 3 mốc.");
    if (!Number.isFinite(time) || time < 0 || time > duration) return setMarkError("Mốc nằm ngoài video.");
    const rounded = Number(time.toFixed(3));
    if (marks.some((mark) => Math.abs(mark - rounded) < 0.001)) return setMarkError("Mốc này đã có.");
    setMarks([...marks, rounded].sort((a, b) => a - b));
  }
  // Trimmed the way the API stores it, so after a save the stored row equals
  // the payload exactly. `dirty` compares the two rather than the raw inputs:
  // a reason left in state after switching away from "Không đồng ý" is not
  // sent, and comparing it made every save look unsaved and loop forever.
  const payload = JSON.stringify({
    verdict, reason_code: verdict === "DISAGREE" ? reason : null,
    reason_note: verdict === "DISAGREE" ? note.trim() : null,
    edited_answer: verdict === "DISAGREE" && answerChanged ? answer.trim() : null,
    human_keyframes_s: needsMarks ? marks : [],
  });
  const stored = JSON.stringify({
    verdict: draft.verdict, reason_code: draft.reason_code, reason_note: draft.reason_note,
    edited_answer: draft.edited_answer, human_keyframes_s: draft.human_keyframes_s.map(Number),
  });
  const dirty = payload !== stored;
  // The parent passes fresh callbacks on every render (several a second while
  // the video plays); through refs they cannot keep restarting the save timer.
  const callbacks = useRef({ onSaved, onError });
  useEffect(() => { callbacks.current = { onSaved, onError }; });
  const save = useCallback(async () => {
    setSaving(true);
    try {
      callbacks.current.onSaved(await requestJson<Partial<HostedDraft>>(`/api/drafts/${draft.id}/annotation`, JSON.parse(payload)));
      setFailed(null);
    } catch (cause) {
      setFailed(payload);
      callbacks.current.onError(cause instanceof Error ? cause.message : "Không thể lưu câu trả lời.");
    } finally { setSaving(false); }
  }, [draft.id, payload]);
  // Auto-save once the answer is complete. The delay lets a typed note settle
  // and lets a verdict change be followed by its reason before anything is sent;
  // an answer being edited waits for "Xong".
  const ready = dirty && !blocked && !editing && !saving && failed !== payload;
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => { void save(); }, 600);
    return () => clearTimeout(timer);
  }, [ready, save]);
  const status = saving ? "Đang lưu…"
    : failed === payload ? null
    : !dirty ? (draft.verdict ? "✓ Đã lưu" : "")
    : !canSave ? "Chỉ xem"
    : !verdict ? ""
    : needsMarks && marks.length < 1 ? "Thêm 1-3 keyframe để lưu"
    : verdict === "DISAGREE" && !reason ? "Chọn lý do để lưu"
    : verdict === "DISAGREE" && reason === "khác" && !note.trim() ? "Ghi lý do để lưu"
    : verdict === "DISAGREE" && !answerChanged ? "Sửa đáp án cho đúng để lưu"
    : strayEdit ? ""
    : editing ? "Bấm Xong để lưu đáp án"
    : "Đang lưu…";

  return <article className="rounded-md border border-border bg-surface">
    <header className="flex items-start gap-3 border-b border-border px-4 py-2.5">
      <span className="shrink-0 rounded border border-border bg-background px-2 py-0.5 text-xs font-semibold text-accent">{draft.qgroup}</span>
      <div className="min-w-0"><div className="text-sm font-medium">{draft.group_name}</div><div className="text-xs text-muted">{draft.question}</div></div>
      {draft.verdict && <span className="ml-auto shrink-0 text-xs text-green">✓ {VERDICT_LABEL[draft.verdict]}</span>}
    </header>
    <div className="px-4 py-3">
      {editing ? <textarea rows={5} value={answer} onChange={(event) => setAnswer(event.target.value)}
        className="w-full rounded-md border border-border bg-background p-2 text-sm" />
        : <p className="whitespace-pre-wrap text-sm">{answer}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
        {verdict === "DISAGREE" && <button type="button" onClick={() => setEditing((value) => !value)}
          className="rounded border border-border px-2 py-1">{editing ? "Xong" : "Sửa đáp án"}</button>}
        {draft.truncated && <span className="text-amber">Bản nháp bị cắt vì chạm trần token</span>}
        <span>{draft.source_kind === "admin_csv" ? "Câu hỏi và trả lời do admin tải lên" :
          `${draft.completion_tokens} token · ${draft.latency_ms} ms · prompt v${draft.prompt_version}`}</span>
      </div>
    </div>
    {needsMarks && <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5 text-xs">
      <span className="text-muted">Keyframe bằng chứng (1-3):</span>
      {marks.map((time) => <span key={time} className="flex items-center rounded border border-accent bg-accent/20">
        <button type="button" onClick={() => onSeek(time)} className="px-2 py-1 tabular-nums">{time.toFixed(2)}s</button>
        <button type="button" aria-label={`Xóa mốc ${time.toFixed(2)} giây`} onClick={() => setMarks(marks.filter((mark) => mark !== time))}
          className="px-2 py-1 text-muted hover:text-red">✕</button>
      </span>)}
      <button type="button" disabled={marks.length >= 3} onClick={() => addMark(playhead)}
        className="rounded border border-border px-2 py-1 disabled:opacity-40">+ tại {playhead.toFixed(2)}s</button>
      <span className="text-muted">hoặc</span>
      <input type="number" step="0.05" min={0} max={duration} placeholder="giây" value={typed}
        onChange={(event) => setTyped(event.target.value)} disabled={marks.length >= 3}
        className="w-20 rounded border border-border bg-background px-2 py-1 tabular-nums" />
      <button type="button" disabled={marks.length >= 3 || !typed.trim()} onClick={() => {
        if (!typed.trim()) return;
        addMark(Number(typed.replace(",", "."))); setTyped("");
      }} className="rounded border border-border px-2 py-1 disabled:opacity-40">Thêm</button>
      {markError && <span className="text-red">{markError}</span>}
      {draft.predicted_keyframes_s && draft.predicted_keyframes_s.length > 0 && <span className="text-muted">
        · Model đoán: {draft.predicted_keyframes_s.map((time) => Number(time).toFixed(2)).join(", ")}
      </span>}
    </div>}
    <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5">
      {(Object.keys(VERDICT_LABEL) as Verdict[]).map((value) => <button key={value} type="button" aria-pressed={verdict === value}
        onClick={() => chooseVerdict(value)} className={`rounded-md border px-3 py-1.5 text-sm ${verdict === value ?
          value === "AGREE" ? "border-green bg-green/20" : value === "DISAGREE" ? "border-red bg-red/20" : "border-amber bg-amber/20"
          : "border-border text-muted"}`}>{VERDICT_LABEL[value]}</button>)}
      <span className={`ml-auto text-xs ${status?.startsWith("✓") ? "text-green" : "text-muted"}`}>{status}</span>
      {failed === payload && <button type="button" onClick={() => { void save(); }}
        className="ml-auto rounded-md border border-red px-3 py-1.5 text-sm text-red">Lưu lỗi · Thử lại</button>}
    </div>
    {strayEdit && <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2.5 text-xs text-amber">
      <span>Đáp án đã bị sửa nhưng đang chọn &quot;{VERDICT_LABEL[verdict]}&quot;. Chọn &quot;Không đồng ý&quot; và lý do để giữ bản sửa, hoặc</span>
      <button type="button" onClick={() => setAnswer(draft.answer)} className="rounded border border-amber px-2 py-1">Dùng đáp án gốc</button>
    </div>}
    {verdict === "DISAGREE" && <div className="flex flex-col gap-2 border-t border-border px-4 py-2.5">
      <div className="flex flex-wrap gap-2">{REASONS.map((value) => <button key={value} type="button" aria-pressed={reason === value}
        onClick={() => setReason(value)} className={`rounded border px-2 py-1 text-xs ${reason === value ? "border-accent bg-accent/20" : "border-border text-muted"}`}>{value}</button>)}</div>
      <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={reason === "khác" ? "Bắt buộc: sai ở chỗ nào?" : "Ghi chú (không bắt buộc)"}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
    </div>}
  </article>;
}

// A question whose disagreement was decided: read-only, showing what this
// annotator answered next to the final answer.
function DecidedCard({ draft, onSeek }: { draft: HostedDraft; onSeek: (time: number) => void }) {
  const decision = draft.decision!;
  return <article className="rounded-md border border-border bg-surface">
    <header className="flex items-start gap-3 border-b border-border px-4 py-2.5">
      <span className="shrink-0 rounded border border-border bg-background px-2 py-0.5 text-xs font-semibold text-accent">{draft.qgroup}</span>
      <div className="min-w-0"><div className="text-sm font-medium">{draft.group_name}</div><div className="text-xs text-muted">{draft.question}</div></div>
      <span className="ml-auto shrink-0 text-xs text-muted">Đã thống nhất · khóa</span>
    </header>
    <dl className="grid gap-2 px-4 py-3 text-sm">
      <div><dt className="text-xs text-muted">Bản nháp</dt><dd className="whitespace-pre-wrap">{draft.answer}</dd></div>
      <div><dt className="text-xs text-muted">Bạn chọn: {draft.verdict ? VERDICT_LABEL[draft.verdict] : "-"}</dt>
        {draft.verdict === "DISAGREE" && draft.edited_answer && <dd className="whitespace-pre-wrap">{draft.edited_answer}</dd>}</div>
      <div className="rounded border border-green/50 bg-green/10 p-2">
        <dt className="text-xs text-green">Đáp án đã thống nhất: {VERDICT_LABEL[decision.final_verdict]}</dt>
        <dd className="whitespace-pre-wrap">{decision.final_answer}</dd>
        {decision.final_keyframes_s.length > 0 && <dd className="mt-1 flex flex-wrap gap-1 text-xs">
          {decision.final_keyframes_s.map((time) => <button key={time} type="button" onClick={() => onSeek(Number(time))}
            className="rounded border border-accent px-2 py-0.5 tabular-nums">{Number(time).toFixed(2)}s</button>)}
        </dd>}
      </div>
    </dl>
  </article>;
}
