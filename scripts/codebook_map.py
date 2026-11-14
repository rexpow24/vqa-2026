"""P1 of the codebook migration: map free-text answers of group S to cells, then report coverage.

Usage:
    python scripts/codebook_map.py prepare answers-agreement-....csv [--out-dir csvs/p1] [--batch-size 7]
    python scripts/codebook_map.py call [--out-dir csvs/p1] [--model gemini-3.8-flash] [--only S-001] [--force]
    python scripts/codebook_map.py report [--out-dir csvs/p1]

prepare  reads the export, keeps completed rows that are not NOT_ANSWERABLE, deduplicates answers
         per question (draft_id + whitespace-normalized text), groups them into batches and writes
           units.csv              one row per unique answer, with how many annotators wrote it
           requests.jsonl         one line per batch: system prompt + few-shot + batch message
           prompt_batch_001.txt   the first batch rendered in full, for review before any API call
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


def load_prompt(path=PROMPT_MD, group=GROUP):
    md = Path(path).read_text(encoding="utf-8")
    system = _blocks(_section(md, 3), "text")[0]
    codebook = json.loads(_blocks(_section(md, 4), "json")[0])
    schema = _blocks(_section(md, 5), "json")[0]
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


# ---------- validation ----------

def validate_item(item, answer, codebook):
    """Return a list of error strings for one mapped answer (empty = valid)."""
    errs = []
    cells = item.get("ô")
    if not isinstance(cells, dict):
        return ['thiếu khóa "ô"']
    a = norm(answer)
    for cell, options in codebook.items():
        c = cells.get(cell)
        if not isinstance(c, dict):
            errs.append(f"{cell}: thiếu ô")
            continue
        st, val, ev, miss = c.get("trạng thái"), c.get("giá trị"), c.get("bằng chứng"), c.get("cụm không khớp")
        if st not in STATES:
            errs.append(f"{cell}: trạng thái lạ {st!r}")
            continue
        if st == "M":
            if val is None or norm(val) not in {norm(o) for o in options}:
                errs.append(f"{cell}: giá trị {val!r} không có trong codebook")
            if not ev:
                errs.append(f"{cell}: M thiếu bằng chứng")
        elif val is not None:
            errs.append(f"{cell}: {st} không được có giá trị ({val!r})")
        if st == "K" and not miss:
            errs.append(f"{cell}: K thiếu cụm không khớp")
        if ev and norm(ev) not in a:
            errs.append(f"{cell}: bằng chứng {ev!r} không có trong câu")
    extra = set(cells) - set(codebook)
    if extra:
        errs.append(f"ô lạ: {', '.join(sorted(extra))}")
    for o in item.get("ngoài codebook") or []:
        if not isinstance(o, dict) or norm(o.get("đoạn", "")) not in a:
            errs.append(f"ngoài codebook: đoạn {o!r} không có trong câu")
    return errs


def parse_reply(text):
    """Model reply -> {id: item}. Tolerates a ```json fence around the JSON."""
    t = text.strip()
    m = re.search(r"```(?:json)?\s*(.*?)\s*```", t, re.S)
    if m:
        t = m.group(1)
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

def cell_stats(results, codebook):
    stats = {}
    for cell, options in codebook.items():
        cnt = Counter()
        values = Counter({o: 0 for o in options})
        canon = {norm(o): o for o in options}
        for item in results.values():
            c = item["ô"][cell]
            st = c["trạng thái"]
            cnt[st] += 1
            if st == "M":
                values[canon[norm(c["giá trị"])]] += 1
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
    stats = cell_stats(results, codebook)
    U = units.set_index("unit")
    L = []
    L.append(f"BÁO CÁO ĐỘ PHỦ CODEBOOK, NHÓM {group}")
    L.append("")
    L.append(f"Câu trả lời khác nhau (đơn vị đếm): {len(units)}  | video: {units['seq'].nunique()}"
             f"  | lượt viết của annotator: {int(units['n_annotators'].sum())}")
    L.append(f"Map hợp lệ: {len(results)}  | lỗi, chưa tính: {len(errors)}")
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
        L.append(table(["Giá trị", "Số câu"], [[v, k] for v, k in s["values"].items()]))
    L.append("")
    L.append("3. MỌI CỤM BỊ K (codebook thiếu lựa chọn)")
    krows = []
    for unit, item in results.items():
        for c, v in item["ô"].items():
            if v["trạng thái"] == "K":
                krows.append([c, v["cụm không khớp"], v.get("bằng chứng") or "", f"#{U.loc[unit, 'seq']}", unit])
    L.append(table(["Ô", "Cụm không khớp", "Bằng chứng", "Video", "Câu"], sorted(krows)) if krows else "(không có)")
    L.append("")
    L.append("4. MỌI T THIẾU CHI TIẾT")
    trows = []
    for unit, item in results.items():
        for c, v in item["ô"].items():
            if v["trạng thái"] == "T" and v.get("bằng chứng"):
                trows.append([c, v["bằng chứng"], f"#{U.loc[unit, 'seq']}", unit])
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
        cells = []
        for c in codebook:
            if item is None:
                cells.append("lỗi")
                continue
            v = item["ô"][c]
            cells.append(f"M:{v['giá trị']}" if v["trạng thái"] == "M" else short[v["trạng thái"]])
        arows.append([u.unit, f"#{u.seq}", u.n_annotators, *cells, u.answer])
    L.append(table(["Câu", "Video", "Số người", *codebook, "Câu trả lời"], arows))
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


def cmd_call(args, generate=gemini_generate):
    key = api_key()
    if not key:
        sys.exit(f"Set {KEY_ENV} in the environment or as a {KEY_ENV}= line in .env (the key is never printed).")
    out = Path(args.out_dir)
    p = load_prompt()
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


# ---------- CLI ----------

def cmd_prepare(args):
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    p = load_prompt()
    units = assign_batches(make_units(pd.read_csv(args.csv)), args.batch_size)
    units.to_csv(out / "units.csv", index=False, encoding="utf-8-sig")
    system = build_system(p)
    batches = []
    for batch, g in units.groupby("batch", sort=True):
        items = [{"id": r.item, "question": r.question, "answer": r.answer} for r in g.itertuples()]
        batches.append({"batch": batch, "system": system, "messages": build_messages(p, items)})
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
    p = load_prompt()
    units = pd.read_csv(out / "units.csv", dtype={"item": str})
    outputs_path = out / "outputs.jsonl"
    outputs = []
    if outputs_path.exists():
        outputs = [json.loads(l) for l in outputs_path.read_text(encoding="utf-8").splitlines() if l.strip()]
    results, errors = collect(units, outputs, p["codebook"])
    report = render_report(units, results, errors, p["codebook"])
    (out / f"coverage_{GROUP}.txt").write_text(report, encoding="utf-8")
    print(f"{len(results)} hợp lệ, {len(errors)} lỗi -> {out / f'coverage_{GROUP}.txt'}")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("prepare")
    a.add_argument("csv")
    a.add_argument("--out-dir", default="csvs/p1")
    a.add_argument("--batch-size", type=int, default=7)
    a.set_defaults(func=cmd_prepare)
    c = sub.add_parser("call", help=f"send batches to Gemini; key from ${KEY_ENV}")
    c.add_argument("--out-dir", default="csvs/p1")
    c.add_argument("--model", default="gemini-3.8-flash")
    c.add_argument("--only", nargs="*", help="batch ids, e.g. S-001")
    c.add_argument("--force", action="store_true", help="call again for batches that already have output")
    c.set_defaults(func=cmd_call)
    r = sub.add_parser("report")
    r.add_argument("--out-dir", default="csvs/p1")
    r.set_defaults(func=cmd_report)
    args = ap.parse_args(argv)
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")
    args.func(args)


if __name__ == "__main__":
    main()
