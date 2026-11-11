"""scripts/iaa_questions.py: the per-qgroup review sheet built from the answers export."""

import csv

import pytest

from scripts.iaa_questions import main, pair_agreement

HEADER = ["seq", "filename", "annotator_name", "assignment_status", "qgroup", "question",
          "draft_answer", "verdict", "reason_code", "reason_note", "edited_answer",
          "human_keyframes_s", "draft_id", "video_id", "annotator_id"]


def _row(**kw):
    base = {"seq": "1", "filename": "v1.mp4", "assignment_status": "completed",
            "video_id": "v1", "draft_answer": "draft"}
    return {**base, **kw}


def _export(path, rows):
    with path.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=HEADER)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in HEADER})


def test_pair_agreement_is_share_of_matching_pairs():
    assert pair_agreement(["AGREE"] * 6 + ["DISAGREE"] * 2) == pytest.approx(16 / 28)
    assert pair_agreement(["AGREE"]) is None


def test_sheet_groups_by_qgroup_in_app_order_and_lists_every_annotator(tmp_path):
    rows = [
        # C question: split, with a pipe in the edit that must not break the table.
        _row(qgroup="C", question="Nguyên nhân?", draft_id="dC", annotator_id="a", annotator_name="An",
             verdict="DISAGREE", reason_code="thiếu thực thể", edited_answer="xe máy | ô tô"),
        _row(qgroup="C", question="Nguyên nhân?", draft_id="dC", annotator_id="b", annotator_name="Bình",
             verdict="AGREE"),
        _row(qgroup="C", question="Nguyên nhân?", draft_id="dC", annotator_id="c", annotator_name="Chi",
             verdict="AGREE", assignment_status="in_progress"),
        # S question: unanimous.
        _row(qgroup="S", question="Bối cảnh?", draft_id="dS", annotator_id="a", annotator_name="An", verdict="AGREE"),
        _row(qgroup="S", question="Bối cảnh?", draft_id="dS", annotator_id="b", annotator_name="Bình", verdict="AGREE"),
    ]
    source, out = tmp_path / "answers.csv", tmp_path / "sheet.md"
    _export(source, rows)

    main([str(source), "--out", str(out)])
    sheet = out.read_text(encoding="utf-8")

    assert sheet.index("# S - Bối cảnh") < sheet.index("# C - Nguyên nhân")  # qgroups.json order
    assert "## [S] Q1: Bối cảnh?" in sheet and "## [C] Q1: Nguyên nhân?" in sheet
    assert "2 người: 1 AGREE, 1 DISAGREE · P_i 0.000, chia rẽ" in sheet  # Chi is in progress, dropped
    assert "Chi" not in sheet
    assert "| An | DISAGREE | thiếu thực thể |  | xe máy \\| ô tô |  |" in sheet
    assert "**Draft:** draft" in sheet

    main([str(source), "--out", str(out), "--split-only"])
    split = out.read_text(encoding="utf-8")
    assert "[C] Q1" in split and "[S] Q1" not in split
