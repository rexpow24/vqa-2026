"""scripts/iaa_tier1.py: the tier-1 agreement CSV leaves out slot assignments (features/slot-data-model/, A33)."""

import csv

from scripts.iaa_tier1 import main

HEADER = ["seq", "filename", "agreement", "annotator_email", "annotator_name", "assignment_status", "batch",
          "answer_format", "qgroup", "question", "draft_answer", "verdict", "reason_code", "reason_note",
          "edited_answer", "effective_answer", "human_keyframes_s", "annotated_at", "event_label",
          "draft_id", "video_id", "annotator_id"]


def _rows():
    rows = []
    for v in ("1", "2"):
        for q in ("S", "C", "N"):
            for a, verdict in (("ann1", "AGREE"), ("ann2", "DISAGREE" if (v, q) == ("1", "C") else "AGREE")):
                rows.append({"seq": v, "filename": f"v{v}.mp4", "annotator_name": a, "assignment_status": "completed",
                             "batch": "agreement", "answer_format": "text", "qgroup": q, "verdict": verdict,
                             "draft_id": f"d{v}{q}", "video_id": f"v{v}", "annotator_id": a})
            rows.append({"seq": v, "filename": f"v{v}.mp4", "annotator_name": "Lead", "assignment_status": "completed",
                         "batch": "agreement", "answer_format": "slots", "qgroup": q,
                         "verdict": "AGREE" if q == "N" else "SLOTS", "draft_id": f"d{v}{q}", "video_id": f"v{v}",
                         "annotator_id": "lead"})
    return rows


def test_tier1_csv_has_no_slot_rows(tmp_path, capsys):
    source, out = tmp_path / "answers.csv", tmp_path / "tier1.csv"
    with source.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=HEADER)
        writer.writeheader()
        for row in _rows():
            writer.writerow({k: row.get(k, "") for k in HEADER})

    main([str(source), "--out", str(out), "--boot", "20"])
    printed = capsys.readouterr().out
    table = out.read_text(encoding="utf-8-sig")

    assert "SLOTS" not in table and "Lead" not in table
    assert "6 câu, 2 người, 2 video" in printed
