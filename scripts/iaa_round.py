#!/usr/bin/env python3
"""Inter-annotator agreement (IAA) for one training round of the agreement group.

Input: the answers CSV exported from /admin/assignments, section 4
(`GET /api/admin/answers/export?scope=agreement&from=&to=`). One row per saved
answer: video_id, draft_id, qgroup, annotator_id, verdict, edited_answer,
effective_answer, event_label, assignment_status, ...

A unit is one question (`draft_id`); each annotator gives it one value.

Tier 1 (verdict): pairwise % agreement, Fleiss kappa, Krippendorff alpha
    (nominal) and Gwet AC1. All three are reported so the team can pick the
    headline coefficient later: with complete data Fleiss kappa and alpha
    differ only by alpha's small-sample correction, and both suffer the kappa
    paradox when AGREE dominates, which AC1 does not.
Tier 2 (content): Krippendorff alpha with a semantic distance on the
    normalized effective_answer (Braylan et al., WWW 2022):
    d = 0 for equal answers, d = 1 when one side is "not answerable" and the
    other has content, otherwise d = 1 - sim(a, b). sim comes from the LLM
    judge scores (--judge); a pair without a score falls back to word-level
    difflib similarity.

Confidence intervals: bootstrap over VIDEOS, since the nine questions of one
video are not independent.

Only rows whose assignment is completed are used unless --include-unfinished
is given, and the report says when a question lacks some annotator.

Usage:
  python scripts/iaa_round.py answers.csv --out out_dir
  # score out_dir/pairs_to_judge.csv with the LLM judge (column judge_score in 0..1), then:
  python scripts/iaa_round.py answers.csv --out out_dir --judge out_dir/pairs_judged.csv

Needs pandas and numpy only. The report text is Vietnamese, for the labeling team.
"""
from __future__ import annotations

import argparse
import itertools
import os
import re
import sys
import unicodedata
from difflib import SequenceMatcher

import numpy as np
import pandas as pd

NA_TOKEN = "<NA>"
# The app writes "Không trả lời được" as the effective answer of every
# NOT_ANSWERABLE row; the guideline's phrase is folded in too.
NA_PHRASES = {"không trả lời được", "không thể xác định"}
VERDICTS = ["AGREE", "DISAGREE", "NOT_ANSWERABLE"]


# ----------------------------------------------------------------------------
# Normalization
# ----------------------------------------------------------------------------
def norm_text(s):
    if s is None or (isinstance(s, float) and np.isnan(s)):
        return ""
    s = unicodedata.normalize("NFC", str(s)).strip().lower()
    s = re.sub(r"\s+", " ", s)
    s = s.rstrip(" .")
    return s


def norm_answer(row):
    if row["verdict"] == "NOT_ANSWERABLE":
        return NA_TOKEN
    t = norm_text(row["effective_answer"])
    if t in NA_PHRASES:
        return NA_TOKEN
    return t


def lexical_sim(a, b):
    return SequenceMatcher(None, a.split(), b.split()).ratio()


# ----------------------------------------------------------------------------
# Agreement coefficients
# ----------------------------------------------------------------------------
def kripp_alpha(units, dist):
    """units: list of lists (the annotators' values for one unit).
    dist(a, b, same_unit) -> [0, 1]. General form: alpha = 1 - Do / De."""
    units = [u for u in units if len(u) >= 2]
    if not units:
        return np.nan
    n = sum(len(u) for u in units)
    # Do: observed disagreement inside each unit
    do = 0.0
    for u in units:
        m = len(u)
        s = sum(dist(a, b, True) for a, b in itertools.permutations(u, 2))
        do += s / (m - 1)
    do /= n
    # De: expected disagreement between any two values, regardless of unit
    vals = [v for u in units for v in u]
    uniq, counts = np.unique(np.array(vals, dtype=object), return_counts=True)
    de = 0.0
    for i in range(len(uniq)):
        for j in range(len(uniq)):
            if i == j:
                continue
            de += counts[i] * counts[j] * dist(uniq[i], uniq[j], False)
    de /= n * (n - 1)
    if de == 0:
        return 1.0 if do == 0 else np.nan
    return 1.0 - do / de


def nominal(a, b, _same=True):
    return 0.0 if a == b else 1.0


def fleiss_kappa(units, categories=VERDICTS):
    """Fleiss (1971). Assumes every unit has the same number of raters; with
    complete data it differs from Krippendorff alpha only by alpha's small-sample
    correction in the expected agreement."""
    units = [u for u in units if len(u) >= 2]
    if not units:
        return np.nan
    p_bar, totals, n_ratings = 0.0, np.zeros(len(categories)), 0
    for u in units:
        r = len(u)
        cnt = np.array([u.count(c) for c in categories], dtype=float)
        p_bar += ((cnt ** 2).sum() - r) / (r * (r - 1))
        totals += cnt
        n_ratings += r
    p_bar /= len(units)
    pe = ((totals / n_ratings) ** 2).sum()
    return (p_bar - pe) / (1 - pe) if pe < 1 else np.nan


def gwet_ac1(units, categories=VERDICTS):
    units = [u for u in units if len(u) >= 2]
    if not units:
        return np.nan
    q = len(categories)
    pa, pi = 0.0, np.zeros(q)
    for u in units:
        r = len(u)
        cnt = np.array([u.count(c) for c in categories], dtype=float)
        pa += (cnt * (cnt - 1)).sum() / (r * (r - 1))
        pi += cnt / r
    pa /= len(units)
    pi /= len(units)
    pe = (pi * (1 - pi)).sum() / (q - 1)
    return (pa - pe) / (1 - pe) if pe < 1 else np.nan


def pairwise_pct(units):
    agree, total = 0, 0
    for u in units:
        for a, b in itertools.combinations(u, 2):
            total += 1
            agree += a == b
    return agree / total if total else np.nan


def bootstrap(df, fn, by="video_id", n=1000, seed=0):
    vids = df[by].unique()
    if len(vids) < 3:
        return (np.nan, np.nan)
    rng = np.random.default_rng(seed)
    groups = {v: g for v, g in df.groupby(by)}
    vals = []
    for _ in range(n):
        pick = rng.choice(vids, size=len(vids), replace=True)
        parts = []
        for k, v in enumerate(pick):
            g = groups[v].copy()
            g["_unit_suffix"] = k  # a video drawn twice must give two units, not one merged unit
            parts.append(g)
        vals.append(fn(pd.concat(parts)))
    vals = np.array([v for v in vals if not np.isnan(v)])
    return (np.percentile(vals, 2.5), np.percentile(vals, 97.5)) if len(vals) else (np.nan, np.nan)


# ----------------------------------------------------------------------------
# Units
# ----------------------------------------------------------------------------
def unit_key(df):
    suf = df["_unit_suffix"].astype(str) if "_unit_suffix" in df else ""
    return df["draft_id"].astype(str) + "|" + suf


def verdict_units(df):
    return [g["verdict"].tolist() for _, g in df.groupby(unit_key(df))]


def answer_units(df):
    return [g["ans"].tolist() for _, g in df.groupby(unit_key(df))]


def make_semantic_dist(judge):
    cache = {}

    def d(a, b, same_unit):
        if a == b:
            return 0.0
        if a == NA_TOKEN or b == NA_TOKEN:
            return 1.0
        key = (a, b) if a < b else (b, a)
        if key in judge:
            return 1.0 - judge[key]
        if key not in cache:
            cache[key] = 1.0 - lexical_sim(a, b)
        return cache[key]

    return d


# ----------------------------------------------------------------------------
# Data quality checks
# ----------------------------------------------------------------------------
COLLISION_WORDS = ["va chạm", "đâm", "ngã", "va vào", "tông"]


def quality_flags(df):
    flags = []
    for _, r in df.iterrows():
        e = norm_text(r["edited_answer"])
        if r["verdict"] == "DISAGREE":
            if not e:
                flags.append((r, "DISAGREE nhưng edited_answer trống"))
            elif e == norm_text(r["draft_answer"]):
                flags.append((r, "DISAGREE nhưng edited_answer giống hệt draft"))
            # A Vietnamese syllable has at most ~7 letters; 9+ letters in a row is likely test input
            elif re.search(r"[^\W\d_]{9,}", str(r["edited_answer"])):
                flags.append((r, "edited_answer có chuỗi ký tự bất thường (nghi nhập thử/rác)"))
        if norm_text(r["effective_answer"]) == "không trả lời được":
            flags.append((r, "Dùng 'Không trả lời được' thay vì cụm chuẩn 'Không thể xác định' trong guideline"))
    # near-miss while the same annotator's N/O answers describe a collision
    for (vid, ann), g in df.groupby(["video_id", "annotator_id"]):
        if (g["event_label"] == "near-miss").any():
            txt = " ".join(norm_text(x) for x in g.loc[g["qgroup"].isin(["N", "O"]), "effective_answer"])
            if any(w in txt for w in COLLISION_WORDS):
                r0 = g.iloc[0].copy()
                r0["qgroup"] = "N/O"
                flags.append((r0, "event_label = near-miss nhưng câu N/O mà chính người này giữ lại mô tả có va chạm"))
    rows = [{
        "filename": r["filename"], "annotator": r["annotator_name"], "qgroup": r["qgroup"],
        "verdict": r["verdict"], "issue": issue,
        "edited_answer": r["edited_answer"] if isinstance(r["edited_answer"], str) else "",
    } for r, issue in flags]
    return pd.DataFrame(rows, columns=["filename", "annotator", "qgroup", "verdict", "issue", "edited_answer"])


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main(argv=None):
    ap = argparse.ArgumentParser(description="Inter-annotator agreement for one training round.")
    ap.add_argument("csv")
    ap.add_argument("--out", default="iaa_out")
    ap.add_argument("--judge", help="CSV with columns answer_a, answer_b, judge_score (0..1)")
    ap.add_argument("--boot", type=int, default=1000)
    ap.add_argument("--include-unfinished", action="store_true",
                    help="keep rows of annotators who have not completed the video (default: assignment_status = completed only)")
    args = ap.parse_args(argv)
    os.makedirs(args.out, exist_ok=True)

    df = pd.read_csv(args.csv, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    n_rows_raw = len(df)
    if not args.include_unfinished and "assignment_status" in df:
        df = df[df["assignment_status"] == "completed"].copy()
    df["verdict"] = df["verdict"].str.strip().str.upper().str.replace("-", "_")
    df["ans"] = df.apply(norm_answer, axis=1)

    judge = {}
    if args.judge:
        j = pd.read_csv(args.judge)
        for _, r in j.iterrows():
            a, b = norm_text(r["answer_a"]), norm_text(r["answer_b"])
            judge[(a, b) if a < b else (b, a)] = float(r["judge_score"])
    sem = make_semantic_dist(judge)

    n_ann = df["annotator_id"].nunique()
    n_vid = df["video_id"].nunique()
    n_unit = df["draft_id"].nunique()
    dist = df["verdict"].value_counts(normalize=True).reindex(VERDICTS, fill_value=0)

    def a_verdict(d):
        return kripp_alpha(verdict_units(d), nominal)

    def k_fleiss(d):
        return fleiss_kappa(verdict_units(d))

    def ac1(d):
        return gwet_ac1(verdict_units(d))

    def a_sem(d):
        return kripp_alpha(answer_units(d), sem)

    lines = []
    P = lines.append
    P(f"Annotators: {n_ann} | Videos: {n_vid} | Units (câu hỏi): {n_unit} | Rows: {len(df)}"
      + ("" if args.include_unfinished else f" (bỏ {n_rows_raw - len(df)} dòng chưa completed)"))
    P("Phân bố verdict: " + ", ".join(f"{k}={v:.1%}" for k, v in dist.items()))

    # Complete data: every question must have every annotator
    per_unit = df.groupby("draft_id")["annotator_id"].nunique()
    incomplete = per_unit[per_unit < n_ann]
    if len(incomplete):
        P(f"CẢNH BÁO: {len(incomplete)}/{n_unit} câu thiếu người chấm (cần {n_ann}). Fleiss kappa giả định đủ người;"
          " alpha vẫn đúng. Người còn thiếu:")
        names = df.drop_duplicates("annotator_id").set_index("annotator_id")["annotator_name"]
        for ann, name in names.items():
            have = set(df.loc[df["annotator_id"] == ann, "draft_id"])
            miss = df[df["draft_id"].isin(incomplete.index) & ~df["draft_id"].isin(have)].drop_duplicates("draft_id")
            if len(miss):
                vids = sorted(miss["filename"].unique())
                P(f"  {name}: thiếu {len(miss)} câu, {len(vids)} video, ví dụ {', '.join(vids[:3])}")
    else:
        P(f"Đủ dữ liệu: mọi câu có đủ {n_ann} người chấm.")
    P("")
    vu = verdict_units(df)
    ci_v = bootstrap(df, a_verdict, n=args.boot)
    ci_k = bootstrap(df, k_fleiss, n=args.boot)
    ci_g = bootstrap(df, ac1, n=args.boot)
    P("TẦNG 1 - VERDICT (nominal), 95% CI bootstrap theo video")
    P(f"  % đồng ý từng cặp      : {pairwise_pct(vu):.3f}")
    P(f"  Fleiss kappa           : {k_fleiss(df):.3f}   CI [{ci_k[0]:.3f}, {ci_k[1]:.3f}]")
    P(f"  Krippendorff alpha     : {a_verdict(df):.3f}   CI [{ci_v[0]:.3f}, {ci_v[1]:.3f}]")
    P(f"  Gwet AC1               : {ac1(df):.3f}   CI [{ci_g[0]:.3f}, {ci_g[1]:.3f}]")
    P("")
    asem = a_sem(df)
    ci_s = bootstrap(df, a_sem, n=min(args.boot, 300))
    P("TẦNG 2 - NỘI DUNG CÂU TRẢ LỜI CUỐI (alpha với khoảng cách ngữ nghĩa)")
    P(f"  Krippendorff alpha_sem : {asem:.3f}   95% CI: [{ci_s[0]:.3f}, {ci_s[1]:.3f}]")
    P(f"  Nguồn sim: {'LLM judge + lexical dự phòng' if judge else 'CHỈ lexical (tạm) - cần điểm LLM judge'}")
    P("")

    # Per question group
    rows = []
    for qg, g in df.groupby("qgroup"):
        u = verdict_units(g)
        rows.append({
            "qgroup": qg, "n_units": len(u),
            "pct_pair_agree": round(pairwise_pct(u), 3),
            "fleiss_kappa": round(fleiss_kappa(u), 3),
            "alpha_verdict": round(a_verdict(g), 3),
            "ac1_verdict": round(gwet_ac1(u), 3),
            "alpha_semantic": round(a_sem(g), 3),
            "share_DISAGREE": round((g["verdict"] == "DISAGREE").mean(), 3),
            "share_NA": round((g["verdict"] == "NOT_ANSWERABLE").mean(), 3),
        })
    by_q = pd.DataFrame(rows).sort_values("pct_pair_agree")
    by_q.to_csv(f"{args.out}/by_qgroup.csv", index=False)
    P("THEO NHÓM CÂU HỎI (sắp theo % đồng ý tăng dần)")
    P(by_q.to_string(index=False))
    P("")

    # Per annotator: how often they match the majority of THE OTHERS
    rows = []
    for ann, ga in df.groupby("annotator_id"):
        hit, tot = 0, 0
        for unit, g in df.groupby("draft_id"):
            mine = g.loc[g["annotator_id"] == ann, "verdict"]
            others = g.loc[g["annotator_id"] != ann, "verdict"]
            if len(mine) and len(others):
                maj = others.mode()
                if len(maj) == 1:
                    tot += 1
                    hit += mine.iloc[0] == maj.iloc[0]
        rest = df[df["annotator_id"] != ann]
        rows.append({
            "annotator": ga["annotator_name"].iloc[0],
            "agree_with_others_majority": round(hit / tot, 3) if tot else np.nan,
            "alpha_without_this_person": round(a_verdict(rest), 3) if rest["annotator_id"].nunique() >= 2 else np.nan,
            "share_DISAGREE": round((ga["verdict"] == "DISAGREE").mean(), 3),
            "share_NA": round((ga["verdict"] == "NOT_ANSWERABLE").mean(), 3),
        })
    by_a = pd.DataFrame(rows)
    by_a.to_csv(f"{args.out}/by_annotator.csv", index=False)
    P("THEO ANNOTATOR")
    P(by_a.to_string(index=False))
    if n_ann < 3:
        P("  (Chỉ có 2 người: cột 'alpha_without_this_person' chưa có ý nghĩa, cần >= 3 người.)")
    P("")

    # Event label (accident / near-miss), one value per annotator per video
    ev = df.groupby(["video_id", "annotator_id"])["event_label"].agg(lambda s: s.mode().iloc[0]).reset_index()
    ev_units = [g["event_label"].tolist() for _, g in ev.groupby("video_id")]
    P("NHÃN EVENT (accident / near-miss, cấp video)")
    P(f"  % đồng ý từng cặp: {pairwise_pct(ev_units):.3f} | alpha: {kripp_alpha(ev_units, nominal):.3f} (chỉ {len(ev_units)} video, CI sẽ rất rộng)")
    P("")

    # Pairs for the LLM judge
    pairs = []
    for unit, g in df.groupby("draft_id"):
        recs = g[["annotator_name", "verdict", "ans", "qgroup", "question", "draft_answer", "filename"]].to_dict("records")
        for x, y in itertools.combinations(recs, 2):
            if x["ans"] != y["ans"] and NA_TOKEN not in (x["ans"], y["ans"]):
                pairs.append({
                    "filename": x["filename"], "qgroup": x["qgroup"], "question": x["question"],
                    "draft_answer": x["draft_answer"],
                    "annotator_a": x["annotator_name"], "verdict_a": x["verdict"], "answer_a": x["ans"],
                    "annotator_b": y["annotator_name"], "verdict_b": y["verdict"], "answer_b": y["ans"],
                    "lexical_sim": round(lexical_sim(x["ans"], y["ans"]), 3),
                    "judge_score": "",
                })
    pd.DataFrame(pairs).to_csv(f"{args.out}/pairs_to_judge.csv", index=False)
    P(f"Đã xuất {len(pairs)} cặp câu khác nhau cần LLM judge -> {args.out}/pairs_to_judge.csv")

    qf = quality_flags(df)
    qf.to_csv(f"{args.out}/quality_flags.csv", index=False)
    P(f"Cảnh báo chất lượng dữ liệu: {len(qf)} dòng -> {args.out}/quality_flags.csv")
    if len(qf):
        P(qf[["filename", "annotator", "qgroup", "issue"]].to_string(index=False))

    report = "\n".join(lines)
    with open(f"{args.out}/report.txt", "w", encoding="utf-8") as f:
        f.write(report + "\n")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # the Windows console defaults to cp1252
    print(report)


if __name__ == "__main__":
    main()
