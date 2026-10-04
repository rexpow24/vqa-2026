---
name: drive-upload
description: Upload clips from finished/ to the project's Google Drive folder and produce videos.csv. Use when setting up Drive credentials, authorising the uploader, uploading clips in bulk, or debugging a Drive auth/upload failure in this repo.
---

# Google Drive upload for this project

Two scripts in `frontend/scripts/`:

- `drive-auth.mjs` — authorise once, writes `frontend/.drive-token.json` (gitignored).
- `drive-upload.mjs` — upload every `finished/*.mp4`, append to `videos.csv`.

```bash
cd frontend
node scripts/drive-auth.mjs                 # one time
node scripts/drive-upload.mjs --limit 2     # smoke test
node scripts/drive-upload.mjs               # the rest
```

`videos.csv` lands at the repo root as `filename,drive_file_id,duration_s` and
is the input to the bulk metadata import.

## One-time credential setup

In [Google Cloud Console](https://console.cloud.google.com/):

1. Create or pick a project.
2. **APIs & Services → Library** → enable **Google Drive API**. It must be the
   *same* project the OAuth client lives in — the client id's leading digits
   are that project's number, and mismatching the two produces
   `has not been used in project NNN before or it is disabled`.
3. **OAuth consent screen** → User type **External** → add the Drive owner's
   Gmail under **Test users**. Testing mode needs no Google review.
4. **Credentials → Create credentials → OAuth client ID → Desktop app**.
5. Put these in `frontend/.env.local`:

```
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_DRIVE_FOLDER_ID=<folder id, or paste the whole folder URL>
```

The consent screen shows the Cloud project's **App name**, which may be an
unrelated older project — cosmetic, not an error. Authorise with the account
that **owns the Drive folder**. Expect "Google hasn't verified this app" →
Advanced → Go to … (unsafe); normal for an app in Testing mode.

## Four traps, each one already cost an hour

**A service account cannot be used.** It has no Drive storage quota of its
own, so creating a file in a personal My Drive folder fails with
`storageQuotaExceeded` — the service account would have to own the bytes and
cannot. Service accounts only work against a Shared Drive, which needs Google
Workspace. OAuth as the folder's owner sidesteps this; the files end up owned
by that person exactly as if they had dragged them in.

**Never open the consent URL through `cmd`.** `cmd /c start "" <url>` cuts the
address at the first `&`, because `cmd` reads `&` as a command separator. The
browser then receives only `...?access_type=offline` and Google replies
`Error 400: invalid_request — Required parameter is missing: response_type`,
which looks like a permissions problem and is not. Use
`rundll32 url.dll,FileProtocolHandler <url>`, which takes the URL as one
unparsed argument. `drive-auth.mjs` also prints the URL for manual pasting —
the whole line, every `&` intact.

**`drive.file` cannot read a folder it did not create, but can write into it.**
`files.get` on a pre-existing folder returns 404 *even for the folder's owner*;
that is the scope behaving correctly, not a wrong id or a wrong account.
`files.create` with that same folder as `parents` succeeds and reports the
right parent. So never gate an upload behind a `files.get` preflight — doing
so blocks a working upload. `drive-upload.mjs` treats the lookup as advisory:
it names the folder when it can, says it cannot otherwise, and continues.
This is why the narrow scope is kept rather than widening to full `drive`
access over the user's entire Drive.

**`GOOGLE_DRIVE_FOLDER_ID` is an id, not a URL** — but people copy the link,
so `drive-upload.mjs` accepts either and extracts the part after `/folders/`.

## Resume behaviour

`videos.csv` is both the output and the ledger: each row is appended the
moment its upload returns, and a filename already in the file is skipped. An
interrupted run continues instead of duplicating, and because the script keeps
its own record it never needs to list the folder — which is what makes the
narrow `drive.file` scope sufficient.

To re-upload a file, delete its row from `videos.csv` first.

## Checking before a large run

`drive-upload.mjs` prints the destination and the file count before writing
anything. A wrong folder id is cheap to catch there; `--limit 2` then lets you
confirm in Drive before committing to the whole batch.
