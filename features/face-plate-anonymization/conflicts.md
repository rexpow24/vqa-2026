# Conflicts — License plate and face anonymization

## Conflicts

| # | New vs. existing | What breaks | Verified how |
|---|---|---|---|
| 1 | Script output folder vs. pipeline's own artifact tiers (`clips/`, `delivered/`, `trimmed/`) | Hypothesis: writing "alongside" a pipeline-managed folder could get silently picked up by something that scans those directories. | Clean. `grep -rn "\.glob\(\|os\.walk\|iterdir\(\)\|listdir\(" **/*.py` across the whole repo finds exactly one glob (`download.py:101`, `work.glob("source.*")`, unrelated). Everything else (`review.py`, `pipeline.py`, `db.py`, `app.py`) resolves paths from DB columns (`master_path`, `delivered_path`, `trim_segments`) — never by listing a directory. An extra file sitting next to a pipeline output is invisible to the pipeline by construction. |
| 2 | New `.onnx` weight file vs. "no network" test constraint (`CLAUDE.md:82`: "66 tests, ~10s, no ffmpeg and no network") | If a test imports the detector and it tries to fetch/load the weight file from disk-that-doesn't-exist-yet or the network, the fast suite breaks its own invariant. | Verified there is no bundled `.onnx` inside the installed `cv2` package (`find venv/Lib/site-packages/cv2 -iname "*.onnx"` → empty) — confirms assumption A2 from `requirements.md` is **false as stated**: the YuNet weight is not bundled, it must be fetched once and cached, same as the plate-detector weight (Q1). Also verified no existing test file (`test_media.py` does not exist) unit-tests ffmpeg/pixel logic today — the "no ffmpeg and no network" bar is about the *existing* suite's actual behavior, not a written rule with a precedent test to copy. |
| 3 | "Don't add a layer" (`CLAUDE.md:75`) | A standalone CPU script run out-of-process from `app.py`/`pipeline.db` could be mistaken for a new service tier. | Clean by design (D1 in `requirements.md`): this is a script invoked directly, not a server, not a Docker container, no HTTP boundary. Not a new layer under the rule's own definition (the rule is about persistent services with their own process lifecycle, per the VLM exception's wording). |
| 4 | Recorded decision "Overlay removal" (`CLAUDE.md` Decision Log) | Could be read as saying blur is already a solved, closed decision — does a second blur mechanism contradict it? | Clean. That decision is scoped explicitly to "calibrated regions + always-on fixed bands" (static, channel-branding overlays). This feature is a second, independent mechanism for a different problem (moving faces/plates) and does not modify, replace, or reuse that filter graph (`vqa/media.py:196-224` confirmed architecturally incompatible with per-frame moving boxes in Conflict #1's investigation and `requirements.md` A1). No existing decision claims to already cover this case — `TODO.md`'s own BLOCKED item says the opposite. |
| 5 | Second run (re-running the script on the same folder) | Could leave a half-written output file if interrupted mid-encode, or silently skip re-processing. | Clean, by requirement (acceptance criteria: "overwritten cleanly, no errors, no orphaned partial files") — this is a constraint carried into implementation (write to a temp path, rename on success — the same pattern `vqa/media.py`'s own encode functions already use for `dst`), not an unresolved conflict. |

## Verdict: PASS

## Recommended approach

Build `scripts/anonymize.py` (or `vqa/anonymize.py` + a thin CLI wrapper, matching the
existing `vqa/` module + `vlm/scripts/` split) as a fully standalone, DB-free, config-free
script: decode each frame with OpenCV, run the YuNet face detector and an ONNX plate
detector (both CPU, both fetched-once-and-cached the way the VLM's GGUF weights already are
per `GUIDE.md`), Gaussian-blur the detected boxes directly in pixel space, write silent video
via `cv2.VideoWriter`, then one `ffmpeg` call to re-mux the original audio track — output
path is a sibling of the input, never overwriting it. The one design point that avoids every
conflict above: **never touch `pipeline.db`, `config.json`, or any pipeline-managed
directory's contents** — the script only ever reads whatever folder it's pointed at and
writes new files next to it, so it cannot collide with anything the pipeline or the reviewer
already owns.

**Trade-off:** because it is fully decoupled from the DB, there is no record of *which* clips
were anonymized, no provenance hash, no re-run tracking — if this needs to become a tracked
pipeline stage later (e.g. feeding straight into `delivered/`), that is new scope, not this
feature.

**Not doing:** wiring into `run_pipeline.py` as a new stage (would touch the DB schema and
`config.json`, expanding this into full pipeline-integration scope the user did not ask for);
a new Docker service (no model here needs isolation from the host process); GPU inference
(user decision, D3); `ultralytics`/`torch` (user decision, D2).
