"""The anonymize script must never touch the clip pipeline's DB/config/reviewer.

Static checks, deliberately, mirroring tests/test_vlm_isolation.py: this is a
standalone tool (features/face-plate-anonymization/requirements.md D1), not
a pipeline stage, so it has no business importing vqa.db, vqa.config, or
vqa.review. No ffmpeg and no network here, so this runs with the rest of the
fast suite.
"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = sorted([ROOT / "vqa" / "anonymize.py", ROOT / "scripts" / "anonymize.py"])


def _code(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    text = re.sub(r'"""[\s\S]*?"""', "", text)
    text = re.sub(r"^\s*#.*$", "", text, flags=re.MULTILINE)
    return text


def test_anonymize_files_exist():
    assert all(p.is_file() for p in SOURCES), SOURCES


def test_anonymize_never_imports_pipeline_db_config_or_review():
    offenders = [
        f"{p.name}: {m.group(0)}"
        for p in SOURCES
        for m in re.finditer(
            r"\b(?:import\s+vqa\.(?:db|config|review)"
            r"|from\s+vqa\.(?:db|config|review)\s+import"
            r"|from\s+vqa\s+import[^\n]*\b(?:db|config|review)\b)",
            _code(p),
        )
    ]
    assert offenders == [], (
        "vqa/anonymize.py and scripts/anonymize.py must stay decoupled from "
        "the pipeline DB/config/reviewer: " + str(offenders))


def test_anonymize_never_imports_torch():
    offenders = [p.name for p in SOURCES if re.search(r"\bimport\s+torch\b", _code(p))]
    assert offenders == [], f"CPU-only per D3, but torch is imported in {offenders}"
