#!/usr/bin/env python3
"""Audit structured multiple-choice disagreements by question group and video.

Writes an annotator-by-question detail CSV plus video and annotator summaries.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from functools import lru_cache

import numpy as np
import pandas as pd

from iaa_round import kripp_alpha, nominal, pairwise_counts, slot_signature


GROUP_COLUMNS = ["qgroup", "codebook_version", "video_id", "draft_id"]


def decode(value):
    if value == "<MISSING>":
        return value
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return value


def differing_paths(left, right, path="$"):
    if type(left) is not type(right):
        return [path]
    if isinstance(left, dict):
        paths = []
        for key in sorted(set(left) | set(right)):
            child = f"{path}.{key}"
            if key not in left or key not in right:
                paths.append(child)
            else:
                paths.extend(differing_paths(left[key], right[key], child))
        return paths
    if isinstance(left, list):
        if all(isinstance(item, dict) and "key" in item for item in left + right):
            left_by_key = {item["key"]: item for item in left}
            right_by_key = {item["key"]: item for item in right}
            if len(left_by_key) == len(left) and len(right_by_key) == len(right):
                paths = []
                for key in sorted(set(left_by_key) | set(right_by_key)):
                    child = f"{path}[key={key}]"
                    if key not in left_by_key or key not in right_by_key:
                        paths.append(child)
                    else:
                        paths.extend(differing_paths(left_by_key[key], right_by_key[key], child))
                return paths
        paths = []
        for index in range(max(len(left), len(right))):
            child = f"{path}[{index}]"
            if index >= len(left) or index >= len(right):
                paths.append(child)
            else:
                paths.extend(differing_paths(left[index], right[index], child))
        return paths
    return [] if left == right else [path]


def unique_plurality(counts):
    if not counts:
        return "", 0, False
    top = max(counts.values())
    winners = [answer for answer, count in counts.items() if count == top]
    return (winners[0], top, True) if len(winners) == 1 else ("", top, False)


@lru_cache(maxsize=None)
def codebook_labels(codebook_version):
    """Return display labels for codebook cells and their selectable options."""
    path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "codebook", f"{codebook_version}.json",
    )
    if not os.path.isfile(path):
        return {}, {}
    with open(path, encoding="utf-8") as handle:
        codebook = json.load(handle)

    cells = {}
    options = {}
    # Expand labels that need context to be unambiguous in the audit report.
    display_overrides = {
        "conflict_type.k13": "K13 - Quay đầu giữa đường, không ở giao lộ",
        "conflict_type.k14": "K14 - Băng ngang đường giữa đoạn, không ở giao lộ",
    }
    for cell in codebook.get("cells", []):
        cells[cell["id"]] = cell.get("label", cell["id"])
        for option in cell.get("options", []):
            option_id = option.get("id")
            if option_id:
                code = option.get("code")
                label = option.get("label", option_id)
                options[option_id] = display_overrides.get(
                    option_id, f"{code} - {label}" if code else label,
                )
    return cells, options


def format_answer_lines(value, codebook_version, indent="      "):
    """Render selected choices as one labeled field per terminal line."""
    answer = decode(value)
    if not isinstance(answer, dict):
        return [f"{indent}{answer}"]

    cell_labels, option_labels = codebook_labels(codebook_version)

    def format_selection(selection):
        if isinstance(selection, dict):
            if "options" in selection:
                selected = [option_labels.get(item, item) for item in selection["options"]]
                display = ", ".join(selected) or "(chưa chọn)"
            elif "option" in selection:
                option_id = selection["option"]
                display = option_labels.get(option_id, option_id)
            elif "entity" in selection:
                display = selection["entity"]
            else:
                display = json.dumps(selection, ensure_ascii=False, sort_keys=True)
            if selection.get("text"):
                display += f" ({selection['text']})"
            return display
        if isinstance(selection, list):
            return ", ".join(format_selection(item) for item in selection)
        return str(selection)

    lines = []
    entities = answer.get("entities")
    if isinstance(entities, list):
        for index, entity in enumerate(entities, start=1):
            if not isinstance(entity, dict):
                lines.append(f"{indent}Thực thể {index}: {entity}")
                continue
            key = entity.get("key", str(index))
            lines.append(f"{indent}Bên {key}:")
            cells = entity.get("cells", {})
            if not isinstance(cells, dict) or not cells:
                lines.append(f"{indent}  (không có trường lựa chọn)")
                continue
            for cell_id, selection in cells.items():
                field_label = cell_labels.get(cell_id, cell_id)
                lines.append(f"{indent}  {field_label}: {format_selection(selection)}")
        return lines or [f"{indent}(không có thực thể nào)"]

    for cell_id, selection in answer.items():
        field_label = cell_labels.get(cell_id, cell_id)
        if cell_id == "parties" and isinstance(selection, list):
            for party in selection:
                if not isinstance(party, dict):
                    lines.append(f"{indent}{field_label}: {party}")
                    continue
                reference = party.get("party", {})
                entity = reference.get("entity") or option_labels.get(
                    reference.get("option"), reference.get("option", "?")
                )
                action = party.get("action", party.get("behavior", {}))
                action_id = action.get("option") if isinstance(action, dict) else None
                action_label = option_labels.get(action_id, action_id or "(chưa chọn)")
                if "behavior" in party and isinstance(action, dict):
                    selected = action.get("options", [action_id] if action_id else [])
                    action_label = ", ".join(option_labels.get(item, item) for item in selected) or "(chưa chọn)"
                    if action.get("text"):
                        action_label += f": {action['text']}"
                lines.append(f"{indent}Bên {entity}: {action_label}")
            continue

        display = format_selection(selection)
        lines.append(f"{indent}{field_label}: {display}")
    return lines or [f"{indent}(không có trường lựa chọn)"]


def format_difference_paths(raw_paths, codebook_version):
    """Replace JSON paths with the labels annotators see in the form."""
    cell_labels, _ = codebook_labels(codebook_version)
    display = []
    for path in raw_paths.split(";"):
        path = path.strip()
        if not path:
            continue
        if path.startswith("$.entities[key="):
            entity_part, _, field_part = path[len("$.entities[key="):].partition("].cells.")
            if field_part:
                cell_id = field_part.split(".", 1)[0]
                display.append(f"Bên {entity_part} - {cell_labels.get(cell_id, cell_id)}")
                continue
            display.append(f"Bên {entity_part} - thực thể")
            continue
        cell_id = path[2:].split(".", 1)[0] if path.startswith("$.") else path
        display.append(cell_labels.get(cell_id, {
            "parties": "Các bên",
        }.get(cell_id, path)))
    return list(dict.fromkeys(display))


def field_values(raw, codebook_version):
    """Break per-entity answers into comparable nominal fields when available."""
    answer = decode(slot_signature(raw, codebook_version))
    if isinstance(answer, dict) and isinstance(answer.get("entities"), list):
        fields = {"entities.count": str(len(answer["entities"]))}
        for entity in answer["entities"]:
            key = entity.get("key", "?")
            for cell, value in entity.get("cells", {}).items():
                fields[f"entity[{key}].{cell}"] = json.dumps(
                    value, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                )
        return fields
    return {"$": slot_signature(raw, codebook_version)}


@lru_cache(maxsize=None)
def codebook_aspects(codebook_version):
    """Map selectable cell IDs and display labels to their codebook metadata."""
    path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "codebook", f"{codebook_version}.json",
    )
    if not os.path.isfile(path):
        raise ValueError(f"Không tìm thấy codebook {codebook_version}: {path}")
    with open(path, encoding="utf-8") as handle:
        codebook = json.load(handle)
    return {
        cell["id"]: cell.get("label", cell["id"])
        for cell in codebook.get("cells", [])
        if "id" in cell
    }


def normalized_aspect(value):
    return " ".join(str(value).casefold().split())


def resolve_aspects(requested, versions):
    """Resolve CLI aspect names or IDs against the selected codebook versions."""
    available = {}
    for version in versions:
        for cell_id, label in codebook_aspects(version).items():
            available.setdefault(normalized_aspect(cell_id), (cell_id, label))
            available.setdefault(normalized_aspect(label), (cell_id, label))

    resolved = []
    unknown = []
    for item in requested:
        for value in item.split(","):
            value = value.strip()
            if not value:
                continue
            match = available.get(normalized_aspect(value))
            if match is None:
                unknown.append(value)
            elif match not in resolved:
                resolved.append(match)
    if unknown:
        choices = ", ".join(label for _, label in available.values())
        raise ValueError(
            "Không tìm thấy khía cạnh: " + ", ".join(unknown)
            + ". Khía cạnh hợp lệ trong phạm vi này: " + choices
        )
    if not resolved:
        raise ValueError("--aspects cần ít nhất một tên khía cạnh hoặc mã ô hợp lệ.")
    return resolved


def remove_aspect_cells(signature, excluded_ids):
    """Remove selected codebook cells from an already canonical slot signature."""
    answer = decode(signature)

    def remove(node):
        if isinstance(node, dict):
            return {
                key: remove(value)
                for key, value in node.items()
                if key not in excluded_ids
            }
        if isinstance(node, list):
            return [remove(value) for value in node]
        return node

    return json.dumps(remove(answer), ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sensitivity_metrics(units):
    pair_agree, pair_total = pairwise_counts(units)
    assessable = [unit for unit in units if len(unit) >= 2]
    unanimous = sum(len(set(unit)) == 1 for unit in assessable)
    return {
        "questions": len(assessable),
        "pairwise_exact_agreement": pair_agree / pair_total if pair_total else np.nan,
        "krippendorff_alpha_nominal": kripp_alpha(assessable, nominal),
        "pct_unanimous_questions": unanimous / len(assessable) if assessable else np.nan,
    }


def print_aspect_sensitivity(data, aspects):
    """Print agreement after excluding each requested aspect, separately by group/version."""
    labels_by_version = {
        version: codebook_aspects(version)
        for version in data["codebook_version"].drop_duplicates()
    }
    rows = []
    for (qgroup, version), group in data.groupby(
        ["qgroup", "codebook_version"], dropna=False, sort=False,
    ):
        applicable = [
            (cell_id, labels_by_version[version].get(cell_id, label))
            for cell_id, label in aspects
            if cell_id in labels_by_version[version]
        ]
        variants = [("Đầy đủ", frozenset())]
        variants.extend((f"Bỏ {label}", frozenset({cell_id})) for cell_id, label in applicable)
        if len(applicable) > 1:
            variants.append((
                "Bỏ tất cả: " + ", ".join(label for _, label in applicable),
                frozenset(cell_id for cell_id, _ in applicable),
            ))

        for variant, excluded in variants:
            units = []
            for _, question in group.groupby("draft_id", sort=False):
                signatures = question["slot_value"].tolist()
                if excluded:
                    signatures = [remove_aspect_cells(value, excluded) for value in signatures]
                units.append(signatures)
            metrics = sensitivity_metrics(units)
            rows.append({
                "qgroup": qgroup,
                "codebook_version": version,
                "variant": variant,
                **metrics,
            })

    result = pd.DataFrame(rows)
    print("\n" + "=" * 88)
    print("PHÂN TÍCH ĐỘ NHẠY THEO KHÍA CẠNH")
    print("Alpha danh nghĩa và đồng thuận cặp được tính lại trên cùng tập câu hỏi.")
    for (qgroup, version), group in result.groupby(
        ["qgroup", "codebook_version"], sort=False,
    ):
        print("\n" + "-" * 88)
        print(f"NHÓM {qgroup} | {version}")
        baseline = group.iloc[0]
        print(f"{'Kịch bản':<42} {'Alpha':>9} {'Δ alpha':>10} {'Cặp khớp':>11} {'Δ điểm %':>10} {'Nhất trí':>10}")
        print("-" * 96)
        for _, row in group.iterrows():
            alpha = row["krippendorff_alpha_nominal"]
            base_alpha = baseline["krippendorff_alpha_nominal"]
            exact = row["pairwise_exact_agreement"]
            base_exact = baseline["pairwise_exact_agreement"]
            delta_alpha = alpha - base_alpha if pd.notna(alpha) and pd.notna(base_alpha) else np.nan
            delta_exact = (exact - base_exact) * 100 if pd.notna(exact) and pd.notna(base_exact) else np.nan
            print(
                f"{row['variant'][:42]:<42} "
                f"{alpha:>9.3f} {delta_alpha:>+10.3f} "
                f"{exact * 100:>10.1f}% {delta_exact:>+9.1f}pp "
                f"{row['pct_unanimous_questions'] * 100:>9.1f}%"
            )
        print(f"Số câu có ít nhất 2 người chấm: {int(baseline['questions'])}")
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description="Audit multiple-choice disagreements per group and video.")
    parser.add_argument("csv", help="answer export CSV")
    parser.add_argument("--out", default="iaa_audit")
    parser.add_argument("--groups", nargs="+", metavar="QGROUP", help="audit only these question groups")
    parser.add_argument("--aspects", nargs="+", metavar="ASPECT",
                        help="compare agreement after excluding each named codebook cell; accepts labels or IDs")
    parser.add_argument("--include-unfinished", action="store_true",
                        help="include rows where assignment_status is not completed")
    args = parser.parse_args(argv)

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    source = pd.read_csv(args.csv, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    required = {"answer_format", "slots", "qgroup", "codebook_version", "video_id", "draft_id",
                "annotator_id", "annotator_name", "filename"}
    missing = sorted(required - set(source.columns))
    if missing:
        raise ValueError("CSV thiếu cột bắt buộc: " + ", ".join(missing))

    data = source[source["answer_format"].str.casefold() == "slots"].copy()
    if not args.include_unfinished and "assignment_status" in data:
        data = data[data["assignment_status"].str.casefold() == "completed"].copy()
    if args.groups:
        wanted = {group.casefold() for group in args.groups}
        available = set(data["qgroup"].str.casefold())
        unknown = wanted - available
        if unknown:
            raise ValueError("Không tìm thấy nhóm: " + ", ".join(sorted(unknown)))
        data = data[data["qgroup"].str.casefold().isin(wanted)].copy()
    if data.empty:
        raise ValueError("Không có câu trả lời multiple-choice trong phạm vi đã chọn.")

    # Keep the same video sequence as the admin export (seq/# on the page).
    if "seq" in data.columns:
        data["_audit_source_order"] = pd.to_numeric(data["seq"], errors="coerce")
        data = data.sort_values("_audit_source_order", kind="stable", na_position="last")
        data = data.drop(columns=["_audit_source_order"])

    data["slot_value"] = data.apply(
        lambda row: slot_signature(row["slots"], row["codebook_version"]), axis=1,
    )
    aspect_sensitivity = None
    if args.aspects:
        aspects = resolve_aspects(
            args.aspects, data["codebook_version"].drop_duplicates().tolist(),
        )
        aspect_sensitivity = print_aspect_sensitivity(data, aspects)
    for column in GROUP_COLUMNS:
        if column not in data:
            data[column] = ""

    detail_rows = []
    video_rows = []
    field_units = {}
    unit_groups = list(data.groupby(GROUP_COLUMNS, dropna=False, sort=False))
    for keys, unit in unit_groups:
        qgroup, version, video_id, draft_id = keys
        values = unit["slot_value"].tolist()
        counts = Counter(values)
        group_answer, group_votes, group_has_plurality = unique_plurality(counts)
        disagreement = len(counts) > 1
        filename = unit["filename"].iloc[0]
        question = unit["question"].iloc[0] if "question" in unit else ""
        per_answer_fields = [
            field_values(row.slots, row.codebook_version)
            for row in unit[["slots", "codebook_version"]].itertuples(index=False)
        ]
        for field_path in set().union(*(fields.keys() for fields in per_answer_fields)):
            field_answers = [fields[field_path] for fields in per_answer_fields if field_path in fields]
            if len(field_answers) >= 2:
                field_key = (qgroup, version, video_id, field_path)
                field_units.setdefault(field_key, []).append(field_answers)

        for index, row in enumerate(unit.itertuples(index=False)):
            others = values[:index] + values[index + 1:]
            other_answer, other_votes, other_has_plurality = unique_plurality(Counter(others))
            if len(values) < 2:
                status = "không đủ người khác để đối chiếu"
            elif not group_has_plurality:
                status = "không có đa số duy nhất trong cả nhóm"
            elif values[index] != group_answer:
                status = "bất đồng với đa số nhóm"
            else:
                status = "khớp đa số nhóm"

            paths = []
            if status == "bất đồng với đa số nhóm":
                paths = differing_paths(decode(values[index]), decode(group_answer))
            detail_rows.append({
                "qgroup": qgroup,
                "codebook_version": version,
                "video_id": video_id,
                "filename": filename,
                "draft_id": draft_id,
                "question": question,
                "annotator_id": row.annotator_id,
                "annotator_name": row.annotator_name,
                "answer": values[index],
                "n_annotators": len(values),
                "n_distinct_answers": len(counts),
                "question_has_disagreement": disagreement,
                "group_plurality_answer": group_answer,
                "group_plurality_votes": group_votes,
                "group_has_unique_plurality": group_has_plurality,
                "others_plurality_answer": other_answer,
                "others_plurality_votes": other_votes,
                "others_have_unique_plurality": other_has_plurality,
                "dissent_status": status,
                "difference_paths_from_group_plurality": "; ".join(paths),
            })

    detail = pd.DataFrame(detail_rows)
    video_columns = ["qgroup", "codebook_version", "video_id", "filename"]
    for keys, group in data.groupby(video_columns, dropna=False, sort=False):
        qgroup, version, video_id, filename = keys
        units = [unit["slot_value"].tolist() for _, unit in group.groupby("draft_id", sort=False)]
        agrees, pairs = pairwise_counts(units)
        question_counts = [len(set(unit)) for unit in units]
        alpha = kripp_alpha(units, nominal)
        video_rows.append({
            "qgroup": qgroup,
            "codebook_version": version,
            "video_id": video_id,
            "filename": filename,
            "n_questions": len(units),
            "questions_with_disagreement": sum(count > 1 for count in question_counts),
            "unanimous_questions": sum(count == 1 for count in question_counts),
            "pct_unanimous_questions": round(sum(count == 1 for count in question_counts) / len(units), 4),
            "pairwise_exact_agreement": round(agrees / pairs, 4) if pairs else np.nan,
            "krippendorff_alpha_nominal": round(alpha, 4) if not np.isnan(alpha) else np.nan,
        })
    video_summary = pd.DataFrame(video_rows)

    field_rows = []
    for (qgroup, version, video_id, field_path), units in sorted(field_units.items()):
        agrees, pairs = pairwise_counts(units)
        alpha = kripp_alpha(units, nominal)
        field_rows.append({
            "qgroup": qgroup,
            "codebook_version": version,
            "video_id": video_id,
            "field_path": field_path,
            "n_questions": len(units),
            "n_annotations": sum(len(unit) for unit in units),
            "pairwise_exact_agreement": round(agrees / pairs, 4) if pairs else np.nan,
            "krippendorff_alpha_nominal": round(alpha, 4) if not np.isnan(alpha) else np.nan,
        })
    field_summary = pd.DataFrame(field_rows)

    dissent = detail[detail["dissent_status"] == "bất đồng với đa số nhóm"]
    assessable = detail[detail["dissent_status"].isin([
        "bất đồng với đa số nhóm", "khớp đa số nhóm",
    ])]
    annotator_group = ["qgroup", "codebook_version", "video_id", "annotator_id", "annotator_name"]
    all_people = detail.groupby(annotator_group, dropna=False).size().rename("questions_seen").reset_index()
    dissent_counts = dissent.groupby(annotator_group, dropna=False).size().rename("dissent_count").reset_index()
    assessed_counts = assessable.groupby(annotator_group, dropna=False).size().rename("assessable_questions").reset_index()
    annotator_summary = all_people.merge(dissent_counts, how="left", on=annotator_group).merge(
        assessed_counts, how="left", on=annotator_group,
    )
    annotator_summary["dissent_count"] = annotator_summary["dissent_count"].fillna(0).astype(int)
    annotator_summary["assessable_questions"] = annotator_summary["assessable_questions"].fillna(0).astype(int)
    annotator_summary["dissent_rate_vs_group_plurality"] = annotator_summary.apply(
        lambda row: round(row["dissent_count"] / row["assessable_questions"], 4)
        if row["assessable_questions"] else np.nan,
        axis=1,
    )

    os.makedirs(args.out, exist_ok=True)
    detail_path = os.path.join(args.out, "slot_audit_detail.csv")
    video_path = os.path.join(args.out, "slot_audit_video_summary.csv")
    annotator_path = os.path.join(args.out, "slot_audit_annotator_summary.csv")
    field_path = os.path.join(args.out, "slot_audit_field_summary.csv")
    detail.to_csv(detail_path, index=False, encoding="utf-8-sig")
    video_summary.to_csv(video_path, index=False, encoding="utf-8-sig")
    annotator_summary.to_csv(annotator_path, index=False, encoding="utf-8-sig")
    field_summary.to_csv(field_path, index=False, encoding="utf-8-sig")
    aspect_path = None
    if aspect_sensitivity is not None:
        aspect_path = os.path.join(args.out, "slot_audit_aspect_sensitivity.csv")
        aspect_sensitivity.to_csv(aspect_path, index=False, encoding="utf-8-sig")

    print(f"Audited {sum(row['n_questions'] for row in video_rows)} selected-choice questions across {len(video_summary)} group/video pairs.")
    print(f"Question-person detail: {detail_path}")
    print(f"Per-video summary:      {video_path}")
    print(f"Per-annotator summary:  {annotator_path}")
    print(f"Per-field summary:      {field_path}")
    if aspect_path:
        print(f"Aspect sensitivity:     {aspect_path}")
    print("Agreement and audit differences ignore every codebook cell marked required=false.")
    print("Rows marked 'bất đồng với đa số nhóm' identify answers outside a unique group majority.")

    print("\n" + "=" * 88)
    print("CHI TIẾT CÂU CÓ BẤT ĐỒNG")
    print("=" * 88)
    video_order = {}
    for (qgroup, version), group_videos in video_summary.groupby(
        ["qgroup", "codebook_version"], sort=False,
    ):
        total_videos = len(group_videos)
        for number, video_id in enumerate(group_videos["video_id"], start=1):
            video_order[(qgroup, version, video_id)] = (number, total_videos)

    disagreements = detail[detail["question_has_disagreement"]].copy()
    if disagreements.empty:
        print("Không có câu nào bất đồng.")
    else:
        question_columns = ["qgroup", "codebook_version", "video_id", "draft_id"]
        for keys, question_rows in disagreements.groupby(question_columns, dropna=False, sort=False):
            qgroup, version, video_id, draft_id = keys
            first = question_rows.iloc[0]
            print("\n" + "-" * 88)
            video_number, total_videos = video_order[(qgroup, version, video_id)]
            print(
                f"VIDEO {video_number:02d}/{total_videos:02d} | "
                f"NHÓM {qgroup} | {version} | {first['filename']}"
            )
            print(f"Video ID: {video_id}")
            if first["question"]:
                print(f"Câu hỏi: {first['question']}")

            if bool(first["group_has_unique_plurality"]):
                print(
                    f"ĐA SỐ NHÓM: {int(first['group_plurality_votes'])}/"
                    f"{int(first['n_annotators'])} người chọn"
                )
                print("  Câu trả lời đa số:")
                print("\n".join(format_answer_lines(
                    first["group_plurality_answer"], version,
                )))
                question_dissenters = question_rows[
                    question_rows["dissent_status"] == "bất đồng với đa số nhóm"
                ]
                if question_dissenters.empty:
                    print("  Không có người nằm ngoài đa số duy nhất.")
                for _, row in question_dissenters.iterrows():
                    raw_paths = row["difference_paths_from_group_plurality"]
                    paths = format_difference_paths(raw_paths, version)
                    print(f"\n  NGƯỜI BẤT ĐỒNG: {row['annotator_name']}")
                    print("    Trường khác: " + (", ".join(paths) if paths else "không xác định được"))
                    print("    Câu trả lời của người này:")
                    print("\n".join(format_answer_lines(row["answer"], version)))
            else:
                print("KHÔNG CÓ ĐA SỐ DUY NHẤT. Câu trả lời của từng người:")
                for _, row in question_rows.iterrows():
                    print(f"\n  {row['annotator_name']}:")
                    print("\n".join(format_answer_lines(row["answer"], version)))

    print("\n" + "=" * 88)
    print("HẾT BÁO CÁO CHI TIẾT")
    print("=" * 88)


if __name__ == "__main__":
    main()
