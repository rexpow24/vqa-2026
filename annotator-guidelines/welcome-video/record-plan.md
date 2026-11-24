# Welcome video - recording plan and run notes

Status: recorded and assembled on 2026-11-24.
The owner approved the narration and delegated clip-specific choices to the operator.
The current recording uses `render_welcome.py`, `record_welcome.py`, and `assemble_welcome.py` in this folder, with a disposable account created by `frontend/scripts/prepare-welcome-demo.mjs`.
The choices are recorded in `shotlist.json`; C is K09 with the closest-approach mark at 7.75 seconds, and Attr is B.
The readable channel logos are blurred in the local clip served to Playwright.
The owner waived filename blurring and the cut after `Hoàn thành video`; the following K18 video appears on screen.

The notes below describe the completed local recording.

Inputs: `shotlist.json` (scenes, narration, steps, selectors), `script.vi.md` (the same, for reading).
Output: `annotator-guidelines/welcome-video/output/welcome.mp4` (the folder `output/` is gitignored here).

## 1. Pipeline

The narration drives the timing, so audio is made first and the browser is paced by it.

1. **Audio.** Synthesise each scene's narration with VieNeu-TTS, voice "Hải Đăng", exactly as `annotator-guidelines/tham-khao-E/video-training/render_training.py` does:
   `Vieneu(mode="v3turbo", device="cpu")`, one cached WAV per sentence (key = sha1 of `voice|text`), sentences joined with `GAP = 0.55 s`, `LEAD = 0.5 s` before and `TAIL = 1.4 s` after.
   Write `output/audio/<scene>.wav` and `output/audio/<scene>.timing.json` (start and end of every sentence).
   `render_welcome.py` contains the standalone audio implementation.
   Run with the workspace venv `.venv-c-video` (has `vieneu==3.8.5`, `numpy`, `soundfile`, `playwright==1.55.0`).
2. **Screen.** The Playwright (Python, Chrome) script `record_welcome.py` reads `shotlist.json` and each scene's timing file and drives the local app.
   Each step has `at_sentence`; the script waits until that sentence's start time (relative to the scene start) before acting, and the scene lasts at least its audio length.
   When actions take longer than the audio, the scene runs longer and the gap is silent.
   It logs each scene's wall-clock offset and captures a screenshot of the actual page at its end.
3. **Takes.** One browser context per take, `record_video_dir=output/raw/`, `record_video_size` equal to the viewport.
   Take 1: S01-S04. Take 2: after the trainings are recorded, S05-S13 through the next video opening. Take 3: S14.
   A take boundary is also where a retake restarts, so a mistake in S10 does not force S01 again.
4. **Assembly (ffmpeg).** `assemble_welcome.py` cuts each take into scenes using the calibrated WebM timestamps, converts to H.264 (`libx264 -crf 20 -pix_fmt yuv420p -r 30`), adds each scene's WAV, and concatenates the scenes with `-movflags +faststart`.
   Result: `output/welcome.mp4`; also write `output/timing/master.json` with scene starts, as the E pipeline does.

### Viewport and quality

- Viewport **1600x900**, `device_scale_factor=1`, upscaled to 1920x1080 in assembly.
  At 1600 px the page is above the `xl` breakpoint, so the layout is the real desktop one (video column `60vh*16/9`, cards beside it), and 12 px text stays readable after upscaling.
  1920x1080 directly also works; it makes the cards' small text (`text-xs`) smaller in the final video.
- Playwright's own recorder writes VP8 WebM at a modest fixed bitrate; small text can smear when the page scrolls.
  The final recording was checked in the assembled 1920x1080 file.
- Playwright draws no mouse pointer.
  The recorder injects a small pointer dot and moves it to each target (about 300 ms) before every click, and draws highlights as an absolutely positioned outline box around the target's bounding box (`highlight` steps), removed after 2 s or at the next highlight.
  These overlays are injected into the page with `page.evaluate`; no app file changes.
- Prefer `locator.click()` over coordinates; every target in `shotlist.json` is a role/name, a `data-*` attribute, or a `[data-field]` label scoped to its card, because the same chip label (for example "có", "không rõ") appears in several cards.

## 2. Local environment before recording

The local stack was running during the recording.

1. Local Supabase running, all migrations applied (including `training_completions`, `reference_views`, E.v6 without "khác", O.v2 grouped signs).
2. `node frontend/scripts/prepare-welcome-demo.mjs` creates a disposable local account and two assigned demo rows while preserving existing accounts and answers.
   For a full retake, keep the old fixture file as evidence and generate a new one.
3. Frontend on port 3006 in hosted mode: `PLATFORM_MODE=hosted`, so `/annotate` shows the assigned list instead of the legacy page.
4. The two disposable fixture video streams use locally downloaded source clips during recording; reference and training clips load through the running app.
5. The `Hướng dẫn` tab (`/huong-dan`, `features/welcome-gate`) exists in the local app and is shown in S14.

### Welcome gate

An annotator without `WELCOME-v1` is redirected from `/annotate` to `/huong-dan`, and every save answers 403 until it is recorded.
The welcome video cannot be watched before it exists, so before take 1 the recorder logs in once in a separate, unrecorded context and calls `POST /api/trainings/WELCOME-v1/complete`.
The recorded login in S01 then lands on `/annotate` as the narration says.
During the recording, the `welcome` Drive id was empty, so S14 shows the `/huong-dan` page without playing its welcome player.
The completed video was later uploaded and its Drive id is now configured in `frontend/scripts/build-c-references.mjs`.

### Training gates

The demo shows the gates on purpose (S04): a fresh annotator sees the training video in place of the E and C forms.
After S04 the script records both completions as the annotator through the real API, off camera:
`POST /api/trainings/E-v1/complete` and `POST /api/trainings/C-v1/complete` with the logged-in context (`page.request.post`), then reloads.
No database write by hand is needed, and admins must not be used for the demo (admins are never gated, so S04 would not exist).

### Demo data

- Main video: the near-miss seed clip `review-bqH0eeeTBcE_114833_159400_t01.mp4` (8 s): dashcam car (A) and a motorbike (B) coming the other way.
- Every concrete choice shown (E cells, C event type, K, action, subject, impact mark, S cells, Attr party) is recorded in `demo_values_to_confirm` after checking the source frames.
  The chosen C conflict is K09; S09 demonstrates the K08/K09 comparison and S10 uses the K09 action.
- The disposable list shows the near-miss demo and a K18 follow-up row.

## 3. Pacing rules

- One action per sentence at most, except S06 and S13 where several chips are clicked; keep 250-400 ms between clicks there.
- After a click that saves, wait for the visible confirmation ("✓ Đã lưu", "Câu đã lưu (server ghép)") before the next step; never a fixed sleep for a server round trip.
- Video seeks set `currentTime` on the main video and pause it; keyboard steps (`ArrowRight`) are only sent after clicking a blank area, because the page ignores shortcuts while a button has focus.
- Reference clips (S07, S09) autoplay muted; close them before the next scene so the layout returns to one video.

## 4. Privacy

- Only anonymized footage is used; the near-miss source is copied locally and its readable channel logos are blurred before Playwright serves it to the page.
- `finished/` is not perfect.
  Before recording, extract every frame of the parts that will be on screen (near-miss clip 0-2 s and 5.5-8 s; the first frame of each training video in S04; the first 3 s of the E training video and of the K08-K09 pair clip) at full resolution and look at each: no readable plate, face, phone number or shop text.
  The near-miss channel logos are blurred in `output/source/near-miss-masked.mp4`.
- The collision seed clip does not appear; the disposable follow-up row is the K18 clip.
  The owner requested that the next video remain visible after completion.
- The owner waived filename blurring.
- The login scene types the password into a masked field and never presses "Hiện".
  The password is read from ignored `output/fixture.json` at run time, never written into the shotlist or the logs.
- Overlays (pointer, highlight boxes, title cards) are drawn by the recorder in the page; no app code is changed for the recording.

## 5. Checks before handing the video over

- Duration: 4 min 56 s in the assembled file.
- Every narration sentence matches what is on screen at that moment (watch once with the script open).
- Every UI text the narration names exists on screen: "Đặt mốc va chạm", "Lưu các bên", "Xem lại video hướng dẫn E", "So sánh", "Đang phân vân với", "Hoàn thành video", "Hướng dẫn".
- Privacy pass over the final file: one frame per second, plus every frame of the near-miss clip that was played.
- Audio loudness consistent across scenes (same TTS settings as the C and E series, so no extra normalisation was needed there).
