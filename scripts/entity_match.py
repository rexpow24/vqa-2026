"""Match annotators' entity letters by the vehicle each letter names in group E.

Every annotator names the parties of a video A, B, C themselves. Until the
stable E naming rule (2026-11-23) two annotators often gave swapped letters to
the same two vehicles, so comparing {"entity": "A"} literally in C, O, Attr,
Prev, ... counted a naming difference as a disagreement about roles. The E
guideline already says entities are matched by identity, not by letter.

Per video, one reference annotator is picked deterministically (their entity
count is the most common one; ties go to the lowest annotator_id). Every other
annotator's letters are mapped onto the reference letters by the one-to-one
assignment that maximizes descriptor similarity (type counts most; a value of
"unclear" never matches). The result:

- a letter whose best target is unique is renamed to the reference letter;
- a letter whose best target is not unique (two identical black motorbikes)
  keeps its own letter and is counted as ambiguous;
- a letter with no similar reference entity (the annotator declared an extra
  party) gets a label no other annotator can have, so it never agrees.

Only references in groups other than E are rewritten. Group E itself is left
alone: the mapping maximizes E similarity, so remapping E would bias E upward.
"""
from __future__ import annotations

import itertools
import json
from collections import Counter

# Type decides; dashcam, size and riders refine it. Colors are being dropped from
# E (2026-11-23, too much disagreement), so they only break ties in legacy rows
# that still carry them, with the lowest weight. Without them, two vehicles of the
# same description stay ambiguous and keep their letter, which under the
# positional naming rule (dashcam A, then left-to-right, top-to-bottom) is itself
# the identity.
TYPE_WEIGHT = 10
CORE_WEIGHTS = {"dashcam": 2, "size": 2, "riders": 2}
COLOR_WEIGHTS = {"vehicle_color": 1, "clothing_color": 1}
DESCRIPTOR_CELLS = tuple(CORE_WEIGHTS) + tuple(COLOR_WEIGHTS)
# E guideline: "Xe máy điện được ghi là xe máy" (older E versions had a separate option).
TYPE_ALIASES = {"electric_two_wheeler": "motorbike"}


def _value(cells, cell):
    option = (cells.get(cell) or {}).get("option") if isinstance(cells.get(cell), dict) else None
    if not option:
        return None
    value = option.split(".", 1)[-1]
    if value == "unclear":
        return None
    return TYPE_ALIASES.get(value, value) if cell == "type" else value


def _descriptors(slots):
    try:
        parsed = json.loads(slots) if isinstance(slots, str) else slots
    except (TypeError, json.JSONDecodeError):
        return {}
    out = {}
    for item in (parsed or {}).get("entities", []) if isinstance(parsed, dict) else []:
        if isinstance(item, dict) and isinstance(item.get("key"), str):
            cells = item.get("cells") if isinstance(item.get("cells"), dict) else {}
            out[item["key"]] = {cell: _value(cells, cell) for cell in ("type",) + DESCRIPTOR_CELLS}
    return out


def _similarity(a, b, use_colors=True):
    score = TYPE_WEIGHT if a["type"] is not None and a["type"] == b["type"] else 0
    weights = {**CORE_WEIGHTS, **(COLOR_WEIGHTS if use_colors else {})}
    score += sum(w for cell, w in weights.items() if a[cell] is not None and a[cell] == b[cell])
    return score


def _optimal_mappings(own, reference, use_colors=True):
    """All one-to-one partial mappings own -> reference with the best total score."""
    own_keys, ref_keys = sorted(own), sorted(reference)
    best, winners = -1, []
    size = min(len(own_keys), len(ref_keys))
    for chosen in itertools.permutations(own_keys, size):
        for targets in itertools.permutations(ref_keys, size):
            pairs = {o: r for o, r in zip(chosen, targets) if _similarity(own[o], reference[r], use_colors) > 0}
            score = sum(_similarity(own[o], reference[r], use_colors) for o, r in pairs.items())
            if score > best:
                best, winners = score, [pairs]
            elif score == best and pairs not in winners:
                winners.append(pairs)
    return winners


def _mapping_for(own, reference, annotator, use_colors=True):
    winners = _optimal_mappings(own, reference, use_colors)
    mapping, ambiguous, unmatched = {}, 0, 0
    certain = {}
    for letter in own:
        targets = {w.get(letter) for w in winners}
        if len(targets) == 1 and None not in targets:
            certain[letter] = targets.pop()
    for letter in sorted(own):
        targets = {w.get(letter) for w in winners}
        if letter in certain:
            mapping[letter] = certain[letter]
        elif targets == {None}:
            mapping[letter] = f"{letter}@{annotator}"
            unmatched += 1
        else:
            # Keep the own letter unless a certain mapping already claimed it.
            mapping[letter] = letter if letter not in certain.values() else f"{letter}@{annotator}"
            ambiguous += 1
    return mapping, ambiguous, unmatched


def _rewrite(node, mapping):
    if isinstance(node, dict):
        return {
            key: (mapping.get(child, child) if key == "entity" and isinstance(child, str) else _rewrite(child, mapping))
            for key, child in node.items()
        }
    if isinstance(node, list):
        return [_rewrite(child, mapping) for child in node]
    return node


def match_entities(df, use_colors=True):
    """Return (df with non-E entity references renamed to shared identities, stats)."""
    stats = Counter(remapped=0, ambiguous=0, unmatched=0)
    if df.empty or "slots" not in df or "qgroup" not in df:
        return df, dict(stats)
    out = df.copy()
    is_e = out["qgroup"].astype(str) == "E"
    for video_id, video in out.groupby("video_id", sort=False):
        e_rows = video[is_e.loc[video.index] & (video["slots"].astype(str) != "")]
        declared = {}
        for row in e_rows.itertuples():
            declared.setdefault(str(row.annotator_id), _descriptors(row.slots))
        if len(declared) < 2:
            continue
        counts = Counter(len(entities) for entities in declared.values())
        mode = max(counts.values())
        reference_id = min(a for a, entities in declared.items() if counts[len(entities)] == mode)
        reference = declared[reference_id]
        for annotator, own in declared.items():
            if annotator == reference_id or not own:
                continue
            mapping, ambiguous, unmatched = _mapping_for(own, reference, annotator, use_colors)
            stats["ambiguous"] += ambiguous
            stats["unmatched"] += unmatched
            stats["remapped"] += sum(1 for k, v in mapping.items() if k != v and "@" not in v)
            if all(k == v for k, v in mapping.items()):
                continue
            targets = video.index[(video["annotator_id"].astype(str) == annotator) & ~is_e.loc[video.index]]
            for index in targets:
                raw = out.at[index, "slots"]
                if not isinstance(raw, str) or not raw:
                    continue
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                out.at[index, "slots"] = json.dumps(_rewrite(parsed, mapping), ensure_ascii=False)
    return out, dict(stats)


def apply_entity_match(df, mode, include_unfinished=False):
    """CLI helper: match on completed E rows (unless include_unfinished); returns (df, summary line)."""
    if mode == "letter":
        return df, "Ghép thực thể: so theo chữ A/B/C (--entity-match letter)."
    use_colors = mode != "identity-nocolor"
    if "slots" not in df or "qgroup" not in df or not (df["slots"].astype(str) != "").any():
        return df, ""
    basis = df
    if not include_unfinished and "assignment_status" in df:
        basis = df[df["assignment_status"].astype(str).str.casefold() == "completed"]
    matched, stats = match_entities(basis, use_colors)
    out = df.copy()
    out.loc[matched.index, "slots"] = matched["slots"]
    return out, (
        f"Ghép thực thể theo danh tính E{'' if use_colors else ' (bỏ màu)'}: "
        f"{stats['remapped']} chữ được đổi, {stats['ambiguous']} không phân biệt được (giữ nguyên), "
        f"{stats['unmatched']} không có bên tương ứng."
    )
