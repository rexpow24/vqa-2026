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

from vqa import config, db, media, review, urls

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
    top = [c for c in pending if db.priority(c["duration_ms"]) == db.TOP]
    low = [c for c in pending if db.priority(c["duration_ms"]) == db.LOW_PRIORITY]

    counts = db.clip_counts()
    total = sum(counts["by_decision"].values()) or 1
    approved = counts["by_decision"].get(db.APPROVED, 0)
    reviewed = total - counts["by_decision"].get(db.UNREVIEWED, 0)

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Top priority left", len(top))
    m2.metric("Low priority left", len(low))
    m3.metric("Reviewed", reviewed)
    m4.metric("Approved", approved)

    # Last decision, echoed so the reviewer sees the approve landed.
    last = st.session_state.get("last_decision")
    if last:
        cid_done, decision, detail = last
        icon = {"APPROVED": "✅", "REJECTED": "❌", "FLAGGED": "🚩"}[decision]
        label = {"APPROVED": "Approved", "REJECTED": "Rejected",
                 "FLAGGED": "Flagged"}[decision]
        banner = st.success if decision == "APPROVED" else st.info
        banner(f"{icon} `{cid_done}` — + {label} · {detail}")

    # Top priority drains first, then Low. The handover is automatic: no
    # "Next batch" click, because there is nothing for the reviewer to decide.
    queue = top or low
    band = db.TOP if top else db.LOW_PRIORITY

    if not queue:
        st.success("Nothing left to review.")
    else:
        clip = queue[0]
        cid = clip["clip_id"]
        dur = clip["duration_ms"] / 1000
        flags = json.loads(clip["flags"] or "[]")
        chip = "🔺 TOP PRIORITY" if band == db.TOP else "▪️ Low priority"

        st.markdown(
            f"### {chip} · `{cid}` · {dur:.1f}s"
            + (f" · ⚠️ {', '.join(flags)}" if flags else "")
        )
        st.caption(
            f"Clips longer than {db.PRIORITY_SECONDS}s are reviewed first. "
            "Priority comes from the original duration and does not change "
            "when you trim."
        )

        path = clip["delivered_path"] or clip["master_path"]
        if path and Path(path).exists():
            st.video(path, autoplay=True, loop=True)
        else:
            st.error(f"Missing file: {path}")

        existing = db.trim_segments(clip)
        if existing:
            st.info(
                f"Already materialised as {len(existing)} file(s) in `trimmed/`. "
                "Approving again overwrites them; Reject deletes them."
            )

        # ── trim: define the output segments ──────────────────────────────
        st.divider()
        multi = st.toggle(
            "✂️ Multiple trim", key=f"multi_{cid}",
            help="One shot sometimes holds two incidents. Split it into several "
                 "clips instead of throwing the whole thing away.")

        segments: list[tuple[float, float]] = []
        seg_error = None
        dmax = round(dur, 1)

        if multi:
            st.caption(
                f"One row per output clip. Times are within this clip "
                f"(0 – {media.fmt_time(dur)}); `HH:MM:SS` or plain seconds both "
                "work. Use the last row to add another, the ✗ to remove one."
            )
            default = pd.DataFrame(
                [{"Start": "00:00:00.0", "End": media.fmt_time(dur)}])
            table = st.data_editor(
                default, num_rows="dynamic", width='stretch',
                key=f"segs_{cid}",
                column_config={
                    "Start": st.column_config.TextColumn(required=True),
                    "End": st.column_config.TextColumn(required=True),
                })
            for i, row in enumerate(table.itertuples(index=False), 1):
                try:
                    a, b = media.parse_time(row.Start), media.parse_time(row.End)
                except (media.MediaError, ValueError):
                    seg_error = f"Row {i}: could not read the times."
                    break
                segments.append((a, b))
            if not segments and not seg_error:
                seg_error = "Add at least one row."
        else:
            lo, hi = st.slider("Keep range (s)", 0.0, dmax, (0.0, dmax), 0.1,
                               key=f"tr_{cid}")
            c1, c2 = st.columns(2)
            a = c1.number_input("Start (s)", 0.0, dmax, float(lo), 0.1, key=f"ts_{cid}")
            b = c2.number_input("End (s)", 0.0, dmax, float(hi), 0.1, key=f"te_{cid}")
            if b > a:
                segments = [(a, b)]
            else:
                seg_error = "End time must be after start time."

        if seg_error:
            st.warning(seg_error)
        else:
            st.caption(
                f"Approve writes **{len(segments)} file(s)** to `trimmed/`: "
                + ", ".join(f"{media.fmt_time(a)}→{media.fmt_time(b)}"
                            for a, b in segments)
                + ". Cut only — no crop, rotate or effects. The master and the "
                  "delivered clip are never modified."
            )

        # ── decision ──────────────────────────────────────────────────────
        st.divider()
        st.caption(
            "Approve or Reject is required to advance — there is no Skip. "
            "Approve materialises the segments into `trimmed/`; Reject removes "
            "this clip from `trimmed/` and leaves the source untouched."
        )
        b1, b2, b3 = st.columns(3)

        if b1.button("✅ Approve", width='stretch', type="primary",
                     disabled=bool(seg_error)):
            try:
                with st.spinner("Writing segments…"):
                    written = review.materialize(clip, segments, cfg)
                db.set_decision(cid, db.APPROVED)
                st.session_state["last_decision"] = (
                    cid, db.APPROVED, f"{len(written)} file(s) → trimmed/")
                st.rerun()
            except media.MediaError as exc:
                st.error(str(exc))

        if b2.button("🗑️ Reject", width='stretch'):
            removed = review.discard(clip)
            db.set_decision(cid, db.REJECTED)
            st.session_state["last_decision"] = (
                cid, db.REJECTED, f"removed {removed} file(s) from trimmed/")
            st.rerun()

        if b3.button("🚩 Flag", width='stretch'):
            db.set_decision(cid, db.FLAGGED)
            st.session_state["last_decision"] = (cid, db.FLAGGED, "needs a second look")
            st.rerun()


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
            # trimmed/ is the finished product: an approved clip is always
            # materialised there, as one file or several.
            segs = db.trim_segments(c)
            sources = ([Path(x["path"]) for x in segs] or
                       [Path(c["delivered_path"] or c["master_path"])])
            dest_dir = out / "clips" / c["youtube_video_id"]
            dest_dir.mkdir(parents=True, exist_ok=True)
            for i, src in enumerate(sources, 1):
                if not src.exists():
                    continue
                name = src.name if segs else f"{c['clip_id']}.mp4"
                shutil.copy2(src, dest_dir / name)
                manifest["clips"].append({
                    "clip_id": c["clip_id"],
                    "file": name,
                    "segment": i,
                    "of_segments": len(sources),
                    "youtube_video_id": c["youtube_video_id"],
                    "start_ms": c["start_ms"], "end_ms": c["end_ms"],
                    "priority": db.priority(c["duration_ms"]),
                    "trim_start_ms": segs[i - 1]["start_ms"] if segs else None,
                    "trim_end_ms": segs[i - 1]["end_ms"] if segs else None,
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
