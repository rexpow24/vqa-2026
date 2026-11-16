"""The frontend reads its own copy of the frozen codebooks (Vercel uploads only frontend/), and the
database seeds from the same files: the copies must be byte-identical to codebook/, and the files
must carry the 2026-11-16 decisions the database rules read (features/slot-data-model, T1)."""

import hashlib
import json
import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "codebook"
COPY = ROOT / "frontend" / "src" / "lib" / "codebook"
GROUPS = ["S", "E", "C", "V", "O", "R", "Prev"]
# Every frozen codebook file, v1 and later (features/codebook-v2 added S.v2, C.v2, V.v2, Attr.v1).
NAMES = [f"{g}.v1.json" for g in GROUPS] + ["S.v2.json", "C.v2.json", "V.v2.json", "Attr.v1.json", "E.v2.json"]


def load(group):
    return json.loads((SOURCE / f"{group}.v1.json").read_text(encoding="utf-8"))


def option(group, cell_id, option_id):
    cell = next(c for c in load(group)["cells"] if c["id"] == cell_id)
    return next((o for o in cell["options"] if o["id"] == option_id), None)


@pytest.mark.parametrize("name", NAMES)
def test_frontend_copy_is_byte_identical_to_the_frozen_codebook(name):
    copy = COPY / name
    assert copy.exists(), f"missing frontend copy {copy.relative_to(ROOT)}"
    assert copy.read_bytes() == (SOURCE / name).read_bytes()


def test_frontend_holds_no_codebook_without_a_source():
    copies = {p.name for p in COPY.glob("*.json")}
    assert copies == set(NAMES)
    assert {p.name for p in SOURCE.glob("*.json")} == set(NAMES)


@pytest.mark.parametrize("group,cell,opt", [
    ("E", "type", "type.other"),
    ("Prev", "main_action", "main_action.other"),
    ("Prev", "extra_action", "extra_action.other"),
    ("V", "behavior", "behavior.other"),
])
def test_other_options_that_take_free_text_are_flagged(group, cell, opt):
    assert option(group, cell, opt)["free_text"] is True


def test_prev_party_can_be_unclear():
    assert option("Prev", "party", "party.unclear") is not None


def test_c_action_is_per_party_when_both_subjects():
    action = next(c for c in load("C")["cells"] if c["id"] == "action")
    assert action["per_party_when"] == "subject.both"


MIGRATION = ROOT / "supabase" / "migrations" / "20261116100000_slot_data_model.sql"
FILES = [d / name for d in (SOURCE, COPY) for name in NAMES]


@pytest.mark.parametrize("path", FILES, ids=lambda p: str(p.relative_to(ROOT)))
def test_codebook_files_use_lf_line_endings_so_their_sha256_is_the_same_on_every_checkout(path):
    assert b"\r" not in path.read_bytes()


@pytest.mark.parametrize("path", FILES, ids=lambda p: str(p.relative_to(ROOT)))
def test_git_checks_codebook_files_out_with_lf_whatever_core_autocrlf_says(path):
    rel = path.relative_to(ROOT).as_posix()
    out = subprocess.run(["git", "check-attr", "eol", "--", rel], cwd=ROOT,
                         capture_output=True, text=True, check=True).stdout
    assert out.strip() == f"{rel}: eol: lf"


@pytest.mark.parametrize("group", GROUPS)
def test_migration_seeds_the_sha256_of_the_codebook_file(group):
    seeded = dict(re.findall(r"\('(\w+)\.v1', '\1', 1, \$cb\$.*?\$cb\$::jsonb,\s*'([0-9a-f]{64})'",
                             MIGRATION.read_text(encoding="utf-8"), re.S))
    assert seeded.get(group) == hashlib.sha256((SOURCE / f"{group}.v1.json").read_bytes()).hexdigest()


MIGRATION_V2 = ROOT / "supabase" / "migrations" / "20261116200000_codebook_v2.sql"


@pytest.mark.parametrize("name", ["S.v2.json", "C.v2.json", "V.v2.json", "Attr.v1.json"])
def test_v2_migration_seeds_the_sha256_of_the_codebook_file(name):
    group, version = name.removesuffix(".json").split(".v")
    seeded = dict(re.findall(r"\('(\w+\.v\d+)', '\w+', \d+, \$cb\$.*?\$cb\$::jsonb,\s*'([0-9a-f]{64})'",
                             MIGRATION_V2.read_text(encoding="utf-8"), re.S))
    assert seeded.get(f"{group}.v{version}") == hashlib.sha256((SOURCE / name).read_bytes()).hexdigest()


def test_v2_removes_overcast_and_evasion_and_adds_the_new_choices():
    s2 = json.loads((SOURCE / "S.v2.json").read_text(encoding="utf-8"))
    c2 = json.loads((SOURCE / "C.v2.json").read_text(encoding="utf-8"))
    v2 = json.loads((SOURCE / "V.v2.json").read_text(encoding="utf-8"))
    ids = lambda book: {o["id"] for c in book["cells"] for o in c.get("options", [])}
    assert "weather.overcast" not in ids(s2) and "weather.no_rain" in ids(s2)
    assert {"surface_material.asphalt", "surface_material.dirt", "surface_material.unclear"} <= ids(s2)
    assert not {"evader", "evasion", "evasion_result"} & {c["id"] for c in c2["cells"]}
    assert "speed.high" in ids(c2)
    assert {"violator.both", "behavior.no_slowdown_intersection"} <= ids(v2)
    assert next(c for c in v2["cells"] if c["id"] == "behavior")["per_party_when"] == "violator.both"


def test_e_v2_migration_seeds_the_sha256_of_the_codebook_file():
    migration = ROOT / "supabase" / "migrations" / "20261116300000_codebook_e_v2.sql"
    seeded = dict(re.findall(r"\('(\w+\.v\d+)', '\w+', \d+, \$cb\$.*?\$cb\$::jsonb,\s*'([0-9a-f]{64})'",
                             migration.read_text(encoding="utf-8"), re.S))
    assert seeded == {"E.v2": hashlib.sha256((SOURCE / "E.v2.json").read_bytes()).hexdigest()}


def test_e_v2_adds_ambulance_and_electric_two_wheeler_and_keeps_every_e_v1_choice():
    e1 = json.loads((SOURCE / "E.v1.json").read_text(encoding="utf-8"))
    e2 = json.loads((SOURCE / "E.v2.json").read_text(encoding="utf-8"))
    ids = lambda book: [o["id"] for c in book["cells"] for o in c.get("options", [])]
    assert set(ids(e2)) - set(ids(e1)) == {"type.ambulance", "type.electric_two_wheeler"}
    assert set(ids(e1)) <= set(ids(e2))
