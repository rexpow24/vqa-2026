"""Agreement coefficients in scripts/iaa_round.py, checked against published values.

The oracles are external on purpose: Fleiss (1971) as reproduced in the standard
14-rater example, and Krippendorff's own worked nominal example (alpha = 0.743),
so a formula error cannot hide behind a value the code itself produced.
"""

import csv
import json

import pytest

from scripts.iaa_round import fleiss_kappa, gwet_ac1, kripp_alpha, main, nominal, pairwise_pct, slot_signature


@pytest.fixture
def synthetic_slot_codebook(monkeypatch):
    """The synthetic test.v1 fixture has no optional cells; real versions keep real validation."""
    from scripts import iaa_round

    original = iaa_round.optional_cell_ids
    monkeypatch.setattr(iaa_round, "optional_cell_ids",
                        lambda version: frozenset() if version == "test.v1" else original(version))


def test_v6_party_order_does_not_create_an_agreement_conflict():
    answer = {"result": {"option": "result.yes"}, "violator": {"option": "violator.both"}, "parties": [
        {"party": {"entity": "A"}, "behavior": {"options": ["behavior.wrong_lane"]}},
        {"party": {"option": "violator.unidentified"}, "behavior": {"options": ["behavior.other"], "text": "để vật nuôi đi rông"}},
    ]}
    reverse = {**answer, "parties": list(reversed(answer["parties"]))}
    assert slot_signature(answer, "V.v6") == slot_signature(reverse, "V.v6")
    assert slot_signature(answer, "V.v5") != slot_signature(reverse, "V.v5")
    changed = {**answer, "parties": [{**answer["parties"][0], "party": {"entity": "B"}}, answer["parties"][1]]}
    assert slot_signature(answer, "V.v6") != slot_signature(changed, "V.v6")

# Fleiss' kappa example: 10 subjects, 14 raters, 5 categories, kappa = 0.210.
FLEISS_COUNTS = [
    [0, 0, 0, 0, 14], [0, 2, 6, 4, 2], [0, 0, 3, 5, 6], [0, 3, 9, 2, 0], [2, 2, 8, 1, 1],
    [7, 7, 0, 0, 0], [3, 2, 6, 3, 0], [2, 5, 3, 2, 2], [6, 5, 2, 1, 0], [0, 2, 2, 3, 7],
]


def test_fleiss_kappa_matches_the_published_14_rater_example():
    units = [[cat for cat, n in enumerate(row) for _ in range(n)] for row in FLEISS_COUNTS]
    assert fleiss_kappa(units, categories=list(range(5))) == pytest.approx(0.20993, abs=1e-4)


def test_alpha_matches_krippendorffs_nominal_example_with_missing_values():
    # Four coders, twelve units, None = not coded. Unit 12 has one value and is dropped.
    coders = [
        [1, 2, 3, 3, 2, 1, 4, 1, 2, None, None, None],
        [1, 2, 3, 3, 2, 2, 4, 1, 2, 5, None, 3],
        [None, 3, 3, 3, 2, 3, 4, 2, 2, 5, 1, None],
        [1, 2, 3, 3, 2, 4, 4, 1, 2, 5, 1, None],
    ]
    units = [[c[i] for c in coders if c[i] is not None] for i in range(12)]
    assert kripp_alpha(units, nominal) == pytest.approx(0.743, abs=1e-3)


def test_kappa_paradox_high_raw_agreement_low_kappa_high_ac1():
    # Two raters, AGREE everywhere but one question: 75% raw agreement.
    units = [["AGREE", "AGREE"]] * 3 + [["AGREE", "DISAGREE"]]
    assert pairwise_pct(units) == pytest.approx(0.75)
    assert fleiss_kappa(units) == pytest.approx(-1 / 7)        # (0.75 - 0.78125) / 0.21875
    assert gwet_ac1(units) == pytest.approx(0.640625 / 0.890625)  # (0.75 - 0.109375) / 0.890625


# The export before P2 (features/slot-data-model/) had no answer_format column.
OLD_HEADER = ["seq", "filename", "agreement", "annotator_email", "annotator_name", "assignment_status",
              "batch", "qgroup", "question", "draft_answer", "verdict", "reason_code", "reason_note",
              "edited_answer", "effective_answer", "human_keyframes_s", "annotated_at", "event_label",
              "draft_id", "video_id", "annotator_id"]
HEADER = OLD_HEADER[:7] + ["answer_format", "codebook_version", "slots"] + OLD_HEADER[7:]


def _export(path, rows, header=OLD_HEADER):
    with path.open("w", newline="", encoding="utf-8-sig") as file:  # the web export has a BOM
        writer = csv.DictWriter(file, fieldnames=header)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in header})


def test_report_drops_unfinished_work_and_names_who_is_missing(tmp_path, capsys):
    rows = []
    for v in range(3):
        for q in ("S", "C"):
            for a in ("ann1", "ann2", "ann3"):
                rows.append({
                    "filename": f"video{v}.mp4", "annotator_name": a,
                    "assignment_status": "in_progress" if (a == "ann3" and v == 2) else "completed",
                    "qgroup": q, "question": f"{q}?", "draft_answer": "draft", "verdict": "AGREE",
                    "effective_answer": "draft", "event_label": "accident",
                    "draft_id": f"d{v}{q}", "video_id": f"v{v}", "annotator_id": a,
                })
    source = tmp_path / "answers.csv"
    _export(source, rows)

    main([str(source), "--out", str(tmp_path / "out"), "--boot", "20"])

    report = capsys.readouterr().out
    assert "bỏ 2 dòng chưa completed" in report
    assert "2/6 câu thiếu người chấm" in report
    assert "ann3: thiếu 2 câu, 1 video, ví dụ video2.mp4" in report
    assert "Fleiss kappa" in report and "Gwet AC1" in report
    assert (tmp_path / "out" / "report.txt").read_text(encoding="utf-8").strip() == report.strip()
    assert "fleiss_kappa" in (tmp_path / "out" / "by_qgroup.csv").read_text(encoding="utf-8")


def _mixed_round():
    """Two text annotators on 3 videos x 3 groups, with some disagreement, so every coefficient is defined."""
    rows = []
    split = {("v0", "C"): "DISAGREE", ("v1", "N"): "NOT_ANSWERABLE", ("v2", "S"): "DISAGREE"}
    for v in ("v0", "v1", "v2"):
        for q in ("S", "C", "N"):
            for a in ("ann1", "ann2"):
                verdict = split.get((v, q), "AGREE") if a == "ann2" else "AGREE"
                rows.append({
                    "seq": v[1], "filename": f"{v}.mp4", "annotator_name": a, "assignment_status": "completed",
                    "batch": "agreement", "answer_format": "text", "qgroup": q, "question": f"{q}?",
                    "draft_answer": "draft", "verdict": verdict,
                    "edited_answer": "khác" if verdict == "DISAGREE" else "",
                    "effective_answer": {"AGREE": "draft", "DISAGREE": "khác"}.get(verdict, "Không trả lời được"),
                    "event_label": "accident", "draft_id": f"d{v}{q}", "video_id": v, "annotator_id": a,
                })
    return rows


def _slot_rows():
    """Two annotators answer the same questions with structured choices."""
    rows = []
    for v in ("v0", "v1", "v2"):
        for q in ("S", "C", "N"):
            for annotator in ("lead", "lead2"):
                option = "option.same"
                if v == "v2" and q == "C" and annotator == "lead2":
                    option = "option.different"
                rows.append({
                    "seq": v[1], "filename": f"{v}.mp4", "annotator_name": annotator,
                    "assignment_status": "completed", "batch": "agreement", "answer_format": "slots",
                    "codebook_version": "test.v1", "slots": json.dumps({"choice": {"option": option}}),
                    "qgroup": q, "question": f"{q}?", "draft_answer": "draft",
                    "verdict": "NOT_ANSWERABLE" if q == "N" else "SLOTS",
                    "edited_answer": "" if q == "N" else "Câu ghép từ ô.",
                    "effective_answer": "Không trả lời được" if q == "N" else "Câu ghép từ ô.",
                    "event_label": "near-miss", "draft_id": f"d{v}{q}", "video_id": v, "annotator_id": annotator,
                })
    return rows


TIER1 = ("% đồng ý từng cặp", "Fleiss kappa", "Krippendorff alpha     ", "Gwet AC1")


def _run(tmp_path, name, rows, header, capsys):
    source = tmp_path / f"{name}.csv"
    _export(source, rows, header)
    out = tmp_path / name
    main([str(source), "--out", str(out), "--boot", "50"])
    report = capsys.readouterr().out.replace(str(out), "<out>")  # the report names its output folder
    return report, (out / "by_qgroup.csv").read_text(encoding="utf-8"), out


def test_slot_rows_leave_every_tier1_coefficient_unchanged(tmp_path, capsys, synthetic_slot_codebook):
    text_report, text_by_q, _ = _run(tmp_path, "text", _mixed_round(), HEADER, capsys)
    slot_report, slot_by_q, _ = _run(tmp_path, "slots", _mixed_round() + _slot_rows(), HEADER, capsys)

    tier1 = lambda report: [line for line in report.split("TẦNG 3")[0].splitlines()
                            if line.strip().startswith(TIER1)]
    assert len(tier1(text_report)) == 5  # pairwise, kappa, alpha, AC1, and the event-label agreement line
    assert tier1(slot_report) == tier1(text_report)
    assert slot_by_q == text_by_q
    assert "Dữ liệu văn bản: 2 người" in slot_report and "lead" not in slot_report and "SLOTS" not in slot_report


def test_export_without_answer_format_column_reads_as_all_text(tmp_path, capsys):
    old_report, old_by_q, _ = _run(tmp_path, "old", _mixed_round(), OLD_HEADER, capsys)
    new_report, new_by_q, _ = _run(tmp_path, "new", _mixed_round(), HEADER, capsys)

    assert "Fleiss kappa" in old_report
    assert old_report == new_report
    assert old_by_q == new_by_q


def test_slot_choices_are_exported_as_a_separate_agreement_tier(tmp_path, capsys, synthetic_slot_codebook):
    report, _, out = _run(tmp_path, "mixed", _mixed_round() + _slot_rows(), HEADER, capsys)

    assert "TẦNG 3 - LỰA CHỌN THEO Ô" in report
    assert "S / test.v1" in report
    slot_summary = (out / "by_slot_group.csv").read_text(encoding="utf-8")
    summary = list(csv.DictReader(slot_summary.splitlines()))
    cause = next(row for row in summary if row["qgroup"] == "C" and row["codebook_version"] == "test.v1")
    assert cause["n_units"] == "3" and cause["n_annotators"] == "2"
    assert float(cause["pct_exact_slots"]) == pytest.approx(2 / 3, abs=0.001)
    assert cause["optional_cells_excluded"] == ""


def test_slot_only_export_still_produces_choice_agreement(tmp_path, capsys, synthetic_slot_codebook):
    report, _, out = _run(tmp_path, "slot_only", _slot_rows(), HEADER, capsys)

    assert "TẦNG 3 - LỰA CHỌN THEO Ô" in report
    assert "S / test.v1" in report
    assert len((out / "by_slot_group.csv").read_text(encoding="utf-8").splitlines()) == 4



def test_o_v2_signs_agree_whatever_order_they_were_ticked_and_o_v1_still_scores():
    # O.v2 (features/o-codebook-v2): signs are a set; parties are optional and not scored.
    first = {"level": {"option": "level.severe"}, "signs": {"options": ["sign.fell_in_place", "sign.person_thrown"]},
             "parties": [{"entity": "A"}, {"entity": "B"}]}
    second = {"signs": {"options": ["sign.person_thrown", "sign.fell_in_place"]}, "level": {"option": "level.severe"},
              "parties": [{"entity": "B"}]}
    assert slot_signature(json.dumps(first), "O.v2") == slot_signature(json.dumps(second), "O.v2")
    fewer = {"level": {"option": "level.severe"}, "signs": {"options": ["sign.person_thrown"]}}
    assert slot_signature(json.dumps(first), "O.v2") != slot_signature(json.dumps(fewer), "O.v2")
    v1 = {"level": {"option": "level.minor"}, "sign": {"option": "sign.scrape_stationary"}, "parties": [{"entity": "A"}]}
    assert slot_signature(json.dumps(v1), "O.v1") == '{"level":{"option":"level.minor"},"sign":{"option":"sign.scrape_stationary"}}'


def test_e_v5_scores_its_conditional_cells_like_e_v4():
    """features/two-entity-subject-rules: E.v5 keeps the E.v4 cells, so it keeps their scoring."""
    from scripts.iaa_round import conditional_scored_cell_ids, slot_signature
    row = {"entities": [
        {"key": "A", "cells": {"type": {"option": "type.car"}, "dashcam": {"option": "dashcam.yes"},
                               "vehicle_color": {"option": "vehicle_color.red"}}},
        {"key": "B", "cells": {"type": {"option": "type.motorbike"}, "vehicle_color": {"option": "vehicle_color.red"}}},
    ]}
    assert conditional_scored_cell_ids("E.v5") == conditional_scored_cell_ids("E.v4") == {"dashcam", "vehicle_color"}
    assert slot_signature(json.dumps(row), "E.v5") == slot_signature(json.dumps(row), "E.v4")
    assert "vehicle_color.red" in slot_signature(json.dumps(row), "E.v5")
    assert slot_signature(json.dumps(row), "E.v5").count('"vehicle_color":') == 1  # the dashcam car's colour is dropped


def test_e_v6_scores_the_dashcam_and_the_vehicle_colour_like_e_v5():
    """features/o-level-first: E.v6 asks the vehicle colour again (no clothing colour)."""
    from scripts.iaa_round import conditional_scored_cell_ids, slot_signature
    row = {"entities": [
        {"key": "A", "cells": {"type": {"option": "type.car"}, "dashcam": {"option": "dashcam.yes"}}},
        {"key": "B", "cells": {"type": {"option": "type.motorbike"}, "vehicle_color": {"option": "vehicle_color.red"}}},
    ]}
    assert conditional_scored_cell_ids("E.v6") == {"dashcam", "vehicle_color"}
    signature = slot_signature(json.dumps(row), "E.v6")
    assert "dashcam.yes" in signature and "vehicle_color.red" in signature
