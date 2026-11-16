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


def test_parse_reply_tolerates_an_unpaired_closing_fence():
    # Seen on gemini-3.5-flash, batches O-005 and O-037: no opening fence, only a closing one.
    assert list(cm.parse_reply('{"kết quả": [{"id": "1"}]}```')) == ["1"]


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

    args = type("A", (), {"out_dir": str(tmp_path), "model": "m", "only": None, "force": False, "group": "S"})
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
    args = type("A", (), {"out_dir": str(tmp_path), "model": "m", "only": None, "force": False, "group": "S"})
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
    # The guideline follows the newest S codebook (S.v2 since features/codebook-v2).
    md = (cm.ROOT / "docs" / "guidelines" / "S-boi-canh.md").read_text(encoding="utf-8")
    rows = dict(re.findall(r"^\| \d\. ([^|]+?) \| ([^|]+?) \|$", md, re.M))
    frozen = {c["label"]: [o["label"] for o in c["options"]] for c in _newest("S")["cells"]}
    assert {k: v.split(" · ") for k, v in rows.items()} == frozen


def test_frozen_s_codebook_ids_are_unique_and_the_template_uses_every_cell():
    cb = _frozen_s()
    ids = [o["id"] for c in cb["cells"] for o in c["options"]]
    assert len(ids) == len(set(ids))
    assert all(o["id"].startswith(c["id"] + ".") for c in cb["cells"] for o in c["options"])
    assert sorted(re.findall(r"\{(\w+)\}", cb["template"])) == sorted(c["id"] for c in cb["cells"])


# ---------- group C ----------

@pytest.fixture(scope="module")
def prompt_c():
    return cm.load_prompt(group="C")


def c_item(**cells):
    """One mapped C answer: every cell T unless overridden."""
    base = {c: {"trạng thái": "T", "giá trị": None, "bằng chứng": None, "cụm không khớp": None}
            for c in cm.cell_specs(cm.load_prompt(group="C")["codebook"])}
    for c, (st, val, ev) in cells.items():
        base[c] = {"trạng thái": st, "giá trị": val, "bằng chứng": ev,
                   "cụm không khớp": "x" if st == "K" else None}
    return {"ô": base, "ngoài codebook": [], "ghi chú": None}


def test_each_group_reads_its_own_codebook_and_few_shot(prompt, prompt_c):
    assert "thời tiết" in prompt["codebook"] and "kiểu xung đột" not in prompt["codebook"]
    assert "kiểu xung đột" in prompt_c["codebook"]
    assert {s["answer"][:10] for s in prompt_c["shots"]} == {"Xe ba gác ", "Xe camera "}
    specs = cm.cell_specs(prompt_c["codebook"])
    assert list(specs).index("hành động") == list(specs).index("kiểu xung đột") + 1
    assert specs["chủ thể"][0] == "free" and specs["loại sự kiện"][1] == ["va chạm", "suýt va chạm", "không rõ"]


def test_c_few_shot_and_trial_outputs_pass_validation(prompt_c):
    for s in prompt_c["shots"]:
        assert cm.validate_item(s["output"], s["answer"], prompt_c["codebook"]) == []
    trials = cm.load_trials(group="C")
    assert len(trials) == 2
    for t in trials:
        assert cm.validate_item(t["expected"], t["answer"], prompt_c["codebook"]) == []


def test_c_action_must_belong_to_the_chosen_conflict_type(prompt_c):
    cb, ans = prompt_c["codebook"], "Xe ba gác rẽ trái trước ô tô."
    ok = c_item(**{"kiểu xung đột": ("M", "K10", "rẽ trái"), "hành động": ("M", "rẽ trái", "rẽ trái")})
    assert cm.validate_item(ok, ans, cb) == []
    wrong = c_item(**{"kiểu xung đột": ("M", "K01", "rẽ trái"), "hành động": ("M", "rẽ trái", "rẽ trái")})
    assert any("không thuộc hành động của K01" in e for e in cm.validate_item(wrong, ans, cb))
    orphan = c_item(**{"hành động": ("M", "rẽ trái", "rẽ trái")})
    assert any("cần kiểu xung đột M" in e for e in cm.validate_item(orphan, ans, cb))
    assert any("không có trong codebook" in e
               for e in cm.validate_item(c_item(**{"kiểu xung đột": ("M", "K99", "rẽ trái")}), ans, cb))


def test_c_free_cells_take_any_description_but_need_one(prompt_c):
    cb, ans = prompt_c["codebook"], "Xe ba gác rẽ trái trước ô tô."
    assert cm.validate_item(c_item(**{"chủ thể": ("M", "xe ba gác", "Xe ba gác")}), ans, cb) == []
    assert any("thiếu mô tả" in e for e in cm.validate_item(c_item(**{"chủ thể": ("M", "", "Xe ba gác")}), ans, cb))


def test_c_report_counts_free_values_and_actions_per_type(prompt_c):
    cb = prompt_c["codebook"]
    units = cm.assign_batches(pd.DataFrame({
        "unit": ["C1", "C2"], "seq": [1, 2], "answer": ["Xe ba gác rẽ trái."] * 2, "n_annotators": 1,
        "draft_id": "d", "question": "Q?"}), 7, "C")
    it = c_item(**{"chủ thể": ("M", "xe ba gác", "Xe ba gác"), "kiểu xung đột": ("M", "K10", "rẽ trái"),
                   "hành động": ("M", "rẽ trái", "rẽ trái")})
    reply = json.dumps({"kết quả": [{"id": "1", **it}, {"id": "2", **it}]}, ensure_ascii=False)
    results, errors = cm.collect(units, [{"batch": "C-001", "text": reply}], cb)
    assert errors == {}
    s = cm.cell_stats(results, cb)
    assert s["chủ thể"]["values"]["xe ba gác"] == 2
    assert s["hành động"]["values"]["K10: rẽ trái"] == 2 and s["hành động"]["values"]["K01: tăng tốc"] == 0
    report = cm.render_report(units, results, errors, cb, "C")
    assert "NHÓM C" in report and "M:K10" in report


def test_trial_compares_cell_by_cell_and_writes_the_reply(tmp_path, prompt_c, monkeypatch):
    monkeypatch.setenv(cm.KEY_ENV, "test-key")
    trials = cm.load_trials(group="C")
    reply = {"kết quả": [{"id": str(i), **t["expected"]} for i, t in enumerate(trials, 1)]}
    reply["kết quả"][1]["ô"]["kiểu xung đột"]["giá trị"] = "K11"   # one deliberate mismatch
    args = type("A", (), {"out_dir": str(tmp_path), "model": "m", "group": "C"})
    cm.cmd_trial(args, generate=lambda *a: (json.dumps(reply, ensure_ascii=False), {}))
    text = (tmp_path / "trial_C.txt").read_text(encoding="utf-8")
    assert text.count("LỆCH") == 1 and "M:K14" in text and "M:K11" in text
    assert json.loads((tmp_path / "trial_C.json").read_text(encoding="utf-8"))["model"] == "m"


def test_default_out_dir_keeps_s_where_it_was():
    assert cm.default_out_dir("S") == "csvs/p1" and cm.default_out_dir("C") == "csvs/p1-C"


# ---------- group O: a cell whose options depend on another cell ----------

def o_item(level, sign):
    cell = lambda st, val, ev: {"trạng thái": st, "giá trị": val, "bằng chứng": ev, "cụm không khớp": None}
    return {"ô": {"mức độ": cell(*level), "dấu hiệu nhìn thấy": cell(*sign)}, "ngoài codebook": [], "ghi chú": None}


def test_o_sign_must_belong_to_the_chosen_level():
    cb = cm.load_prompt(group="O")["codebook"]
    ans = "Xe tải lật nghiêng, va chạm mạnh."
    assert cm.cell_specs(cb)["dấu hiệu nhìn thấy"][0] == "depends"
    ok = o_item(("M", "va chạm mạnh", "va chạm mạnh"), ("M", "bị lật", "Xe tải lật"))
    assert cm.validate_item(ok, ans, cb) == []
    wrong = o_item(("M", "va chạm nhẹ", "va chạm mạnh"), ("M", "bị lật", "Xe tải lật"))
    assert any("không thuộc mức độ 'va chạm nhẹ'" in e for e in cm.validate_item(wrong, ans, cb))
    for level in [("T", None, None), ("M", "không rõ", "va chạm mạnh")]:
        orphan = o_item(level, ("M", "bị lật", "Xe tải lật"))
        assert any("cần ô 'mức độ' là M" in e for e in cm.validate_item(orphan, ans, cb))


def test_o_report_counts_signs_per_level():
    cb = cm.load_prompt(group="O")["codebook"]
    units = cm.assign_batches(pd.DataFrame({
        "unit": ["O1"], "seq": [1], "answer": ["Xe tải lật, va chạm mạnh."], "n_annotators": 1,
        "draft_id": "d", "question": "Q?"}), 7, "O")
    it = o_item(("M", "va chạm mạnh", "va chạm mạnh"), ("M", "bị lật", "Xe tải lật"))
    results, errors = cm.collect(units, [{"batch": "O-001", "text": json.dumps({"kết quả": [{"id": "1", **it}]},
                                                                                ensure_ascii=False)}], cb)
    assert errors == {}
    values = cm.cell_stats(results, cb)["dấu hiệu nhìn thấy"]["values"]
    assert values["va chạm mạnh: bị lật"] == 1 and values["va chạm nhẹ: chạm quẹt, vẫn đi tiếp"] == 0


def test_a_dependent_cell_must_come_after_its_parent():
    with pytest.raises(ValueError):
        cm.cell_specs({"b": {"theo": "a", "lựa chọn": {"x": ["y"]}}, "a": ["x"]})


def test_every_group_in_the_prompt_validates_its_own_examples():
    for g in ["S", "E", "C", "V", "O", "R", "Prev"]:
        p = cm.load_prompt(group=g)
        assert p["shots"], g
        for s in p["shots"]:
            assert cm.validate_item(s["output"], s["answer"], p["codebook"]) == [], (g, s["answer"])
        for t in cm.load_trials(group=g):
            assert cm.validate_item(t["expected"], t["answer"], p["codebook"]) == [], (g, t["answer"])


def test_parse_reply_drops_prose_around_the_json():
    assert list(cm.parse_reply('Đây là kết quả:\n```json\n{"kết quả": [{"id": "1"}]}\n```\nXong.')) == ["1"]


def _lines(*lines):
    it = iter(lines)
    return lambda: next(it)


def test_read_reply_stops_as_soon_as_the_pasted_json_is_complete():
    read = _lines('{"kết quả": [', '{"id": "1"}', ']}', "never read")
    assert json.loads(cm.read_reply(read)) == {"kết quả": [{"id": "1"}]}
    assert cm.read_reply(_lines("skip")) == "skip"
    assert cm.read_reply(_lines("not json", "END")) == "not json"


def test_chat_saves_pasted_replies_like_call_and_resumes(tmp_path, prompt):
    _prepared(tmp_path, prompt)   # two batches, S-001 and S-002
    args = type("A", (), {"out_dir": str(tmp_path), "model": "chatgpt-web", "group": "S"})
    shown, copied = [], []
    bad, good = _reply(valid=False), _reply(valid=True)
    # S-001: an invalid paste, then Enter and a valid one; S-002: quit.
    cm.cmd_chat(args, read_line=_lines(bad, "", good, "quit"), copy=lambda t: copied.append(t) or True,
                show=shown.append)
    lines = (tmp_path / "outputs.jsonl").read_text(encoding="utf-8").splitlines()
    assert [json.loads(l)["batch"] for l in lines] == ["S-001"]
    assert json.loads(lines[0])["text"] == good and json.loads(lines[0])["model"] == "chatgpt-web"
    assert "Trời nắng." in copied[0] and "=== CÂU CẦN MAP ===" in copied[0]
    assert any("câu lỗi" in s for s in shown)

    cm.cmd_chat(args, read_line=_lines(good), copy=lambda t: True, show=shown.append)   # resumes at S-002
    lines = (tmp_path / "outputs.jsonl").read_text(encoding="utf-8").splitlines()
    assert [json.loads(l)["batch"] for l in lines] == ["S-001", "S-002"]


# ---------- group E: a list of parties, each with the same cells ----------

@pytest.fixture(scope="module")
def prompt_e():
    return cm.load_prompt(group="E")


def e_party(doan, **cells):
    """One party: every E cell T unless given as (state, value, evidence)."""
    names = ["loại", "cỡ", "camera hành trình", "màu xe", "màu áo người điều khiển", "số người trên xe"]
    o = {c: {"trạng thái": "T", "giá trị": None, "bằng chứng": None, "cụm không khớp": None} for c in names}
    for c, (st, val, ev) in cells.items():
        o[c] = {"trạng thái": st, "giá trị": val, "bằng chứng": ev,
                "cụm không khớp": ev if st == "K" else None}
    return {"đoạn": doan, "ô": o}


E_ANSWER = "Xe ô tô con màu trắng và xe máy màu hồng."


def e_item(*parties):
    return {"các bên": list(parties), "ngoài codebook": [], "ghi chú": None}


def test_e_uses_its_own_schema_and_the_cells_of_one_party(prompt_e):
    assert '"các bên"' in prompt_e["schema"] and '"các bên"' not in cm.load_prompt(group="S")["schema"]
    assert list(cm.cell_specs(prompt_e["codebook"])) == [
        "loại", "cỡ", "camera hành trình", "màu xe", "màu áo người điều khiển", "số người trên xe"]


def test_e_validates_every_party_and_its_passage(prompt_e):
    cb = prompt_e["codebook"]
    car = e_party("Xe ô tô con màu trắng", **{"loại": ("M", "ô tô", "Xe ô tô con"), "màu xe": ("M", "trắng", "màu trắng")})
    bike = e_party("xe máy màu hồng", **{"loại": ("M", "xe máy, xe hai bánh", "xe máy"),
                                          "màu xe": ("M", "màu khác", "màu hồng")})
    assert cm.validate_item(e_item(car, bike), E_ANSWER, cb) == []
    assert cm.validate_item(e_item(), "Không thể xác định.", cb) == []
    bad = e_party("xe máy màu tím", **{"màu xe": ("M", "tím", "màu hồng")})
    errs = cm.validate_item(e_item(car, bad), E_ANSWER, cb)
    assert any(e.startswith("bên 2: màu xe") for e in errs)
    assert any(e.startswith("bên 2: đoạn") for e in errs)
    assert cm.validate_item({"ô": {}}, E_ANSWER, cb) == ['thiếu danh sách "các bên"']


def test_e_report_counts_cells_over_every_party(prompt_e):
    cb = prompt_e["codebook"]
    units = cm.assign_batches(pd.DataFrame({
        "unit": ["E1", "E2"], "seq": [1, 2], "answer": [E_ANSWER, "Không thể xác định."], "n_annotators": 1,
        "draft_id": "d", "question": "Q?"}), 7, "E")
    car = e_party("Xe ô tô con màu trắng", **{"loại": ("M", "ô tô", "Xe ô tô con"), "màu xe": ("M", "trắng", "màu trắng")})
    bike = e_party("xe máy màu hồng", **{"loại": ("M", "xe máy, xe hai bánh", "xe máy"), "màu xe": ("K", None, "màu hồng")})
    reply = json.dumps({"kết quả": [{"id": "1", **e_item(car, bike)}, {"id": "2", **e_item()}]}, ensure_ascii=False)
    results, errors = cm.collect(units, [{"batch": "E-001", "text": reply}], cb)
    assert errors == {}
    s = cm.cell_stats(results, cb)
    assert (s["loại"]["M"], s["loại"]["n"]) == (2, 2)
    assert (s["màu xe"]["M"], s["màu xe"]["K"]) == (1, 1)
    assert s["loại"]["values"]["ô tô"] == 1 and s["loại"]["values"]["động vật"] == 0
    report = cm.render_report(units, results, errors, cb, "E")
    assert "Số bên đã tách: 2" in report
    assert "E1/1" in report and "E1/2" in report and "M:xe máy, xe hai bánh" in report
    assert "(không có bên)" in report


def test_e_trial_compares_party_by_party(tmp_path, prompt_e, monkeypatch):
    monkeypatch.setenv(cm.KEY_ENV, "test-key")
    trials = cm.load_trials(group="E")
    reply = {"kết quả": [{"id": str(i), **t["expected"]} for i, t in enumerate(trials, 1)]}
    reply["kết quả"][0]["ô"] = None
    reply["kết quả"][0]["các bên"] = reply["kết quả"][0]["các bên"][:1]   # model missed the second party
    args = type("A", (), {"out_dir": str(tmp_path), "model": "m", "group": "E"})
    cm.cmd_trial(args, generate=lambda *a: (json.dumps(reply, ensure_ascii=False), {}))
    text = (tmp_path / "trial_E.txt").read_text(encoding="utf-8")
    assert "bên 2 / loại" in text and text.count("LỆCH") == 7   # the party count row and six empty cells


# ---------- frozen v1 codebooks of the other groups ----------

GUIDELINES = {"C": "C-nguyen-nhan.md", "E": "E-thuc-the.md", "V": "V-vi-pham.md", "O": "O-hau-qua.md",
              "R": "R-ung-xu.md", "Prev": "Prev-phong-ngua.md"}


def _frozen(group):
    return json.loads((cm.ROOT / "codebook" / f"{group}.v1.json").read_text(encoding="utf-8"))


def _newest(group):
    """The newest frozen codebook of a group: the guideline follows it (features/codebook-v2)."""
    files = sorted((cm.ROOT / "codebook").glob(f"{group}.v*.json"), key=lambda f: int(f.stem.split(".v")[1]))
    return json.loads(files[-1].read_text(encoding="utf-8"))


def _guideline(group):
    return (cm.ROOT / "docs" / "guidelines" / GUIDELINES[group]).read_text(encoding="utf-8")


def _expected_cells(md):
    """[(label, options or None)] from the 'Các ô' table. 'như ô N' copies row N; entity picks are dropped;
    options defined by a table further down ('bảng dưới') are None and checked separately."""
    rows = re.findall(r"^\| (\d)\. ([^|]+?) \| ([^|]+?) \|", md, re.M)
    by_num, out = {}, []
    for num, label, raw in rows:
        label = re.sub(r" \(.*\)$", "", label)
        m = re.match(r"như ô (\d)", raw)
        if m:
            options = by_num[m.group(1)]
        elif "bảng dưới" in raw:
            options = None
        else:
            options = [o.replace(" [chọn từ E]", "") for o in raw.split(" · ") if "chọn từ E" not in o or "[" in o]
        by_num[num] = options
        out.append((label, options))
    return out


@pytest.mark.parametrize("group", list(GUIDELINES))
def test_frozen_codebook_matches_the_guideline_table(group):
    cb, md = _newest(group), _guideline(group)
    expected = _expected_cells(md)
    labels = {lbl for lbl, _ in expected}
    cells = [c for c in cb["cells"] if c["label"] in labels or not c.get("auto_fill")]
    assert [c["label"] for c in cells] == [lbl for lbl, _ in expected]
    for c, (_, options) in zip(cells, expected):
        if options is not None:
            assert [o["label"] for o in c["options"]] == options, c["id"]
    assert cb["group"] == group and cb["source"].endswith(GUIDELINES[group])
    assert f"- Câu hỏi chuẩn: {cb['question']}\n" in md


@pytest.mark.parametrize("group", list(GUIDELINES))
def test_frozen_codebook_ids_are_unique_prefixed_and_parents_exist(group):
    cb = _frozen(group)
    cells = {c["id"]: c for c in cb["cells"]}
    assert len(cells) == len(cb["cells"])
    ids = [o["id"] for c in cb["cells"] for o in c["options"]]
    assert len(ids) == len(set(ids))
    assert all(o["id"].startswith(c["id"] + ".") for c in cb["cells"] for o in c["options"])
    for c in cb["cells"]:
        if any("parent" in o for o in c["options"]):
            parents = {o["id"] for o in cells[c["parent_cell"]]["options"]}
            assert all(o["parent"] in parents for o in c["options"]), c["id"]
    c_actions = {o["id"] for c in _frozen("C")["cells"] for o in c["options"]}
    for p in cb.get("prefill_from_c", []):
        assert p["option"] in ids
        assert all(re.fullmatch(r"K(0[1-9]|1[0-8])", k) for k in p["conflict_types"])
        assert all(a in c_actions for a in p.get("c_actions", []))


@pytest.mark.parametrize("group", list(GUIDELINES))
def test_frozen_codebook_templates_are_verbatim_from_the_guideline(group):
    cb, md = _newest(group), _guideline(group)
    assert cb["templates"]
    for t in cb["templates"]:
        if "{" in t["text"]:
            # Codebook v2 patterns are machine-rendered ({cell} placeholders); the guideline shows each
            # case by name, its variants ("Cả A và B, va chạm") under the base case.
            assert f"| {t['case'].split(', ')[0]} |" in md, t["case"]
        else:
            assert f"| {t['case']} | {t['text']} |" in md


def test_frozen_c_conflict_types_and_actions_match_the_guideline_table():
    cb, md = _frozen("C"), _guideline("C")
    rows = re.findall(r"^\| (K\d\d) \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \| ([^|]+?) \|$", md, re.M)
    cells = {c["id"]: c for c in cb["cells"]}
    types = [o for o in cells["conflict_type"]["options"] if "code" in o]
    assert [(o["code"], o["group"], o["label"], o["relation"]) for o in types] == [r[:4] for r in rows]
    assert [o["label"] for o in cells["conflict_type"]["options"]][-1] == "không rõ"
    for t, row in zip(types, rows):
        got = [o["label"] for o in cells["action"]["options"] if o["parent"] == t["id"]]
        assert got == row[4].split(" · "), t["code"]
    assert cb["keyframes"] == ["start", "end"]


def test_frozen_o_signs_per_level_match_the_guideline_table():
    cb, md = _frozen("O"), _guideline("O")
    rows = re.findall(r"^\| (Không va chạm|Va chạm nhẹ|Va chạm vừa|Va chạm mạnh) \| ([^|]+?) \|$", md.split("## Mẫu câu")[0], re.M)
    cells = {c["id"]: c for c in cb["cells"]}
    level_id = {o["label"]: o["id"] for o in cells["level"]["options"]}
    for level, signs in rows:
        got = [o["label"] for o in cells["sign"]["options"] if o["parent"] == level_id[level.lower()]]
        assert got == signs.split(" · "), level
