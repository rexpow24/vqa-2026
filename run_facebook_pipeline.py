"""Direct Facebook downloader/queue worker; no detection or blur stages."""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

from vqa import db, facebook


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    db.init()
    log_dir = Path("logs")
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / "facebook-latest.log"
    log_path.write_text("", encoding="utf-8")
    latest = log_dir / "facebook-latest"
    latest.write_text(str(log_path.resolve()), encoding="utf-8")

    def log(message: str) -> None:
        line = f"{datetime.now():%H:%M:%S}  {message}"
        print(line, flush=True)
        with log_path.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")

    log("Facebook direct-ingest run start")
    count = facebook.run(log)
    log(f"Facebook run finished - {count} video(s) processed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
