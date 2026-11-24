# Impact keyframe and R aftermath suggestion - requirements

Decided by the owner on 2026-11-24.

## 1. One impact mark instead of two free marks

Groups that need evidence keyframes (`needsKeyframes()`, today C and Attr) no longer take two free marks.
The annotator presses one button, "Đặt mốc va chạm", at the collision frame; on a near miss, at the moment the two parties are closest.
The app sets Start = mark - 2 s and End = mark + 2 s, clamped to [0, duration], rounded to 3 decimals, with start < end.
Storage is unchanged: `human_keyframes_s` stays [start, end], so the save route, the database triggers, the exports and old rows need no change.
A saved pair is shown as stored; its mark is shown when the pair is a 4 s window, or a window clamped at one end of the clip.
A legacy pair set by hand stays valid as stored, and setting a mark replaces it.
The ±2 s window is a project convention, chosen from the Start-End spans annotators set on videos #1-#40 (median 3.6 s).

## 2. R `has_aftermath` suggested from the C End mark

The app suggests R cell `has_aftermath` from the caller's own C keyframes: "có" when (video duration - C End) >= 2 s, else "không".
The annotator can change it, and the field shows the badge "gợi ý từ mốc C" while it holds the suggestion.
The suggestion is made only while the R answer is not saved, and never when C has no keyframes.
The 2 s threshold is a provisional project convention, from the audit of videos #1-#40 (majority match on 36 of 37 videos).

## 3. Guidelines

`docs/guidelines/C-nguyen-nhan.md` replaces the SHRP 2 Event End definition of Mốc End with the impact-mark rule; the other SHRP 2 citations stay.
`docs/guidelines/R-ung-xu.md` replaces the cell 0 rule with the End + 2 s rule and the note that the system suggests cell 0.
The annotator copies under `annotator-guidelines/huong-dan/` (.md and .html) get the same change.
Codebook JSON files are frozen and are not changed.
