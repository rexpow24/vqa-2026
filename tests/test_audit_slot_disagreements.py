"""Keep per-party audit output useful for human and unidentified V parties."""

from pathlib import Path


def test_v6_audit_displays_the_keeper_and_each_observed_behaviour(monkeypatch):
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1] / "scripts"))
    from audit_slot_disagreements import format_answer_lines

    answer = {"parties": [
        {"party": {"entity": "A"}, "behavior": {"options": ["behavior.wrong_lane"]}},
        {"party": {"option": "violator.unidentified"}, "behavior": {
            "options": ["behavior.other"], "text": "để vật nuôi đi rông",
        }},
    ]}
    text = "\n".join(format_answer_lines(answer, "V.v6"))
    assert "chủ/người quản lý vật nuôi (chưa xác định)" in text
    assert "để vật nuôi đi rông" in text
    assert "Bên A: đi sai làn, lấn làn" in text
    assert "Bên ?" not in text


def test_c_audit_still_displays_its_entity_and_action(monkeypatch):
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[1] / "scripts"))
    from audit_slot_disagreements import format_answer_lines

    lines = format_answer_lines({"parties": [{"party": {"entity": "B"},
        "action": {"option": "action.k11.right_to_left"}}]}, "C.v2", indent="")
    assert lines == ["Bên B: từ phải sang trái"]
