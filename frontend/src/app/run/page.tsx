"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { RunStatus, YoutubeAuthSettings } from "@/lib/types";

export default function RunPage() {
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [auth, setAuth] = useState<YoutubeAuthSettings | null>(null);
  const [cookiesFile, setCookiesFile] = useState("");
  const [cookiesBrowser, setCookiesBrowser] = useState("");
  const [settingsPending, setSettingsPending] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await api<RunStatus>("/run/status"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const loadAuth = useCallback(async () => {
    try {
      const saved = await api<YoutubeAuthSettings>("/settings/youtube-auth");
      setAuth(saved);
      setCookiesFile(saved.cookies_file);
      setCookiesBrowser(saved.cookies_browser);
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : String(e));
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
    loadAuth();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [load, loadAuth]);

  async function saveAuth() {
    setSettingsPending(true);
    setSettingsError(null);
    setSettingsSaved(false);
    try {
      const saved = await api<YoutubeAuthSettings>("/settings/youtube-auth", {
        method: "PUT",
        body: JSON.stringify({
          cookies_file: cookiesFile.trim(),
          cookies_browser: cookiesFile.trim() ? "" : cookiesBrowser,
        }),
      });
      setAuth(saved);
      setCookiesFile(saved.cookies_file);
      setCookiesBrowser(saved.cookies_browser);
      setSettingsSaved(true);
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : String(e));
    } finally {
      setSettingsPending(false);
    }
  }

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
      <section className="rounded-md border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">YouTube access</h2>
            <p className="mt-1 text-xs text-muted">
              Use a fresh cookie export when YouTube asks you to sign in.
              Relative file paths are resolved from the project folder.
            </p>
          </div>
          {auth?.cookies_file && (
            <span className={`text-xs ${auth.cookies_file_exists ? "text-green" : "text-red"}`}>
              {auth.cookies_file_exists ? "Cookie file found" : "Cookie file missing"}
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto] md:items-end">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Cookie file (.txt or .json)
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted"
              value={cookiesFile}
              onChange={(e) => setCookiesFile(e.target.value)}
              placeholder="cookies.txt"
              disabled={status.busy || settingsPending || !auth}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Or read from browser
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              value={cookiesFile.trim() ? "" : cookiesBrowser}
              onChange={(e) => setCookiesBrowser(e.target.value)}
              disabled={status.busy || settingsPending || !auth || Boolean(cookiesFile.trim())}
            >
              <option value="">Not set</option>
              <option value="chrome">Chrome</option>
              <option value="edge">Edge</option>
              <option value="firefox">Firefox</option>
              <option value="brave">Brave</option>
            </select>
          </label>
          <button
            className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-40"
            disabled={status.busy || settingsPending || !auth}
            onClick={saveAuth}
          >
            {settingsPending ? "Saving..." : "Save access"}
          </button>
        </div>

        <p className="mt-3 text-xs text-muted">
          Manual export example: <code>yt-dlp --cookies-from-browser chrome --cookies cookies.txt</code>.
          Keep the file private. Close the browser before using browser access directly. See the{" "}
          <a
            className="text-accent underline underline-offset-2"
            href="https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp"
            target="_blank"
            rel="noreferrer"
          >
            yt-dlp cookie guide
          </a>.
        </p>
        {settingsError && <p className="mt-2 text-sm text-red">{settingsError}</p>}
        {settingsSaved && <p className="mt-2 text-sm text-green">YouTube access settings saved.</p>}
      </section>

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
