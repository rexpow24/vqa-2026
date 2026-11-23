# Claude Code setup for this repo

Shared so every teammate's Claude Code session works like the owner's.

| Path | What it is |
| --- | --- |
| `rules/00-working-preferences.md` | Working preferences (priority order, investigate before guessing, verify before claiming success) |
| `rules/00-core.md` ... `rules/50-communication.md` | Detailed rules referenced by the preferences file |
| `rules/60-project-feedback.md` | Project decisions: minimal guideline edits, cited basis for rules, LLM prompt review, Streamlit frozen |
| `skills/ship-feature` + `skills/00_grill-me` ... `skills/08_ship-review`, `clarification`, `project-docs` | The feature pipeline required by `CLAUDE.md` |
| `skills/handoff` | Writes `.claude/handoff/` for a session switch |
| `skills/drive-upload` | Project skill for uploading clips to Drive |
| `agents/` | `code-reviewer`, `unit-test-writer` subagents |
| `settings.json` | `permissions.defaultMode: auto`, spinner tips off |
| `handoff/` | Current handoff: read it before touching codebooks or deploying |

## Notes

- **Skill names.** On the owner's machine these skills come from a plugin named `quyen`, so `CLAUDE.md` and the skills call them `quyen:ship-feature`, `/quyen:02_to-spec`, and so on.
  Here they are project skills without the prefix: `ship-feature`, `02_to-spec`.
  When a skill says `quyen:<name>`, use `<name>`.
- **Rules load automatically.** Claude Code reads every `.md` file in `.claude/rules/` as project instructions.
- **Auto mode.** `settings.json` turns on auto permission mode for this project.
  If you hold production Supabase or Vercel credentials on your machine, consider overriding it in your own `.claude/settings.local.json` (not committed), for example `{"permissions": {"defaultMode": "default"}}`.
- **Not shared on purpose.** The owner's hooks (an auto-commit after every edit, local desktop notifications, Orca agent hooks) and model choice are machine- or account-specific and are left out.
  Personal memory and credentials are never copied here.
