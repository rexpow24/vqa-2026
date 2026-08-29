---
name: ship-feature
description: The four-step routine for building anything in this repo — read the code first, ask the user short grounded questions, audit the seam against what exists, then TDD it. Use whenever the user asks for a feature, reports a bug to fix, pastes a spec, or says "implement X" / "add X" / "fix X" / "làm feature". Not for one-line edits the user has fully specified.
---

# Ship a feature

## The routine

Four steps, in order. Do not skip step 1 to get to step 2 faster — every
question you ask before reading the code is a question you are asking because
you were too lazy to look.

```
1. Read       what already exists, in the actual files
2. Ask        short questions, each one grounded in something you just read
3. Audit      run feature-conflict-audit on the seam; report; ask if it changes the shape
4. Build      run the tdd skill; docs; full suite green before you say "done"
```

## 1. Read first

Before the first question, open the code the feature touches. In this repo that
usually means `app.py`, `vqa/db.py`, and whichever `vqa/stages/*.py` is
implicated, plus the Decision Log in `CLAUDE.md`.

You are reading to find out three things:

- **Does this already exist?** More often than you expect. Say so.
- **What is the real blocker?** The user describes a symptom. The cause is
  frequently somewhere else entirely. A request to "let me review while the
  pipeline runs" turned out to be a 2-second poll loop in a *different tab*.
- **What will this collide with?** Feeds step 3.

## 2. Ask short, grounded questions

Use `AskUserQuestion`. Rules:

- **Never ask what the code can tell you.** Ask what only the user knows: which
  trade-off they want, what they meant, what they have actually seen happen.
- **Quote your evidence in the preamble**, with file:line links. A question that
  arrives with the relevant three lines of code attached gets a decisive answer;
  a bare question gets "tùy bạn".
- **Recommended option first**, labelled `(khuyến nghị)`, with the reason for the
  recommendation *and* what it gives up.
- **Say when a premise is wrong.** If the user asks for something that already
  works, tell them plainly and ask what they actually saw, offering "chưa thấy,
  chỉ muốn chắc" as a real option. Two of the three items in one request were
  already implemented; pretending otherwise would have meant writing dead code.
- **When the user pushes back, restate your understanding before continuing.**
  "bạn nhầm feature không, hiểu feature gì nói tôi xem" means stop and say back,
  in one short paragraph per item, what you think is being asked. Then drop the
  questions that were built on the wrong reading.

## 3. Audit the seam

Run the `feature-conflict-audit` skill. Report as its table plus one paragraph.
Scale it to the change — do not produce a report longer than the diff.

**A conflict you cannot demonstrate is a hypothesis.** If a probe needs an
answer the code does not obviously give, write a throwaway script and measure.
Stub the boundary, count the calls:

```python
# "Does it re-download?" -- 20 lines beats an hour of reading.
monkeypatch.setattr(yt_dlp, "YoutubeDL", Tripwire)   # raises if called
```

If the audit changes what should be built, go back to step 2 with one more
question. If it does not, say "no conflicts" in a line and move on.

## 4. Build with TDD

Run the `tdd` skill. On top of its loop, this repo has earned four rules:

- **RED must actually fail, and fail for the stated reason.** A test that passes
  the moment you write it has told you nothing. `AppTest script run timed out
  after 30(s)` is a good RED — it names the bug.
- **Assert `not app.exception`.** Every AppTest that clicks anything. A test that
  only checks the database will happily pass while the page is showing a
  traceback: that is exactly how the `rm_pick` crash survived its first test.
- **Drive the real app, not a mock of it.** `streamlit.testing.v1.AppTest`
  against `app.py`, with `db.DB_PATH` monkeypatched to a tmp file. Every serious
  bug in this project was found by running the app, none by reading it.
- **Test through keys the user's fingers can reach.** Widget keys get versioned
  (`rm_pick_{rev}`, `s_{cid}_{rev}_{i}`) precisely so programmatic changes can
  reset them — so tests address widgets positionally (`app.multiselect[0]`)
  rather than pinning a key that is designed to change.

Then, before saying done:

- `python -m pytest tests -q` — the whole suite, not just your new file.
- Update the docs the repo keeps in step with code: `architecture.md` for the
  mechanism and *why*, `CLAUDE.md` Decision Log for a choice worth not
  relitigating, `TODO.md`'s "Bugs found by testing" table for anything the
  tests caught, `GUIDE.md` for anything the operator does differently now.
- State plainly what passed, what you skipped, and what is still broken.

## Destructive steps

Deleting rows, dropping files, overwriting outputs: **look at the target and
back it up first**, then show the counts before and after. The database runs in
WAL mode, so checkpoint before copying it or the backup is short:

```python
with db.tx() as c:
    c.execute("PRAGMA wal_checkpoint(TRUNCATE)")
shutil.copy2("pipeline.db", backup)
```

Report the real numbers afterwards. When they disagree with what you predicted
— 35 rows deleted where you said 33 — say so and explain the gap.

## Language

The user writes Vietnamese; reply in Vietnamese. Code, comments, commit
messages, docs and test names stay English, matching the repo.

## What this is not

Not a process to perform. If the user has already specified a one-line change,
make the change. The routine exists because features in this repo break at the
seam with what was already there — not because ceremony is good.

## Examples

<example>
<scenario>Request contains something that already works</scenario>
<input>"không có cơ chế nếu có video duplicate mặc định bỏ qua nó (tránh tải
lại mất thời gian)"</input>
<reasoning>Step 1 found dedup at three layers already. Step 2 asked which
situation they had actually observed; the answer was "kiểm tra lại pipeline xem
có thực sự tải lại không" — so the deliverable was a measurement, not a
feature.</reasoning>
<output>A 4-row table of measured outcomes (cached / re-downloads, by state of
`work/`), the conclusion that no new code was needed, and instead: regression
tests pinning the behaviour, plus naming each duplicate and its status in the UI
so the user can see the skip happening.</output>
</example>

<example>
<scenario>The symptom is in a different place from the cause</scenario>
<input>"khi status là REVIEW_READY thì cho reviewer review luôn thay vì phải đợi
tất cả video trong hàng đợi xong"</input>
<reasoning>Step 1: clips are inserted one at a time during encoding and the
Review tab filters on `decision`, never on `videos.status` — so the data was
already there. The blocker was `time.sleep(2); st.rerun()` in the Run tab, which
reran every tab's body and re-created `st.video` every two seconds.</reasoning>
<output>Told the user the feature they asked for already existed and named the
real blocker with a file:line link, then fixed that instead —
`st.fragment(run_every=2)`, plus the `st.rerun(scope="app")` needed because
`busy` would otherwise never be recomputed.</output>
</example>

<example>
<scenario>Your own new code repeats a bug the repo already had</scenario>
<input>Resetting the removal picker with `st.session_state["rm_pick"] = []`</input>
<reasoning>Step 4's "assert not app.exception" caught
`StreamlitAPIException: cannot be modified after the widget with key rm_pick is
instantiated` — the same widget-ownership trap the trim rows hit. The first
version of the test asserted only on the database and passed while the page was
on fire.</reasoning>
<output>Strengthened the test first, then fixed with the established pattern:
version the key so a new widget is rendered. Logged it in `TODO.md` next to the
original occurrence.</output>
</example>
