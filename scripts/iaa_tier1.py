"""Answers export -> one readable CSV with every tier-1 (verdict) agreement figure.

Usage:
    python scripts/iaa_tier1.py answers-agreement-....csv [--out FILE] [--boot N] [--round-size 20]

The file has titled sections separated by blank lines (open it in Excel; UTF-8 with BOM):
overall, coefficients with 95% CI, by qgroup, by round, by annotator, annotator pairs,
verdict pairs, and one line per video. Coefficients come from scripts/iaa_round.py.
Only assignment_status = completed rows count, same as there.
"""

import argparse
import csv
import itertools
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.iaa_questions import qgroup_names  # noqa: E402
from scripts.iaa_round import (VERDICTS, bootstrap, fleiss_kappa, gwet_ac1, kripp_alpha,  # noqa: E402
                               nominal, pairwise_pct, verdict_units)

TARGET = 0.8


def f3(x):
    return "" if x is None or (isinstance(x, float) and np.isnan(x)) else f"{x:.3f}"


def pct(x):
    return "" if x is None or (isinstance(x, float) and np.isnan(x)) else f"{x * 100:.1f}%"


def coefficients(g):
    u = verdict_units(g)
    return {"pairwise": pairwise_pct(u), "kappa": fleiss_kappa(u),
            "alpha": kripp_alpha(u, nominal), "ac1": gwet_ac1(u),
            "unanimous": float(np.mean([len(set(x)) == 1 for x in u])) if u else np.nan}


def main(argv=None):
    ap = argparse.ArgumentParser(description="Tier-1 agreement as one readable CSV.")
    ap.add_argument("csv")
    ap.add_argument("--out", default="iaa_out/tier1.csv")
    ap.add_argument("--boot", type=int, default=1000)
    ap.add_argument("--round-size", type=int, default=20)
    args = ap.parse_args(argv)

    df = pd.read_csv(args.csv, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    raw = len(df)
    df = df[df["assignment_status"] == "completed"].copy()
    df["verdict"] = df["verdict"].str.strip().str.upper().str.replace("-", "_")
    df["seq_n"] = df["seq"].astype(int)
    names = qgroup_names()
    rows = []

    def section(title, header, body):
        rows.extend([[title], header, *body, []])

    n_ann, n_vid, n_q = df["annotator_id"].nunique(), df["video_id"].nunique(), df["draft_id"].nunique()
    per_q = df.groupby("draft_id")["annotator_id"].nunique()
    dist = df["verdict"].value_counts()
    section("1. TỔNG QUAN", ["Mục", "Giá trị"], [
        ["Số annotator", n_ann], ["Số video", n_vid], ["Số câu hỏi (đơn vị tính)", n_q],
        ["Số lượt chấm", len(df)], ["Dòng chưa completed bị bỏ", raw - len(df)],
        ["Câu có đủ mọi annotator", f"{int((per_q == n_ann).sum())}/{n_q}"],
        *[[f"Verdict {v}", f"{dist.get(v, 0)} ({dist.get(v, 0) / len(df) * 100:.1f}%)"] for v in VERDICTS]])

    cis = {k: bootstrap(df, lambda d, k=k: coefficients(d)[k], n=args.boot)
           for k in ("pairwise", "kappa", "alpha", "ac1")}
    co = coefficients(df)
    label = {"pairwise": ("% đồng ý từng cặp", "Tỉ lệ cặp người chấm cùng verdict (P_i trung bình)"),
             "kappa": ("Fleiss kappa", "Đã trừ phần trùng do ngẫu nhiên; thấp khi AGREE chiếm đa số (nghịch lý kappa)"),
             "alpha": ("Krippendorff alpha", "Gần bằng Fleiss kappa khi đủ dữ liệu"),
             "ac1": ("Gwet AC1", "Ít bị nghịch lý kappa; thường cao hơn kappa")}
    body = []
    for k in ("pairwise", "kappa", "alpha", "ac1"):
        v = co[k]
        fmt = pct if k == "pairwise" else f3
        body.append([label[k][0], fmt(v), fmt(cis[k][0]), fmt(cis[k][1]),
                     "" if k == "pairwise" else ("ĐẠT" if v >= TARGET else f"thiếu {TARGET - v:.3f}"), label[k][1]])
    body.append(["% câu cả nhóm cùng verdict", pct(co["unanimous"]), "", "", "", "Câu mà mọi người chấm giống hệt nhau"])
    section(f"2. CHỈ SỐ TẦNG 1 (mục tiêu {TARGET}, CI 95% bootstrap theo video, {args.boot} lần)",
            ["Chỉ số", "Giá trị", "CI thấp", "CI cao", f"So với {TARGET}", "Ý nghĩa"], body)

    hdr = ["% đồng ý cặp", "Fleiss kappa", "Krippendorff alpha", "Gwet AC1", "% câu đồng nhất",
           "% AGREE", "% DISAGREE", "% NOT_ANSWERABLE"]

    def cols(g):
        c, sh = coefficients(g), g["verdict"].value_counts(normalize=True)
        return [pct(c["pairwise"]), f3(c["kappa"]), f3(c["alpha"]), f3(c["ac1"]), pct(c["unanimous"]),
                *[pct(sh.get(v, 0.0)) for v in VERDICTS]]

    order = list(names) + sorted(set(df["qgroup"]) - set(names))
    body = []
    for code in order:
        g = df[df["qgroup"] == code]
        if not g.empty:
            body.append([code, names.get(code, ""), g["draft_id"].nunique(), *cols(g)])
    section("3. THEO NHÓM CÂU HỎI", ["Nhóm", "Tên", "Số câu", *hdr], body)

    df["round"] = (df["seq_n"] - 1) // args.round_size + 1
    body = []
    for r, g in df.groupby("round"):
        lo, hi = (r - 1) * args.round_size + 1, r * args.round_size
        body.append([f"Vòng {r}", f"#{lo}-#{hi}", g["video_id"].nunique(), g["draft_id"].nunique(), *cols(g)])
    section(f"4. THEO VÒNG ({args.round_size} video mỗi vòng)", ["Vòng", "Video", "Số video", "Số câu", *hdr], body)

    ann = df.drop_duplicates("annotator_id").set_index("annotator_id")["annotator_name"]
    body = []
    for aid, name in ann.items():
        mine = df[df["annotator_id"] == aid]
        hit = tot = 0
        for _, g in df.groupby("draft_id"):
            a = g.loc[g["annotator_id"] == aid, "verdict"]
            others = g.loc[g["annotator_id"] != aid, "verdict"].mode()
            if len(a) and len(others) == 1:
                tot += 1
                hit += a.iloc[0] == others.iloc[0]
        rest = df[df["annotator_id"] != aid]
        sh = mine["verdict"].value_counts(normalize=True)
        body.append([name, len(mine), pct(hit / tot if tot else np.nan),
                     f3(fleiss_kappa(verdict_units(rest))) if rest["annotator_id"].nunique() >= 3 else "",
                     *[pct(sh.get(v, 0.0)) for v in VERDICTS]])
    section("5. THEO ANNOTATOR", ["Annotator", "Số câu chấm", "% khớp đa số của người khác",
                                  "Fleiss kappa nếu bỏ người này", "% AGREE", "% DISAGREE", "% NOT_ANSWERABLE"], body)

    pivot = df.pivot_table(index="draft_id", columns="annotator_id", values="verdict", aggfunc="first")
    ids = list(ann.index)
    body = []
    for a in ids:
        line = [ann[a]]
        for b in ids:
            if a == b:
                line.append("-")
                continue
            both = pivot[[a, b]].dropna()
            line.append(pct((both[a] == both[b]).mean()) if len(both) else "")
        body.append(line)
    section("6. % ĐỒNG Ý GIỮA TỪNG CẶP ANNOTATOR", ["", *[ann[i] for i in ids]], body)

    conf = Counter()
    for _, g in df.groupby("draft_id"):
        for x, y in itertools.combinations(sorted(g["verdict"]), 2):
            conf[(x, y)] += 1
    total = sum(conf.values())
    body = [[a, b, n, pct(n / total)] for (a, b), n in sorted(conf.items(), key=lambda kv: -kv[1])]
    section("7. CÁC CẶP VERDICT (mỗi cặp người chấm trên cùng một câu là một dòng)",
            ["Verdict 1", "Verdict 2", "Số cặp", "Tỉ lệ"], body)

    body = []
    for (seq, fn), g in df.sort_values("seq_n").groupby(["seq_n", "filename"], sort=False):
        u = verdict_units(g)
        split = sum(len(set(x)) > 1 for x in u)
        body.append([seq, fn, g["annotator_id"].nunique(), len(u), len(u) - split, split,
                     pct(pairwise_pct(u)), f3(fleiss_kappa(u)),
                     *[pct((g["verdict"] == v).mean()) for v in VERDICTS]])
    section("8. THEO VIDEO", ["#", "File", "Số người", "Số câu", "Câu đồng nhất", "Câu chia rẽ",
                              "% đồng ý cặp", "Fleiss kappa (1 video, nhiễu)", "% AGREE", "% DISAGREE",
                              "% NOT_ANSWERABLE"], body)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8-sig") as fh:
        csv.writer(fh).writerows(rows)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print(f"{n_q} câu, {n_ann} người, {n_vid} video -> {out}")
    print(f"pairwise {f3(co['pairwise'])} | kappa {f3(co['kappa'])} | alpha {f3(co['alpha'])} | AC1 {f3(co['ac1'])}")


if __name__ == "__main__":
    main()
