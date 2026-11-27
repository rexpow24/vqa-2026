#!/usr/bin/env python3
"""Report two nominal Krippendorff alpha views for the 8 label groups.

Usage:
  python scripts/agreement_alpha_kappa.py [answers.csv] [--out reports/answers-agreement]
  python scripts/agreement_alpha_kappa.py csvs/answers-agreement.csv --boot 2000

Method 1 calculates alpha per coded field (slot). Method 2 treats the complete
answer for each question as one exact nominal label. Confidence intervals use a
video-level percentile bootstrap so fields/questions from one video stay together.
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

try:
    from scripts.iaa_round import kripp_alpha, nominal, slot_signature, optional_cell_ids
    from scripts.entity_match import apply_entity_match
except ImportError:  # direct `python scripts/agreement_alpha_kappa.py`
    from iaa_round import kripp_alpha, nominal, slot_signature, optional_cell_ids
    from entity_match import apply_entity_match
import pandas as pd

GROUPS = ("S", "E", "C", "O", "R", "Attr", "Prev", "N")


def flatten_fields(node, prefix="", entity=()):
    """Return (field, value) pairs, preserving entity identity in the field key."""
    found = []
    if isinstance(node, dict):
        leaf = bool(set(node) & {"option", "options", "entity"}) and not any(
            isinstance(v, (dict, list)) for k, v in node.items() if k != "options"
        )
        if leaf:
            if "option" in node:
                value = node["option"]
            elif "options" in node:
                value = json.dumps(sorted(node["options"]), ensure_ascii=False)
            elif "entity" in node:
                value = node["entity"]
            else:
                value = json.dumps(node, ensure_ascii=False, sort_keys=True)
            found.append((".".join(filter(None, (prefix, "[" + "/".join(entity) + "]" if entity else ""))), value))
        else:
            for key, value in node.items():
                if key in {"key", "party"}:
                    continue
                child_entity = entity
                if key == "entities" and isinstance(value, list):
                    for item in value:
                        ident = str(item.get("key", "?")) if isinstance(item, dict) else "?"
                        child = {k: v for k, v in item.items() if k != "key"} if isinstance(item, dict) else item
                        found.extend(flatten_fields(child, prefix, entity + (ident,)))
                else:
                    found.extend(flatten_fields(value, ".".join(filter(None, (prefix, key))), child_entity))
    elif isinstance(node, list):
        # Order-independent multi-selects and repeated structured entities.
        if all(isinstance(item, dict) and set(item) == {"entity"} for item in node):
            found.append((prefix, json.dumps(sorted(item["entity"] for item in node), ensure_ascii=False)))
            return found
        if all(not isinstance(item, (dict, list)) for item in node):
            found.append((prefix, json.dumps(sorted(node, key=str), ensure_ascii=False)))
        else:
            for index, value in enumerate(node):
                if isinstance(value, dict):
                    ident = value.get("key") or value.get("entity") or (value.get("party") or {}).get("entity")
                else:
                    ident = None
                rest = {k: v for k, v in value.items() if k not in {"key", "party"}} if isinstance(value, dict) else value
                found.extend(flatten_fields(rest, prefix, entity + (str(ident or index),)))
    return found


def alpha(units):
    values = [value for unit in units for value in unit]
    if len(set(values)) < 2:
        return math.nan
    return float(kripp_alpha(units, nominal))


def bootstrap_ci(units_by_video, draws, seed):
    videos = sorted(units_by_video)
    if len(videos) < 3:
        return (math.nan, math.nan)
    rng = np.random.default_rng(seed)
    estimates = []
    for _ in range(draws):
        sampled = rng.choice(videos, size=len(videos), replace=True)
        units = [unit for video in sampled for unit in units_by_video[video]]
        value = alpha(units)
        if math.isfinite(value):
            estimates.append(value)
    if not estimates:
        return (math.nan, math.nan)
    return tuple(float(x) for x in np.percentile(estimates, [2.5, 97.5]))


def fmt(value):
    return "n/a" if not math.isfinite(value) else f"{value:.3f}"


def run(source: Path, out: Path, draws: int, seed: int):
    with source.open(encoding="utf-8-sig", newline="") as handle:
        frame = pd.DataFrame(csv.DictReader(handle)).fillna("")
    frame, entity_match_note = apply_entity_match(frame, "identity", False)
    rows = frame.to_dict("records")
    completed = [r for r in rows if r.get("assignment_status", "completed") == "completed"]
    groups_present = {r.get("qgroup", "") for r in completed}
    roster = defaultdict(set)
    whole_raw = defaultdict(lambda: defaultdict(dict))
    fields = defaultdict(lambda: defaultdict(dict))

    for row in completed:
        group = row.get("qgroup", "")
        if group not in GROUPS:
            continue
        video = row.get("video_id") or row.get("seq") or row.get("filename")
        ann = row.get("annotator_name") or row.get("annotator_id") or "?"
        roster[group].add(ann)
        if group == "N" or not row.get("slots"):
            value = row.get("verdict") or row.get("effective_answer") or "<MISSING>"
            unit = (video, row.get("draft_id", ""))
            whole_raw[(group, "verdict")][unit][ann] = value
            fields[(group, "verdict", "verdict")][unit][ann] = value
            continue
        version = row.get("codebook_version", "")
        signature = slot_signature(row["slots"], version)
        unit = (video, row.get("draft_id", ""))
        whole_raw[(group, version)][unit][ann] = signature
        try:
            parsed = json.loads(row["slots"])
        except json.JSONDecodeError:
            parsed = row["slots"]
        for field, value in flatten_fields(parsed):
            # Optional fields are omitted by the same codebook policy as the tuple method.
            if field.split(".")[-1] in optional_cell_ids(version):
                continue
            key = (group, version, field)
            fields[key][(video, row.get("draft_id", ""))][ann] = value

    out.mkdir(parents=True, exist_ok=True)
    # Flatten collected annotations into units; only units with at least 2 raters count.
    def unit_map(raw, panel):
        by_video = defaultdict(list)
        for (video, _draft), values in raw.items():
            if all(annotator in values for annotator in panel):
                by_video[video].append([values[annotator] for annotator in panel])
        return dict(by_video)

    whole = []
    group_rows = []
    for group in GROUPS:
        versions = sorted(version for g, version in whole_raw if g == group) or [""]
        if group not in groups_present:
            group_rows.append([group, "MISSING", "n/a", 0, 0, math.nan, math.nan, math.nan, "0/0"])
            continue
        for version in versions:
            raw = whole_raw.get((group, version), {})
            panels = list(itertools.combinations(sorted(roster[group]), 4))
            for panel in panels:
                units_per_video = unit_map(raw, panel)
                units = [u for v in units_per_video.values() for u in v]
                estimate = alpha(units)
                lo, hi = bootstrap_ci(units_per_video, draws, seed)
                panel_name = ", ".join(panel)
                group_rows.append([group, version or "verdict", panel_name, len(units), len(units_per_video), estimate, lo, hi, f"{len(units)}/{len(raw)}"])
                whole.append((group, version, panel_name, len(units), len(units_per_video), estimate, lo, hi))

    field_rows = []
    for (group, version, field), raw in sorted(fields.items()):
        if "@" in field:
            # Entity matching marks an unpaired party with an annotator-specific
            # suffix; it cannot form a comparable field across annotators.
            continue
        for panel in itertools.combinations(sorted(roster[group]), 4):
            units_per_video = unit_map(raw, panel)
            units = [u for v in units_per_video.values() for u in v]
            estimate = alpha(units)
            lo, hi = bootstrap_ci(units_per_video, draws, seed)
            field_rows.append([group, version or "verdict", ", ".join(panel), field, len(units), len(units_per_video), fmt(estimate), f"[{fmt(lo)}, {fmt(hi)}]"])

    lines = ["# Báo cáo độ đồng thuận", "", f"- Nguồn: `{source}`", f"- Bản ghi: {len(rows)}; hoàn thành: {len(completed)}; loại chưa hoàn thành: {len(rows)-len(completed)}.", f"- Bootstrap: {draws:,} lần theo video; CI percentile 95%; seed={seed}.", f"- Ghép danh tính thực thể: {entity_match_note}.", "- Roster nhóm: " + "; ".join(f"{g}: {', '.join(sorted(roster[g])) or 'không có'} ({len(roster[g])} người)" for g in GROUPS), "", "## Cách 1: alpha riêng từng ô nhãn", "", "Đơn vị là một ô trong một câu trả lời; các ô nhiều lựa chọn được xem là một tập. Mỗi tổ hợp bốn annotator được tính riêng. CI lấy mẫu lại video.", "", "| Nhóm | Codebook | Tổ hợp 4 người | Ô | Đơn vị | Video | Alpha | CI 95% |", "|---|---|---|---|---:|---:|---:|---:|"]
    lines += [f"| {g} | {v} | {panel} | {cell} | {n} | {nv} | {a} | {ci} |" for g, v, panel, cell, n, nv, a, ci in field_rows]
    lines += ["", "## Cách 2: alpha trên toàn bộ nhãn của nhóm", "", "Mỗi câu trả lời cấu trúc được giữ nguyên thành một nhãn danh nghĩa; áp dụng quy tắc ô optional và điều kiện codebook. Mỗi dòng là một tổ hợp 4 annotator.", "", "| Nhóm | Codebook | Tổ hợp 4 người | Đơn vị | Video | Alpha | CI 95% |", "|---|---|---|---:|---:|---:|---:|"]
    lines += [f"| {g} | {v} | {panel} | {n} | {nv} | {fmt(a)} | [{fmt(lo)}, {fmt(hi)}] |" for g, v, panel, n, nv, a, lo, hi, _coverage in group_rows]
    lines += ["", "## Diễn giải dữ liệu", "", "Mỗi tổ hợp gồm bốn trong số năm annotator của file; tổ hợp chỉ tính một video khi có đủ cả bốn câu trả lời. Vì vậy số video trên mỗi dòng thể hiện mức bao phủ đầy đủ của tổ hợp đó.", "Alpha không xác định khi không có bất đồng kỳ vọng (mọi đơn vị chỉ có cùng một nhãn). Cận CI không xác định khi có dưới 3 video.", ""]
    report = out / "agreement_report.md"
    report.write_text("\n".join(lines), encoding="utf-8")
    with (out / "agreement_report.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["method", "qgroup", "codebook", "annotators", "field", "units", "videos", "alpha", "ci95_low", "ci95_high", "coverage"])
        for g, v, panel, cell, n, nv, a, ci in field_rows:
            lo, hi = ci.strip("[]").split(", ")
            writer.writerow(["field", g, v, panel, cell, n, nv, a, lo, hi, ""])
        for g, v, panel, n, nv, a, lo, hi, coverage in group_rows:
            writer.writerow(["whole_group", g, v, panel, "", n, nv, fmt(a), fmt(lo), fmt(hi), coverage])
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
