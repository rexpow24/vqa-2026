"""E2E qua HTTP cho /relabel/*, doi chieu voi query DB (qua vqa/db.py, nguon
su thuc duy nhat -- khong tu viet lai SQL rieng vi se lac hau voi
list_missing_labels() moi biet ve review_segments) + filesystem truc tiep.

Khong ghi nhan gia len pipeline.db thuc -- chi doc va doi chieu.
"""
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from vqa import db  # noqa: E402  (sys.path setup must come first)

B = "http://127.0.0.1:8787"


def call(path):
    with urllib.request.urlopen(B + path) as r:
        return r.status, json.loads(r.read())


def db_backlog_trimmed_only():
    """Goi dung ham thuc su sidecar dung (db.list_missing_labels), khong
    tu viet lai dieu kien -- do chinh la diem _e2e.py cua repo nay nhan manh:
    E2E phai di dung duong UI/sidecar di, khong doan lai logic rieng."""
    rows = db.list_missing_labels(trimmed_only=True)
    return {r["clip_id"]: r for r in rows}


def resolve_fs_path(trim_segments_json: str) -> str | None:
    """trimmed/ only -- never finished/, which is mpeg4 (cv2.VideoWriter) and
    not browser-playable; see the comment on sidecar.main._relabel_video_path."""
    for seg in json.loads(trim_segments_json or "[]"):
        p = seg["path"].replace("\\", "/")
        if os.path.exists(p):
            return p
    return None


print("=== /relabel/next tra ve gi ===")
code, next_resp = call("/relabel/next")
clip = next_resp["clip"]
print(f" HTTP {code}  clip_id={clip['clip_id'] if clip else None}"
      f"  remaining(API)={next_resp['remaining']}")
if clip:
    print(f" video_path tra ve: {clip['video_path']}")

print("\n=== doi chieu voi QUERY truc tiep tren pipeline.db ===")
db_rows = db_backlog_trimmed_only()
print(f" so clip query truc tiep tim duoc (truoc khi loai file hong): {len(db_rows)}")
if clip:
    row = db_rows.get(clip["clip_id"])
    if row is None:
        print(f" FAIL: clip {clip['clip_id']} API tra ve KHONG nam trong ket qua query"
              f" -- co the da bi label roi ma API van tra ve nham.")
    else:
        already_labeled = row["difficulty"] is not None and row["event_label"] is not None
        print(f" difficulty={row['difficulty']!r} event_label={row['event_label']!r}"
              f"  -> {'FAIL: da co nhan roi!' if already_labeled else 'dat: chua co nhan'}")

print("\n=== doi chieu voi FILESYSTEM: video_path API tra ve co ton tai, dung la trimmed/ ===")
fail = 0
for cid, row in db_rows.items():
    expected = resolve_fs_path(row["trim_segments"])
    if expected is None:
        continue  # file hong ca hai noi -- da biet, API phai tu loai no ra
    if cid == (clip["clip_id"] if clip else None):
        actual = clip["video_path"]
        ok = actual == expected
        print(f" clip dang xet: expected={expected}")
        print(f"                actual  ={actual}")
        print(f"                -> {'dat' if ok else 'FAIL: lech duong dan'}")
        if not ok:
            fail += 1

print("\n=== doi chieu so luong remaining cua API voi so luong tu FS+DB tinh doc lap ===")
valid = sum(1 for row in db_rows.values() if resolve_fs_path(row["trim_segments"]) is not None)
print(f" remaining (API)        = {next_resp['remaining']}")
print(f" valid doc lap (query+fs) = {valid}")
print(f" -> {'dat' if next_resp['remaining'] == valid else 'FAIL: khong khop'}")

print("\n=== TONG KET ===")
print("KHONG PHAT HIEN LECH" if fail == 0 and next_resp["remaining"] == valid
      else "CO LECH -- xem chi tiet o tren")
