# Render plan - video huấn luyện nhóm E (phase 2)

Phase 2 starts only after the owner has approved the clips, the A/B labels in `boxes.json` and the narration in `narration.vi.draft.json` (see the open questions in `review.md`).
Nothing in this plan has been run yet.

## Inputs

- `narration.vi.draft.json`: 17 scenes `S00`-`S16`; each has a `narration` text and an ordered `visual` list (`card`, `play`, `freeze`).
- `boxes.json`: clip table (source path relative to the folder that holds `finished/`), and the stills with their boxes, captions, corner tags and `privacy_masks`.
- Footage: the anonymized copies under `D:\Projects\Assignment\VQA-VN-Traffic-2026\finished\`, passed as `--finished-dir` (they are not in the repo).
  All seven clips are 1920x1080, 30 fps, H.264.
- `make_stills.py`: already renders the annotated stills; phase 2 adds a `--final` flag that drops the red "BẢN NHÁP" mark once the owner approves.

## Step 1 - narration audio (VieNeu-TTS, same voice as group C)

Reuse the audio half of `annotator-guidelines/tham-khao-C/video-training/render_training.py` unchanged in behaviour:

- `Vieneu(mode="v3turbo", device="cpu")`, `VOICE = "Hải Đăng"`, `vieneu==3.8.5` from the C `requirements.txt`, Python 3.12 venv `.venv-c-video`.
- Split each scene's narration into sentences (`(?<=[.!?])\s+`), synthesise each sentence, cache by `sha1("Hải Đăng|<text>")[:16]`, join with `LEAD, GAP, TAIL = 0.5, 0.55, 1.4` seconds of silence.
- Write `output/audio/<scene>.wav` and `<scene>.timing.json` (per-sentence start/end, total duration); skip a scene whose cached timing already matches its sentences.

The simplest way is to import `sentences`, `synth` and `build_audio` from the C script (or copy those three functions), not to fork the whole renderer: the E video needs no Chrome/Playwright step.
Measured on the C series: VieNeu speaks about 4.2 syllables per second, so the 17 scenes come to roughly 3.3-3.6 minutes with the silences.
RAM: loading VieNeu on CPU is the heavy part; run it when the machine has headroom, one process, nothing else heavy open.

## Step 2 - visuals per scene (ffmpeg only)

Scene duration `D` = the scene's audio duration.
Visual parts are laid end to end:

- `card`: `color=c=0x111111:s=1920x1080:r=30` plus one `drawtext` per line (bold Arial, `textfile=` so diacritics need no escaping, same trick as `make_stills.py`).
  A scene made only of a card shows it for all of `D`.
- `play`: `-ss start -to end -i finished/<clip>`, `scale=1920:1080,setsar=1,fps=30`, then `setpts=PTS/speed` for the 0.5x segments.
  Apply that still's `privacy_masks` on every frame of the segment (`split` -> `crop` -> `boxblur=luma_radius=15:luma_power=3:chroma_radius=7` -> `overlay`).
  Clip C1's `0.0-1.6 s` segment uses `clips.C1.segment_masks` instead (plate and rider face keyframes, linearly interpolated per frame with `enable='between(t,..)'` or a per-frame mask image): the painted plate and the rider's side face are not blurred in `finished/`.
  Footage audio is dropped (`-an`).
- `freeze`: loop the approved still `stills/<id>.jpg` (`-loop 1 -framerate 30 -t <hold>`).
  Hold time = `(D - total play time) / number of freezes`, at least 2.0 s each.
  If the visuals need longer than `D`, pad the audio with silence (`apad`) instead of cutting footage.

Concatenate the parts with the `concat` filter, mux with the scene WAV, encode exactly like the C series so the master can be joined with `-c copy`:
`-c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -r 30 -c:a aac -b:a 160k -ar 48000 -movflags +faststart`, written to `output/videos/<scene>.mp4` via a `.tmp.mp4` rename.

## Step 3 - master

Write `output/playlist.txt` in scene order and join with the concat demuxer (`-f concat -safe 0 ... -c copy -movflags +faststart`).

Expected output: `annotator-guidelines/tham-khao-E/video-training/output/videos/E-training-full.mp4` (plus `S00.mp4` ... `S16.mp4`).

## Step 4 - verification before handing it out

- `ffprobe` every scene: one video and one audio stream, durations within 0.1 s of the timing file.
- Extract one frame per second of `S02` (C1 `0.0-1.6 s`) and look at each: neither the painted plate `34C-...` nor the rider's face may be recognizable in any frame.
- Look at one frame per freeze: boxes on the right vehicles, labels not overlapping, no "BẢN NHÁP" mark in the final render.
- Listen to the whole master once at normal speed: pronunciation of "ba gác", "côn tay", "xe ghi hình".

## Repo hygiene

- Add a `.gitignore` like the C folder's before rendering; decide with the owner whether rendered MP4s and the stills (frames of real footage) are committed.
- Keep `--finished-dir` an argument; never copy `finished/` clips into the repo.
