"""Agreement coefficients in scripts/iaa_round.py, checked against published values.

The oracles are external on purpose: Fleiss (1971) as reproduced in the standard
14-rater example, and Krippendorff's own worked nominal example (alpha = 0.743),
so a formula error cannot hide behind a value the code itself produced.
"""

import csv

import pytest

from scripts.iaa_round import fleiss_kappa, gwet_ac1, kripp_alpha, main, nominal, pairwise_pct

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


def _export(path, rows):
    header = ["seq", "filename", "agreement", "annotator_email", "annotator_name", "assignment_status",
              "batch", "qgroup", "question", "draft_answer", "verdict", "reason_code", "reason_note",
              "edited_answer", "effective_answer", "human_keyframes_s", "annotated_at", "event_label",
              "draft_id", "video_id", "annotator_id"]
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
