#!/usr/bin/env python3
"""Report nominal Krippendorff alpha per field and per complete group answer.

Both analyses use every video with at least two completed annotators. A video
with three of four annotators is included. The bootstrap samples whole videos
with a fixed seed, so the report is reproducible for a fixed input CSV.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

try:
    from scripts.agreement_alpha_kappa import flatten_fields
    from scripts.entity_match import apply_entity_match
    from scripts.iaa_round import kripp_alpha, nominal, slot_signature
except ImportError:
    from agreement_alpha_kappa import flatten_fields
    from entity_match import apply_entity_match
    from iaa_round import kripp_alpha, nominal, slot_signature


GROUPS = ("S", "E", "C", "O", "R", "Attr", "Prev")


def video_units(answers):
    """Keep all pairable coding units, regardless of their rater count."""
    by_video = defaultdict(list)
    for (video, _draft), by_annotator in answers.items():
        if len(by_annotator) >= 2:
            by_video[video].append([by_annotator[ann] for ann in sorted(by_annotator)])
    return dict(by_video)


def alpha_and_ci(by_video, draws, seed):
    videos = sorted(by_video)
    if not videos:
        return math.nan, math.nan, math.nan

    def estimate(sampled):
        units = [unit for video in sampled for unit in by_video[video]]
        return float(kripp_alpha(units, nominal))

    point = estimate(videos)
    if len(videos) < 3:
        return point, math.nan, math.nan
    rng = np.random.default_rng(seed)
    estimates = [estimate(rng.choice(videos, len(videos), replace=True)) for _ in range(draws)]
    finite = [value for value in estimates if math.isfinite(value)]
    if not finite:
        return point, math.nan, math.nan
    low, high = np.percentile(finite, [2.5, 97.5])
    return point, float(low), float(high)


def format_alpha(value):
    return "n/a" if not math.isfinite(value) else f"{value:.3f}"


def run(source: Path, out: Path, excluded: list[str], draws: int, seed: int):
    frame = pd.read_csv(source, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    requested = {value.strip().casefold() for value in excluded}
    known = {
        value.casefold()
        for column in ("annotator_id", "annotator_name")
        for value in frame[column].astype(str)
    }
    unknown = requested - known
    if unknown:
        raise ValueError(f"Annotator not in CSV: {', '.join(sorted(unknown))}")
    frame = frame[
        (frame["assignment_status"] == "completed")
        & ~frame["annotator_id"].str.casefold().isin(requested)
        & ~frame["annotator_name"].str.casefold().isin(requested)
    ].copy()
    frame, entity_note = apply_entity_match(frame, "identity", False)

    whole = defaultdict(lambda: defaultdict(dict))
    fields = defaultdict(lambda: defaultdict(dict))
    roster = defaultdict(set)
    for row in frame.to_dict("records"):
        group, version = row["qgroup"], row["codebook_version"]
        if group not in GROUPS or not row["slots"]:
            continue
        unit = (row["video_id"], row["draft_id"])
        ann = row["annotator_id"]
        roster[(group, version)].add(ann)
        signature = slot_signature(row["slots"], version)
        whole[(group, version)][unit][ann] = signature
        for field, value in flatten_fields(json.loads(signature)):
            if "@" not in field:
                fields[(group, version, field)][unit][ann] = value

    whole_rows, field_rows = [], []
    for group, version in sorted(whole, key=lambda key: (GROUPS.index(key[0]), key[1])):
        by_video = video_units(whole[(group, version)])
        point, low, high = alpha_and_ci(by_video, draws, seed)
        full = sum(len(answers) == len(roster[(group, version)]) for answers in whole[(group, version)].values())
        whole_rows.append({
            "qgroup": group, "codebook": version, "videos_with_at_least_2": len(by_video),
            "videos_with_all_annotators": full, "annotators": len(roster[(group, version)]),
            "alpha": point, "ci95_low": low, "ci95_high": high,
        })
        for key in sorted(fields):
            if key[:2] != (group, version):
                continue
            field_by_video = video_units(fields[key])
            field_point, field_low, field_high = alpha_and_ci(field_by_video, draws, seed)
            field_rows.append({
                "qgroup": group, "codebook": version, "field": key[2],
                "videos_with_at_least_2": len(field_by_video),
                "alpha": field_point, "ci95_low": field_low, "ci95_high": field_high,
            })

    out.mkdir(parents=True, exist_ok=True)
    for name, records in (("whole_group.csv", whole_rows), ("per_field.csv", field_rows)):
        with (out / name).open("w", encoding="utf-8-sig", newline="") as handle:
            if records:
                writer = csv.DictWriter(handle, fieldnames=list(records[0]))
                writer.writeheader()
                writer.writerows(records)

    lines = [
        "# Krippendorff alpha theo ô và cả bộ ô", "",
        f"Nguồn: `{source}`.",
        f"Dùng {len(frame)} câu trả lời hoàn thành của {frame['annotator_id'].nunique()} người.",
        f"Bootstrap {draws} lần theo video, seed={seed}.",
        entity_note, "",
        "Video còn ít nhất 2 người được tính, kể cả video thiếu một người.",
        "Alpha n/a nghĩa là không có đủ biến thiên nhãn để ước lượng.", "",
        "| Nhóm | Video được tính | Đủ tất cả người | Alpha cả bộ | CI 95% |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for row in whole_rows:
        lines.append(
            f"| {row['qgroup']} | {row['videos_with_at_least_2']} | "
            f"{row['videos_with_all_annotators']} | {format_alpha(row['alpha'])} | "
            f"[{format_alpha(row['ci95_low'])}, {format_alpha(row['ci95_high'])}] |"
        )
    lines += ["", "| Nhóm | Ô | Video được tính | Alpha từng ô | CI 95% |", "| --- | --- | ---: | ---: | ---: |"]
    for row in field_rows:
        lines.append(
            f"| {row['qgroup']} | {row['field']} | {row['videos_with_at_least_2']} | "
            f"{format_alpha(row['alpha'])} | "
            f"[{format_alpha(row['ci95_low'])}, {format_alpha(row['ci95_high'])}] |"
        )
    lines += ["", "Mỗi ô là một biến riêng; cả bộ ô là một nhãn cấu trúc duy nhất.",
              "Không gộp nhãn của các ô khác nhau vào một alpha chung.", ""]
    report = out / "agreement_report.md"
    report.write_text("\n".join(lines), encoding="utf-8")
    print(report.read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--out", type=Path, default=Path("reports/agreement-krippendorff"))
    parser.add_argument("--exclude-annotators", nargs="+", default=[])
    parser.add_argument("--boot", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()
    if args.boot < 1:
        parser.error("--boot must be >= 1")
    run(args.source, args.out, args.exclude_annotators, args.boot, args.seed)


if __name__ == "__main__":
    main()
