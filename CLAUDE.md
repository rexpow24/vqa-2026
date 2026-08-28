# CLAUDE.md — VQA-VN-Traffic-2026

Vietnamese traffic video dataset for VQA. Current phase: **YouTube compilations → clean short
clips**. VQA annotation is out of scope.

Design docs: [`architecture.md`](./architecture.md) · [`TODO.md`](./TODO.md)

---

## CONSTITUTION — Preprocessing Pipeline

**This section is the source of truth for decision-making. If a question isn't explicitly
covered, default to "ship it" and move on.**

### Principles

1. **This is a preprocessing pipeline, NOT an annotation platform.**
   - Goal: produce candidate clips for later review
   - Perfection is not required at this stage
   - Rough cuts are acceptable — human review exists to clean up

2. **Ship it, don't polish it.**
   - If it works 80% of the time on 80% of videos, it's good enough
   - Edge cases are handled by the review tool, not by making the detector smarter
   - Default parameters are fine — don't tune thresholds unless proven necessary

3. **Do not overthink things that don't matter for this phase:**
   - Exact number of videos to crawl → just grab enough, ~50 is fine
   - Boundary P/R/F1 benchmarks → not needed until evaluation phase
   - Optimal parameters → use PySceneDetect defaults + OCR fusion
   - Review UI polish → ugly but functional is the goal
   - Multi-machine coordination → not needed (single user, single machine)

4. **Keep the scope tight.**
   - If a feature isn't required to get clips out, defer it
   - If it adds >1 day of work, question whether you really need it
   - The review tool is where quality happens, not the pipeline

5. **Progress over perfection.**
   - A working pipeline that produces clips is better than a perfect pipeline that never ships
   - You can always iterate after seeing real outputs

### Decision Log

| Decision | Choice |
|---|---|
| Tech stack | **Streamlit + Python** (no FastAPI, no JS framework, no separate web server) |
| Review mode | Simple keyboard triage — `A`=approve, `R`=reject, `F`=flag |
| Segmentation | OCR counter + PySceneDetect fusion, **defaults** |
| Overlay removal | Blur + desaturate + darken (toggleable) |
| Headless mode | Yes, clips marked `UNREVIEWED` |
| Config | Streamlit sidebar widgets (no separate config file editing) |
| Output | Local disk only (no Drive upload) |
| Crawl target | ~50 videos, ~1200–1500 clips expected |

---

## Working agreements

- **One app, one process.** `streamlit run app.py` is the entire interface.
- **Don't add a layer.** No API tier, no task broker, no ORM, no build step.
- **Don't propose benchmarks, tuning campaigns, or coordination mechanisms** for this phase —
  they are explicitly out of scope per Principle 3.
- When a design question comes up that the constitution doesn't answer: pick the option that
  ships soonest, note the choice in a comment, and keep going.
