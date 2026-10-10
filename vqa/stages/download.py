"""Download stage — yt-dlp."""

from __future__ import annotations

import json
from pathlib import Path

import yt_dlp


class DownloadError(RuntimeError):
    pass


def _netscape_from_json(src: Path) -> Path:
    """Convert a browser-extension cookie export (JSON) to Netscape format.

    yt-dlp reads only Netscape. Extensions like EditThisCookie / Cookie-Editor
    export JSON, so accept both rather than making the user reformat by hand.
    """
    out = src.with_suffix(".netscape.txt")
    if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
        return out
    try:
        cookies = json.loads(src.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DownloadError(f"cannot read cookie JSON {src.name}: {exc}") from exc
    if not isinstance(cookies, list):
        raise DownloadError("cookie JSON must contain a list of exported cookies")

    rows = ["# Netscape HTTP Cookie File"]
    for c in cookies:
        if not isinstance(c, dict):
            continue
        domain = c.get("domain", "")
        if not domain or not c.get("name"):
            continue
        sub = "FALSE" if c.get("hostOnly") else "TRUE"
        secure = "TRUE" if c.get("secure") else "FALSE"
        # Session cookies carry no expiry; 0 means "expires at end of session".
        expiry = int(c.get("expirationDate") or 0)
        rows.append(chr(9).join([domain, sub, c.get("path", "/"), secure,
                               str(expiry), c["name"], c.get("value", "")]))
    if len(rows) == 1:
        raise DownloadError("cookie JSON contains no usable cookie entries")
    out.write_text(chr(10).join(rows) + chr(10), encoding="utf-8")
    return out


def _auth_opts(cfg: dict | None) -> dict:
    """Cookie options. YouTube bot-gates unauthenticated requests from many IPs;
    without cookies the download fails with "Sign in to confirm you're not a bot".
    """
    if not cfg:
        return {}
    path = (cfg.get("cookies_file") or "").strip()
    if path:
        src = Path(path)
        if not src.is_absolute():
            src = Path.cwd() / src
        if not src.is_file():
            raise DownloadError(f"configured cookie file does not exist: {path}")
        if src.suffix.lower() == ".json":
            src = _netscape_from_json(src)
        elif src.suffix.lower() == ".txt":
            try:
                with src.open(encoding="utf-8-sig") as cookies:
                    header = cookies.readline().strip()
            except OSError as exc:
                raise DownloadError(f"cannot read cookie file {src.name}: {exc}") from exc
            if header not in {"# HTTP Cookie File", "# Netscape HTTP Cookie File"}:
                raise DownloadError(
                    "cookie TXT must be in Netscape format; export it with yt-dlp "
                    "or use a compatible cookie exporter"
                )
        else:
            raise DownloadError("cookie file must have a .txt or .json extension")
        return {"cookiefile": str(src)}
    browser = (cfg.get("cookies_browser") or "").strip().lower()
    if browser:
        # yt-dlp cannot read the cookie DB while that browser is running.
        return {"cookiesfrombrowser": (browser, None, None, None)}
    return {}


def download(url: str, work: Path, max_height: int = 1080,
             cfg: dict | None = None) -> dict:
    """Download to work/source.mp4. Returns metadata; resumes if already present."""
    work.mkdir(parents=True, exist_ok=True)
    target = work / "source.mp4"
    meta_path = work / "metadata.json"

    if target.exists() and target.stat().st_size > 1024 and meta_path.exists():
        return json.loads(meta_path.read_text(encoding="utf-8"))

    opts = {
        "format": (
            f"bestvideo[height<={max_height}][ext=mp4]+bestaudio[ext=m4a]/"
            f"best[height<={max_height}]/best"
        ),
        "merge_output_format": "mp4",
        "outtmpl": str(work / "source.%(ext)s"),
        "quiet": True,
        "noprogress": True,
        "no_warnings": True,
        "retries": 3,
        "fragment_retries": 3,
        "continuedl": True,
        "noplaylist": True,
        # YouTube's "n" challenge needs a real JS runtime plus the solver script.
        # Without both, extraction dies with "The page needs to be reloaded".
        # ejs:github fetches yt-dlp's own solver at runtime.
        "js_runtimes": {"deno": {}, "node": {}},  # API wants a dict, not the CLI list
        "remote_components": ["ejs:github"],
    }
    auth_opts = _auth_opts(cfg)
    opts.update(auth_opts)

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
    except yt_dlp.utils.DownloadError as exc:
        message = str(exc)[:400]
        if "Sign in to confirm" in message or "not a bot" in message:
            if auth_opts:
                message += (
                    " Configured cookies were supplied but YouTube rejected them; "
                    "export a fresh cookie file and update YouTube access settings."
                )
            else:
                message += (
                    " Set a fresh cookies.txt path or choose a browser in "
                    "YouTube access settings."
                )
        raise DownloadError(message) from exc

    if info.get("is_live"):
        raise DownloadError("live stream — not a compilation")

    if not target.exists():
        # yt-dlp may have produced a different container.
        for cand in sorted(work.glob("source.*")):
            if cand.suffix.lower() in (".mp4", ".mkv", ".webm"):
                cand.rename(target)
                break
    if not target.exists():
        raise DownloadError("download produced no file")

    meta = {
        "title": info.get("title") or "",
        "channel_id": info.get("channel_id") or info.get("uploader_id") or "unknown",
        "channel_name": info.get("channel") or info.get("uploader") or "",
        "duration_s": float(info.get("duration") or 0.0),
        "webpage_url": info.get("webpage_url") or url,
    }
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta
