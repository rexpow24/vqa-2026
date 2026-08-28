# GUIDE — running the pipeline & reviewing clips

Two audiences in one file:

- **[Part 1 — Operator](#part-1--operator)**: whoever runs the pipeline.
- **[Part 2 — Reviewer](#part-2--reviewer)**: whoever decides what makes it into
  the dataset. **The trim rule is in [§2.4](#24-where-to-cut--the-rule).**

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
   same video pasted with different tracking parameters is caught.
2. **Sidebar** — set toggles, then **Save settings**. Settings lock during a run
   so a batch cannot end up half-processed under two different configs.
3. **Run tab** — **Start**. Progress and the log update inline.

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

Apply this to every approved clip unless one of the exceptions below applies.

### Exceptions

| Situation | What to do |
|---|---|
| The collision is in the last 5s of the clip | End at the end of the clip. Do not pad. |
| No collision — a near-miss or a violation | Start at the moment the event is unmistakable, still +5s. |
| The event genuinely continues past 5s (pile-up, vehicle rolls) | Extend the end until the motion settles. Do not cut mid-event. |
| Two separate incidents in one clip | Use **Multiple trim** — see §2.5. |

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

## 2.5 Multiple trim — two incidents in one clip

The detector sometimes merges two incidents into a single shot. Rather than
throwing the clip away or keeping only one:

1. Turn on **✂️ Multiple trim**.
2. Each row is one output clip. Fill in `Start` and `End`.
3. Click the last row to add another; the ✗ removes one.
4. **Approve** writes one file per row.

Apply the §2.4 rule to **each** incident independently.

Example — impacts at 4s and 31s in a 45s clip:

| Start | End |
|---|---|
| `00:00:04.0` | `00:00:09.0` |
| `00:00:31.0` | `00:00:36.0` |

→ two files: `..._t01.mp4` and `..._t02.mp4`.

## 2.6 When to Reject

Reject when the clip is not usable, regardless of how it was cut:

- No traffic event — just ordinary driving
- The incident is off-screen, or too small / too dark / too blurred to read
- The cut lands mid-incident and the impact itself is missing
- A title card, intro, outro or channel bumper survived the filter
- Duplicate of a clip you already approved from the same video

Reject deletes this clip's files from `trimmed/` and **nothing else**. The
blurred clip and the original download both survive, so a rejection can always be
revisited.

## 2.7 What happens when you press Approve

The segments you defined are cut out of the blurred clip you were watching and
written to `work/<video_id>/trimmed/` as `{clip_id}_t01.mp4`, `_t02.mp4`, …

- The master and the blurred clip are **never** modified.
- Approving the same clip again **replaces** its previous segments — going from
  3 rows to 2 does not leave a stray third file behind.
- A confirmation banner shows the clip ID and how many files were written.

## 2.8 Pace

Clips are short and the decision is usually obvious. Do not study them. If you
cannot tell within two viewings whether a clip is usable, **Flag** it and move
on — that is what the flag is for.

Rough expectation: **~1500 clips for 50 videos**. Every clip needs a human
decision, because with a single detection signal none of them can be trusted
automatically.
