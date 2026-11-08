# Overview

## Desire (user, 2026-11-07, translated)

When two annotators labelled the same video and changed the same question differently, the team has to agree on one answer.
The user asked how that answer gets updated, and proposed: a button that downloads answers edited by two or more people, download, upload the final answer, and default the annotators' button to "agree".

## What was agreed in discussion

- Never overwrite the annotators' own rows; `AGREE` means "agrees with Gemini", so forcing it would falsify the verdict, the derived difficulty and the agreement data.
- A separate final answer per question, with a source: `single` (one annotator), `consensus` (two annotators, same), `adjudicated` (two annotators disagreed, then decided together).
- A question needs adjudication when the two annotators disagree, not when both edited: verdicts differ, or both edited with different text. The user's "edited by 2+" filter would miss AGREE vs DISAGREE.
- Event label disagreement goes through the same file.
- Agreement (Cohen's kappa) is measured once, on the independent labels, before adjudication; difficulty keeps reading the raw verdicts; the dataset reads the final answers.

## User answers (2026-11-07)

1. Who decides: the two annotators who labelled it, together, using an LLM suggestion and the guidelines.
2. Annotators can see the final answer: yes.
3. A decided question is locked for annotators: yes.

## Flow

Diagram: https://claude.ai/artifact/4XakU1WW6UGUqe6CktpVbw
