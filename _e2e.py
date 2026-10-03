"""E2E qua HTTP that, dung duong ma UI se di."""
import json, sqlite3, sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
B = "http://127.0.0.1:8787"


def call(path, body=None):
    req = urllib.request.Request(
        B + path, data=json.dumps(body).encode() if body else None,
        headers={"Content-Type": "application/json"},
        method="POST" if body else "GET")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def snap():
    c = sqlite3.connect("pipeline.db")
    return (c.execute("select count(*) from reviews where difficulty is not null").fetchone()[0],
            c.execute("select count(*) from review_segments").fetchone()[0],
            c.execute("select difficulty||'/'||event_label from reviews"
                      " where clip_id='0aD5Bbh_GgU_097200_166733'").fetchone()[0])


before = snap()
_, s = call("/annotate/shot?clip_id=0aD5Bbh_GgU_097200_166733&shot=1&annotator_id=quyen")
d = {x["qgroup"]: x for x in s["drafts"]}
print("dap an nhom V:", repr(d["V"]["answer"]))
print("dap an nhom S:", d["S"]["answer"][:110], "...\n")

print("=== cac truong hop phai bi CHAN ===")
for name, body in [
    ("DISAGREE khong ly do", {"annotator_id": "quyen", "verdict": "DISAGREE"}),
    ("ly do 'khac' khong ghi chu", {"annotator_id": "quyen", "verdict": "DISAGREE",
                                    "reason_code": "khác"}),
    ("verdict bia dat", {"annotator_id": "quyen", "verdict": "MAYBE"}),
    ("4 moc keyframe", {"annotator_id": "quyen", "verdict": "AGREE",
                        "keyframes_s": [1, 2, 3, 4]}),
    ("khong chon nguoi", {"annotator_id": "  ", "verdict": "AGREE"}),
]:
    code, r = call(f"/annotate/draft/{d['S']['draft_id']}", body)
    print(f"  {name:<28} HTTP {code}  {str(r.get('detail'))[:60]}")

print("\n=== cac truong hop phai THANH CONG ===")
print(" AGREE + 2 moc   ->", call(f"/annotate/draft/{d['S']['draft_id']}",
      {"annotator_id": "quyen", "verdict": "AGREE", "keyframes_s": [2.5, 4.25]}))
print(" NOT_ANSWERABLE  ->", call(f"/annotate/draft/{d['V']['draft_id']}",
      {"annotator_id": "quyen", "verdict": "NOT_ANSWERABLE"}))
print(" DISAGREE + ly do->", call(f"/annotate/draft/{d['N']['draft_id']}",
      {"annotator_id": "quyen", "verdict": "DISAGREE", "reason_code": "bịa chi tiết",
       "reason_note": "nói xe tải đi ngược chiều, thực tế cùng chiều"}))
print(" nhan shot       ->", call("/annotate/label",
      {"annotator_id": "quyen", "clip_id": "0aD5Bbh_GgU_097200_166733", "shot": 1,
       "difficulty": "medium", "event_label": "near-miss"}))

print("\n=== nguoi THU HAI cham cung draft (A13) ===")
call("/annotate/annotators", {"annotator_id": "quoc", "name": "Quoc", "team": "B"})
print(" quoc AGREE      ->", call(f"/annotate/draft/{d['S']['draft_id']}",
      {"annotator_id": "quoc", "verdict": "DISAGREE", "reason_code": "thiếu thực thể"}))
a = sqlite3.connect("annotations.db")
n = a.execute("select count(*) from qa_annotations where draft_id=?",
              (d["S"]["draft_id"],)).fetchone()[0]
print(f" so dong cho draft S: {n}  (phai la 2, khong phai 1)")

print("\n=== sau khi luu, keyframe model moi hien ra ===")
_, s2 = call("/annotate/shot?clip_id=0aD5Bbh_GgU_097200_166733&shot=1&annotator_id=quyen")
d2 = {x["qgroup"]: x for x in s2["drafts"]}
print(" S  verdict:", d2["S"]["verdict"], "| moc nguoi:", d2["S"]["human_keyframes_s"],
      "| model doan:", d2["S"]["predicted_keyframes_s"])
print(" V  verdict:", d2["V"]["verdict"])
print(" N  verdict:", d2["N"]["verdict"], "|", d2["N"]["reason_code"])
print(" nhan cua toi:", s2["my_label"], "| nguoi duyet truoc:", s2["reviewer_label"])

print("\n=== A19/A24: pipeline.db co bi dong khong ===")
after = snap()
print(f" truoc: {before}")
print(f" sau  : {after}")
print(" " + ("KHONG DOI - dat" if before == after else "BI DOI - HONG"))

print("\n=== thong ke 9 nhom ===")
_, sm = call("/annotate/summary")
for r in sm["by_group"]:
    print(f"  {r['qgroup']:<5} draft={r['drafts']} da cham={r['annotated']} "
          f"agree={r['agree'] or 0} n/a={r['not_answerable'] or 0} disagree={r['disagree'] or 0}")
print(" ly do:", sm["by_reason"])
