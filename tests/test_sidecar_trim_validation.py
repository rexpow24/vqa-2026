"""Review validation must handle a shot removed while a time field is blank."""

import pytest
from pydantic import ValidationError

from sidecar.main import ValidateRequest, trim_validate


def test_remaining_shot_validates_after_second_shot_is_removed():
    shots = [
        {"start": 4.0, "end": 10.0},
        {"start": 20.0, "end": 30.0},
    ]
    request = ValidateRequest.model_validate({"shots": shots[:1], "duration": 48.3})

    assert trim_validate(request) == {
        "errors": [],
        "conflicts": [],
        "segments": [(4.0, 10.0)],
    }


def test_blank_time_is_rejected_as_input_instead_of_crashing_validation():
    with pytest.raises(ValidationError):
        ValidateRequest.model_validate({
            "shots": [{"start": None, "end": 10.0}],
            "duration": 48.3,
        })
