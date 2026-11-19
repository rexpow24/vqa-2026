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

Rows of a slot assignment (answer_format = slots) are excluded from the text
verdict and semantic-answer metrics. Their structured selections are compared
separately in Tier 3, grouped by question group and codebook version. One unit
is the canonicalized `slots` JSON after cells marked `required: false` in its
codebook have been removed. An export without the answer_format column
predates slot answers and is read as all text.

Usage:
  python scripts/iaa_round.py answers.csv --out out_dir
  python scripts/iaa_round.py answers.csv --exclude-groups N C V --out out_without_ncv
  python scripts/iaa_round.py answers.csv --exclude-annotators "Annotator Name" --out out_without_person
  # score out_dir/pairs_to_judge.csv with the LLM judge (column judge_score in 0..1), then:
  python scripts/iaa_round.py answers.csv --out out_dir --judge out_dir/pairs_judged.csv

Needs pandas and numpy only. The report text is Vietnamese, for the labeling team.
"""
from __future__ import annotations

import argparse
import itertools
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from functools import lru_cache

import numpy as np
import pandas as pd

NA_TOKEN = "<NA>"
# The app writes "Không trả lời được" as the effective answer of every
# NOT_ANSWERABLE row; the guideline's phrase is folded in too.
NA_PHRASES = {"không trả lời được", "không thể xác định"}
VERDICTS = ["AGREE", "DISAGREE", "NOT_ANSWERABLE"]


def text_rows(df):
    """Rows of text assignments only; an export without answer_format has no others."""
    if "answer_format" not in df:
        return df
    return df[df["answer_format"] == "text"].copy()


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
        if dist is nominal:
            counts = Counter(u).values()
            disagreeing_pairs = m * m - sum(count * count for count in counts)
        else:
            disagreeing_pairs = sum(dist(a, b, True) for a, b in itertools.permutations(u, 2))
        do += disagreeing_pairs / (m - 1)
    do /= n
    # De: expected disagreement between any two values, regardless of unit
    vals = [v for u in units for v in u]
    uniq, counts = np.unique(np.array(vals, dtype=object), return_counts=True)
    if dist is nominal:
        # For nominal distance, every unequal pair has distance 1. Avoid the
        # quadratic loop over distinct structured answers during each bootstrap.
        de = (n * n - sum(count * count for count in counts)) / (n * (n - 1))
    else:
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
    p_bar, totals, n_ratings = 0.0, Counter(), 0
    allowed = set(categories) if categories is not None else None
    for u in units:
        r = len(u)
        cnt = Counter(u)
        if allowed is not None:
            cnt = Counter({category: count for category, count in cnt.items() if category in allowed})
        p_bar += (sum(count * count for count in cnt.values()) - r) / (r * (r - 1))
        totals.update(cnt)
        n_ratings += r
    p_bar /= len(units)
    pe = sum((count / n_ratings) ** 2 for count in totals.values())
    return (p_bar - pe) / (1 - pe) if pe < 1 else np.nan


def gwet_ac1(units, categories=VERDICTS):
    units = [u for u in units if len(u) >= 2]
    if not units:
        return np.nan
    q = len(categories)
    if q < 2:
        return 1.0 if all(len(set(u)) == 1 for u in units) else np.nan
    pa, pi = 0.0, defaultdict(float)
    allowed = set(categories) if categories is not None else None
    for u in units:
        r = len(u)
        cnt = Counter(u)
        if allowed is not None:
            cnt = Counter({category: count for category, count in cnt.items() if category in allowed})
        pa += sum(count * (count - 1) for count in cnt.values()) / (r * (r - 1))
        for category, count in cnt.items():
            pi[category] += count / r
    pa /= len(units)
    pi_values = [value / len(units) for value in pi.values()]
    pe = sum(value * (1 - value) for value in pi_values) / (q - 1)
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


@lru_cache(maxsize=None)
def optional_cell_ids(codebook_version):
    """Cell IDs marked required=false in the matching local codebook."""
    if not codebook_version:
        return frozenset()
    codebook_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "codebook", f"{codebook_version}.json",
    )
    if not os.path.isfile(codebook_path):
        raise ValueError(f"Không tìm thấy codebook {codebook_version}: {codebook_path}")
    with open(codebook_path, encoding="utf-8") as handle:
        codebook = json.load(handle)
    return frozenset(
        cell["id"] for cell in codebook.get("cells", [])
        if cell.get("required") is False and "id" in cell
    )


def slot_signature(value, codebook_version=""):
    """Canonical answer with optional codebook cells removed from agreement scoring."""
    if value is None or (isinstance(value, float) and np.isnan(value)) or value == "":
        return "<MISSING>"
    try:
        parsed = json.loads(value) if isinstance(value, str) else value
    except (TypeError, json.JSONDecodeError):
        parsed = value

    if not codebook_version:
        raise ValueError(
            "Câu trả lời dạng ô không có codebook_version; cần export CSV có phiên bản codebook "
            "để xác định các ô optional."
        )
    optional_ids = optional_cell_ids(str(codebook_version or ""))

    def remove_optional(node):
        if isinstance(node, dict):
            return {
                key: remove_optional(child)
                for key, child in node.items()
                if key not in optional_ids
            }
        if isinstance(node, list):
            return [remove_optional(child) for child in node]
        return node

    parsed = remove_optional(parsed)
    return json.dumps(parsed, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def slot_answer_units(df):
    """One categorical structured answer per annotator and question."""
    return [g["slot_value"].tolist() for _, g in df.groupby(unit_key(df))]


def pairwise_counts(units):
    """Return exact matching pair count and total pair count across units."""
    agree, total = 0, 0
    for unit in units:
        for a, b in itertools.combinations(unit, 2):
            total += 1
            agree += a == b
    return agree, total


def alpha_interpretation(value):
    """Krippendorff's conventional alpha bands for reliability decisions."""
    if value is None or np.isnan(value):
        return "không tính được"
    if value >= 0.8:
        return "đạt ngưỡng 0.800"
    if value >= 0.667:
        return "0.667-0.800: chỉ kết luận thăm dò"
    return "dưới 0.667"


def slot_alpha_overview(data):
    """Summarize nominal alpha across separate question/codebook variables."""
    rows = []
    grouping = ["qgroup", "codebook_version"] if "codebook_version" in data else ["qgroup"]
    for keys, group in data.groupby(grouping, dropna=False):
        alpha = kripp_alpha(slot_answer_units(group), nominal)
        label = " / ".join(str(x) for x in keys) if isinstance(keys, tuple) else str(keys)
        rows.append((label, alpha))
    valid_rows = [(label, value) for label, value in rows if not np.isnan(value)]
    values = [value for _, value in valid_rows]
    return {
        "n_groups": len(rows),
        "reliable": sum(value >= 0.8 for value in values),
        "tentative": sum(0.667 <= value < 0.8 for value in values),
        "below": sum(value < 0.667 for value in values),
        "min": min(values) if values else np.nan,
        "min_group": min(valid_rows, key=lambda row: row[1])[0] if values else "",
        "groups": rows,
    }


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
    ap.add_argument("--exclude-groups", nargs="+", metavar="QGROUP", default=[],
                    help="exclude one or more question groups (for example: --exclude-groups N C V); report compares before and after")
    ap.add_argument("--exclude-annotators", nargs="+", metavar="ID_OR_NAME", default=[],
                    help="exclude annotators by ID or exact name; report compares agreement before and after")
    args = ap.parse_args(argv)
    os.makedirs(args.out, exist_ok=True)

    source = pd.read_csv(args.csv, dtype=str, keep_default_na=False, encoding="utf-8-sig")
    slot_df = source[source["answer_format"] == "slots"].copy() if "answer_format" in source else source.iloc[0:0].copy()
    df = text_rows(source)
    n_slot_rows = len(slot_df)
    n_rows_raw = len(df)
    if not args.include_unfinished and "assignment_status" in df:
        df = df[df["assignment_status"] == "completed"].copy()
    n_rows_completed = len(df)
    if not args.include_unfinished and "assignment_status" in slot_df:
        slot_df = slot_df[slot_df["assignment_status"] == "completed"].copy()
    n_slot_rows_completed = len(slot_df)
    if len(slot_df):
        if "slots" not in slot_df:
            raise ValueError("CSV has answer_format=slots but no slots column; export it again from the updated app.")
        slot_df["slot_value"] = slot_df.apply(
            lambda row: slot_signature(row["slots"], row.get("codebook_version", "")), axis=1,
        )
        if "codebook_version" in slot_df:
            slot_df["_unit_suffix"] = slot_df["codebook_version"].fillna("")
    df["verdict"] = df["verdict"].str.strip().str.upper().str.replace("-", "_")
    df["ans"] = df.apply(norm_answer, axis=1)

    excluded_groups = {group.strip().upper() for group in args.exclude_groups}
    source_groups = set(df["qgroup"].astype(str).str.upper()) | set(slot_df["qgroup"].astype(str).str.upper())
    unknown_groups = excluded_groups - source_groups
    if unknown_groups:
        raise ValueError(f"Không tìm thấy nhóm cần loại: {', '.join(sorted(unknown_groups))}. Nhóm có trong CSV: {', '.join(sorted(source_groups))}")
    if excluded_groups:
        df = df[~df["qgroup"].astype(str).str.upper().isin(excluded_groups)].copy()
        slot_df = slot_df[~slot_df["qgroup"].astype(str).str.upper().isin(excluded_groups)].copy()
    df_before_annotator_exclusion = df.copy()
    slot_before_annotator_exclusion = slot_df.copy()
    excluded_annotators = set()
    excluded_annotator_names = {}
    if args.exclude_annotators:
        people = pd.concat([
            df[["annotator_id", "annotator_name"]],
            slot_df[["annotator_id", "annotator_name"]],
        ], ignore_index=True).drop_duplicates("annotator_id")
        people["annotator_id"] = people["annotator_id"].astype(str)
        people["annotator_name"] = people["annotator_name"].astype(str)
        for requested in args.exclude_annotators:
            needle = requested.strip().casefold()
            matched = people[
                (people["annotator_id"].str.casefold() == needle)
                | (people["annotator_name"].str.casefold() == needle)
            ]
            if matched.empty:
                known = ", ".join(
                    f"{row.annotator_name} (ID: {row.annotator_id})"
                    for row in people.itertuples(index=False)
                )
                raise ValueError(f"Không tìm thấy annotator '{requested}'. Có trong CSV: {known}")
            for row in matched.itertuples(index=False):
                excluded_annotators.add(row.annotator_id)
                excluded_annotator_names[row.annotator_id] = row.annotator_name
        df = df[~df["annotator_id"].astype(str).isin(excluded_annotators)].copy()
        slot_df = slot_df[~slot_df["annotator_id"].astype(str).isin(excluded_annotators)].copy()
    n_slot_rows = len(slot_df)
    if len(df) == 0 and len(slot_df) == 0:
        raise ValueError("Không còn dữ liệu sau khi áp dụng bộ lọc nhóm/người gán nhãn đã chọn.")

    judge = {}
    if args.judge:
        j = pd.read_csv(args.judge)
        for _, r in j.iterrows():
            a, b = norm_text(r["answer_a"]), norm_text(r["answer_b"])
            judge[(a, b) if a < b else (b, a)] = float(r["judge_score"])
    sem = make_semantic_dist(judge)

    reporting_rows = df if len(df) else slot_df
    n_ann = reporting_rows["annotator_id"].nunique()
    n_vid = reporting_rows["video_id"].nunique()
    n_unit = reporting_rows["draft_id"].nunique()
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
    if excluded_groups:
        P("PHÂN TÍCH ẢNH HƯỞNG KHI LOẠI NHÓM")
        P(f"  Nhóm bị loại: {', '.join(sorted(excluded_groups))}")
        if n_slot_rows:
            original_slots = source[source["answer_format"] == "slots"].copy() if "answer_format" in source else source.iloc[0:0].copy()
            if not args.include_unfinished and "assignment_status" in original_slots:
                original_slots = original_slots[original_slots["assignment_status"] == "completed"].copy()
            original_slots["slot_value"] = original_slots.apply(
                lambda row: slot_signature(row["slots"], row.get("codebook_version", "")), axis=1,
            )
            if "codebook_version" in original_slots:
                original_slots["_unit_suffix"] = original_slots["codebook_version"].fillna("")
            before_units = slot_answer_units(original_slots)
            after_units = slot_answer_units(slot_df)
            before_agree, before_total = pairwise_counts(before_units)
            after_agree, after_total = pairwise_counts(after_units)
            before_alpha = slot_alpha_overview(original_slots)
            after_alpha = slot_alpha_overview(slot_df)
            before_pct = before_agree / before_total if before_total else np.nan
            after_pct = after_agree / after_total if after_total else np.nan
            delta = after_pct - before_pct if not np.isnan(before_pct) and not np.isnan(after_pct) else np.nan
            P("  Lựa chọn dạng ô: % cặp khớp chính xác trong cùng câu hỏi")
            P(f"    Trước: {before_pct:.3f} ({before_agree}/{before_total} cặp), {len(before_units)} câu")
            P(f"    Sau  : {after_pct:.3f} ({after_agree}/{after_total} cặp), {len(after_units)} câu")
            P(f"    Thay đổi: {delta:+.3f} ({delta * 100:+.1f} điểm phần trăm)" if not np.isnan(delta) else "    Thay đổi: không đủ dữ liệu để tính")
            P("  Krippendorff alpha nominal theo từng nhóm/codebook:")
            P(f"    Trước: {before_alpha['reliable']} nhóm >= 0.800; {before_alpha['tentative']} nhóm 0.667-0.800; {before_alpha['below']} nhóm < 0.667.")
            P(f"    Sau  : {after_alpha['reliable']} nhóm >= 0.800; {after_alpha['tentative']} nhóm 0.667-0.800; {after_alpha['below']} nhóm < 0.667.")
            P(f"    Alpha thấp nhất sau lọc: {after_alpha['min']:.3f} ({after_alpha['min_group']})" if after_alpha["groups"] else "    Alpha thấp nhất sau lọc: không tính được")
            P("  Từng nhóm bị loại:")
            for qgroup in sorted(excluded_groups):
                group = original_slots[original_slots["qgroup"].astype(str).str.upper() == qgroup]
                units = slot_answer_units(group)
                agree, total = pairwise_counts(units)
                pct = agree / total if total else np.nan
                alpha = kripp_alpha(units, nominal)
                P(f"    {qgroup}: {len(units)} câu, khớp cặp {pct:.3f}; alpha {alpha:.3f} ({alpha_interpretation(alpha)})" if total else f"    {qgroup}: {len(units)} câu, chưa đủ cặp để tính alpha")
            P("  Kết quả theo nhóm còn lại sẽ được in ở TẦNG 3 bên dưới.")
        if len(df):
            P(f"  Văn bản: còn {df['qgroup'].nunique()} nhóm, {df['draft_id'].nunique()} câu hỏi, {len(df)} dòng.")
        P("")
    if excluded_annotators:
        P("PHÂN TÍCH ẢNH HƯỞNG KHI LOẠI ANNOTATOR")
        P("  Người bị loại: " + ", ".join(
            f"{excluded_annotator_names[ann]} (ID: {ann})" for ann in sorted(excluded_annotators)
        ))
        P(f"  Dòng bị loại: {len(df_before_annotator_exclusion) - len(df)} văn bản; "
          f"{len(slot_before_annotator_exclusion) - len(slot_df)} lựa chọn dạng ô.")
        if len(df_before_annotator_exclusion):
            alpha_before = kripp_alpha(verdict_units(df_before_annotator_exclusion), nominal)
            alpha_after = kripp_alpha(verdict_units(df), nominal)
            P("  Krippendorff alpha nominal cho verdict:")
            P(f"    Trước: {alpha_before:.3f} ({alpha_interpretation(alpha_before)})" if not np.isnan(alpha_before) else "    Trước: không tính được")
            P(f"    Sau  : {alpha_after:.3f} ({alpha_interpretation(alpha_after)})" if not np.isnan(alpha_after) else "    Sau  : không tính được")
        if len(slot_before_annotator_exclusion):
            before_units = slot_answer_units(slot_before_annotator_exclusion)
            after_units = slot_answer_units(slot_df)
            before_agree, before_total = pairwise_counts(before_units)
            after_agree, after_total = pairwise_counts(after_units)
            before_pct = before_agree / before_total if before_total else np.nan
            after_pct = after_agree / after_total if after_total else np.nan
            before_alpha = slot_alpha_overview(slot_before_annotator_exclusion)
            after_alpha = slot_alpha_overview(slot_df)
            P("  Lựa chọn dạng ô (khớp chính xác trong cùng câu hỏi):")
            P(f"    Cặp khớp trước: {before_pct:.3f} ({before_agree}/{before_total})" if not np.isnan(before_pct) else "    Cặp khớp trước: không tính được")
            P(f"    Cặp khớp sau  : {after_pct:.3f} ({after_agree}/{after_total})" if not np.isnan(after_pct) else "    Cặp khớp sau  : không tính được")
            P(f"    Alpha theo nhóm/codebook đạt >= 0.800: {before_alpha['reliable']} trước, {after_alpha['reliable']} sau.")
            P(f"    Alpha thấp nhất sau: {after_alpha['min']:.3f} ({after_alpha['min_group']})" if after_alpha["groups"] else "    Alpha sau: không tính được")
        P("  Các bảng và chỉ số bên dưới dùng dữ liệu sau khi đã loại annotator.")
        P("")
    if len(df):
        P(f"Dữ liệu văn bản: {n_ann} người | {n_vid} video | {n_unit} câu hỏi | {len(df)} dòng"
          + ("" if args.include_unfinished else f" (bỏ {n_rows_raw - n_rows_completed} dòng chưa completed)"))
    if n_slot_rows:
        P(f"Dữ liệu lựa chọn: {slot_df['annotator_id'].nunique()} người | {slot_df['video_id'].nunique()} video | {slot_df['draft_id'].nunique()} câu hỏi | {n_slot_rows} dòng.")
        P("Ô có required=false trong codebook đã được bỏ khỏi phép tính đồng thuận.")
    if excluded_groups:
        P(f"Đã loại thêm {n_rows_completed - len(df)} dòng văn bản và {n_slot_rows_completed - n_slot_rows} dòng dạng ô theo nhóm.")
    if len(df):
        P("Phân bố verdict: " + ", ".join(f"{k}={v:.1%}" for k, v in dist.items()))
    elif n_slot_rows:
        P("CSV chỉ có câu trả lời dạng ô: bỏ qua các tầng dành cho verdict và câu trả lời văn bản.")

    # Complete data: every question must have every annotator
    per_unit = df.groupby("draft_id")["annotator_id"].nunique()
    incomplete = per_unit[per_unit < df["annotator_id"].nunique()] if len(df) else per_unit
    if len(df) and len(incomplete):
        P(f"CẢNH BÁO: {len(incomplete)}/{n_unit} câu thiếu người chấm (cần {n_ann}). Fleiss kappa giả định đủ người;"
          " alpha vẫn đúng. Người còn thiếu:")
        names = df.drop_duplicates("annotator_id").set_index("annotator_id")["annotator_name"]
        for ann, name in names.items():
            have = set(df.loc[df["annotator_id"] == ann, "draft_id"])
            miss = df[df["draft_id"].isin(incomplete.index) & ~df["draft_id"].isin(have)].drop_duplicates("draft_id")
            if len(miss):
                vids = sorted(miss["filename"].unique())
                P(f"  {name}: thiếu {len(miss)} câu, {len(vids)} video, ví dụ {', '.join(vids[:3])}")
    elif len(df):
        P(f"Đủ dữ liệu: mọi câu có đủ {n_ann} người chấm.")
    P("")
    vu = verdict_units(df)
    if len(df):
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
    else:
        P("TẦNG 1-2: bỏ qua vì CSV không có câu trả lời dạng văn bản.")
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
    by_q = pd.DataFrame(rows, columns=["qgroup", "n_units", "pct_pair_agree", "fleiss_kappa",
                                      "alpha_verdict", "ac1_verdict", "alpha_semantic",
                                      "share_DISAGREE", "share_NA"]).sort_values("pct_pair_agree")
    by_q.to_csv(f"{args.out}/by_qgroup.csv", index=False)
    if len(df):
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
    if len(df):
        P("THEO ANNOTATOR")
        P(by_a.to_string(index=False))
    if len(df) and n_ann < 3:
        P("  (Chỉ có 2 người: cột 'alpha_without_this_person' chưa có ý nghĩa, cần >= 3 người.)")
        P("")

    # Event label (accident / near-miss), one value per annotator per video
    if len(df):
        ev = df.groupby(["video_id", "annotator_id"])["event_label"].agg(lambda s: s.mode().iloc[0]).reset_index()
        ev_units = [g["event_label"].tolist() for _, g in ev.groupby("video_id")]
        P("NHÃN EVENT (accident / near-miss, cấp video)")
        P(f"  % đồng ý từng cặp: {pairwise_pct(ev_units):.3f} | alpha: {kripp_alpha(ev_units, nominal):.3f} (chỉ {len(ev_units)} video, CI sẽ rất rộng)")
    else:
        P("Nhãn EVENT: bỏ qua vì CSV không có câu trả lời dạng văn bản.")
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

    # Slot answers are compared after removing optional codebook cells.
    # Keep codebook versions separate because their option IDs may not be comparable.
    slot_rows = []
    for (qgroup, version), group in slot_df.groupby(
            ["qgroup", "codebook_version"] if "codebook_version" in slot_df else ["qgroup"], dropna=False):
        units = slot_answer_units(group)
        slot_alpha = lambda data: kripp_alpha(slot_answer_units(data), nominal)
        slot_kappa = lambda data: fleiss_kappa(slot_answer_units(data), categories=sorted(data["slot_value"].unique()))
        slot_ac1 = lambda data: gwet_ac1(slot_answer_units(data), categories=sorted(data["slot_value"].unique()))
        ci_alpha = bootstrap(group, slot_alpha, n=args.boot)
        ci_kappa = bootstrap(group, slot_kappa, n=args.boot)
        ci_ac1 = bootstrap(group, slot_ac1, n=args.boot)
        alpha = slot_alpha(group)
        kappa = slot_kappa(group)
        ac1_value = slot_ac1(group)
        label = f"{qgroup} / {version}" if "codebook_version" in slot_df else str(qgroup)
        optional_fields = optional_cell_ids(str(version)) if "codebook_version" in slot_df else frozenset()
        P("")
        P(f"TẦNG 3 - LỰA CHỌN THEO Ô ({label}), 95% CI bootstrap theo video")
        P("  Ô tùy chọn bỏ qua       : " + (", ".join(sorted(optional_fields)) if optional_fields else "không có"))
        P(f"  % đáp án ô trùng khớp : {pairwise_pct(units):.3f}")
        P(f"  Fleiss kappa           : {kappa:.3f}   CI [{ci_kappa[0]:.3f}, {ci_kappa[1]:.3f}]")
        P(f"  Krippendorff alpha     : {alpha:.3f}   CI [{ci_alpha[0]:.3f}, {ci_alpha[1]:.3f}]")
        P(f"  Đánh giá theo ngưỡng   : {alpha_interpretation(alpha)}")
        P(f"  Gwet AC1               : {ac1_value:.3f}   CI [{ci_ac1[0]:.3f}, {ci_ac1[1]:.3f}]")
        slot_rows.append({
            "qgroup": qgroup, "codebook_version": version if "codebook_version" in slot_df else "",
            "optional_cells_excluded": ";".join(sorted(optional_fields)),
            "n_units": len(units), "n_annotators": group["annotator_id"].nunique(),
            "pct_exact_slots": round(pairwise_pct(units), 3), "fleiss_kappa": round(kappa, 3),
            "alpha_slots": round(alpha, 3), "ac1_slots": round(ac1_value, 3),
            "alpha_threshold_status": alpha_interpretation(alpha),
        })
    slot_summary = pd.DataFrame(slot_rows, columns=["qgroup", "codebook_version", "optional_cells_excluded",
                                                    "n_units", "n_annotators",
                                                    "pct_exact_slots", "fleiss_kappa", "alpha_slots", "ac1_slots",
                                                    "alpha_threshold_status"])
    slot_summary.to_csv(f"{args.out}/by_slot_group.csv", index=False)
    if n_slot_rows:
        P(f"Đã đánh giá {n_slot_rows} dòng lựa chọn dạng ô; kết quả theo nhóm -> {args.out}/by_slot_group.csv")

    report = "\n".join(lines)
    with open(f"{args.out}/report.txt", "w", encoding="utf-8") as f:
        f.write(report + "\n")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # the Windows console defaults to cp1252
    print(report)


if __name__ == "__main__":
    main()
