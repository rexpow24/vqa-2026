"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LabelGroup } from "@/components/LabelGroup";
import type {
  Difficulty,
  EventLabel,
  RelabelClip,
  RelabelNextResponse,
} from "@/lib/types";

// Clips already materialized into trimmed/ (the finished-product folder)
// that are missing difficulty/event_label because they were decided before
// those columns existed. The decision itself is never revisited here --
// only the two labels that didn't exist yet when it was made. Scoped to
// trimmed/ output only, so a REJECTED clip (no trimmed/ file) never shows up.
export default function RelabelPage() {
  const [clip, setClip] = useState<RelabelClip | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [eventLabel, setEventLabel] = useState<EventLabel | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveError(null);
    setDifficulty(null);
    setEventLabel(null);
    try {
      const data = await api<RelabelNextResponse>("/relabel/next");
      setClip(data.clip);
      setRemaining(data.remaining);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Reused after every save, not just on mount -- same pattern as
    // review/page.tsx's loadNext effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNext();
  }, [loadNext]);

  async function save() {
    if (!clip || !difficulty || !eventLabel) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api(`/relabel/${clip.clip_id}`, {
        method: "POST",
        body: JSON.stringify({ difficulty, event_label: eventLabel }),
      });
      setLastSaved(`Labeled \`${clip.clip_id}\` (${difficulty} / ${eventLabel}).`);
      loadNext();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !clip) {
    return <p className="text-sm text-muted">Loading...</p>;
  }

  if (error) {
    return <p className="text-sm text-red">{error}</p>;
  }

  const videoSrc = clip
    ? `/api/media/${clip.video_path.split("/").map(encodeURIComponent).join("/")}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted">
        Clips already in <code className="text-foreground">trimmed/</code> that were
        decided before the difficulty and event labels existed --{" "}
        <span className="text-foreground">{remaining}</span> left without one or
        both. This does not change the decision, only backfills the labels.
      </div>

      {lastSaved && <p className="text-sm text-green">{lastSaved}</p>}

      {!clip ? (
        <p className="text-sm text-green">Nothing left -- every decided clip has both labels.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-sm">
            <code className="text-foreground">{clip.clip_id}</code>{" "}
            <span className="text-muted">{clip.duration_s.toFixed(1)}s</span>{" "}
            <span className="text-muted">-- already {clip.decision.toLowerCase()}</span>
            {clip.flags.length > 0 && (
              <span className="text-amber"> -- {clip.flags.join(", ")}</span>
            )}
          </h2>

          <video
            key={videoSrc}
            src={videoSrc ?? undefined}
            controls
            autoPlay
            loop
            className="w-full rounded-md border border-border bg-black max-h-[480px]"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <LabelGroup
              legend="Difficulty"
              value={difficulty}
              options={["easy", "medium", "high"] as Difficulty[]}
              onChange={setDifficulty}
            />
            <LabelGroup
              legend="Event"
              value={eventLabel}
              options={["accident", "near-miss"] as EventLabel[]}
              onChange={setEventLabel}
            />
          </div>

          <div className="rounded-md border border-border bg-surface p-3 text-xs text-muted">
            <div className="grid gap-2 sm:grid-cols-2">
              <p><strong className="text-foreground">Easy:</strong> thời tiết quang đãng, ánh sáng tốt, camera rõ, tình huống dễ quan sát.</p>
              <p><strong className="text-foreground">Medium:</strong> hình ảnh trung bình, vẫn quan sát được nhưng cần chú ý, che khuất nhẹ hoặc góc nhìn chưa tối ưu.</p>
              <p><strong className="text-foreground">High:</strong> hình ảnh thấp, ánh sáng kém, góc quay khó hoặc che khuất nhiều, khó xác định chính xác diễn biến và loại sự kiện.</p>
              <p><strong className="text-foreground">Accident:</strong> có va chạm thực tế giữa các phương tiện, người hoặc vật thể.</p>
              <p><strong className="text-foreground">Near-miss:</strong> không va chạm, nhưng suýt va chạm hoặc phải phanh, đánh lái, tránh gấp để tránh tai nạn.</p>
            </div>
          </div>

          {saveError && <p className="text-sm text-red">{saveError}</p>}

          <button
            className="self-start px-4 py-2 text-sm rounded-md bg-accent text-white font-medium disabled:opacity-40"
            disabled={saving || !difficulty || !eventLabel}
            onClick={save}
          >
            Save & next
          </button>
        </div>
      )}
    </div>
  );
}
