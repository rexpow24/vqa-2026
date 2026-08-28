"""VQA traffic clip pipeline — the entire interface.

    streamlit run app.py

Ugly but functional, on purpose (CLAUDE.md Principle 2).
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

import pandas as pd
import streamlit as st

from vqa import config, db, urls

st.set_page_config(page_title="VQA Clip Pipeline", page_icon="🎬", layout="wide")

db.init()
LOG_DIR = Path("logs")


# ── run process helpers ───────────────────────────────────────────────────

def running_proc() -> subprocess.Popen | None:
    p = st.session_state.get("proc")
    if p is not None and p.poll() is None:
        return p
    return None


def start_run() -> None:
    proc = subprocess.Popen(
        [sys.executable, "run_pipeline.py"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    st.session_state["proc"] = proc


def log_tail(n: int = 40) -> str:
    latest = LOG_DIR / "latest.log"
    if not latest.exists():
        return "(no runs yet)"
    try:
        path = Path(latest.read_text(encoding="utf-8").strip())
        lines = path.read_text(encoding="utf-8").splitlines()
        return "\n".join(lines[-n:]) or "(empty)"
    except OSError:
        return "(log unavailable)"


# ── sidebar: all configuration ────────────────────────────────────────────

cfg = config.load()
busy = running_proc() is not None

with st.sidebar:
    st.header("⚙️ Settings")
    if busy:
        st.warning("Run in progress — settings are locked.")
        st.caption(
            "Editing config mid-run would put clips with different parameters "
            "under one config hash."
        )

    st.subheader("Toggles")
    cfg["review_enabled"] = st.checkbox(
        "Review mode", value=cfg["review_enabled"], disabled=busy,
        help="Off = headless. Clips are written UNREVIEWED, never APPROVED.")
    cfg["blur_enabled"] = st.checkbox(
        "Blur overlays", value=cfg["blur_enabled"], disabled=busy)
    cfg["color_kill_enabled"] = st.checkbox(
        "Desaturate + darken", value=cfg["color_kill_enabled"],
        disabled=busy or not cfg["blur_enabled"],
        help="Kills the brand colour signature. Ignored if blur is off.")

    st.subheader("Overlay removal")
    cfg["blur_sigma"] = st.slider("Blur sigma", 2, 60, int(cfg["blur_sigma"]),
                                  disabled=busy or not cfg["blur_enabled"])
    cfg["desaturate"] = st.slider("Desaturate", 0.0, 1.0, float(cfg["desaturate"]),
                                  0.05, disabled=busy or not cfg["color_kill_enabled"])
    cfg["darken"] = st.slider("Darken", 0.0, 0.5, float(cfg["darken"]), 0.05,
                              disabled=busy or not cfg["color_kill_enabled"])

    st.subheader("Fixed blur bands")
    st.caption(
        "Applied to every video, on top of whatever calibration finds. "
        "Coordinates are fractions of the frame, so one setting works at any "
        "resolution. Defaults cover the burned-in clock, the `#03` counter and "
        "the source-camera name."
    )
    bands = []
    for i, band in enumerate(cfg.get("fixed_blur", [])):
        name = band.get("name", f"band{i}")
        with st.expander(name, expanded=False):
            band = dict(band)
            band["enabled"] = st.checkbox(
                "Enabled", value=band.get("enabled", True),
                key=f"fb_on_{i}", disabled=busy or not cfg["blur_enabled"])
            c1, c2 = st.columns(2)
            band["x"] = c1.number_input("x", 0.0, 1.0, float(band["x"]), 0.01,
                                        key=f"fb_x_{i}", disabled=busy)
            band["y"] = c2.number_input("y", 0.0, 1.0, float(band["y"]), 0.01,
                                        key=f"fb_y_{i}", disabled=busy)
            band["w"] = c1.number_input("w", 0.01, 1.0, float(band["w"]), 0.01,
                                        key=f"fb_w_{i}", disabled=busy)
            band["h"] = c2.number_input("h", 0.01, 1.0, float(band["h"]), 0.01,
                                        key=f"fb_h_{i}", disabled=busy)
        bands.append(band)
    cfg["fixed_blur"] = bands

    st.subheader("Detection")
    cfg["content_threshold"] = st.slider(
        "Content threshold", 5.0, 60.0, float(cfg["content_threshold"]), 1.0,
        disabled=busy, help="PySceneDetect default is 27. Leave it alone.")

    st.subheader("Clips")
    cfg["min_duration_s"] = st.number_input(
        "Min duration (s)", 1.0, 60.0, float(cfg["min_duration_s"]), 1.0, disabled=busy)
    cfg["max_duration_s"] = st.number_input(
        "Max duration (s)", 5.0, 300.0, float(cfg["max_duration_s"]), 5.0, disabled=busy)

    st.subheader("Encoding")
    cfg["encoder"] = st.selectbox(
        "Encoder", ["h264_nvenc", "libx264"],
        index=0 if cfg["encoder"] == "h264_nvenc" else 1, disabled=busy)
    cfg["nvenc_cq"] = st.slider("NVENC cq", 10, 35, int(cfg["nvenc_cq"]),
                                disabled=busy or cfg["encoder"] != "h264_nvenc",
                                help="NVENC has no CRF; cq is the equivalent.")

    st.subheader("YouTube access")
    cfg["cookies_file"] = st.text_input(
        "cookies.txt path", cfg.get("cookies_file", ""), disabled=busy,
        placeholder="cookies.txt",
        help="Netscape-format cookie export. Needed when YouTube answers "
             "\"Sign in to confirm you're not a bot\".")
    _browsers = ["", "chrome", "edge", "firefox", "brave"]
    _cur = (cfg.get("cookies_browser") or "")
    cfg["cookies_browser"] = st.selectbox(
        "or read cookies from browser", _browsers,
        index=_browsers.index(_cur) if _cur in _browsers else 0,
        disabled=busy or bool(cfg.get("cookies_file", "").strip()),
        help="That browser must be fully closed while the pipeline runs.")

    st.subheader("Paths")
    cfg["work_dir"] = st.text_input("Work dir", cfg["work_dir"], disabled=busy)
    cfg["output_dir"] = st.text_input("Export dir", cfg["output_dir"], disabled=busy)

    if st.button("💾 Save settings", disabled=busy, width='stretch'):
        config.save(cfg)
        st.success(f"Saved — config {config.config_hash(config.load())}")

    st.caption(f"config hash `{config.config_hash(config.load())}`  ·  "
               f"pipeline `{config.PIPELINE_VERSION}`")

if cfg["blur_enabled"] and not cfg["color_kill_enabled"]:
    st.sidebar.info("Blur only: the brand colour survives as a smear.")
if not cfg["review_enabled"]:
    st.sidebar.warning("Headless mode: no human gate. Clips stay UNREVIEWED.")


# ── tabs ──────────────────────────────────────────────────────────────────

tab_queue, tab_run, tab_review, tab_export = st.tabs(
    ["📥 Queue", "▶️ Run", "👀 Review", "📦 Export"]
)


with tab_queue:
    st.subheader("Add videos")
    col_a, col_b = st.columns(2)

    with col_a:
        pasted = st.text_area("Paste URLs (one per line)", height=140,
                              placeholder="https://youtu.be/...\nhttps://www.youtube.com/watch?v=...")
        if st.button("Add pasted URLs"):
            ok, bad = urls.parse_lines(pasted)
            added = sum(db.enqueue(v, u) for v, u in ok)
            st.success(f"Added {added}, duplicate {len(ok) - added}, invalid {len(bad)}")
            for line_no, raw in bad[:5]:
                st.caption(f"line {line_no}: {raw}")

    with col_b:
        up = st.file_uploader("Or upload a .txt (one URL per line)", type=["txt"])
        if up is not None and st.button("Add from file"):
            text = up.read().decode("utf-8", errors="replace")
            ok, bad = urls.parse_lines(text)
            added = sum(db.enqueue(v, u) for v, u in ok)
            st.success(f"Added {added}, duplicate {len(ok) - added}, invalid {len(bad)}")
            for line_no, raw in bad[:10]:
                st.caption(f"line {line_no}: {raw}")

    st.divider()
    st.subheader("Queue")
    rows = db.list_videos()
    if rows:
        frame = pd.DataFrame([{
            "video_id": r["youtube_video_id"],
            "title": (r["title"] or "")[:60],
            "channel": (r["channel_name"] or "")[:24],
            "status": r["status"],
            "stage": r["stage"] or "",
            "min": round((r["duration_s"] or 0) / 60, 1),
            "bounds": r["n_boundaries"] or 0,
            "clips": r["n_clips"] or 0,
            "error": (r["error_code"] or ""),
        } for r in rows])
        st.dataframe(frame, width='stretch', hide_index=True)

        c1, c2 = st.columns(2)
        if c1.button("🔁 Retry DOWNLOAD_FAILED", disabled=busy):
            st.info(f"Requeued {db.retry_status(db.DOWNLOAD_FAILED)}")
        if c2.button("🔁 Retry FAILED", disabled=busy):
            st.info(f"Requeued {db.retry_status(db.FAILED)}")
    else:
        st.info("Queue is empty. Add some URLs above.")


with tab_run:
    queued = len(db.list_videos(db.QUEUED))
    st.subheader("Pipeline")

    c1, c2, c3 = st.columns([1, 1, 3])
    if c1.button("▶️ Start", disabled=busy or queued == 0, type="primary"):
        start_run()
        st.rerun()
    if c2.button("⏹ Stop", disabled=not busy):
        proc = running_proc()
        if proc:
            proc.terminate()
        st.rerun()
    c3.metric("Queued", queued)

    all_rows = db.list_videos()
    if all_rows:
        done = sum(1 for r in all_rows
                   if r["status"] in (db.READY_FOR_REVIEW, db.DONE))
        st.progress(done / len(all_rows), text=f"{done}/{len(all_rows)} videos complete")

    st.text_area("Log", log_tail(), height=320)

    if busy:
        time.sleep(2)
        st.rerun()


with tab_review:
    if not cfg["review_enabled"]:
        st.warning(
            "Headless mode is on. Clips from the last run are UNREVIEWED — "
            "you can still review them here."
        )

    pending = db.list_clips(decision=db.UNREVIEWED)
    counts = db.clip_counts()
    total = sum(counts["by_decision"].values()) or 1
    approved = counts["by_decision"].get(db.APPROVED, 0)
    reviewed = total - counts["by_decision"].get(db.UNREVIEWED, 0)

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Pending", len(pending))
    m2.metric("Reviewed", reviewed)
    m3.metric("Approved", approved)
    m4.metric("Approval rate", f"{(approved / reviewed * 100) if reviewed else 0:.0f}%")

    if not pending:
        st.success("Nothing left to review.")
    else:
        clip = pending[0]
        flags = json.loads(clip["flags"] or "[]")
        badge = {"HIGH": "🟢", "MEDIUM": "🟡", "LOW": "🔴"}[clip["confidence"]]

        st.markdown(
            f"### {badge} `{clip['clip_id']}`  ·  {clip['duration_ms']/1000:.1f}s"
            + (f"  ·  ⚠️ {', '.join(flags)}" if flags else "")
        )
        st.caption("LOW-confidence clips are shown first.")

        path = clip["delivered_path"] or clip["master_path"]
        if path and Path(path).exists():
            st.video(path, autoplay=True, loop=True)
        else:
            st.error(f"Missing file: {path}")

        b1, b2, b3 = st.columns(3)
        if b1.button("✅ Approve (A)", width='stretch', type="primary"):
            db.set_decision(clip["clip_id"], db.APPROVED)
            st.rerun()
        if b2.button("❌ Reject (R)", width='stretch'):
            db.set_decision(clip["clip_id"], db.REJECTED)
            st.rerun()
        if b3.button("🚩 Flag (F)", width='stretch'):
            db.set_decision(clip["clip_id"], db.FLAGGED)
            st.rerun()

        st.caption(
            "Keyboard triage: `pip install streamlit-shortcuts`, then bind A/R/F. "
            "Buttons work fine meanwhile."
        )


with tab_export:
    st.subheader("Export")
    batch = st.text_input("Batch name", "batch01")
    headless_batch = not cfg["review_enabled"]
    wanted = db.UNREVIEWED if headless_batch else db.APPROVED
    clips = db.list_clips(decision=wanted)
    st.write(f"{len(clips)} clip(s) with decision `{wanted}` ready to export.")

    if st.button("📦 Export to disk", disabled=not clips, type="primary"):
        out = Path(cfg["output_dir"]) / batch
        (out / "clips").mkdir(parents=True, exist_ok=True)
        manifest = {
            "batch": batch,
            "pipeline_version": config.PIPELINE_VERSION,
            # The config at EXPORT time. Each clip carries the hash of the
            # config that actually produced it, which may differ.
            "export_config_hash": config.config_hash(cfg),
            "review_mode": "headless" if headless_batch else "interactive",
            "exported_at": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
            "clips": [],
        }
        for c in clips:
            src = Path(c["delivered_path"] or c["master_path"])
            if not src.exists():
                continue
            dest_dir = out / "clips" / c["youtube_video_id"]
            dest_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest_dir / f"{c['clip_id']}.mp4")
            manifest["clips"].append({
                "clip_id": c["clip_id"],
                "youtube_video_id": c["youtube_video_id"],
                "start_ms": c["start_ms"], "end_ms": c["end_ms"],
                "confidence": c["confidence"],
                "flags": json.loads(c["flags"] or "[]"),
                "decision": c["decision"],
                "pipeline_version": c["pipeline_version"],
                "config_hash": c["config_hash"],
            })
        (out / "manifest.json").write_text(
            json.dumps(manifest, indent=2), encoding="utf-8")
        st.success(f"Exported {len(manifest['clips'])} clips to {out}")

    st.divider()
    st.caption("Stats")
    st.json(db.clip_counts())
