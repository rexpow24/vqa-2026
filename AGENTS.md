# Repository instructions

- After completing a feature, commit the changes and push the feature branch.
- For every task, capture and share screenshot evidence of the actual result.
- For UI work, screenshot the running app after the change.
- For code-only work, screenshot relevant verification output or another genuine artifact.
- Never fabricate evidence.
- If screenshot capture is unavailable, state why and identify the blocker.

## Lessons from codebook-rules-update

- Keep the latest explicit annotation decision. C retains `Đối tượng` unless the user changes that decision.
- A visible form or screenshot does not prove persistence. Verify expected rows in local Supabase before calling an end-to-end flow complete, and report any unverified group as partial.
- Do not change passwords or roles on existing local accounts to run tests. Use a dedicated disposable fixture account and preserve its initial state.
- Run focused tests with the dependencies they require. Report collection failures separately; do not describe a partial suite as fully passing.
- Prior local E2E incident: `trial-lead@example.com` had its local password reset and role toggled; the role was restored, but the password remains changed. Do not repeat this; disclose existing local account changes and use a disposable account.
