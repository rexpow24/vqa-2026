"""Answers export -> one Markdown review sheet, questions grouped by qgroup.

Usage:
    python scripts/iaa_questions.py answers-agreement-....csv [--out FILE] [--split-only]

For each qgroup (in the app's order, from frontend/src/lib/qgroups.json) every
question gets a heading "[S] Q1: <question>", its draft once, the verdict counts
with the per-question agreement P_i (share of annotator pairs with the same
verdict), and one table row per annotator: verdict, reason, note, edited answer,
evidence frames. --split-only keeps the questions where annotators did not all
pick the same verdict, the ones to discuss when updating the guidelines.

Same row filter as scripts/iaa_round.py: only assignment_status = completed
unless --include-unfinished.
"""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

QGROUPS_JSON = Path(__file__).resolve().parent.parent / "frontend" / "src" / "lib" / "qgroups.json"
VERDICTS = ["AGREE", "DISAGREE", "NOT_ANSWERABLE"]


def qgroup_names():
    """Ordered {code: name} as the app shows them; empty if the file is missing."""
    try:
        return {g["code"]: g["name"] for g in json.loads(QGROUPS_JSON.read_text(encoding="utf-8"))}
    except (OSError, ValueError, KeyError):
        return {}


def pair_agreement(verdicts):
    """Share of annotator pairs on one question that picked the same verdict (Fleiss P_i)."""
    n = len(verdicts)
    if n < 2:
        return None
    same = sum(c * (c - 1) for c in Counter(verdicts).values())
    return same / (n * (n - 1))


def cell(value):
    """A Markdown table cell: one line, pipes escaped."""
    return " ".join(str(value).split()).replace("|", "\\|")


def render(df, split_only=False):
    names = qgroup_names()
    order = list(names) + sorted(set(df["qgroup"]) - set(names))
    lines = []
    for code in order:
        group = df[df["qgroup"] == code]
        if group.empty:
            continue
        questions = []
        for draft_id, rows in group.groupby("draft_id", sort=False):
            p_i = pair_agreement(list(rows["verdict"]))
            questions.append((draft_id, rows, p_i))
        questions.sort(key=lambda q: (_seq(q[1]), q[1]["filename"].iloc[0]))
        split = [q for q in questions if q[2] is not None and q[2] < 1]
        title = f"{code} - {names[code]}" if code in names else code
        lines += [f"# {title}", "",
                  f"{len(questions)} câu, {len(split)} câu chia rẽ, "
                  f"{sum(1 for q in questions if q[2] is None)} câu chỉ 1 người.", ""]
        for number, (draft_id, rows, p_i) in enumerate(questions, start=1):
            if split_only and (p_i is None or p_i == 1):
                continue
            first = rows.iloc[0]
            counts = Counter(rows["verdict"])
            summary = ", ".join(f"{counts[v]} {v}" for v in VERDICTS if counts[v])
            agreement = "1 người, không tính" if p_i is None else f"P_i {p_i:.3f}" + ("" if p_i == 1 else ", chia rẽ")
            seq = f"#{first['seq']} " if first.get("seq") else ""
            lines += [f"## [{code}] Q{number}: {cell(first['question'])}", "",
                      f"Video {seq}`{first['filename']}` · {len(rows)} người: {summary} · {agreement}", "",
                      f"**Draft:** {cell(first['draft_answer'])}", "",
                      "| Annotator | Verdict | Reason | Note | Edited answer | Frames (s) |",
                      "|---|---|---|---|---|---|"]
            for _, r in rows.sort_values(["verdict", "annotator_name"]).iterrows():
                lines.append("| " + " | ".join(cell(r.get(k, "")) for k in
                             ("annotator_name", "verdict", "reason_code", "reason_note",
                              "edited_answer", "human_keyframes_s")) + " |")
            lines.append("")
    return "\n".join(lines)


def _seq(rows):
    try:
        return int(rows["seq"].iloc[0])
    except (KeyError, ValueError):
        return sys.maxsize


def main(argv=None):
    ap = argparse.ArgumentParser(description="Review sheet of every question, grouped by qgroup.")
    ap.add_argument("csv")
    ap.add_argument("--out", default="iaa_out/questions_by_qgroup.md")
    ap.add_argument("--split-only", action="store_true",
                    help="only questions where annotators picked different verdicts")
    ap.add_argument("--include-unfinished", action="store_true",
                    help="keep rows of annotators who have not completed the video")
    args = ap.parse_args(argv)

    df = pd.read_csv(args.csv, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    if not args.include_unfinished:
        df = df[df["assignment_status"] == "completed"]
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(render(df, split_only=args.split_only), encoding="utf-8")
    if hasattr(sys.stdout, "reconfigure"):  # Windows consoles default to cp1252
        sys.stdout.reconfigure(encoding="utf-8")
    print(f"{df['draft_id'].nunique()} câu, {df['annotator_id'].nunique()} người -> {out}")


if __name__ == "__main__":
    main()
