"""scripts/codebook_map.py: prompt pieces come from p1-prompt.md, answers are deduplicated and
batched, model output is validated against the codebook, and the coverage report is complete."""

import json
import re
import unicodedata

import pandas as pd
import pytest

from scripts import codebook_map as cm


@pytest.fixture(scope="module")
def prompt():
    return cm.load_prompt()


def item(weather=("M", "nắng", "trời nắng"), **cells):
    """One mapped answer: weather as given, every other S cell T unless overridden."""
    base = {c: {"trạng thái": "T", "giá trị": None, "bằng chứng": None, "cụm không khớp": None}
            for c in ["thời tiết", "ánh sáng", "loại đường", "mặt đường", "mật độ xe", "đoạn đường"]}
    st, val, ev = weather
    base["thời tiết"] = {"trạng thái": st, "giá trị": val, "bằng chứng": ev,
                          "cụm không khớp": "trời có tuyết" if st == "K" else None}
    base.update(cells)
    return {"ô": base, "ngoài codebook": [], "ghi chú": None}


def test_prompt_pieces_come_from_the_reviewed_markdown(prompt):
    assert list(prompt["codebook"]) == ["thời tiết", "ánh sáng", "loại đường", "mặt đường", "mật độ xe", "đoạn đường"]
    assert "Quy tắc" in prompt["system"]
    assert len(prompt["shots"]) == 2 and all(s["group"] == "S" for s in prompt["shots"])


def test_few_shot_outputs_pass_their_own_validation(prompt):
    for s in prompt["shots"]:
        assert cm.validate_item(s["output"], s["answer"], prompt["codebook"]) == []


def test_messages_carry_few_shot_then_the_batch(prompt):
    items = [{"id": "1", "question": "Q?", "answer": "Trời nắng."}]
    msgs = cm.build_messages(prompt, items)
    assert [m["role"] for m in msgs] == ["user", "assistant", "user"]
    shot_reply = json.loads(msgs[1]["content"])
    assert [r["id"] for r in shot_reply["kết quả"]] == ["1", "2"]
    assert "[1]\nCâu hỏi: Q?\nCâu trả lời: Trời nắng." in msgs[2]["content"]


def test_units_dedupe_per_question_and_skip_unfinished_and_not_answerable():
    rows = [
        # same draft, same text up to whitespace -> one unit written by 2 people
        dict(draft_id="d1", seq=1, annotator_name="A", verdict="AGREE", effective_answer="Trời nắng."),
        dict(draft_id="d1", seq=1, annotator_name="B", verdict="AGREE", effective_answer="Trời  nắng. "),
        dict(draft_id="d1", seq=1, annotator_name="C", verdict="DISAGREE", effective_answer="Trời mưa."),
        dict(draft_id="d1", seq=1, annotator_name="D", verdict="NOT_ANSWERABLE", effective_answer="Trời nắng."),
        dict(draft_id="d2", seq=2, annotator_name="A", verdict="AGREE", effective_answer="Trời nắng."),
    ]
    df = pd.DataFrame(rows).assign(qgroup="S", question="Q?", assignment_status="completed")
    df = pd.concat([df, df.iloc[[0]].assign(assignment_status="in_progress", annotator_name="E")])
    units = cm.make_units(df)
    assert len(units) == 3
    d1 = units[(units.draft_id == "d1") & (units.answer == "Trời nắng.")].iloc[0]
    assert d1.n_annotators == 2 and d1.annotators == "A, B"


def test_batches_hold_at_most_the_batch_size():
    units = pd.DataFrame({"unit": [f"S{i}" for i in range(16)]})
    b = cm.assign_batches(units, 7)
    assert b.groupby("batch").size().tolist() == [7, 7, 2]
    assert b["item"].tolist()[:8] == ["1", "2", "3", "4", "5", "6", "7", "1"]


def test_validation_accepts_decomposed_unicode_and_rejects_bad_items(prompt):
    cb = prompt["codebook"]
    nfd = unicodedata.normalize("NFD", "nắng")
    assert cm.validate_item(item(("M", nfd, "Trời nắng")), "Trời nắng.", cb) == []
    assert any("không có trong codebook" in e for e in cm.validate_item(item(("M", "nang", "Trời nắng")), "Trời nắng.", cb))
    assert any("không có trong câu" in e for e in cm.validate_item(item(("M", "nắng", "trời mưa")), "Trời nắng.", cb))
    assert any("thiếu bằng chứng" in e for e in cm.validate_item(item(("M", "nắng", None)), "Trời nắng.", cb))
    assert any("không được có giá trị" in e for e in cm.validate_item(item(("T", "nắng", None)), "Trời nắng.", cb))
    missing = item()
    del missing["ô"]["ánh sáng"]
    assert any("ánh sáng: thiếu ô" in e for e in cm.validate_item(missing, "Trời nắng.", cb))


def test_parse_reply_tolerates_a_code_fence():
    assert list(cm.parse_reply('```json\n{"kết quả": [{"id": "1"}]}\n```')) == ["1"]


def _run(units_answers, items, codebook):
    units = cm.assign_batches(pd.DataFrame({
        "unit": [f"S{i:04d}" for i in range(len(units_answers))], "seq": range(1, len(units_answers) + 1),
        "answer": units_answers, "n_annotators": 1, "draft_id": "d", "question": "Q?"}), 7)
    outputs = []
    for batch, g in units.groupby("batch"):
        reply = {"kết quả": [{"id": r.item, **it} for r, it in zip(g.itertuples(), [items[i] for i in g.index])]}
        outputs.append({"batch": batch, "text": json.dumps(reply, ensure_ascii=False)})
    return units, *cm.collect(units, outputs, codebook)


def test_verdict_rules_follow_n_and_coverage(prompt):
    cb = prompt["codebook"]
    # 12 answers: weather M in 9, K in 3 -> n 12, 75% -> fails. light M in 1 -> n 1 -> not enough data.
    answers = ["Trời nắng, ban ngày."] * 12
    items = [item(("M", "nắng", "Trời nắng")) for _ in range(9)] + [item(("K", None, "Trời nắng")) for _ in range(3)]
    items[0]["ô"]["ánh sáng"] = {"trạng thái": "M", "giá trị": "ban ngày", "bằng chứng": "ban ngày", "cụm không khớp": None}
    units, results, errors = _run(answers, items, cb)
    assert errors == {}
    s = cm.cell_stats(results, cb)
    assert (s["thời tiết"]["M"], s["thời tiết"]["K"], s["thời tiết"]["n"]) == (9, 3, 12)
    assert s["thời tiết"]["verdict"] == "không đạt, phải sửa ô"
    assert s["ánh sáng"]["verdict"] == "chưa đủ dữ liệu"
    assert s["thời tiết"]["values"]["nắng"] == 9 and s["thời tiết"]["values"]["mưa"] == 0

    passing = [item(("M", "nắng", "Trời nắng")) for _ in range(10)]
    _, results, _ = _run(["Trời nắng."] * 10, passing, cb)
    assert cm.cell_stats(results, cb)["thời tiết"]["verdict"] == "đạt"


def test_report_lists_every_k_phrase_and_every_answer_without_truncation(prompt):
    cb = prompt["codebook"]
    n = 30
    answers = [f"Trời kiểu {i}." for i in range(n)]
    items = []
    for i in range(n):
        it = item(("K", None, f"Trời kiểu {i}"))
        it["ô"]["thời tiết"]["cụm không khớp"] = f"kiểu {i}"
        items.append(it)
    units, results, errors = _run(answers, items, cb)
    report = cm.render_report(units, results, errors, cb)
    k_section = report.split("3. MỌI CỤM BỊ K")[1].split("4. MỌI T THIẾU")[0]
    for i in range(n):
        assert re.search(rf"^thời tiết\s+kiểu {i}\s", k_section, re.M)
        assert f"Trời kiểu {i}." in report
    assert "Độ phủ = M / n" in report


def test_missing_batch_and_broken_reply_become_errors(prompt):
    cb = prompt["codebook"]
    units = cm.assign_batches(pd.DataFrame({"unit": ["S1", "S2"], "seq": [1, 2], "answer": ["a", "b"],
                                            "n_annotators": 1, "draft_id": "d", "question": "Q?"}), 1)
    results, errors = cm.collect(units, [{"batch": "S-001", "text": "không phải json"}], cb)
    assert results == {}
    assert "không parse được" in errors["S1"][0] and errors["S2"] == ["lô chưa có output"]


def test_gemini_body_maps_roles_and_asks_for_json():
    body = cm.gemini_body("sys", [{"role": "user", "content": "a"}, {"role": "assistant", "content": "b"}])
    assert [c["role"] for c in body["contents"]] == ["user", "model"]
    assert body["systemInstruction"]["parts"][0]["text"] == "sys"
    assert body["generationConfig"] == {"temperature": 0, "responseMimeType": "application/json"}


def _prepared(tmp_path, prompt, n=2):
    units = cm.assign_batches(pd.DataFrame({
        "unit": [f"S{i}" for i in range(n)], "seq": range(1, n + 1), "answer": ["Trời nắng."] * n,
        "n_annotators": 1, "draft_id": "d", "question": "Q?"}), 1)
    units.to_csv(tmp_path / "units.csv", index=False)
    with open(tmp_path / "requests.jsonl", "w", encoding="utf-8") as f:
        for b, g in units.groupby("batch"):
            msgs = cm.build_messages(prompt, [{"id": "1", "question": "Q?", "answer": "Trời nắng."}])
            f.write(json.dumps({"batch": b, "system": "sys", "messages": msgs}, ensure_ascii=False) + "\n")


def _reply(valid):
    it = item(("M", "nắng", "Trời nắng") if valid else ("M", "nang", "Trời nắng"))
    return json.dumps({"kết quả": [{"id": "1", **it}]}, ensure_ascii=False)


def test_call_retries_once_on_invalid_reply_and_skips_batches_already_done(tmp_path, prompt, monkeypatch):
    monkeypatch.setenv(cm.KEY_ENV, "test-key")
    _prepared(tmp_path, prompt)
    calls = []

    def fake(model, system, messages, key):
        calls.append(key)
        return _reply(valid=len(calls) != 1), {}   # first reply invalid, the rest valid

    args = type("A", (), {"out_dir": str(tmp_path), "model": "m", "only": None, "force": False})
    cm.cmd_call(args, generate=fake)
    assert len(calls) == 3   # S-001 twice (retry), S-002 once
    lines = (tmp_path / "outputs.jsonl").read_text(encoding="utf-8").splitlines()
    assert [json.loads(l)["batch"] for l in lines] == ["S-001", "S-002"]
    assert "nắng" in json.loads(lines[0])["text"]   # the valid retry was kept

    cm.cmd_call(args, generate=fake)   # nothing left to do
    assert len(calls) == 3


def test_call_refuses_without_the_key(tmp_path, prompt, monkeypatch):
    monkeypatch.setattr(cm, "api_key", lambda: None)
    monkeypatch.delenv(cm.KEY_ENV, raising=False)
    args = type("A", (), {"out_dir": str(tmp_path), "model": "m", "only": None, "force": False})
    with pytest.raises(SystemExit):
        cm.cmd_call(args, generate=lambda *a: None)


def test_api_key_falls_back_to_the_env_file_line(tmp_path, monkeypatch):
    monkeypatch.delenv(cm.KEY_ENV, raising=False)
    f = tmp_path / ".env"
    f.write_text('OTHER=x\nGEMINI_API_KEY="abc"\n', encoding="utf-8")
    assert cm.api_key(f) == "abc"
    monkeypatch.setenv(cm.KEY_ENV, "from-env")
    assert cm.api_key(f) == "from-env"
    assert cm.api_key(tmp_path / "missing") == "from-env"


def test_a_timeout_becomes_a_runtime_error_so_the_run_continues(monkeypatch):
    import urllib.request

    def slow(*a, **k):
        raise TimeoutError("The read operation timed out")
    monkeypatch.setattr(urllib.request, "urlopen", slow)
    with pytest.raises(RuntimeError, match="network"):
        cm.gemini_generate("m", "sys", [{"role": "user", "content": "a"}], "k")


def _frozen_s():
    return json.loads((cm.ROOT / "codebook" / "S.v1.json").read_text(encoding="utf-8"))


def test_frozen_s_codebook_matches_the_prompt_codebook(prompt):
    frozen = {c["label"].lower(): [o["label"] for o in c["options"]] for c in _frozen_s()["cells"]}
    assert frozen == prompt["codebook"]


def test_frozen_s_codebook_matches_the_guideline_table():
    md = (cm.ROOT / "docs" / "guidelines" / "S-boi-canh.md").read_text(encoding="utf-8")
    rows = dict(re.findall(r"^\| \d\. ([^|]+?) \| ([^|]+?) \|$", md, re.M))
    frozen = {c["label"]: [o["label"] for o in c["options"]] for c in _frozen_s()["cells"]}
    assert {k: v.split(" · ") for k, v in rows.items()} == frozen


def test_frozen_s_codebook_ids_are_unique_and_the_template_uses_every_cell():
    cb = _frozen_s()
    ids = [o["id"] for c in cb["cells"] for o in c["options"]]
    assert len(ids) == len(set(ids))
    assert all(o["id"].startswith(c["id"] + ".") for c in cb["cells"] for o in c["options"])
    assert sorted(re.findall(r"\{(\w+)\}", cb["template"])) == sorted(c["id"] for c in cb["cells"])
