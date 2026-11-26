"""Compare group S agreement before and after omitting selected codebook cells."""

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

from audit_slot_disagreements import (
    codebook_aspects,
    remove_aspect_cells,
    resolve_aspects,
    sensitivity_metrics,
)
from iaa_round import slot_signature


DEFAULT_PEOPLE = ("Đức Mạnh", "Huỳnh Trung", "Nhật Trường", "Tuyết Hạnh")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("csvs/answers-agreement.csv"))
    parser.add_argument("--start", type=int, default=41)
    parser.add_argument("--end", type=int, default=60)
    parser.add_argument("--version", default="S.v3")
    parser.add_argument("--people", default=",".join(DEFAULT_PEOPLE),
                        help="Tên annotator, ngăn cách bằng dấu phẩy")
    parser.add_argument("--drop", nargs="+", metavar="CELL",
                        help="Mã hoặc tên ô cần bỏ khi tính lại, ví dụ: density surface")
    args = parser.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if args.start > args.end:
        parser.error("--start phải nhỏ hơn hoặc bằng --end")
    if not args.source.is_file():
        parser.error(f"Không thấy CSV: {args.source}")
    available = codebook_aspects(args.version)
    if not available:
        parser.error(f"Không thấy codebook cho {args.version}")
    people = tuple(name.strip() for name in args.people.split(",") if name.strip())
    if len(people) < 2 or len(set(people)) != len(people):
        parser.error("--people cần ít nhất hai tên khác nhau")
    try:
        selected = resolve_aspects(args.drop, [args.version]) if args.drop else list(available.items())
    except ValueError as exc:
        parser.error(str(exc))

    data = pd.read_csv(args.source, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    required = {"seq", "qgroup", "codebook_version", "annotator_name",
                "assignment_status", "draft_id", "slots"}
    missing = required - set(data.columns)
    if missing:
        parser.error("CSV thiếu cột: " + ", ".join(sorted(missing)))
    seq = pd.to_numeric(data["seq"], errors="coerce")
    data = data[
        seq.between(args.start, args.end)
        & data["qgroup"].eq("S")
        & data["codebook_version"].eq(args.version)
        & data["annotator_name"].isin(people)
        & data["assignment_status"].eq("completed")
    ].copy()
    if data.empty:
        parser.error("Không có câu trả lời S completed trong phạm vi đã chọn")
    if data.duplicated(["draft_id", "annotator_name"]).any():
        parser.error("CSV có nhiều câu trả lời completed của cùng người cho một câu hỏi")

    data["signature"] = data["slots"].map(lambda value: slot_signature(value, args.version))
    units = [batch["signature"].tolist() for _, batch in data.groupby("draft_id", sort=False)]
    units = [unit for unit in units if len(unit) >= 2]
    if not units:
        parser.error("Cần ít nhất một video có từ hai người hoàn thành")

    def print_row(name, values, baseline=None):
        metrics = sensitivity_metrics(values)
        delta = "" if baseline is None else f" ({metrics['krippendorff_alpha_nominal'] - baseline['krippendorff_alpha_nominal']:+.3f})"
        print(f"{name:<33} {metrics['krippendorff_alpha_nominal']:.3f}{delta:<9} "
              f"{metrics['pairwise_exact_agreement'] * 100:6.1f}%  "
              f"{metrics['pct_unanimous_questions'] * 100:6.1f}%")
        return metrics

    print(f"Nhóm S | {args.version} | video #{args.start}-#{args.end} | {len(units)} video đủ 2 người")
    print("Người: " + ", ".join(people))
    complete = sum(len(unit) == len(people) for unit in units)
    print(f"Có {complete}/{len(units)} video đủ {len(people)} người; video còn lại tính theo số người đã hoàn thành.")
    print("Bỏ ô chỉ thay đổi phép tính, không xóa nhãn gốc.\n")
    print(f"{'Kịch bản':<33} {'Alpha (thay đổi)':<15} {'Cặp khớp':>8}  {'Nhất trí':>8}")
    baseline = print_row("Đầy đủ", units)
    for cell_id, label in selected:
        changed = [[remove_aspect_cells(value, {cell_id}) for value in unit] for unit in units]
        print_row(f"Bỏ {label}", changed, baseline)
    if args.drop and len(selected) > 1:
        excluded = {cell_id for cell_id, _ in selected}
        changed = [[remove_aspect_cells(value, excluded) for value in unit] for unit in units]
        print_row("Bỏ chung: " + ", ".join(cell_id for cell_id, _ in selected), changed, baseline)

    print("\nAlpha riêng từng ô:")
    for cell_id, label in available.items():
        cell_units = [
            [json.dumps(json.loads(value).get(cell_id), ensure_ascii=False, sort_keys=True)
             for value in unit]
            for unit in units
        ]
        metrics = sensitivity_metrics(cell_units)
        print(f"  {label:<24} {metrics['krippendorff_alpha_nominal']:.3f} | "
              f"cặp khớp {metrics['pairwise_exact_agreement'] * 100:.1f}%")


if __name__ == "__main__":
    main()
