# Welcome gate deployment

Deployed to [VQA VN Traffic](https://vqa-vn-traffic-labeling.vercel.app) on 2026-11-24.
The Vercel production deployment is `dpl_C8gJp8ECwrgx4S1FD2XE7mwsri9u` from commit `b23f839`.
Supabase production migration `20261124160000_training_welcome_stats.sql` was applied before the frontend deployment.

## Production verification

- The public login page and welcome poster returned 200.
- The welcome stream denied an anonymous request with 401.
- A disposable annotator was redirected to `/huong-dan` after login.
- The welcome player loaded its 296.095-second video with HTTP 206 and no media error.
- Seeking near the end and playing to `ended` showed `Đã xem` and `Bắt đầu gán nhãn`.
- The `WELCOME-v1` completion row was verified in production Supabase, and the button opened `/annotate`.
- The disposable production annotator was deleted after verification.

The [initial guide screenshot](https://drive.google.com/file/d/1hgH-rWVy3i5rXUM85oAfUxWn0axMqLmb/view) and [completed guide screenshot](https://drive.google.com/file/d/1PeHnUoFmUCoI-bhY3VdSeZ2hEVSS7fzA/view) were captured from production and uploaded to the same Drive folder as the welcome video.
Playback for the full 4 minutes 56 seconds in real time was not checked.
