#!/usr/bin/env python3
"""Legacy exploratory report for videos #41-#60 and the eight label groups.

Usage:
  python scripts/agreement_alpha_kappa.py
  python scripts/agreement_alpha_kappa.py "C:/path/answers-agreement.csv" --boot 2000

This report requires four completed annotators per video and skips partial
panels. Its pooled-fields alpha combines different variables into one synthetic
category space, so it must not be used as a reliability claim for any field or
group. Use agreement_krippendorff.py for standard per-field and whole-answer
alpha, including units with at least two annotators.
"""
from __future__ import annotations

import argparse
import csv
import itertools
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

try:
    from scripts.iaa_round import kripp_alpha, nominal, slot_signature, optional_cell_ids
    from scripts.entity_match import apply_entity_match
except ImportError:  # direct `python scripts/agreement_alpha_kappa.py`
    from iaa_round import kripp_alpha, nominal, slot_signature, optional_cell_ids
    from entity_match import apply_entity_match

GROUPS = ("S", "E", "C", "V", "O", "R", "Attr", "Prev")


def flatten_fields(node, prefix="", entity=()):
    """Flatten structured answers into comparable field names and values."""
    found = []
    if isinstance(node, dict):
        leaf = bool(set(node) & {"option", "options", "entity"}) and not any(
            isinstance(value, (dict, list)) for key, value in node.items() if key != "options"
        )
        if leaf:
            if "option" in node:
                value = node["option"]
            elif "options" in node:
                value = json.dumps(sorted(node["options"]), ensure_ascii=False)
            else:
                value = node["entity"]
            field = ".".join(filter(None, (prefix, "[" + "/".join(entity) + "]" if entity else "")))
            found.append((field, str(value)))
            return found
        for key, value in node.items():
            if key in {"key", "party"}:
                continue
            if key == "entities" and isinstance(value, list):
                for item in value:
                    ident = str(item.get("key", "?")) if isinstance(item, dict) else "?"
                    child = {k: v for k, v in item.items() if k != "key"} if isinstance(item, dict) else item
                    found.extend(flatten_fields(child, prefix, entity + (ident,)))
            else:
                found.extend(flatten_fields(value, ".".join(filter(None, (prefix, key))), entity))
    elif isinstance(node, list):
        if all(isinstance(item, dict) and set(item) == {"entity"} for item in node):
            found.append((prefix, json.dumps(sorted(item["entity"] for item in node), ensure_ascii=False)))
        elif all(not isinstance(item, (dict, list)) for item in node):
            found.append((prefix, json.dumps(sorted(node, key=str), ensure_ascii=False)))
        else:
            for index, item in enumerate(node):
                ident = None
                if isinstance(item, dict):
                    ident = item.get("key") or item.get("entity") or (item.get("party") or {}).get("entity")
                child = {k: v for k, v in item.items() if k not in {"key", "party"}} if isinstance(item, dict) else item
                found.extend(flatten_fields(child, prefix, entity + (str(ident or index),)))
    return found


def alpha(units):
    values = [value for unit in units for value in unit]
    if not units or len(set(values)) < 2:
        return math.nan
    return float(kripp_alpha(units, nominal))


def bootstrap_mean(team_units, draws, seed):
    """Mean panel alpha and percentile CI, resampling whole videos."""
    videos = sorted({video for units in team_units for video in units})
    if len(videos) < 3:
        return math.nan, math.nan, math.nan

    def estimate(sampled_videos):
        estimates = []
        for by_video in team_units:
            units = [unit for video in sampled_videos for unit in by_video.get(video, [])]
            value = alpha(units)
            if math.isfinite(value):
                estimates.append(value)
        return float(np.mean(estimates)) if estimates else math.nan

    point = estimate(videos)
    rng = np.random.default_rng(seed)
    values = [estimate(rng.choice(videos, size=len(videos), replace=True)) for _ in range(draws)]
    values = [value for value in values if math.isfinite(value)]
    if not values:
        return point, math.nan, math.nan
    low, high = np.percentile(values, [2.5, 97.5])
    return point, float(low), float(high)


def fmt(value):
    return "n/a" if not math.isfinite(value) else f"{value:.3f}".replace(".", ",")


def run(source: Path, out: Path, draws: int, seed: int):
    with source.open(encoding="utf-8-sig", newline="") as handle:
        frame = pd.DataFrame(csv.DictReader(handle)).fillna("")
    frame, _entity_note = apply_entity_match(frame, "identity", False)
    rows = frame.to_dict("records")
    completed = [row for row in rows if row.get("assignment_status", "completed") == "completed"]
    groups_present = {row.get("qgroup", "") for row in completed}
    roster = defaultdict(set)
    tuples = defaultdict(lambda: defaultdict(dict))  # (group, version) -> (video, draft) -> annotator -> answer
    fields = defaultdict(lambda: defaultdict(dict))   # (group, version, field) -> (video, draft) -> annotator -> value

    for row in completed:
        group = row.get("qgroup", "")
        if group not in GROUPS:
            continue
        ann = row.get("annotator_name") or row.get("annotator_id") or "?"
        video = row.get("video_id") or row.get("seq") or row.get("filename")
        unit = (video, row.get("draft_id", ""))
        roster[group].add(ann)
        version = row.get("codebook_version", "")
        if not row.get("slots"):
            continue
        tuples[(group, version)][unit][ann] = slot_signature(row["slots"], version)
        try:
            parsed = json.loads(row["slots"])
        except json.JSONDecodeError:
            continue
        for field, value in flatten_fields(parsed):
            if "@" in field or field.split(".")[-1] in optional_cell_ids(version):
                continue
            fields[(group, version, field)][unit][ann] = value

    def panel_data(raw, panel, field_name=None):
        by_video = defaultdict(list)
        for (video, _draft), answers in raw.items():
            if not all(ann in answers for ann in panel):
                continue
            values = [answers[ann] for ann in panel]
            if field_name is not None:
                values = [f"{field_name}\x1f{value}" for value in values]
            by_video[video].append(values)
        return dict(by_video)

    def per_field_panel(group, version, panel):
        by_video = defaultdict(list)
        for (g, v, field), raw in fields.items():
            if g != group or v != version:
                continue
            for video, units in panel_data(raw, panel, field).items():
                by_video[video].extend(units)
        return dict(by_video)

    output_rows = []
    for group in GROUPS:
        if group not in groups_present:
            output_rows.append([group, "", "n/a", "n/a", "n/a", "n/a", "n/a"])
            continue
        versions = sorted(version for g, version in tuples if g == group)
        for version in versions:
            panels = list(itertools.combinations(sorted(roster[group]), 4))
            field_panel_data = [per_field_panel(group, version, panel) for panel in panels]
            whole_raw = tuples[(group, version)]
            whole_panel_data = [panel_data(whole_raw, panel) for panel in panels]
            field_alpha, field_low, field_high = bootstrap_mean(field_panel_data, draws, seed)
            whole_alpha, whole_low, whole_high = bootstrap_mean(whole_panel_data, draws, seed + 1)
            coverages = [len(data) for data in whole_panel_data]
            coverage = f"{min(coverages)}-{max(coverages)}/20" if coverages else "0/20"
            output_rows.append([
                group, version, coverage,
                fmt(field_alpha), f"[{fmt(field_low)}; {fmt(field_high)}]",
                fmt(whole_alpha), f"[{fmt(whole_low)}; {fmt(whole_high)}]",
            ])

    seqs = [int(row["seq"]) for row in completed if row.get("seq", "").isdigit()]
    seq_range = f"#{min(seqs)}-#{max(seqs)}" if seqs else "không rõ"
    out.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Báo cáo độ đồng thuận", "",
        "CẢNH BÁO: Alpha ô gộp ở đây chỉ để đối chiếu cách cũ, không phải alpha độ tin cậy của từng ô hay cả nhóm.",
        "Script này bỏ video thiếu người; dùng `agreement_krippendorff.py` cho kết quả chính thức theo từng ô và cả bộ ô.", "",
        f"- Video: {seq_range}",
        f"- Dữ liệu: {len(rows)} dòng, {len(completed)} hoàn thành; loại {len(rows)-len(completed)} dòng chưa hoàn thành.",
        f"- 4 người: trung bình trên mọi tổ hợp 4 người có thể chọn; CI 95% bootstrap theo video ({draws:,} lần).",
        "- α ô gộp: gom các ô theo nhóm, vẫn giữ tên từng ô; α nguyên bộ: so khớp cả câu trả lời cấu trúc.",
        "",
        "| Nhóm | Codebook | Video đủ 4 người | α ô gộp (95% CI) | α nguyên bộ (95% CI) |",
        "|---|---|---:|---:|---:|",
    ]
    for group, version, coverage, field_a, field_ci, whole_a, whole_ci in output_rows:
        field_result = "n/a" if field_a == "n/a" else f"{field_a} {field_ci}"
        whole_result = "n/a" if whole_a == "n/a" else f"{whole_a} {whole_ci}"
        lines.append(f"| {group} | {version or '-'} | {coverage} | {field_result} | {whole_result} |")
    lines += [
        "", "V được giữ trong danh sách tám nhóm; nếu không có trong CSV thì hiển thị `n/a`. N là verdict, không nằm trong tám nhóm nhãn này.",
        "Alpha/CI `n/a` nghĩa là không có biến thiên nhãn để ước lượng độ đồng thuận.", "",
    ]
    report = out / "agreement_report.md"
    report.write_text("\n".join(lines), encoding="utf-8")
    with (out / "agreement_report.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["qgroup", "codebook", "video_coverage_4_raters", "alpha_fields_pooled_mean", "fields_ci95", "alpha_whole_answer_mean", "whole_ci95"])
        writer.writerows(output_rows)
    print(report.read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", type=Path, default=Path("csvs/answers-agreement.csv"))
    parser.add_argument("--out", type=Path, default=Path("reports/answers-agreement"))
    parser.add_argument("--boot", type=int, default=1000)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()
    if args.boot < 1:
        parser.error("--boot must be >= 1")
    run(args.source, args.out, args.boot, args.seed)


if __name__ == "__main__":
    main()
