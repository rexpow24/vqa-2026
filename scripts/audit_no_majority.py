"""Print S/E/C videos without a strict whole-group majority, with each person's labels."""

import argparse
import json
from collections import Counter
from pathlib import Path

import pandas as pd

from entity_match import apply_entity_match
from iaa_round import slot_signature


DEFAULT_PEOPLE = ("Đức Mạnh", "Huỳnh Trung", "Nhật Trường", "Tuyết Hạnh")
FIELD_NAMES = {
    "weather": "Thời tiết", "light": "Ánh sáng", "road_type": "Loại đường",
    "segment": "Đoạn đường", "surface": "Mặt đường",
    "surface_material": "Chất liệu mặt đường", "density": "Mật độ xe",
    "event_type": "Loại sự kiện", "subject": "Chủ thể",
    "conflict_type": "Kiểu xung đột K", "action": "Hành động",
    "object": "Đối tượng", "entities.count": "Số thực thể",
    "type": "Loại", "vehicle_color": "Màu", "dashcam": "Camera hành trình",
}


def options_by_id(book):
    result = {}

    def walk(item):
        if isinstance(item, dict):
            if "id" in item and "label" in item:
                result[item["id"]] = item
            for value in item.values():
                walk(value)
        elif isinstance(item, list):
            for value in item:
                walk(value)

    walk(book)
    return result


def flatten(group, value):
    if group != "E":
        return value
    result = {"entities.count": len(value.get("entities", []))}
    for entity in value.get("entities", []):
        for field, selection in entity.get("cells", {}).items():
            result[f"{entity['key']}.{field}"] = selection
    return result


def label(selection, lookup):
    if isinstance(selection, int):
        return str(selection)
    if isinstance(selection, dict) and "option" in selection:
        option = selection["option"]
        found = lookup.get(option, {})
        name = found.get("label", option)
        return f"{found['code']} - {name}" if found.get("code") else name
    if isinstance(selection, dict) and "entity" in selection:
        return str(selection["entity"])
    return json.dumps(selection, ensure_ascii=False, sort_keys=True)


def field_name(field):
    if len(field) > 2 and field[0] in "AB" and field[1] == ".":
        entity, name = field.split(".", 1)
        return f"{entity}: {FIELD_NAMES.get(name, name)}"
    return FIELD_NAMES.get(field, field)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("csvs/answers-agreement.csv"))
    parser.add_argument("--start", type=int, default=41)
    parser.add_argument("--end", type=int, default=60)
    parser.add_argument("--group", choices=("S", "E", "C"), action="append")
    parser.add_argument("--people", default=",".join(DEFAULT_PEOPLE),
                        help="Tên annotator, ngăn cách bằng dấu phẩy")
    args = parser.parse_args()
    people = tuple(name.strip() for name in args.people.split(",") if name.strip())
    if len(people) < 2 or len(set(people)) != len(people):
        parser.error("--people cần ít nhất hai tên khác nhau")
    if args.start > args.end:
        parser.error("--start phải nhỏ hơn hoặc bằng --end")
    if not args.source.is_file():
        parser.error(f"Không thấy CSV: {args.source}")

    groups = tuple(group for group in ("S", "E", "C") if not args.group or group in args.group)
    data = pd.read_csv(args.source, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    required = {"seq", "qgroup", "annotator_name", "assignment_status", "slots",
                "codebook_version", "filename"}
    missing = required - set(data.columns)
    if missing:
        parser.error("CSV thiếu cột: " + ", ".join(sorted(missing)))
    seq = pd.to_numeric(data["seq"], errors="coerce")
    data = data[
        seq.between(args.start, args.end)
        & data["qgroup"].isin(("S", "E", "C"))
        & data["annotator_name"].isin(people)
        & data["assignment_status"].eq("completed")
    ].copy()
    if data.empty:
        parser.error("Không có câu trả lời completed trong phạm vi đã chọn")
    duplicates = data.duplicated(["qgroup", "seq", "annotator_name"])
    if duplicates.any():
        parser.error("CSV có nhiều câu trả lời completed của cùng người cho một video/nhóm")
    data, _ = apply_entity_match(data, "identity", False)
    books = {
        group: options_by_id(json.loads((Path("codebook") / f"{version}.json").read_text(encoding="utf-8")))
        for group, version in (("S", "S.v3"), ("E", "E.v6"), ("C", "C.v4"))
        if group in groups
    }

    print(f"Video #{args.start}-#{args.end} | completed | {', '.join(people)}")
    print("Quá bán = hơn một nửa người chọn cùng đáp án toàn bộ nhóm.")
    print("Chỉ hiện ô bất đồng; '-' là không có đáp án hoặc ô không áp dụng.\n")
    for group in groups:
        cases = []
        for seq, batch in data[data["qgroup"].eq(group)].groupby("seq", sort=False):
            if len(batch) < 2:
                continue
            answers = {
                row.annotator_name: flatten(group, json.loads(slot_signature(row.slots, row.codebook_version)))
                for row in batch.itertuples(index=False)
            }
            signatures = [json.dumps(answer, ensure_ascii=False, sort_keys=True) for answer in answers.values()]
            top = Counter(signatures).most_common(1)[0][1]
            if top > len(answers) / 2:
                continue
            fields = sorted(set().union(*(answer.keys() for answer in answers.values())))
            disputed = [field for field in fields if len({
                json.dumps(answer.get(field), ensure_ascii=False, sort_keys=True)
                for answer in answers.values()
            }) > 1]
            cases.append((int(seq), batch.iloc[0]["filename"], len(answers), top, answers, disputed))

        print(f"NHÓM {group}: {len(cases)} video không có quá bán")
        print("Video: " + (", ".join(f"#{case[0]}" for case in sorted(cases)) or "không có"))
        for seq, filename, count, top, answers, disputed in sorted(cases):
            print(f"\n#{seq} | {filename} | nhóm lớn nhất {top}/{count}")
            for field in disputed:
                print(f"  {field_name(field)}:")
                for person in people:
                    value = answers.get(person, {}).get(field)
                    shown = label(value, books[group]) if value is not None else "-"
                    print(f"    {person}: {shown}")
        print()


if __name__ == "__main__":
    main()
