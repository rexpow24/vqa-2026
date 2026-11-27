"use client";

import { useRef, useState } from "react";

export function ReportVideoEvidence({ videoId, seq }: { videoId: string; seq: number }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function downloadFrame() {
    const player = video.current;
    if (!player || player.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setError("Chờ video tải được khung hình rồi thử lại.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = player.videoWidth;
    canvas.height = player.videoHeight;
    canvas.getContext("2d")?.drawImage(player, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) { setError("Không tạo được ảnh khung hình này."); return; }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `video-${seq}-frame-${player.currentTime.toFixed(2)}s.png`;
    link.click();
    URL.revokeObjectURL(url);
    setError("");
  }

  return <div className="mt-3">
    <button type="button" onClick={() => setOpen((value) => !value)}
      className="rounded border border-border px-3 py-1.5 text-sm text-foreground/80 hover:border-accent">
      {open ? "Ẩn video" : "Xem video, chuẩn bị ảnh vote"}
    </button>
    {open && <div className="mt-2 max-w-xl rounded border border-border bg-background p-3">
      <video ref={video} src={`/api/videos/${videoId}/stream`} controls playsInline preload="metadata"
        className="max-h-[55vh] w-full rounded bg-black" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void downloadFrame()}
          className="rounded bg-accent px-3 py-1.5 text-sm font-semibold text-white">Tải ảnh khung hình gửi Zalo</button>
        <span className="text-xs text-muted">Tua đến đoạn cần hỏi, dừng video rồi tải ảnh.</span>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red">{error}</p>}
    </div>}
  </div>;
}
