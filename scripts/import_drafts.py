"""Load drafted QA from JSONL into `annotations.db`.

    python -m scripts.import_drafts vlm/data/drafts/draft_20261003_120000.jsonl
    python -m scripts.import_drafts --all

Lives outside `vlm/` on purpose. That package may not contain write SQL at all
(`tests/test_vlm_isolation.py` greps for it), so the drafting run writes JSONL
and this reads it back. The split also makes the run resumable: the JSONL is the
checkpoint, and importing twice adds nothing the second time.

Only files under `vlm/data/drafts/` are accepted. The sibling `vlm/data/output/`
holds the 2026-09-05 vision-check probes, whose 33 rows carry clip_id, shot and
source_sha256 but no `qgroup` -- enough shape to be imported as drafts by
accident, which is why `import_drafts` rejects a row without a valid group.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from vqa import annotations

DRAFT_DIR = Path(__file__).resolve().parents[1] / "vlm" / "data" / "drafts"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="*", type=Path, help="JSONL files to import")
    ap.add_argument("--all", action="store_true",
                    help=f"import every draft_*.jsonl in {DRAFT_DIR.name}/")
    args = ap.parse_args(argv)

    files = sorted(DRAFT_DIR.glob("draft_*.jsonl")) if args.all else args.files
    if not files:
        print("Không có file nào để nạp. Dùng --all hoặc nêu đường dẫn.")
        return 1

    annotations.init()
    total_added = total_skipped = total_err = 0

    for f in files:
        if not f.exists():
            print(f"FAIL: không có file {f}")
            return 1
        rows = annotations.load_jsonl(f)
        ok = [r for r in rows if r.get("status") == "success"]
        errs = len(rows) - len(ok)
        try:
            added, skipped = annotations.import_drafts(ok)
        except (ValueError, KeyError) as e:
            print(f"FAIL: {f.name}: {e}")
            return 1
        total_added += added
        total_skipped += skipped
        total_err += errs
        print(f"{f.name}: thêm {added}, đã có {skipped}, bỏ qua {errs} dòng lỗi")

    print(f"\nTổng: thêm {total_added}, đã có sẵn {total_skipped}, "
          f"dòng lỗi {total_err}")
    print(f"-> {annotations.DB_PATH}")

    rows = annotations.verdict_summary()
    print(f"\n{len(rows)} nhóm câu hỏi, "
          f"{sum(r['drafts'] for r in rows)} bản nháp trong DB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
