"""Entity letters are compared by the vehicle they name in group E, not by the letter.

Each annotator names entities A, B, C themselves; before the stable E naming
rule (2026-11-23) two annotators routinely used swapped letters for the same
two vehicles, which made C/O/Attr/Prev look like disagreements about roles.
"""

import json

import pandas as pd

from scripts.entity_match import match_entities
from scripts.iaa_round import pairwise_counts, slot_signature


def entity(key, vtype, color=None, clothing=None):
    cells = {"type": {"option": f"type.{vtype}"}}
    if color:
        cells["vehicle_color"] = {"option": f"vehicle_color.{color}"}
    if clothing:
        cells["clothing_color"] = {"option": f"clothing_color.{clothing}"}
    return {"key": key, "cells": cells}


def rows(annotator, entities, subject, obj=None):
    c_slots = {"event_type": {"option": "event_type.collision"}, "subject": {"entity": subject}}
    if obj:
        c_slots["object"] = {"entity": obj}
    base = {"video_id": "v1", "annotator_id": annotator, "annotator_name": annotator,
            "answer_format": "slots", "assignment_status": "completed"}
    return [
        {**base, "qgroup": "E", "codebook_version": "E.v4", "draft_id": "dE",
         "slots": json.dumps({"entities": entities})},
        {**base, "qgroup": "C", "codebook_version": "C.v4", "draft_id": "dC",
         "slots": json.dumps(c_slots)},
    ]


def c_slots(df):
    return {r.annotator_id: json.loads(r.slots) for r in df[df.qgroup == "C"].itertuples()}


def c_agreement(df):
    c = df[df.qgroup == "C"]
    agree, total = pairwise_counts([[slot_signature(s, "C.v4") for s in c.slots]])
    return agree / total


TRUCK = ("truck", "white")
MOTO = ("motorbike", "black", "red")


def test_swapped_letters_for_the_same_vehicles_agree_after_matching():
    df = pd.DataFrame(
        rows("a1", [entity("A", *TRUCK), entity("B", *MOTO)], "B", "A")
        + rows("a2", [entity("A", *MOTO), entity("B", *TRUCK)], "A", "B")
    )
    letter_pairs = {k: (v["subject"]["entity"], v["object"]["entity"]) for k, v in c_slots(df).items()}
    assert letter_pairs["a1"] != letter_pairs["a2"]

    matched, stats = match_entities(df)
    pairs = {k: (v["subject"]["entity"], v["object"]["entity"]) for k, v in c_slots(matched).items()}
    assert pairs["a1"] == pairs["a2"]
    assert stats["remapped"] == 2 and stats["ambiguous"] == 0 and stats["unmatched"] == 0


def test_group_e_itself_is_never_rewritten():
    df = pd.DataFrame(
        rows("a1", [entity("A", *TRUCK), entity("B", *MOTO)], "B", "A")
        + rows("a2", [entity("A", *MOTO), entity("B", *TRUCK)], "A", "B")
    )
    matched, _ = match_entities(df)
    assert matched[matched.qgroup == "E"].slots.tolist() == df[df.qgroup == "E"].slots.tolist()


def test_identical_vehicles_keep_their_letters_and_are_counted_ambiguous():
    same = [entity("A", "motorbike", "black"), entity("B", "motorbike", "black")]
    df = pd.DataFrame(rows("a1", same, "A", "B") + rows("a2", same, "B", "A"))
    matched, stats = match_entities(df)
    assert c_slots(matched) == c_slots(df)
    assert stats["ambiguous"] == 2


def test_an_entity_only_one_annotator_declared_never_matches_anyone():
    df = pd.DataFrame(
        rows("a1", [entity("A", *TRUCK), entity("B", *MOTO)], "A", "B")
        + rows("a2", [entity("A", *TRUCK), entity("B", *MOTO)], "A", "B")
        + rows("a3", [entity("A", *TRUCK), entity("B", *MOTO), entity("C", "car", "red")], "C", "A")
        + rows("a4", [entity("A", "pedestrian")], "A")
    )
    matched, stats = match_entities(df)
    slots = c_slots(matched)
    assert slots["a3"]["object"]["entity"] == "A"
    third = slots["a3"]["subject"]["entity"]
    lone = slots["a4"]["subject"]["entity"]
    assert third not in {"A", "B", "C"} and lone not in {"A", "B", "C"} and third != lone
    assert stats["unmatched"] == 2


def test_matching_raises_c_agreement_when_only_the_letters_differed():
    df = pd.DataFrame(
        rows("a1", [entity("A", *TRUCK), entity("B", *MOTO)], "B", "A")
        + rows("a2", [entity("A", *MOTO), entity("B", *TRUCK)], "A", "B")
        + rows("a3", [entity("A", *TRUCK), entity("B", *MOTO)], "B", "A")
    )
    matched, _ = match_entities(df)
    assert c_agreement(df) < 1
    assert c_agreement(matched) == 1


def test_without_colors_same_type_vehicles_keep_their_positional_letters():
    # Two black/red motorbikes told apart only by color in legacy rows.
    a = [entity("A", "motorbike", "black"), entity("B", "motorbike", "red")]
    b = [entity("A", "motorbike", "red"), entity("B", "motorbike", "black")]
    df = pd.DataFrame(rows("a1", a, "A", "B") + rows("a2", b, "B", "A"))
    with_colors, stats = match_entities(df)
    assert c_slots(with_colors)["a2"]["subject"]["entity"] == "A" and stats["remapped"] == 2
    without, stats = match_entities(df, use_colors=False)
    assert c_slots(without) == c_slots(df) and stats["ambiguous"] == 2


def test_type_outweighs_any_color_match():
    a = [entity("A", "truck", "white"), entity("B", "car", "black")]
    b = [entity("A", "car", "white"), entity("B", "truck", "black")]
    df = pd.DataFrame(rows("a1", a, "A", "B") + rows("a2", b, "B", "A"))
    matched, _ = match_entities(df)
    assert c_slots(matched)["a2"]["subject"]["entity"] == "A"


def test_e_v6_parties_without_colours_keep_the_positional_letter_on_a_tie():
    """features/e-v6-no-colors: two colourless motorbikes cannot be told apart by E, so each keeps its letter."""
    df = pd.DataFrame(rows("ann1", [entity("A", "motorbike"), entity("B", "motorbike")], "A", "B")
                      + rows("ann2", [entity("A", "motorbike"), entity("B", "motorbike")], "A", "B"))
    df.loc[df.qgroup == "E", "codebook_version"] = "E.v6"
    matched, stats = match_entities(df)
    assert c_slots(matched)["ann2"]["subject"] == {"entity": "A"}
    assert c_agreement(matched) == 1.0
