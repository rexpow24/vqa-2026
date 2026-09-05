"""The VLM path must never write to the clip pipeline's database.

Static checks, deliberately: by the time a stray INSERT shows up in a run it has
already touched the file the runner and the reviewer are contending over. No
ffmpeg and no network here, so this runs with the rest of the suite.
"""

from __future__ import annotations

import re
from pathlib import Path

VLM = Path(__file__).resolve().parents[1] / "vlm"
SOURCES = sorted(VLM.rglob("*.py"))


def _code(path: Path) -> str:
    """File contents with docstrings and comments stripped."""
    text = path.read_text(encoding="utf-8")
    text = re.sub(r'"""[\s\S]*?"""', "", text)
    text = re.sub(r"^\s*#.*$", "", text, flags=re.MULTILINE)
    return text


def test_vlm_package_has_python_files_to_check():
    assert SOURCES, "no vlm/*.py found -- this test would pass vacuously"


def test_vlm_never_writes_to_the_pipeline_database():
    offenders = [
        f"{p.name}: {m.group(0)}"
        for p in SOURCES
        for m in re.finditer(r"\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b", _code(p))
    ]
    assert offenders == [], (
        "the VLM path may only read pipeline.db; found write SQL: " + str(offenders))


def test_the_database_is_opened_read_only():
    readers = [p for p in SOURCES if "sqlite3.connect" in _code(p)]
    assert readers, "nothing opens the database -- has source.py moved?"
    for p in readers:
        assert "mode=ro" in _code(p), f"{p.name} opens pipeline.db without mode=ro"


def test_vlm_does_not_reach_into_unreviewed_or_unblurred_folders():
    # clips/ holds unblurred masters and delivered/ holds 105 UNREVIEWED clips;
    # only trimmed/ is finished product (features/qa-pipeline/conflicts.md #5).
    offenders = [f"{p.name}: {m.group(0)}"
                 for p in SOURCES
                 for m in re.finditer(r"\b(master_path|delivered_path)\b", _code(p))]
    assert offenders == [], "the VLM path must only read trimmed/: " + str(offenders)


def test_the_dead_column_is_never_queried():
    # trimmed_path is NULL on every row of the real database and absent from a
    # fresh one; trim_segments is what review.materialize actually writes.
    offenders = [p.name for p in SOURCES if "trimmed_path" in _code(p)]
    assert offenders == [], f"trimmed_path is a dead column, queried in {offenders}"
