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
# Every frozen codebook file, v1 and later.
NAMES = [f"{g}.v1.json" for g in GROUPS] + ["S.v2.json", "C.v2.json", "V.v2.json", "V.v3.json", "V.v4.json", "V.v5.json", "V.v6.json", "Attr.v1.json", "E.v2.json", "C.v3.json", "E.v3.json", "R.v2.json", "Prev.v2.json", "V.v7.json", "V.v8.json", "Prev.v3.json", "S.v3.json", "E.v4.json", "C.v4.json", "V.v9.json", "Prev.v4.json", "O.v2.json", "E.v5.json", "E.v6.json"]


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


def test_e_v3_applies_entity_taxonomy_and_required_car_details():
    e3 = json.loads((SOURCE / "E.v3.json").read_text(encoding="utf-8"))
    cells = {cell["id"]: cell for cell in e3["cells"]}
    types = {option["id"] for option in cells["type"]["options"]}
    vehicle_colors = {option["id"] for option in cells["vehicle_color"]["options"]}
    clothing_colors = {option["id"] for option in cells["clothing_color"]["options"]}
    assert "type.bicycle" in types and "type.motorbike" in types
    assert not {"size", "riders"} & cells.keys()
    assert "type.two_wheeler" not in types
    assert vehicle_colors == {
        "vehicle_color.white_gray_silver", "vehicle_color.black", "vehicle_color.red",
        "vehicle_color.blue_green", "vehicle_color.yellow",
    }
    assert "vehicle_color.light" not in vehicle_colors and "vehicle_color.dark" not in vehicle_colors
    assert cells["dashcam"]["required_when"] == "type.car"
    assert cells["vehicle_color"]["required_when"] == "type.car"
    assert cells["clothing_color"]["when"] == "Chỉ với người đi bộ"
    assert clothing_colors == {
        "clothing_color.white_gray_silver", "clothing_color.black", "clothing_color.red",
        "clothing_color.blue_green", "clothing_color.yellow",
    }


def test_prev_v4_is_derived_from_c_and_excludes_legal_violation_and_secondary_action():
    book = json.loads((SOURCE / "Prev.v4.json").read_text(encoding="utf-8"))
    cells = {cell["id"]: cell for cell in book["cells"]}
    options = {option["id"] for option in cells["main_action"]["options"]}
    assert book["inferred_from"] == "C"
    assert "extra_action" not in cells
    assert "main_action.wear_helmet" not in options
    assert {"main_action.overtake_safely", "main_action.check_surroundings", "main_action.use_pedestrian_path"} <= options


def test_remove_v_migration_seeds_prev_v4_exact_bytes():
    migration = ROOT / "supabase" / "migrations" / "20261122160000_remove_v_from_active_workflow.sql"
    seeded = dict(re.findall(r"\('([^']+)', 'Prev', 4, \$cb\$.*?\$cb\$::jsonb,\s*'([0-9a-f]{64})'",
                             migration.read_text(encoding="utf-8"), re.S))
    assert seeded.get("Prev.v4") == hashlib.sha256((SOURCE / "Prev.v4.json").read_bytes()).hexdigest()


def test_new_codebook_rules_keep_c_object_and_apply_requested_option_changes():
    s3 = json.loads((SOURCE / "S.v3.json").read_text(encoding="utf-8"))
    e4 = json.loads((SOURCE / "E.v4.json").read_text(encoding="utf-8"))
    c4 = json.loads((SOURCE / "C.v4.json").read_text(encoding="utf-8"))
    v9 = json.loads((SOURCE / "V.v9.json").read_text(encoding="utf-8"))
    ids = lambda book, cell: {option["id"] for option in next(c for c in book["cells"] if c["id"] == cell)["options"]}
    assert "surface_material.concrete" in ids(s3, "surface_material")
    assert "type.bicycle" in ids(e4, "type")
    assert next(c for c in e4["cells"] if c["id"] == "vehicle_color")["required"] is False
    assert "object" in {c["id"] for c in c4["cells"]}
    assert ids(c4, "event_type") == {"event_type.collision", "event_type.near_miss"}
    assert next(o for o in next(c for c in c4["cells"] if c["id"] == "conflict_type")["options"]
                if o["id"] == "conflict_type.k14")["label"] == "Băng ngang đường giữa đoạn, không ở giao lộ"
    for cell_id in ("behavior", "additional_behavior"):
        labels = {option["label"] for option in next(c for c in v9["cells"] if c["id"] == cell_id)["options"]}
        assert "quay đầu sai quy định" in labels
        assert not labels & {"không giảm tốc độ qua giao lộ", "vượt xe sai quy định", "không chấp hành biển báo, vạch kẻ đường"}


def test_c_v3_removes_speed_without_mutating_c_v2():
    c2 = json.loads((SOURCE / "C.v2.json").read_text(encoding="utf-8"))
    c3 = json.loads((SOURCE / "C.v3.json").read_text(encoding="utf-8"))
    assert any(cell["id"] == "speed" for cell in c2["cells"])
    assert not any(cell["id"] == "speed" for cell in c3["cells"])
    assert all("{speed}" not in template["text"] for template in c3["templates"])


def test_r_prev_and_v_next_versions_encode_requested_removals_and_derivation():
    r2 = json.loads((SOURCE / "R.v2.json").read_text(encoding="utf-8"))
    prev2 = json.loads((SOURCE / "Prev.v2.json").read_text(encoding="utf-8"))
    v7 = json.loads((SOURCE / "V.v7.json").read_text(encoding="utf-8"))
    bystanders = next(cell for cell in r2["cells"] if cell["id"] == "bystanders")
    assert {option["id"] for option in bystanders["options"]} == {"bystanders.helped", "bystanders.unclear"}
    assert prev2["inferred_from"] == "V" and prev2["read_only"] is True
    assert {cell["id"] for cell in prev2["cells"]} == {"party", "main_action"}
    assert v7["inferred_from"] == "C"
    behavior = next(cell for cell in v7["cells"] if cell["id"] == "behavior")
    assert behavior["multiple"] is True
    assert behavior["allow_manual_additions"] is True
    assert behavior["additions_optional"] is True


O_V2_SIGNS = {
    "sign.contact_balanced": "level.minor",
    "sign.vehicle_fell": "level.moderate",
    "sign.person_fell": "level.moderate",
    "sign.spun_or_lost_control": "level.moderate",
    "sign.visible_body_damage": "level.moderate",
    "sign.overturned": "level.severe",
    "sign.person_thrown": "level.severe",
    "sign.vehicle_thrown": "level.severe",
    "sign.major_deformation": "level.severe",
}


def test_o_v2_drops_unclear_and_derives_the_level_from_multi_select_signs():
    o2 = json.loads((SOURCE / "O.v2.json").read_text(encoding="utf-8"))
    cells = {cell["id"]: cell for cell in o2["cells"]}
    assert set(cells) == {"parties", "level", "signs"}
    levels = [option["id"] for option in cells["level"]["options"]]
    # features/o-v2-sign-revision: "không đánh giá" merged into "không va chạm".
    assert levels == ["level.none", "level.minor", "level.moderate", "level.severe"]
    assert all(template["case"] != "C không rõ loại sự kiện" for template in o2["templates"])
    # features/o-signs-max-grouped: the level is derived from the signs again, never chosen.
    assert cells["level"]["read_only"] is True and cells["level"]["required"] is True
    assert any("mức cao nhất" in rule for rule in o2["constraints"])
    assert "sign.secondary_collision" not in {option["id"] for option in cells["signs"]["options"]}
    signs = cells["signs"]
    assert signs["multiple"] is True and "parent_cell" not in signs
    assert {option["id"]: option["level"] for option in signs["options"]} == O_V2_SIGNS
    assert [option["id"] for option in signs["options"]] == list(O_V2_SIGNS)
    labels = {option["id"]: option["label"] for option in signs["options"]}
    assert labels["sign.spun_or_lost_control"] == "xoay ngang mất lái"
    assert labels["sign.vehicle_fell"] == "xe đổ tại chỗ" and labels["sign.person_fell"] == "người ngã tại chỗ"
    assert "sign.fell_in_place" not in labels
    assert labels["sign.visible_body_damage"] == "có hư hỏng nhìn thấy được ở thân xe (ô tô)"
    assert labels["sign.major_deformation"] == "biến dạng nghiêm trọng, cấu trúc xe bị phá vỡ rõ rệt"
    assert all(option["id"] != "level.unclear" for option in cells["level"]["options"])
    assert all(template["text"] != "Không thể xác định." for template in o2["templates"])
    assert o2["inferred_from"] == "C"


def test_o_v2_migration_seeds_exact_bytes():
    """20261123100000 is applied in production and stays as it ran; the O.v2 row is revised
    in place by 20261124100000 (features/o-signs-max-grouped), which must carry the file's bytes."""
    migration = ROOT / "supabase" / "migrations" / "20261124100000_o_v2_signs_max.sql"
    text = migration.read_text(encoding="utf-8")
    content = re.search(r"set content = \$cb\$(.*?)\$cb\$::jsonb,\s*sha256 = '([0-9a-f]{64})'", text, re.S)
    assert content, "the migration must update the O.v2 row's content and sha256"
    source = (SOURCE / "O.v2.json").read_bytes()
    assert content.group(2) == hashlib.sha256(source).hexdigest()
    assert json.loads(content.group(1)) == json.loads(source.decode("utf-8"))
    assert "where id = 'O.v2'" in text


def test_e_v5_keeps_the_e_v4_cells_and_takes_at_most_two_parties():
    """features/two-entity-subject-rules: the two main parties of the first collision, else of the first near miss."""
    e4 = json.loads((SOURCE / "E.v4.json").read_text(encoding="utf-8"))
    e5 = json.loads((SOURCE / "E.v5.json").read_text(encoding="utf-8"))
    assert e5["cells"] == e4["cells"] and e5["templates"] == e4["templates"]
    assert e5["max_entities"] == 2 and e5["version"] == 5


E_V5_MIGRATION = ROOT / "supabase" / "migrations" / "20261123110000_e_v5_two_entities.sql"


def test_e_v5_migration_seeds_exact_bytes_and_limits_the_list():
    text = E_V5_MIGRATION.read_text(encoding="utf-8")
    seeded = dict(re.findall(r"\('([^']+)', 'E', 5, \$cb\$.*?\$cb\$::jsonb,\s*'([0-9a-f]{64})'", text, re.S))
    assert seeded.get("E.v5") == hashlib.sha256((SOURCE / "E.v5.json").read_bytes()).hexdigest()
    assert "too_many_entities" in text and "max_entities" in text


def test_e_v6_drops_the_clothing_colour_and_keeps_the_vehicle_colour():
    """features/e-v6-no-colors, revised by features/o-level-first: the vehicle colour came back."""
    e5 = json.loads((SOURCE / "E.v5.json").read_text(encoding="utf-8"))
    e6 = json.loads((SOURCE / "E.v6.json").read_text(encoding="utf-8"))
    assert [cell["id"] for cell in e6["cells"]] == ["type", "dashcam", "vehicle_color"]
    # E.v6 = E.v5 without the clothing colour and, since features/e-type-definitions, without type "khác".
    without_other = [{**cell, "options": [o for o in cell["options"] if o["id"] != "type.other"]} if cell["id"] == "type" else cell
                     for cell in e5["cells"] if cell["id"] != "clothing_color"]
    assert e6["cells"] == without_other
    assert e6["max_entities"] == 2 and e6["version"] == 6
    assert not any("áo" in t["text"] for t in e6["templates"])
    assert any("màu [3]" in t["text"] for t in e6["templates"])


def test_e_v6_migration_seeds_exact_bytes_and_drops_colour_rules():
    """20261123120000 seeded E.v6 and ran in production; 20261124130000 revises the row in place
    (features/e-type-definitions) and must carry the file's bytes."""
    text = (ROOT / "supabase" / "migrations" / "20261123120000_e_v6_no_colors.sql").read_text(encoding="utf-8")
    assert "'E.v6'" in text
    revision = (ROOT / "supabase" / "migrations" / "20261124130000_e_v6_no_other_type.sql").read_text(encoding="utf-8")
    content = re.search(r"set content = \$cb\$(.*?)\$cb\$::jsonb,\s*sha256 = '([0-9a-f]{64})'", revision, re.S)
    assert content, "the revision must update the E.v6 row's content and sha256"
    source = (SOURCE / "E.v6.json").read_bytes()
    assert content.group(2) == hashlib.sha256(source).hexdigest()
    assert json.loads(content.group(1)) == json.loads(source.decode("utf-8"))
    assert "where id = 'E.v6'" in revision


def test_e_v6_has_no_other_type_but_older_books_keep_it():
    """features/e-type-definitions: every party is one of the listed types since E.v6."""
    e6 = json.loads((SOURCE / "E.v6.json").read_text(encoding="utf-8"))
    types = [o["id"] for o in next(c for c in e6["cells"] if c["id"] == "type")["options"]]
    assert "type.other" not in types
    assert types == ["type.car", "type.bus", "type.truck", "type.ambulance", "type.motorbike", "type.cargo_tricycle",
                     "type.pedestrian", "type.animal", "type.bicycle"]
    assert all("khác" not in t["case"].replace("khách", "") for t in e6["templates"])
    e4 = json.loads((SOURCE / "E.v4.json").read_text(encoding="utf-8"))
    assert "type.other" in [o["id"] for o in next(c for c in e4["cells"] if c["id"] == "type")["options"]]
