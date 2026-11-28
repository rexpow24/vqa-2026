"use client";

import { useState } from "react";

/** Local demonstration of the permanent URL that a direct Drive redirect exposes. */
export function DriveLinkPreview({ streamPath }: { streamPath: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  if (process.env.NODE_ENV !== "development") return null;

  async function reveal() {
    try {
      const response = await fetch(`${streamPath}?direct_drive_preview=link`, { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      setUrl(data.driveUrl);
      setError(false);
    } catch {
      setError(true);
    }
  }

  return <div className="rounded border border-amber/60 bg-amber/10 p-2 text-xs">
    <button type="button" onClick={() => { void reveal(); }} className="font-medium text-amber underline">
      Xem URL Drive sẽ lộ nếu phát trực tiếp
    </button>
    {url && <p className="mt-2 break-all" role="status">Người xem có thể sao chép và chia sẻ URL này: <code>{url}</code></p>}
    {error && <p className="mt-2 text-red" role="alert">Không lấy được URL thử nghiệm.</p>}
  </div>;
}
