# Project feedback rules (VQA-VN-Traffic-2026)

Standing decisions from the project owner, carried over from the owner's Claude memory so every teammate's session follows them.

## Guideline edits stay minimal

When asked to change the team's labeling guidelines (`annotator-guidelines/huong-dan/*.md`, `docs/guidelines/*.md`), apply exactly that change on top of the team's text and keep their categories and wording.
Do not add inferred rules, restructure, or merge in your own proposals.
Suggestions go in the chat reply as proposals; the file reflects only what was decided.
Why: on 2026-11-15 the owner rejected a reworked S guideline with invented tie-break rules ("hạn chế suy luận nhiều").

## Methods need a cited basis

Every method, rule or threshold proposed (guideline rules, codebook design, agreement metrics, gates) must rest on a peer-reviewed paper, an official agency report (e.g. NHTSA), a published standard or catalog, or data measured on this project's own dataset.
Cite the source with each proposal and say whether the original or only a secondary source was read.
If no basis is found, say so and leave the decision to the owner.
Exception (2026-11-14): guidelines for E, N, V, O, R, Attr, Prev may be based on the project's original Human Refinement guideline instead; group C and measurement methods still need a basis.

## LLM API runs need prompt review

Any step that calls an LLM through an API (mapping, draft splitting, judges) is reviewed by the owner before it runs at scale: show the full prompt, one real input from the data, and the expected output, then wait for approval.
In prompts and LLM output schemas for this dataset, write labels and JSON keys in Vietnamese with diacritics; stable English IDs live only in code and the database.

## Streamlit is frozen legacy

`app.py` takes no new features; all new UI work goes to the Next.js frontend (`frontend/`) and `sidecar/`.
