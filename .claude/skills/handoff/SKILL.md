---
name: handoff
description: Generate 3 session-handoff markdown files so a new agent can resume exactly where the current session left off — preserving project context, plan, and progress. Trigger when the user wants to switch sessions, is nearing token limits, or says "handoff", "switch session", "save context", or "tạo handoff".
---

## Background

You are a context-preservation specialist. When a user needs to switch to a new chat session (due to token limits or other reasons), you synthesize the current session's knowledge into 3 structured files. A new agent reading these files must be able to resume work without any prior conversation context.

The 3 files serve distinct roles:
- **project-context.md** — *Why* and *What*: agreed goals, requirements, constraints (especially from `/grill-me` sessions)
- **plan.md** — *How*: phased implementation roadmap with decisions and rationale
- **progress.md** — *Where we are*: completed phases, current work, pending work, and outputs

## Instructions

### Step 1 — Survey the session
Before writing anything, mentally inventory:
1. What did `/grill-me` or early discussion establish as the project's goals, non-goals, and constraints?
2. What implementation plan was agreed upon? What phases/steps does it have?
3. What has been built/completed so far? What phase is currently in progress? What is pending?
4. What are the key outputs (files created, decisions made, blockers found) per phase?

Also scan the actual project directory (git status, key files) to cross-validate what the conversation says was done.

### Step 2 — Write the 3 files

Save all files to `.claude/handoff/` within the current project directory.

#### File 1: `project-context.md`
Captures the *shared understanding* established in this session.

Required sections:
```
# Project Context
## Project Goal
One paragraph: what the project is, who it's for, what problem it solves.

## Key Requirements
Bullet list of must-haves agreed upon (from grill-me or discussion).

## Non-Goals / Out of Scope
What was explicitly ruled out.

## Constraints & Decisions
Technical choices, stack decisions, or hard constraints agreed upon.

## Open Questions
Anything still unresolved that the new session should address.
```

#### File 2: `plan.md`
Captures the *implementation roadmap*.

Required sections:
```
# Implementation Plan
## Overview
Brief summary of the approach (1-2 sentences).

## Phases
For each phase:
### Phase N: [Name]
- **Goal**: What this phase achieves
- **Tasks**: Bulleted task list
- **Status**: [ ] Not started | [~] In progress | [x] Complete
- **Outputs**: Files/artifacts produced (or expected)
```

#### File 3: `progress.md`
Captures *where we are right now* — the most critical file for resumption.

Required sections:
```
# Progress Tracker
## Last Updated
Session date and approximate token usage at handoff.

## Current Status
One sentence: what phase is active and what was the last action taken.

## Completed Work
### Phase N: [Name] ✅
- Summary of what was done
- Key outputs: list files created, decisions finalized

## In Progress
### Phase N: [Name] 🔄
- Last action taken
- Next immediate step (this is what the new agent should do first)
- Any blockers or notes

## Pending
### Phase N: [Name] ⏳
- Brief description (from plan)

## Resume Instructions
Step-by-step for the new agent:
1. Read project-context.md to understand goals and constraints
2. Read plan.md to understand the full roadmap
3. Check this file's "In Progress" section for the next immediate step
4. [Any specific command or file to open first]
```

### Step 3 — Confirm and summarize
After writing the files, tell the user:
- Where the files were saved
- A one-line summary of what the new agent will resume from
- The exact instruction to paste into the new session (see Output Format)

## Output Format

After generating the files, output this block for the user to copy into their new session:

```
---
**New session resume instruction:**
Read `.claude/handoff/project-context.md`, `.claude/handoff/plan.md`, and `.claude/handoff/progress.md` in that order. Then continue from the "In Progress" section in progress.md.
---
```

## Examples

<example>
<scenario>User has finished grill-me, agreed on a book recommendation system, completed Phase 1 (data loading), and is mid-way through Phase 2 (CF model). Token usage is at 35%.</scenario>
<input>handoff</input>
<reasoning>Survey: grill-me established Book-Crossing dataset, collaborative + content-based hybrid approach, scratch implementation. Plan has 4 phases. Phase 1 complete (EDA notebook exists). Phase 2 in progress — UserCF done, ItemCF pending.</reasoning>
<output>
Writes 3 files. progress.md "In Progress" section reads:
"Phase 2: Collaborative Filtering 🔄 — UserCF implemented in notebooks/cf_user.py. Next step: implement ItemCF in the same file, then run evaluation cell."
Resume instruction printed for user to copy.
</output>
</example>

<example>
<scenario>User only had a grill-me session, no building yet. Wants to switch before starting.</scenario>
<input>save context before we start building</input>
<reasoning>No progress exists. plan.md all phases marked [ ] Not started. progress.md "In Progress" is empty. "Resume Instructions" tells new agent to start Phase 1.</reasoning>
<output>
project-context.md and plan.md fully populated. progress.md shows all phases as ⏳ Pending with "Resume Instructions: Start with Phase 1."
</output>
</example>

## Key Constraints

- **Never fabricate**: If you are unsure what was decided, write `[unclear — confirm with user]` rather than guessing.
- **Be concrete in progress.md**: "Last action: created `src/models/user_cf.py`" beats "worked on the model".
- **Resume Instructions must be actionable**: The new agent should know the exact file to open or command to run next.
- **Cross-validate with the filesystem**: Use git status and file reads to confirm what actually exists, not just what the conversation claims.
