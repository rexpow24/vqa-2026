"""Checks for the two standard nominal alpha analyses and missing coders."""

import math

import pytest

from scripts.agreement_krippendorff import alpha_and_ci, video_units
from scripts.iaa_round import kripp_alpha, nominal


def test_three_coder_video_contributes_to_alpha():
    units = video_units({
        ("54", "q"): {"A": "y", "B": "y", "C": "y"},
        ("55", "q"): {"A": "x", "B": "x", "C": "x", "D": "y"},
    })
    assert len(units["54"][0]) == 3
    expected = kripp_alpha([units["54"][0], units["55"][0]], nominal)
    point, _, _ = alpha_and_ci(units, draws=10, seed=0)
    assert point == pytest.approx(expected)
    assert point != pytest.approx(kripp_alpha([units["55"][0]], nominal))


def test_single_coder_unit_does_not_contribute():
    units = video_units({
        ("54", "q"): {"A": "x"},
        ("55", "q"): {"A": "x", "B": "y"},
    })
    assert "54" not in units
    assert "55" in units


def test_bootstrap_is_deterministic_for_fixed_input_and_seed():
    units = video_units({
        ("54", "q"): {"A": "x", "B": "y", "C": "y"},
        ("55", "q"): {"A": "x", "B": "x", "C": "x", "D": "y"},
        ("56", "q"): {"A": "y", "B": "y", "C": "y", "D": "y"},
    })
    assert alpha_and_ci(units, draws=100, seed=0) == alpha_and_ci(units, draws=100, seed=0)


def test_alpha_is_undefined_when_every_value_is_identical():
    assert math.isnan(kripp_alpha([["same", "same"], ["same", "same", "same"]], nominal))
