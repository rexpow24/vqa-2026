# architecture.md — qa-pipeline V1 (của FEATURE, không phải của repo)

**Bước 02** · Gộp vào `architecture.md` của repo ở bước 08.

---

## Shape

Một chiều: **`vlm/` được phép import `vqa/`; `vqa/` không bao giờ import `vlm/`.** Nhờ vậy 55 test
hiện có bảo vệ nguyên vẹn phần cũ, và xoá cả thư mục `vlm/` cũng không làm pipeline clip suy suyển.

| File | Vai trò | Seam nó nấp sau |
|---|---|---|
| `docker/docker-compose.yml` | llama.cpp server-cuda, pin digest, bind `127.0.0.1:8080` | HTTP — không có gì trong Python biết về Docker |
| `docker/.env.example` | đường dẫn model, context, ngpu-layers, port | compose đọc, code không đọc |
| `models/` (gitignored) | 2 file GGUF + `models/SHA256SUMS` | bind-mount, không copy vào image |
| `vlm/frames.py` | `keyframes(video, times_s, width) -> list[bytes]` (JPEG) | **một** hàm public; ffmpeg nằm hết bên trong |
| `vlm/select.py` | `keyframe_times(segment, n) -> list[float]` | thuần số học, không I/O → test được không cần ffmpeg |
| `vlm/source.py` | `approved_clips() -> list[ClipRef]` | **chỗ duy nhất** biết `trim_segments` và đĩa |
| `vlm/client.py` | `health()`, `ask(question, images, timeout)` | **chỗ duy nhất** biết HTTP/base64/OpenAI schema |
| `vlm/scripts/test_api.py` | chạy 3 điều kiện, in latency + VRAM, exit code | CLI |
| `vlm/data/output/` | JSONL kết quả | nơi ghi **duy nhất** của V1 |

Bốn interface, không hơn: `keyframe_times`, `keyframes`, `approved_clips`, `ask`. Độ phức tạp
(ffmpeg args, base64, retry, lỗi HTTP) nằm **bên trong** module, không rải ra cho caller.

## Data

`vlm/data/output/probe_<timestamp>.jsonl`, mỗi dòng một lần gọi:

| Field | Type | Default | **Ai ghi** |
|---|---|---|---|
| `clip_id` | str | — | `vlm/source.py` (đọc từ `clips.clip_id`) |
| `source_sha256` | str | — | `vlm/source.py`, hash của file `trimmed/` lúc đọc |
| `condition` | `"real"` \| `"grey"` \| `"blind"` | — | `test_api.py` |
| `question` | str | — | `test_api.py` |
| `answer` | str \| null | null | `vlm/client.py` |
| `latency_ms` | int | — | `vlm/client.py` |
| `status` | `"success"` \| `"error"` | — | `vlm/client.py` |
| `error` | str \| null | null | `vlm/client.py` |
| `n_frames` | int | 4 | `test_api.py` |
| `model` | str | từ `.env` | `test_api.py` |

**Chủ sở hữu duy nhất của mọi field là tiến trình `test_api.py`.** Không có tiến trình thứ hai:
runner (`run_pipeline.py`) và reviewer (Streamlit) đều không biết thư mục này tồn tại.

**Không thêm/sửa field nào trong `pipeline.db`.** `vlm/source.py` mở DB **read-only**
(`file:pipeline.db?mode=ro`), nên kể cả lỗi lập trình cũng không ghi được.

## Flow

```
test_api.py
  │
  ├─ vlm.source.approved_clips()          ← đọc RO: clips ⋈ reviews, decision='APPROVED',
  │     │                                    trim_segments ≠ '[]'  (KHÔNG dùng trimmed_path)
  │     └─ file thiếu trên đĩa → bỏ qua clip đó, đếm và báo   [nhánh lỗi: Reject đã xoá]
  │
  ├─ vlm.select.keyframe_times(segment, n=4)   ← neo theo giữa segment
  ├─ vlm.frames.keyframes(...)             → 4 JPEG bytes
  │     └─ ffmpeg fail / 0 byte → MediaError có tên            [nhánh lỗi: AC-10]
  │
  ├─ vlm.client.health()
  │     └─ connection refused → thoát non-zero, in "server chưa chạy"  [nhánh lỗi]
  │
  ├─ ask(q, real)  → A      ─┐
  ├─ ask(q, grey)  → B       ├─ timeout → status=error, ghi JSONL, KHÔNG nuốt   [AC-11]
  └─ ask(q, none)  → C      ─┘
        │
        └─ A == C  →  exit 1: "vision encoder không tham gia"   ★ điều kiện fail chính
           A == B  →  exit 1: "model không phân biệt được ảnh thật/ảnh xám"
           còn lại →  exit 0
```

## Why this shape — một đoạn cho mỗi conflict

**#1 — `trimmed_path` là cột chết.** `vlm/source.py` là *chỗ duy nhất* chạm vào DB, và nó truy vấn
`trim_segments` — đúng cột mà `app.py:434,631` đang thật sự dùng — chứ không đụng `trimmed_path`.
Vì chỉ có một chỗ biết chuyện này, không có cách nào để một caller thứ hai hỏi nhầm cột. Acceptance
C1 khoá lại bằng con số: query phải trả về **27**, không phải 0.

**#2 — `trimmed/` có người ghi thứ hai.** Không lưu đường dẫn làm định danh. Bản ghi khoá theo
`clip_id`, đường dẫn được phân giải lại mỗi lần chạy, và `source_sha256` chụp lại nội dung file lúc
đọc. Reject/purge xoá file → lần chạy sau `approved_clips()` **không trả clip đó nữa** và đếm nó vào
mục "nguồn đã biến mất"; reviewer cắt lại clip → sha256 lệch → bản ghi cũ tự lộ là stale. Cả hai
đều là trạng thái nhìn thấy được, thay cho một con trỏ hỏng im lặng.

**#3 — impact ở giữa, không ở đầu.** `keyframe_times` nhận `(start_ms, end_ms)` của **segment** rồi
đặt mốc quanh trung điểm: hai frame trước và hai frame sau, giãn theo độ dài thật. Với shot
`impact ± 5s` thì mốc giữa chính là va chạm; với shot reviewer chỉnh tay (9.2–29s) thì đây là phỏng
đoán tốt nhất và điều đó được ghi thẳng trong docstring. Vì hàm thuần số học, nó test được mà không
cần ffmpeg — hợp với ràng buộc "no ffmpeg, no network" của suite hiện tại.

**#4 — mâu thuẫn quyết định đã ghi.** Không giải bằng code mà bằng tài liệu, ở bước 08: `CLAUDE.md`
mở Phase 2 và ghi ngoại lệ cho "Don't add a layer"; `architecture.md` §1 bỏ "VQA/QA generation" khỏi
out-of-scope; `docs/01…TeamA.md` §4 sửa lại vì VLM **giờ có** đề xuất đáp án; `docs/02…TeamB.md` phải
sửa vì đang dặn annotator "đừng mở cột đáp án gợi ý" trong khi sắp thấy đáp án AI. AC-12 giữ chỗ.

**#5 — ba thư mục khác nghĩa.** `approved_clips()` chỉ nhận clip có `reviews.decision='APPROVED'`
**và** có `trim_segments`, rồi đọc đúng file trong `trimmed/`. `clips/` (master chưa blur) và
`delivered/` (gồm 105 clip chưa duyệt) không xuất hiện ở bất kỳ đâu trong `vlm/`. Grep là đủ để kiểm.

## Rejected

- **Thêm bảng `vlm_annotations` vào `pipeline.db`** — tạo người ghi thứ ba vào store mà runner và reviewer đã tranh chấp; JSONL đủ cho V1.
- **Thêm `keyframes()` vào `vqa/media.py`** — module đó đang được 55 test bảo vệ; đổi nó là mở rộng bán kính vụ nổ mà không được gì.
- **Đọc frame bằng OpenCV** — `opencv-python-headless` đã có, nhưng ffmpeg đã là đường đi của cả repo; hai decoder cho cùng một việc là hai hành vi khác nhau khi gặp file lỗi.
- **Gọi thẳng `/completion` của llama.cpp** — OpenAI-compatible `/v1/chat/completions` là thứ `overview.md` §4 yêu cầu và đổi backend sau này rẻ hơn.
- **Chạy server ngoài Docker** — mất tính tái lập mà `overview.md` §22.4 đòi.
