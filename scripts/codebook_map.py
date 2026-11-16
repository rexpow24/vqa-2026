"""P1 of the codebook migration: map free-text answers of one group (S, C, E, ...) to cells, then report coverage.

Group E answers list several parties; each party gets the same cells and coverage counts every party.

Usage (--group defaults to S; --out-dir defaults to csvs/p1 for S and csvs/p1-<group> otherwise):
    python scripts/codebook_map.py prepare answers-agreement-....csv [--group C] [--batch-size 7]
    python scripts/codebook_map.py trial [--group C] [--model gemini-3.8-flash]
    python scripts/codebook_map.py call [--group C] [--model gemini-3.8-flash] [--only C-001] [--force]
    python scripts/codebook_map.py report [--group C]
    python scripts/codebook_map.py chat [--group V]

trial    sends only the reviewed 'Chạy thử' inputs of the group as one batch and prints, cell by cell,
         the expected output next to the model's (trial_<group>.txt). Run it before any full run.

prepare  reads the export, keeps completed rows that are not NOT_ANSWERABLE, deduplicates answers
         per question (draft_id + whitespace-normalized text), groups them into batches and writes
           units.csv              one row per unique answer, with how many annotators wrote it
           requests.jsonl         one line per batch: system prompt + few-shot + batch message
           prompt_batch_001.txt   the first batch rendered in full, for review before any API call
chat     instead of `call`, through a web chat UI: for each batch without output, prints the prompt
         (system, few-shot and batch in one message) and copies it to the clipboard, reads the reply
         pasted into the terminal, validates it and appends it to outputs.jsonl exactly as `call`
         would, so `report` works unchanged. quit stops; running chat again resumes.
         Larger batches mean fewer pastes: prepare --batch-size 25.
report   reads outputs.jsonl ({"batch": ..., "text": <raw model reply>} per line), validates every item
         against the codebook and writes coverage_S.txt: per-cell M/T/K, n, coverage, verdict, value
         counts, every K phrase, every out-of-codebook phrase, every note, every error, every answer.

call     sends each batch without output yet to Gemini (temperature 0, JSON reply), retries once when
         the reply does not validate, keeps the better reply and appends it to outputs.jsonl.
         The API key comes from $GEMINI_API_KEY or the GEMINI_API_KEY= line of the repo's git-ignored
         .env, and only ever goes in a request header.

The system prompt, the S codebook and the few-shot examples are read from
features/codebook-multiple-choice/p1-prompt.md, so what was reviewed there is exactly what is sent.
"""

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PROMPT_MD = ROOT / "features" / "codebook-multiple-choice" / "p1-prompt.md"
GROUP = "S"
STATES = ("M", "T", "K")
MIN_N = 10      # below this a cell is "chưa đủ dữ liệu"
GATE = 0.80     # coverage needed to pass

BATCH_INSTRUCTION = (
    "Bạn sẽ nhận nhiều câu trả lời trong một lần, mỗi câu có số thứ tự [1], [2], ... "
    "Map từng câu độc lập với các câu khác. "
    'Trả về đúng một JSON dạng {"kết quả": [ ... ]}, mỗi phần tử là output theo schema ở trên '
    'cho một câu và có thêm khóa "id" là số thứ tự của câu đó (dạng chuỗi). '
    "Đủ mọi id, giữ đúng thứ tự."
)


# ---------- text helpers ----------

def norm(s):
    """NFC, lower case, single spaces: the form labels and evidence are compared in."""
    return " ".join(unicodedata.normalize("NFC", str(s)).lower().split())


def squash(s):
    """Whitespace-normalized text, case kept: the dedup key of an answer."""
    return " ".join(unicodedata.normalize("NFC", str(s)).split())


# ---------- prompt pieces from p1-prompt.md ----------

def _section(md, num):
    m = re.search(rf"^## {num}\. [^\n]*\n(.*?)(?=^## \d+\. |\Z)", md, re.M | re.S)
    if not m:
        raise ValueError(f"section {num} not found in {PROMPT_MD.name}")
    return m.group(1)


def _blocks(text, lang):
    return re.findall(rf"```{lang}\n(.*?)\n```", text, re.S)


def _parse_input(block):
    fields = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
    return {"group": fields["Nhóm"], "question": fields["Câu hỏi"], "answer": fields["Câu trả lời"]}


def _codebooks(md):
    """Section 4 holds one JSON block per group, each introduced by a line 'Nhóm <X>, lấy từ ...'."""
    found = re.findall(r"^Nhóm (\w+), lấy từ[^\n]*\n+```json\n(.*?)\n```", _section(md, 4), re.M | re.S)
    return {g: json.loads(b) for g, b in found}


def load_trials(path=PROMPT_MD, group=GROUP):
    """The 'Chạy thử' sections of a group: real inputs with the output the reviewer expects."""
    md = Path(path).read_text(encoding="utf-8")
    trials = []
    for m in re.finditer(r"^## \d+\. Chạy thử[^\n]*\n(.*?)(?=^## \d+\. |\Z)", md, re.M | re.S):
        texts, jsons = _blocks(m.group(1), "text"), _blocks(m.group(1), "json")
        if texts and jsons:
            inp = _parse_input(texts[0])
            if inp["group"] == group:
                trials.append({**inp, "expected": json.loads(jsons[0])})
    return trials


def load_prompt(path=PROMPT_MD, group=GROUP):
    md = Path(path).read_text(encoding="utf-8")
    system = _blocks(_section(md, 3), "text")[0]
    books = _codebooks(md)
    if group not in books:
        raise ValueError(f"no codebook for group {group} in {Path(path).name}")
    codebook = books[group]
    # Section 5: the shared schema first, then 'Riêng nhóm <X> ...' blocks for groups shaped differently (E).
    sec5 = _section(md, 5)
    own = dict(re.findall(r"^Riêng nhóm (\w+)[^\n]*\n+```json\n(.*?)\n```", sec5, re.M | re.S))
    schema = own.get(group) or _blocks(sec5, "json")[0]
    shots = []
    for sub in re.split(r"^### ", _section(md, 6), flags=re.M)[1:]:
        texts, jsons = _blocks(sub, "text"), _blocks(sub, "json")
        if texts and jsons:
            inp = _parse_input(texts[0])
            if inp["group"] == group:
                shots.append({**inp, "output": json.loads(jsons[0])})
    if not shots:
        raise ValueError(f"no few-shot for group {group}")
    return {"system": system, "codebook": codebook, "schema": schema, "shots": shots}


def build_system(p, group=GROUP):
    return (f"{p['system']}\n\nCodebook nhóm {group}:\n"
            f"{json.dumps(p['codebook'], ensure_ascii=False, indent=2)}\n\n"
            f"Schema output cho mỗi câu:\n{p['schema']}\n\n{BATCH_INSTRUCTION}")


def batch_message(items, group=GROUP):
    parts = [f"Nhóm: {group}"]
    for it in items:
        parts.append(f"[{it['id']}]\nCâu hỏi: {it['question']}\nCâu trả lời: {it['answer']}")
    return "\n\n".join(parts)


def build_messages(p, items, group=GROUP):
    shot_items = [{"id": str(i), "question": s["question"], "answer": s["answer"]}
                  for i, s in enumerate(p["shots"], 1)]
    shot_reply = {"kết quả": [{"id": str(i), **s["output"]} for i, s in enumerate(p["shots"], 1)]}
    return [
        {"role": "user", "content": batch_message(shot_items, group)},
        {"role": "assistant", "content": json.dumps(shot_reply, ensure_ascii=False)},
        {"role": "user", "content": batch_message(items, group)},
    ]


# ---------- units and batches ----------

def make_units(df, group=GROUP):
    d = df[(df["qgroup"] == group) & (df["assignment_status"] == "completed")
           & (df["verdict"] != "NOT_ANSWERABLE")].dropna(subset=["effective_answer"]).copy()
    d["answer"] = d["effective_answer"].map(squash)
    d = d[d["answer"] != ""]
    rows = []
    for (draft_id, answer), g in d.groupby(["draft_id", "answer"], sort=False):
        rows.append({"draft_id": draft_id, "seq": int(g["seq"].iloc[0]), "question": g["question"].iloc[0],
                     "answer": answer, "n_annotators": len(g),
                     "annotators": ", ".join(sorted(g["annotator_name"].astype(str)))})
    units = pd.DataFrame(rows).sort_values(["seq", "draft_id", "answer"]).reset_index(drop=True)
    units.insert(0, "unit", [f"{group}{i:04d}" for i in range(1, len(units) + 1)])
    return units


def assign_batches(units, size, group=GROUP):
    units = units.copy()
    units["batch"] = [f"{group}-{i // size + 1:03d}" for i in range(len(units))]
    units["item"] = [str(i % size + 1) for i in range(len(units))]
    return units


# ---------- cells ----------

CONFLICT = re.compile(r"K\d{2}")
ACTION_CELL = "hành động"
CONFLICT_UNCLEAR = "không rõ"
PARTIES = "các bên"


def party_cells(codebook):
    """E-shaped codebook {"các bên": {"ghi chú", "ô": {cells}}} -> the cells of one party; None otherwise."""
    spec = codebook.get(PARTIES) if isinstance(codebook, dict) else None
    return spec["ô"] if isinstance(spec, dict) and isinstance(spec.get("ô"), dict) else None


def parts(item, codebook):
    """[(label, {"ô": cells})]: one per party for an E-shaped codebook, else the item itself once."""
    if party_cells(codebook) is None:
        return [("", item)]
    return [(f"bên {i}", {"ô": (p or {}).get("ô")}) for i, p in enumerate(item.get(PARTIES) or [], 1)]


def cell_specs(codebook):
    """Codebook JSON -> ordered {cell: (kind, data)}.

    kind "options":  a list of labels, or {"lựa chọn": [...], "ghi chú": ...}
    kind "free":     a string describing the cell; the value is an entity description from the answer (C subject/object)
    kind "conflict": {"K01": {"tên", "hành động"}, ...}; the value is a code or "không rõ".
                     It brings a dependent "hành động" cell whose value must belong to the chosen code.
    kind "depends":  {"theo": <earlier cell>, "lựa chọn": {<value of that cell>: [labels]}, "ghi chú": ...};
                     the value must be in the list of the value chosen in the earlier cell (O sign by level).
    An E-shaped codebook (a list of parties) gives the cells of one party.
    """
    codebook = party_cells(codebook) or codebook
    specs = {}
    for cell, spec in codebook.items():
        if isinstance(spec, list):
            specs[cell] = ("options", spec)
        elif isinstance(spec, str):
            specs[cell] = ("free", None)
        elif isinstance(spec, dict) and "theo" in spec:
            if spec["theo"] not in specs:
                raise ValueError(f"cell {cell!r} depends on {spec['theo']!r}, which must come before it")
            specs[cell] = ("depends", (spec["theo"], spec["lựa chọn"]))
        elif isinstance(spec, dict) and "lựa chọn" in spec:
            specs[cell] = ("options", spec["lựa chọn"])
        elif isinstance(spec, dict) and spec and all(CONFLICT.fullmatch(k) for k in spec):
            specs[cell] = ("conflict", [*spec, CONFLICT_UNCLEAR])
            specs[ACTION_CELL] = ("action", {k: v["hành động"] for k, v in spec.items()})
        else:
            raise ValueError(f"cell {cell!r}: unknown codebook shape")
    return specs


# ---------- validation ----------

def validate_item(item, answer, codebook):
    """Return a list of error strings for one mapped answer (empty = valid).
    E-shaped: every party's passage must be in the answer and its cells are checked like any item's,
    errors prefixed 'bên <i>: '. An empty list of parties is valid ("Không thể xác định")."""
    a = norm(answer)
    if party_cells(codebook) is None:
        if not isinstance(item.get("ô"), dict):
            return ['thiếu khóa "ô"']
        errs = _cell_errors(item["ô"], a, codebook)
    else:
        if not isinstance(item.get(PARTIES), list):
            return [f'thiếu danh sách "{PARTIES}"']
        errs = []
        for (label, sub), p in zip(parts(item, codebook), item[PARTIES]):
            doan = (p or {}).get("đoạn")
            if not isinstance(doan, str) or not doan.strip() or norm(doan) not in a:
                errs.append(f"{label}: đoạn {doan!r} không có trong câu")
            if not isinstance(sub["ô"], dict):
                errs.append(f'{label}: thiếu khóa "ô"')
                continue
            errs += [f"{label}: {e}" for e in _cell_errors(sub["ô"], a, codebook)]
    for o in item.get("ngoài codebook") or []:
        if not isinstance(o, dict) or norm(o.get("đoạn", "")) not in a:
            errs.append(f"ngoài codebook: đoạn {o!r} không có trong câu")
    return errs


def _cell_errors(cells, a, codebook):
    """Errors of one set of cells; `a` is the normalized answer."""
    errs = []
    specs = cell_specs(codebook)
    for cell, (kind, data) in specs.items():
        c = cells.get(cell)
        if not isinstance(c, dict):
            errs.append(f"{cell}: thiếu ô")
            continue
        st, val, ev, miss = c.get("trạng thái"), c.get("giá trị"), c.get("bằng chứng"), c.get("cụm không khớp")
        if st not in STATES:
            errs.append(f"{cell}: trạng thái lạ {st!r}")
            continue
        if st == "M":
            if kind == "free":
                if not isinstance(val, str) or not val.strip():
                    errs.append(f"{cell}: M thiếu mô tả thực thể")
            elif kind == "action":
                errs += _action_errors(cells, val, data)
            elif kind == "depends":
                errs += _depends_errors(cell, cells, val, *data)
            elif val is None or norm(val) not in {norm(o) for o in data}:
                errs.append(f"{cell}: giá trị {val!r} không có trong codebook")
            if not ev:
                errs.append(f"{cell}: M thiếu bằng chứng")
        elif val is not None:
            errs.append(f"{cell}: {st} không được có giá trị ({val!r})")
        if kind == "action" and st != "T":
            kx = cells.get("kiểu xung đột") or {}
            if kx.get("trạng thái") == "T":
                errs.append(f"{cell}: kiểu xung đột là T thì hành động phải là T")
        if st == "K" and not miss:
            errs.append(f"{cell}: K thiếu cụm không khớp")
        if ev and norm(ev) not in a:
            errs.append(f"{cell}: bằng chứng {ev!r} không có trong câu")
    extra = set(cells) - set(specs)
    if extra:
        errs.append(f"ô lạ: {', '.join(sorted(extra))}")
    return errs


def _action_errors(cells, val, actions):
    kx = cells.get("kiểu xung đột") or {}
    code = kx.get("giá trị")
    if kx.get("trạng thái") != "M" or code not in actions:
        return [f"{ACTION_CELL}: M cần kiểu xung đột M với mã K01-K18 (đang là {kx.get('trạng thái')!r}, {code!r})"]
    if val is None or norm(val) not in {norm(a) for a in actions[code]}:
        return [f"{ACTION_CELL}: {val!r} không thuộc hành động của {code}"]
    return []


def _depends_errors(cell, cells, val, parent, by_value):
    p = cells.get(parent) or {}
    pv = next((k for k in by_value if norm(k) == norm(p.get("giá trị") or "")), None)
    if p.get("trạng thái") != "M" or pv is None:
        return [f"{cell}: M cần ô {parent!r} là M với một giá trị có danh sách (đang là "
                f"{p.get('trạng thái')!r}, {p.get('giá trị')!r})"]
    if val is None or norm(val) not in {norm(o) for o in by_value[pv]}:
        return [f"{cell}: {val!r} không thuộc {parent} {pv!r}"]
    return []


def parse_reply(text):
    """Model reply -> {id: item}. Tolerates a ```json fence around the JSON, paired or not:
    gemini-3.5-flash sometimes ends a bare JSON reply with a lone closing fence. Prose around the
    JSON (a reply pasted from a web chat) is dropped."""
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)
    if not t.startswith("{") and "{" in t:   # a chat UI may put prose before or after the JSON
        t = t[t.index("{"):t.rindex("}") + 1]
    data = json.loads(t)
    return {str(it.get("id")): it for it in data["kết quả"]}


def collect(units, outputs, codebook):
    """Join model replies to units. Returns (results, errors): results[unit] = item, errors[unit] = [str]."""
    by_batch = {}
    for o in outputs:
        try:
            by_batch[o["batch"]] = parse_reply(o["text"])
        except (ValueError, KeyError, TypeError) as e:
            by_batch[o["batch"]] = e
    results, errors = {}, {}
    for u in units.itertuples():
        got = by_batch.get(u.batch)
        if got is None:
            errors[u.unit] = ["lô chưa có output"]
        elif isinstance(got, Exception):
            errors[u.unit] = [f"lô không parse được: {got}"]
        elif u.item not in got:
            errors[u.unit] = [f"thiếu id {u.item} trong lô {u.batch}"]
        else:
            errs = validate_item(got[u.item], u.answer, codebook)
            if errs:
                errors[u.unit] = errs
            else:
                results[u.unit] = got[u.item]
    return results, errors


# ---------- report ----------

def _value_label(kind, data, cells, value, canon):
    if kind == "free":
        return canon.setdefault(norm(value), value.strip())
    if kind == "action":
        code = cells["kiểu xung đột"]["giá trị"]
        return f"{code}: {next(a for a in data[code] if norm(a) == norm(value))}"
    if kind == "depends":
        parent, by_value = data
        pv = next(k for k in by_value if norm(k) == norm(cells[parent]["giá trị"]))
        return f"{pv}: {next(o for o in by_value[pv] if norm(o) == norm(value))}"
    return canon[norm(value)]


def cell_rows(results, codebook):
    """{row: {"ô": cells}} counted for coverage: one row per answer, or per party ('<unit>/<i>') for E."""
    if party_cells(codebook) is None:
        return results
    return {f"{u}/{i}": sub for u, item in results.items() for i, (_, sub) in enumerate(parts(item, codebook), 1)}


def cell_stats(results, codebook):
    results = cell_rows(results, codebook)
    stats = {}
    for cell, (kind, data) in cell_specs(codebook).items():
        cnt = Counter()
        if kind in ("options", "conflict"):
            values = Counter({o: 0 for o in data})
            canon = {norm(o): o for o in data}
        elif kind == "action":
            values = Counter({f"{k}: {a}": 0 for k, acts in data.items() for a in acts})
            canon = {}
        elif kind == "depends":
            values = Counter({f"{k}: {o}": 0 for k, opts in data[1].items() for o in opts})
            canon = {}
        else:
            values, canon = Counter(), {}
        for item in results.values():
            c = item["ô"][cell]
            st = c["trạng thái"]
            cnt[st] += 1
            if st == "M":
                values[_value_label(kind, data, item["ô"], c["giá trị"], canon)] += 1
            if st == "T":
                cnt["T_detail" if c.get("bằng chứng") else "T_silent"] += 1
        n = cnt["M"] + cnt["K"]
        cov = cnt["M"] / n if n else None
        if n < MIN_N:
            verdict = "chưa đủ dữ liệu"
        elif cov >= GATE:
            verdict = "đạt"
        else:
            verdict = "không đạt, phải sửa ô"
        stats[cell] = {"M": cnt["M"], "K": cnt["K"], "T": cnt["T"], "T_detail": cnt["T_detail"],
                       "T_silent": cnt["T_silent"], "n": n, "coverage": cov, "verdict": verdict,
                       "values": values}
    return stats


def table(headers, rows):
    rows = [[str(x) for x in r] for r in rows]
    widths = [max(len(h), *(len(r[i]) for r in rows)) if rows else len(h) for i, h in enumerate(headers)]
    line = lambda r: "  ".join(c.ljust(w) for c, w in zip(r, widths)).rstrip()
    out = [line(headers), "  ".join("-" * w for w in widths)]
    out += [line(r) for r in rows]
    return "\n".join(out)


def render_report(units, results, errors, codebook, group=GROUP):
    specs = cell_specs(codebook)
    stats = cell_stats(results, codebook)
    rows_by_cell = cell_rows(results, codebook)   # one row per answer, or per party for E
    U = units.set_index("unit")
    seq = lambda row: f"#{U.loc[row.split('/')[0], 'seq']}"
    L = []
    L.append(f"BÁO CÁO ĐỘ PHỦ CODEBOOK, NHÓM {group}")
    L.append("")
    L.append(f"Câu trả lời khác nhau (đơn vị đếm): {len(units)}  | video: {units['seq'].nunique()}"
             f"  | lượt viết của annotator: {int(units['n_annotators'].sum())}")
    L.append(f"Map hợp lệ: {len(results)}  | lỗi, chưa tính: {len(errors)}")
    if party_cells(codebook) is not None:
        L.append(f"Số bên đã tách: {len(rows_by_cell)} (mỗi ô tính trên từng bên; câu ghi '<câu>/<thứ tự bên>')")
    L.append(f"Độ phủ = M / n, n = M + K. Ô có n < {MIN_N}: chưa đủ dữ liệu. Đạt khi độ phủ >= {GATE:.0%}.")
    L.append("T chia hai: 'T thiếu chi tiết' (có nhắc nhưng không đủ để chọn) và 'T không nhắc'.")
    L.append("")
    L.append("1. ĐỘ PHỦ THEO Ô")
    L.append(table(["Ô", "M", "K", "T", "T thiếu chi tiết", "T không nhắc", "n = M + K", "Độ phủ = M / n", "Kết luận"],
                   [[c, s["M"], s["K"], s["T"], s["T_detail"], s["T_silent"], s["n"],
                     "" if s["coverage"] is None else f"{s['coverage']:.0%}", s["verdict"]]
                    for c, s in stats.items()]))
    L.append("")
    L.append("2. GIÁ TRỊ ĐƯỢC CHỌN (chỉ tính M)")
    for c, s in stats.items():
        L.append("")
        L.append(f"[{c}]")
        rows = [[v, k] for v, k in s["values"].items()]
        if specs[c][0] == "free":
            rows.sort(key=lambda r: (-r[1], norm(r[0])))
        L.append(table(["Giá trị", "Số câu"], rows) if rows else "(không có)")
    L.append("")
    L.append("3. MỌI CỤM BỊ K (codebook thiếu lựa chọn)")
    krows = []
    for unit, item in rows_by_cell.items():
        for c, v in item["ô"].items():
            if v["trạng thái"] == "K":
                krows.append([c, v["cụm không khớp"], v.get("bằng chứng") or "", seq(unit), unit])
    L.append(table(["Ô", "Cụm không khớp", "Bằng chứng", "Video", "Câu"], sorted(krows)) if krows else "(không có)")
    L.append("")
    L.append("4. MỌI T THIẾU CHI TIẾT")
    trows = []
    for unit, item in rows_by_cell.items():
        for c, v in item["ô"].items():
            if v["trạng thái"] == "T" and v.get("bằng chứng"):
                trows.append([c, v["bằng chứng"], seq(unit), unit])
    L.append(table(["Ô", "Bằng chứng", "Video", "Câu"], sorted(trows)) if trows else "(không có)")
    L.append("")
    L.append("5. NGOÀI CODEBOOK (gộp theo loại và đoạn)")
    outside = defaultdict(list)
    for unit, item in results.items():
        for o in item.get("ngoài codebook") or []:
            outside[(o.get("loại", ""), norm(o["đoạn"]))].append(f"#{U.loc[unit, 'seq']}")
    orows = sorted(([k[0], k[1], len(v), " ".join(sorted(set(v), key=lambda x: int(x[1:])))]
                    for k, v in outside.items()), key=lambda r: (r[0], -r[2], r[1]))
    L.append(table(["Loại", "Đoạn", "Số câu", "Video"], orows) if orows else "(không có)")
    L.append("")
    L.append("6. GHI CHÚ CỦA MODEL")
    nrows = [[f"#{U.loc[u, 'seq']}", u, it["ghi chú"]] for u, it in results.items() if it.get("ghi chú")]
    L.append(table(["Video", "Câu", "Ghi chú"], nrows) if nrows else "(không có)")
    L.append("")
    L.append("7. LỖI (không tính vào độ phủ)")
    erows = [[f"#{U.loc[u, 'seq']}", u, U.loc[u, "batch"], e] for u, es in errors.items() for e in es]
    L.append(table(["Video", "Câu", "Lô", "Lỗi"], erows) if erows else "(không có)")
    L.append("")
    L.append("8. TỪNG CÂU TRẢ LỜI")
    short = {"M": "M", "T": "T", "K": "K"}
    arows = []
    for u in units.itertuples():
        item = results.get(u.unit)
        if item is None:
            arows.append([u.unit, f"#{u.seq}", u.n_annotators, *["lỗi"] * len(specs), u.answer])
            continue
        subs = parts(item, codebook)
        if not subs:
            arows.append([u.unit, f"#{u.seq}", u.n_annotators, *["-"] * len(specs), f"(không có bên) {u.answer}"])
        for i, (label, sub) in enumerate(subs, 1):
            cells = [f"M:{v['giá trị']}" if v["trạng thái"] == "M" else short[v["trạng thái"]]
                     for v in (sub["ô"][c] for c in specs)]
            arows.append([f"{u.unit}/{i}" if label else u.unit, f"#{u.seq}", u.n_annotators, *cells,
                          item[PARTIES][i - 1]["đoạn"] if label else u.answer])
    L.append(table(["Câu", "Video", "Số người", *specs, "Câu trả lời"], arows))
    return "\n".join(L) + "\n"


# ---------- Gemini call ----------

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
KEY_ENV = "GEMINI_API_KEY"


def gemini_body(system, messages):
    role = {"user": "user", "assistant": "model"}
    return {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": role[m["role"]], "parts": [{"text": m["content"]}]} for m in messages],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
    }


def gemini_generate(model, system, messages, key, timeout=300):
    """One generateContent call. Returns (reply text, usage dict). The key goes only in a header."""
    import urllib.error
    import urllib.request
    req = urllib.request.Request(
        GEMINI_URL.format(model=model), method="POST",
        data=json.dumps(gemini_body(system, messages), ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": key})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:500]}") from None
    except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
        # A slow or dropped call must cost one batch, not stop the whole run.
        raise RuntimeError(f"network: {e}") from None
    cand = (data.get("candidates") or [{}])[0]
    text = "".join(p.get("text", "") for p in cand.get("content", {}).get("parts", []) if not p.get("thought"))
    if not text:
        raise RuntimeError(f"empty reply, finishReason={cand.get('finishReason')}")
    return text, data.get("usageMetadata", {})


def batch_errors(units, batch, text, codebook):
    _, errors = collect(units[units["batch"] == batch], [{"batch": batch, "text": text}], codebook)
    return errors


def api_key(env_file=ROOT / ".env"):
    """$GEMINI_API_KEY, else the GEMINI_API_KEY= line of the git-ignored .env at the repo root."""
    import os
    key = os.environ.get(KEY_ENV)
    if not key and Path(env_file).exists():
        for line in Path(env_file).read_text(encoding="utf-8").splitlines():
            name, _, value = line.strip().partition("=")
            if name.strip() == KEY_ENV:
                key = value.strip().strip('"').strip("'")
    return key or None


def compare_trial(got, expected, codebook):
    """Rows [ô, mong muốn, model, khớp] comparing state and value cell by cell; evidence is shown, not judged."""
    rows = []
    show = lambda c: "-" if not c else (f"{c.get('trạng thái')}:{c.get('giá trị')}" if c.get("giá trị") is not None
                                        else str(c.get("trạng thái")))
    if party_cells(codebook) is None:
        pairs = [("", expected, got)]
    else:
        from itertools import zip_longest
        exp_p, got_p = expected.get(PARTIES) or [], got.get(PARTIES) or []
        rows.append(["số bên", len(exp_p), len(got_p), "khớp" if len(exp_p) == len(got_p) else "LỆCH",
                     " | ".join(p.get("đoạn", "") for p in exp_p), " | ".join(str((p or {}).get("đoạn")) for p in got_p)])
        pairs = [(f"bên {i} / ", e or {}, g or {}) for i, (e, g) in enumerate(zip_longest(exp_p, got_p), 1)]
    for prefix, exp, gt in pairs:
        for cell in cell_specs(codebook):
            e, g = (exp.get("ô") or {}).get(cell) or {}, (gt.get("ô") or {}).get(cell) or {}
            same = (e.get("trạng thái") == g.get("trạng thái")
                    and norm(e.get("giá trị") or "") == norm(g.get("giá trị") or ""))
            rows.append([prefix + cell, show(e), show(g), "khớp" if same else "LỆCH",
                         e.get("bằng chứng") or "", g.get("bằng chứng") or ""])
    return rows


def cmd_trial(args, generate=gemini_generate):
    """Send only the reviewed 'Chạy thử' inputs of a group, as one batch, and compare with the expected outputs."""
    key = api_key()
    if not key:
        sys.exit(f"Set {KEY_ENV} in the environment or as a {KEY_ENV}= line in .env (the key is never printed).")
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    p = load_prompt(group=args.group)
    trials = load_trials(group=args.group)
    if not trials:
        sys.exit(f"no 'Chạy thử' section for group {args.group}")
    items = [{"id": str(i), "question": t["question"], "answer": t["answer"]} for i, t in enumerate(trials, 1)]
    text, usage = generate(args.model, build_system(p, args.group), build_messages(p, items, args.group), key)
    (out / f"trial_{args.group}.json").write_text(
        json.dumps({"model": args.model, "text": text, "usage": usage}, ensure_ascii=False, indent=2), encoding="utf-8")
    got = parse_reply(text)
    L = [f"CHẠY THỬ NHÓM {args.group}, model {args.model}", ""]
    for i, t in enumerate(trials, 1):
        item = got.get(str(i), {})
        errs = validate_item(item, t["answer"], p["codebook"]) if item else ["model không trả id này"]
        L.append(f"[{i}] {t['answer']}")
        L.append(table(["Ô", "Mong muốn", "Model", "So", "Bằng chứng mong muốn", "Bằng chứng model"],
                       compare_trial(item, t["expected"], p["codebook"])))
        L.append(f"Ngoài codebook, model: {json.dumps(item.get('ngoài codebook'), ensure_ascii=False)}")
        L.append(f"Ngoài codebook, mong muốn: {json.dumps(t['expected'].get('ngoài codebook'), ensure_ascii=False)}")
        L.append(f"Ghi chú, model: {item.get('ghi chú')}")
        L.append(f"Lỗi kiểm tra: {'; '.join(errs) if errs else 'không có'}")
        L.append("")
    L.append(f"Token: {json.dumps(usage, ensure_ascii=False)}")
    (out / f"trial_{args.group}.txt").write_text("\n".join(L) + "\n", encoding="utf-8")
    print("\n".join(L))


def cmd_call(args, generate=gemini_generate):
    key = api_key()
    if not key:
        sys.exit(f"Set {KEY_ENV} in the environment or as a {KEY_ENV}= line in .env (the key is never printed).")
    out = Path(args.out_dir)
    p = load_prompt(group=args.group)
    units = pd.read_csv(out / "units.csv", dtype={"item": str})
    requests = [json.loads(l) for l in (out / "requests.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    outputs_path = out / "outputs.jsonl"
    done = set()
    if outputs_path.exists() and not args.force:
        done = {json.loads(l)["batch"] for l in outputs_path.read_text(encoding="utf-8").splitlines() if l.strip()}
    todo = [r for r in requests if (not args.only or r["batch"] in args.only) and r["batch"] not in done]
    failed = 0
    for r in todo:
        best = None
        for attempt in (1, 2):   # one retry when the reply does not validate
            try:
                text, usage = generate(args.model, r["system"], r["messages"], key)
            except RuntimeError as e:
                print(f"{r['batch']} lần {attempt}: lỗi gọi API: {e}")
                continue
            errs = batch_errors(units, r["batch"], text, p["codebook"])
            if best is None or len(errs) < len(best[2]):
                best = (text, usage, errs)
            if not errs:
                break
            print(f"{r['batch']} lần {attempt}: {len(errs)} câu không hợp lệ")
        if best is None:
            failed += 1
            continue
        with open(outputs_path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"batch": r["batch"], "model": args.model, "text": best[0], "usage": best[1]},
                               ensure_ascii=False) + "\n")
        print(f"{r['batch']}: xong, {len(best[2])} câu lỗi")
    print(f"{len(todo) - failed}/{len(todo)} lô có output -> {outputs_path}")
    if failed:
        sys.exit(1)


# ---------- chat (copy-paste through a web chat UI instead of the API) ----------

CHAT_MODEL = "chatgpt-web"


def chat_prompt(request):
    """One request as a single message for a web chat: system, the few-shot turn, then the batch."""
    shot_in, shot_out, batch = (m["content"] for m in request["messages"])
    return (f"{request['system']}\n\n"
            f"=== VÍ DỤ ===\nInput:\n{shot_in}\n\nOutput:\n{shot_out}\n\n"
            f"=== CÂU CẦN MAP ===\n{batch}\n\n"
            "Chỉ trả về một JSON {\"kết quả\": [...]} trong một khối code, không viết gì thêm.")


def copy_to_clipboard(text):
    """Windows clipboard via clip.exe (reads UTF-16LE); silently does nothing elsewhere."""
    import subprocess
    try:
        subprocess.run(["clip"], input=text.encode("utf-16-le"), check=True)
        return True
    except (OSError, subprocess.CalledProcessError):
        return False


def read_reply(read_line=input):
    """Read a pasted reply line by line until it parses as a batch reply, or until a line END.
    Returns the text, or a command ("skip", "quit") typed on the first line."""
    lines = []
    while True:
        line = read_line()
        if not lines and line.strip().lower() in ("skip", "quit"):
            return line.strip().lower()
        if line.strip() == "END":
            return "\n".join(lines)
        lines.append(line)
        try:
            parse_reply("\n".join(lines))
            return "\n".join(lines)
        except (ValueError, KeyError, TypeError):
            pass


def cmd_chat(args, read_line=input, copy=copy_to_clipboard, show=print):
    """Interactive copy-paste through a web chat: for each batch without output, show the prompt
    (and copy it to the clipboard), read the pasted reply, validate it and append it to outputs.jsonl
    exactly as `call` does, so `report` works unchanged. Stop with quit; run again to resume."""
    out = Path(args.out_dir)
    p = load_prompt(group=args.group)
    units = pd.read_csv(out / "units.csv", dtype={"item": str})
    requests = [json.loads(l) for l in (out / "requests.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    outputs_path = out / "outputs.jsonl"
    done = set()
    if outputs_path.exists():
        done = {json.loads(l)["batch"] for l in outputs_path.read_text(encoding="utf-8").splitlines() if l.strip()}
    todo = [r for r in requests if r["batch"] not in done]
    for k, r in enumerate(todo, 1):
        prompt = chat_prompt(r)
        bar = "=" * 70
        show(f"\n{bar}\nLô {r['batch']} ({k}/{len(todo)})\n{bar}\n{prompt}\n{bar}")
        show(f"Lô {r['batch']}: " + ("prompt đã copy vào clipboard. " if copy(prompt) else "")
             + "Dán câu trả lời của chat vào đây (gõ END nếu nó không tự dừng; skip bỏ qua lô; quit dừng):")
        while True:
            try:
                text = read_reply(read_line)
            except EOFError:
                text = "quit"
            if text in ("skip", "quit"):
                break
            errs = batch_errors(units, r["batch"], text, p["codebook"])
            if not errs:
                break
            show(f"{len(errs)} câu lỗi, ví dụ: {next(iter(errs.values()))[0]}")
            show("Gõ save để vẫn lưu (câu lỗi không tính vào độ phủ), skip, quit, hoặc Enter rồi dán lại:")
            choice = read_line().strip().lower()
            if choice == "save":
                break
            if choice in ("skip", "quit"):
                text = choice
                break
            show("Dán lại câu trả lời:")
        if text == "quit":
            show("Dừng. Chạy lại chat để làm tiếp.")
            return
        if text == "skip":
            continue
        with open(outputs_path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps({"batch": r["batch"], "model": args.model, "text": text, "usage": None},
                                ensure_ascii=False) + "\n")
        show(f"Lô {r['batch']}: đã lưu, {len(errs)} câu lỗi.")
    show(f"Hết lô. Chạy: python scripts/codebook_map.py report --group {args.group}")


# ---------- CLI ----------

def cmd_prepare(args):
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    p = load_prompt(group=args.group)
    units = assign_batches(make_units(pd.read_csv(args.csv), args.group), args.batch_size, args.group)
    units.to_csv(out / "units.csv", index=False, encoding="utf-8-sig")
    system = build_system(p, args.group)
    batches = []
    for batch, g in units.groupby("batch", sort=True):
        items = [{"id": r.item, "question": r.question, "answer": r.answer} for r in g.itertuples()]
        batches.append({"batch": batch, "system": system, "messages": build_messages(p, items, args.group)})
    with open(out / "requests.jsonl", "w", encoding="utf-8") as f:
        for b in batches:
            f.write(json.dumps(b, ensure_ascii=False) + "\n")
    first = batches[0]
    rendered = [f"===== SYSTEM =====\n{first['system']}"]
    rendered += [f"===== {m['role'].upper()} =====\n{m['content']}" for m in first["messages"]]
    (out / "prompt_batch_001.txt").write_text("\n\n".join(rendered) + "\n", encoding="utf-8")
    print(f"{len(units)} câu khác nhau, {units['seq'].nunique()} video, {len(batches)} lô "
          f"(tối đa {args.batch_size} câu) -> {out}")


def cmd_report(args):
    out = Path(args.out_dir)
    p = load_prompt(group=args.group)
    units = pd.read_csv(out / "units.csv", dtype={"item": str})
    outputs_path = out / "outputs.jsonl"
    outputs = []
    if outputs_path.exists():
        outputs = [json.loads(l) for l in outputs_path.read_text(encoding="utf-8").splitlines() if l.strip()]
    results, errors = collect(units, outputs, p["codebook"])
    report = render_report(units, results, errors, p["codebook"], args.group)
    path = out / f"coverage_{args.group}.txt"
    path.write_text(report, encoding="utf-8")
    print(f"{len(results)} hợp lệ, {len(errors)} lỗi -> {path}")


def default_out_dir(group):
    """S kept its original folder; every other group gets its own, so outputs never mix."""
    return "csvs/p1" if group == "S" else f"csvs/p1-{group}"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--group", default=GROUP, help="question group, e.g. S or C")
    common.add_argument("--out-dir", default=None, help="default csvs/p1 for S, csvs/p1-<group> otherwise")
    a = sub.add_parser("prepare", parents=[common])
    a.add_argument("csv")
    a.add_argument("--batch-size", type=int, default=7)
    a.set_defaults(func=cmd_prepare)
    c = sub.add_parser("call", parents=[common], help=f"send batches to Gemini; key from ${KEY_ENV}")
    c.add_argument("--model", default="gemini-3.8-flash")
    c.add_argument("--only", nargs="*", help="batch ids, e.g. S-001")
    c.add_argument("--force", action="store_true", help="call again for batches that already have output")
    c.set_defaults(func=cmd_call)
    t = sub.add_parser("trial", parents=[common], help="send only the reviewed 'Chạy thử' inputs and compare")
    t.add_argument("--model", default="gemini-3.8-flash")
    t.set_defaults(func=cmd_trial)
    h = sub.add_parser("chat", parents=[common], help="copy-paste batches through a web chat, interactively")
    h.add_argument("--model", default=CHAT_MODEL, help="label stored with each reply")
    h.set_defaults(func=cmd_chat)
    r = sub.add_parser("report", parents=[common])
    r.set_defaults(func=cmd_report)
    args = ap.parse_args(argv)
    if args.out_dir is None:
        args.out_dir = default_out_dir(args.group)
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")
    args.func(args)


if __name__ == "__main__":
    main()
