# GUIDE — running the pipeline & reviewing clips

Two audiences in one file:

- **[Part 1 — Operator](#part-1--operator)**: whoever runs the pipeline.
- **[Part 2 — Reviewer](#part-2--reviewer)**: whoever decides what makes it into
  the dataset. **The trim rule is in [§2.4](#24-where-to-cut--the-rule).**
- **[Part 3 — VLM server](#part-3--vlm-server)**: asking a local vision model
  about a clip. Phase 2, added 2026-09-05.

---

# Part 1 — Operator

## 1.1 One-time setup

```bash
python -m venv venv
venv/Scripts/pip install -r requirements.txt
```

Then check three things are on `PATH`:

| Tool | Check | If missing |
|---|---|---|
| ffmpeg / ffprobe | `ffmpeg -version` | install and add to PATH |
| Node **or** Deno | `node --version` | required for YouTube's "n" challenge |
| NVIDIA GPU (optional) | `nvidia-smi` | else set encoder to `libx264` |

### Cookies

YouTube blocks unauthenticated downloads from most IPs
(`Sign in to confirm you're not a bot`). Export cookies from a browser where you
are logged in:

1. Install a cookie-export extension (e.g. *Cookie-Editor*, *Get cookies.txt
   LOCALLY*).
2. Open YouTube in a **new incognito window**, log in, open any video.
3. Export to `cookies.json` **or** `cookies.txt` in the project root.
4. Close the window **without logging out** — logging out invalidates the
   cookies you just exported.

Both formats work; JSON is converted to Netscape automatically. Point the
sidebar field *YouTube access → cookies path* at the file.

> Use a throwaway Google account. A heavy download run from a flagged IP can get
> the account itself rate-limited.

## 1.2 Start the app

```bash
venv/Scripts/streamlit run app.py
```

This is the whole interface. There are no command-line flags — everything is a
sidebar widget, saved to `config.json` behind the scenes.

## 1.3 Queue → Run

1. **Queue tab** — paste YouTube URLs (one per line) or upload a `.txt`.
   Duplicates are skipped automatically; the video ID is the dedup key, so the
   same video pasted with different tracking parameters is caught. Anything
   already queued is listed by ID with the state it reached, so you can tell a
   finished video from one whose download failed. **A duplicate is never
   downloaded again.**
2. **Remove from queue** (same tab) — drops a URL you no longer want, typically
   a `DOWNLOAD_FAILED` one you want to re-add and retry. Only videos the runner
   has finished with are offered; a `READY_FOR_REVIEW` one cannot be removed
   here, because its clips are the product. Removing a `STOPPED` video also
   deletes the clips it managed to produce, **including anything you already
   approved into `trimmed/`**. The download stays on disk either way, so
   re-adding the URL resumes rather than starting over.
3. **Sidebar** — set toggles, then **Save settings**. Settings lock during a run
   so a batch cannot end up half-processed under two different configs.
4. **Run tab** — **Start**. Progress and the log update inline. **Stop** kills
   the runner and marks whatever it was working on `STOPPED`; from the Queue tab
   you can then **Resume STOPPED** (carries on from the downloaded file — it does
   not re-download) or remove it. If a video is stuck at `DOWNLOADING` /
   `PROCESSING` with nothing running — after a crash, a reboot, or a closed
   browser tab — the Queue tab offers **Mark them STOPPED** to free it. Only
   press that when you are sure no run is going, including in another tab.

You do **not** have to wait for the queue to drain before reviewing. Clips are
written to the database one at a time as each is encoded, so the Review tab
fills up during the run — open it and work while the pipeline keeps going.

Expect roughly, for a 12-minute 1080p video:

| Stage | Time |
|---|---|
| download | ~30s |
| overlay calibration | ~2 min (cached per channel afterwards) |
| shot detection | ~8 min |
| cut + blur + encode | ~3 min |

Calibration runs once per **channel**, so the second video from the same channel
skips it.

## 1.4 Settings that actually matter

| Setting | Default | Why you would change it |
|---|---|---|
| **NVENC cq** | 23 | Lower = better quality, much bigger files. At 19 the output was ~6x the lossless master. |
| **Encoder** | `h264_nvenc` | Switch to `libx264` with no NVIDIA GPU. |
| **Blur overlays** | on | Off produces unredacted clips. Do not ship those. |
| **Fixed blur bands** | 3 bands on | Positions are fractions of the frame. Adjust once per channel layout; see §1.5. |
| **Content threshold** | 27.0 | PySceneDetect default. Leave it alone unless boundaries are visibly wrong. |
| **Min / max duration** | 5s / 30s | Clips under min are dropped; over max are flagged `TOO_LONG`, never auto-split. |
| **Review mode** | on | Off = headless: clips are written `UNREVIEWED` and **nothing** reaches `trimmed/`. |

## 1.5 Checking the blur before a big batch

Blur is the one thing that silently produces useless output, so verify it on the
**first video of any new channel** before queueing 50 more.

1. Open any file in `work/<video_id>/delivered/`.
2. Confirm all four things are illegible: the channel logo, the burned-in clock,
   the `#03` counter, and the source-camera name.
3. Confirm the roadway, signs and vehicles are **untouched**.

If a band is off-target, adjust its `x/y/w/h` in the sidebar, save, delete
`work/<video_id>/delivered/`, and re-run. Masters are not re-cut and nothing is
re-downloaded, so this costs minutes, not hours.

## 1.6 Disk

About **1.4 GB per 12-minute video** (source + masters + delivered). Fifty videos
is roughly **70 GB**.

`clips/` (the lossless masters) is the largest slice and exists so blur settings
can be changed without re-downloading. Once a channel's blur is settled and the
batch is exported, deleting `clips/` roughly halves the footprint — at the cost
of a re-download if you ever change blur again.

## 1.7 Export

**Export tab** → name the batch → **Export to disk**. Writes
`export/<batch>/clips/<video_id>/` plus a `manifest.json` recording, per file:
clip ID, segment index, trim points, confidence, flags, decision, pipeline
version and config hash.

Only `APPROVED` clips are exported (or `UNREVIEWED` ones from a headless batch —
the manifest records which, so the two can never be confused).

---

# Part 2 — Reviewer

## 2.1 What you are deciding

Each clip is one candidate incident, already cut and blurred. Your job is:

1. Is there a real, usable traffic event here? → **Approve** / **Reject**
2. If yes, **which seconds** of it belong in the dataset? → set the trim

Nothing reaches the finished-product folder until you approve it.

## 2.2 The screen

Open the **Review** tab. It shows one clip at a time.

- **🔺 TOP PRIORITY** — the clip is longer than 15s. These are reviewed first.
- **▪️ Low priority** — 15s or shorter.
- The video autoplays and loops.
- Priority comes from the **original** clip length and never changes when you
  trim.

Top priority drains completely, then low priority begins automatically. There is
no batch button to press.

## 2.3 There is no Skip

You must **Approve** or **Reject** to move on. Flag is available for "someone
should look at this again" — it is a decision, not a skip, and it also advances.

This is deliberate: a Skip button turns into a pile of clips nobody ever
revisits.

## 2.4 Where to cut — the rule

> **Start the clip at the moment of impact. End it 5 seconds later.**

So for a collision at `00:00:12.0` in the clip, the trim is:

| | |
|---|---|
| Start | `00:00:12.0` |
| End | `00:00:17.0` |

**You do not have to type this.** Park the playhead on the impact and press
**📍 Mark cut** — see [§2.5](#25-mark-cut-and-the-timeline). The default
padding is ±5s, set in the sidebar under *Review → Mark cut padding*.

Apply this to every approved clip unless one of the exceptions below applies.

### Exceptions

| Situation | What to do |
|---|---|
| The collision is in the last 5s of the clip | End at the end of the clip. Do not pad. |
| No collision — a near-miss or a violation | Start at the moment the event is unmistakable, still +5s. |
| The event genuinely continues past 5s (pile-up, vehicle rolls) | Extend the end until the motion settles. Do not cut mid-event. |
| Two separate incidents in one clip | Mark each one — see §2.6. |

### Reading the timeline

Times are **relative to the clip you are watching**, not the original YouTube
video. `0` is the first frame of this clip. Both `HH:MM:SS` and plain seconds
are accepted, so `00:00:12.0`, `0:12` and `12` are the same instant.

> **A note worth raising with whoever owns the dataset.** Starting exactly at
> impact means the clip contains no lead-up. A VQA question like *"why did the
> crash happen?"* or *"who had right of way?"* cannot be answered from footage
> that begins at the moment of contact. If those question types are in scope,
> the rule should become **impact −3s to impact +5s**. Until that is decided,
> follow the rule as written above.

## 2.5 Mark cut and the timeline

### Marking one incident

1. Drag **Playhead (s)** to the moment of impact.
2. Press **📍 Mark cut**.

That creates a shot of *playhead ± padding* (±5s by default). The first Mark cut
replaces the whole-clip default you arrive with, so you are not fighting it.

### When ±5s does not fit

If the window would run off the end of the clip, or land on a shot you already
marked, it **shrinks evenly on both sides** — ±5s, ±4s, ±3s, ±2s, ±1s — until it
fits. An adjusted shot gets a **yellow dashed border** on the timeline and the
tooltip *auto-adjusted to avoid overlap*. Nothing is silently discarded.

If it is still stuck at ±1s, no shot is created and you get **"Cannot
auto-adjust"** followed by the reason, e.g. *the playhead is inside (or within
1s of) shot 1 [0.0–22.8s]*. The two common causes:

| Reason | Fix |
|---|---|
| The playhead is inside a shot you already marked — including the whole-clip shot, if you have edited it | Delete that shot with ✗, or move the playhead into free space |
| The playhead is less than 1s from the start or end of the clip | Type the times by hand; a shot needs 1s on each side |

### Reading the timeline

Under the player is a bar showing the whole clip, with one block per shot:

| | |
|---|---|
| 🟩 Shot 1 | green |
| 🟦 Shot 2 | blue |
| 🟧 Shot 3 | orange |

Each block is labelled with its shot number and its start and end in seconds.
Hover for the exact range and duration. **Maximum 3 shots per clip.**

### Conflicts

If two shots overlap by more than 0.1s, the shared region turns **red with a
blinking border**, the overlap is listed underneath, and **Approve is disabled**.

Press **🔧 Resolve conflict** and the *newer* shot shrinks — ±5s, ±4s, … — until
it clears the older one. If it cannot (the newer shot is entirely inside the
older one), you get *"Cannot resolve automatically – please adjust Start/End
manually"*, the red stays, and Approve stays blocked until you fix it by hand.

### Adjusting by hand

Every shot has **Start (s)** and **End (s)** boxes stepping in 0.1s. The timeline
and the conflict check update as you type. **✗** removes a shot; **➕ Add shot**
adds an empty one if you would rather not use the playhead.

## 2.6 Two incidents in one clip

The detector sometimes merges two incidents into a single shot. Rather than
throwing the clip away or keeping only one, mark each one:

1. Playhead on the first impact → **Mark cut**.
2. Playhead on the second impact → **Mark cut**.
3. **Approve** writes one file per shot.

Apply the §2.4 rule to **each** incident independently. Example — impacts at 6s
and 20s in a 26s clip give shots `1.0–11.0` and `15.0–25.0`, and two files:
`..._t01.mp4` and `..._t02.mp4`.

## 2.7 When to Reject

Reject when the clip is not usable, regardless of how it was cut:

- No traffic event — just ordinary driving
- The incident is off-screen, or too small / too dark / too blurred to read
- The cut lands mid-incident and the impact itself is missing
- A title card, intro, outro or channel bumper survived the filter
- Duplicate of a clip you already approved from the same video

Reject deletes this clip's files from `trimmed/` and **nothing else**. The
blurred clip and the original download both survive, so a rejection can always be
revisited.

## 2.8 What happens when you press Approve

The shots you defined are cut out of the blurred clip you were watching and
written to `work/<video_id>/trimmed/` as `{clip_id}_t01.mp4`, `_t02.mp4`, …

- The master and the blurred clip are **never** modified.
- Approving the same clip again **replaces** its previous shots — going from
  3 shots to 2 does not leave a stray third file behind.
- Approve is refused while any conflict or out-of-range shot remains, so a
  broken trim cannot reach `trimmed/`.
- A confirmation banner shows the clip ID and how many files were written.

## 2.9 Pace

Clips are short and the decision is usually obvious. Do not study them. If you
cannot tell within two viewings whether a clip is usable, **Flag** it and move
on — that is what the flag is for.

Rough expectation: **~1500 clips for 50 videos**. Every clip needs a human
decision, because with a single detection signal none of them can be trusted
automatically.


---

# Part 3 — VLM server

A local Qwen3-VL-2B answering questions about video, for drafting QA labels.
Nothing here writes to `pipeline.db` — it only reads.

## 3.1 One-time setup

Weights are not in the repo (~1.9 GB). Fetch them into `models/`:

```bash
B=https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/resolve/main
curl -L -o models/Qwen3VL-2B-Instruct-Q4_K_M.gguf   $B/Qwen3VL-2B-Instruct-Q4_K_M.gguf
curl -L -o models/mmproj-Qwen3VL-2B-Instruct-F16.gguf $B/mmproj-Qwen3VL-2B-Instruct-F16.gguf
sha256sum -c models/SHA256SUMS      # must both say OK before you go further
```

A truncated download loads and then fails strangely later, so check the hashes.

## 3.2 Start and stop

```bash
docker compose -f docker/docker-compose.yml up -d      # ~60s to load
docker compose -f docker/docker-compose.yml logs -f    # watch it come up
docker compose -f docker/docker-compose.yml down       # stop, free the VRAM
```

It is up when `docker ps` shows `(healthy)`. Two lines in the log matter:

```
loaded multimodal model, '/models/mmproj-Qwen3VL-2B-Instruct-F16.gguf'
listening on http://0.0.0.0:8080
```

**Without the `mmproj` line the model is text-only** — it will answer your
questions confidently and never look at a single pixel.

`0.0.0.0` there is *inside* the container. From your machine it is reachable
only on `127.0.0.1:8080`, which is deliberate: llama.cpp has no password and
allows any origin. Do not publish the port to the LAN without putting
something in front of it.

## 3.3 Ask about a video

```bash
python -m vlm.scripts.ask <video> "<your question>"
```

```
$ python -m vlm.scripts.ask work/fy_MyGNqwfI/trimmed/fy_MyGNqwfI_065967_094167_t01.mp4       "Chuyện gì xảy ra trong video này?"

video  : fy_MyGNqwfI_065967_094167_t01.mp4  (10.0s)
frames : 4 at [2.0, 4.0, 6.0, 8.0]

Video ghi lại cảnh một chiếc xe máy đang di chuyển trên đường... xe máy bị va
chạm với xe tải.

(9455 ms, 1375 prompt tokens)
```

| Flag | What it does |
|---|---|
| `--frames 8` | more keyframes. Each costs ~344 tokens of a 4096 context, so **8 is the practical ceiling** |
| `--at 5.0 5.5 6.0` | exact seconds instead of sampling — use when you know where the incident is |
| `--middle` | cluster the frames around the middle, where `impact ± pad` puts the collision. Default spreads them across the whole file |
| `--json` | one JSON object, for piping into something else |
| `--timeout`, `--width`, `--temperature`, `--max-tokens` | as named |

**It sends frames, not video.** Motion between two frames is lost, so the model
*infers* a collision from stills rather than seeing it. Read its answers with
that in mind, especially for questions about order of events.

First question after startup takes ~50s; after that 3–10s.

## 3.4 Check the model is really looking

Run this before trusting a batch of answers, and any time the answers start
feeling generic:

```bash
python -m vlm.scripts.test_api
```

It asks one approved clip the same question three ways — real keyframes, flat
grey frames, and no image at all — and **fails if the real answer matches the
no-image answer**, because that means the vision encoder is not contributing.
Exit code 0 is the only pass.

```
[real ]   7256 ms   1384 tok  - Xe tải: Xanh bạc, có logo Hyundai...
[grey ]   8982 ms   1384 tok  Không có phương tiện nào được nhìn thấy trong hình ảnh.
[blind]    991 ms     32 tok  Các phương tiện thường có màu sắc như: trắng, xanh...
PASS: real != grey != blind
```

## 3.5 When something is wrong

| Symptom | What it means |
|---|---|
| `no VLM server at http://127.0.0.1:8080` | container is down — `docker compose ... up -d` |
| healthy, but no `loaded multimodal model` line | `--mmproj` did not load; the model is blind |
| `test_api` fails with *real == blind* | same thing, caught by behaviour instead of by log |
| CUDA OOM on load | lower `VLM_CTX` in `docker/.env` before anything else |
| answers ignore later frames | context is full — use fewer `--frames` |
| `UnicodeEncodeError` in your own script | the model replies in Vietnamese; add `sys.stdout.reconfigure(encoding="utf-8")` |

## 3.6 What you should not trust it for

The model **drafts** answers. It does not decide them. A draft answer is not
ground truth, and a reviewer who reads it before deciding will tend to agree
with it — which is exactly what destroys the value of two annotators working
independently. Decide first, then compare.

Measured on the 6 GB GTX 1660 Ti: 3.3 GB VRAM in use, 4 keyframes = 1378 of
4096 tokens, 3–10s per question once warm.
