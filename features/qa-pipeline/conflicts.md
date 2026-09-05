# conflicts.md — qa-pipeline

**Bước 01 · Input:** `requirements.md` · **Ngày:** 2026-09-05
**Baseline:** `python -m pytest tests -q` → **55 passed in 9.72s** (trước khi động vào gì)

---

## Conflicts

| # | Mới vs cũ | Cái gì vỡ | Xác minh bằng |
|---|---|---|---|
| 1 | VLM chọn input qua `clips.trimmed_path` vs cột đó đã **chết** | `trimmed_path` NULL ở **cả 141/141** dòng trong khi **30 file thật** nằm trong `trimmed/`. Chủ sở hữu thật là `trim_segments` (27 dòng → 30 segment). Code mới hỏi nhầm cột sẽ nhận **0 clip** và im lặng không annotate gì | `SELECT (trimmed_path IS NOT NULL), count(*) FROM clips GROUP BY 1` → `(0, 141)`; `db.py:129-138` chỉ đọc `trimmed_path` **một lần** lúc migrate, không bao giờ ghi lại |
| 2 | VLM lưu annotation trỏ tới file trong `trimmed/` vs **`trimmed/` có người ghi thứ hai** | Reviewer bấm Reject → `review.discard()` `unlink()` file; `review.purge_video()` cũng xoá khi gỡ video khỏi queue. Annotation trỏ vào file đã bị xoá, **không có gì báo** | Chạy `probe_second_writer.py` trên **bản sao** DB đã checkpoint: `file exists BEFORE: True` → `discard() removed 1 file(s)` → `file exists AFTER: False` → `ORPHANED`. DB thật sau probe: vẫn 27 dòng / 30 file |
| 3 | Giả định **A8** ("impact ở đầu clip") vs hình học thật của shot | A8 **SAI**. Shot là `impact ± 5s` nên impact nằm ở **giữa**, không phải đầu; và reviewer chỉnh tay nên độ dài thật là 9.2–29.0s (median 16.0s), không phải 5s hay 10s cố định. N=4 frame chia đều sẽ **không có frame nào ở thời điểm va chạm** — đúng cái nhóm **C** cần ("khung ngay *trước* va chạm") | `ffprobe` trên cả 30 file → `n=30 min=9.2 median=16.0 max=29.0`; mid của segment thật: 13.8 / 11.8 / 9.3 / 22.0 / 10.0s |
| 4 | Feature vs **quyết định đã ghi** | 5 chỗ: `CLAUDE.md` ("VQA annotation is out of scope", "One app, one process", "Don't add a layer"), `architecture.md` §1 ("Out of scope: VQA/QA generation"), `docs/01…TeamA.md` §4 ("VLM **không bao giờ** được tự chọn đáp án đúng"). Người dùng đã đồng ý đổi 4 cái đầu (Q2/Q3). Cái thứ 5 **cũng phải sửa** — nếu không, `docs/02…TeamB.md` vẫn dặn annotator "đừng mở cột đáp án gợi ý" trong khi dashboard sẽ chìa đáp án AI ra trước mặt họ | `grep` trực tiếp trong 4 file. Không phải suy đoán |
| 5 | "Đọc clip từ `work/`" vs **ba thư mục khác nhau, khác nghĩa** | `clips/` (141) là master **chưa blur**; `delivered/` (142) đã blur nhưng gồm **105 clip UNREVIEWED**; `trimmed/` (30) mới là thành phẩm đã duyệt. Không nêu rõ nguồn thì V1 dễ annotate nhầm footage chưa duyệt hoặc còn nguyên overlay | `review.py:_source()` — "Always cut from delivered: that is the blurred video"; `SELECT decision,count(*) FROM reviews` → APPROVED 27 / REJECTED 9 / UNREVIEWED 105 |

### Probe trả về sạch — không bịa thêm

- **Port**: 8080 và 8501 đều rảnh (`netstat`).
- **Không có consumer nào quét thư mục** `work/` ngoài `download.py:101` `work.glob("source.*")` → chỉ cần **không** đặt tên file keyframe là `source.*`.
- **Export đọc DB, không đọc đĩa** (`app.py:607-658`) → thêm file vào `work/` không làm hỏng manifest.
- **R5 đã gỡ**: `.devops/cuda.Dockerfile` **có cài `ffmpeg`** (`apt-get install -y libgomp1 curl ffmpeg`) → đường video sau này khả thi, không phải ngõ cụt.
- **A5**: image base là CUDA **12.8.1**, driver 580.88/CUDA 13.0 chạy ngược được. `CUDA_DOCKER_ARCH=default` → dùng arch list mặc định của llama.cpp. Chưa chứng minh được compute 7.5 có trong đó mà không kéo image về; **rủi ro còn lại, bắt tại AC-2/AC-3**, không phải conflict.
- **A4 (VRAM)**: không kiểm được nếu chưa nạp model. Vẫn `unverified`, bắt tại AC-3.

---

## Verdict: **PASS**

Cả 5 conflict đều có cách sửa **nằm gọn trong các quyết định đã chốt** — không cái nào đòi mở lại Q1–Q4.
Conflict #4 không phải BLOCK vì người dùng đã được nêu hệ quả và đã chủ động chọn (A6); nó biến thành
**nghĩa vụ sửa tài liệu**, không phải rào chặn.

---

## Recommended approach

Dựng V1 như một **đường một chiều, chỉ đọc**, tách hẳn khỏi pipeline clip: `vlm/` (client + script) và
`docker/` (compose) đứng cạnh `vqa/`, ghi ra `vlm/data/output/`, **không mở `pipeline.db` để ghi**.
Điểm thiết kế then chốt gỡ được cả #1 và #2 cùng lúc: **annotation lấy `clip_id` làm định danh, tuyệt đối
không lấy đường dẫn file** — đường dẫn được phân giải tại thời điểm dùng qua `db.trim_segments(clip)`
(hàm mà `app.py` đang thật sự dùng), và mỗi bản ghi kèm **sha256 của file nguồn**. Như vậy Reject/purge
xoá file thì annotation trở thành trạng thái "nguồn đã biến mất" nhìn thấy được, còn reviewer cắt lại
clip thì sha256 lệch và annotation cũ tự lộ ra là **stale** thay vì âm thầm khớp nhầm video. Với #3,
keyframe lấy **neo theo giữa segment** (nơi impact thực sự nằm) chứ không chia đều mù: một frame ngay
trước mốc giữa cho nhóm C, một frame sau cho nhóm T. Nguồn đầu vào cố định là **`trimmed/` của clip
APPROVED**, nêu thẳng trong config, để #5 không thể xảy ra do nhầm lẫn.

**Trade-off:** buộc VLM chỉ chạy trên **27 clip đã duyệt** thay vì 141 — tập nhỏ hơn nhiều, và mỗi lần
muốn thêm dữ liệu thì phải duyệt tay trước. Đổi lại không bao giờ annotate nhầm footage chưa duyệt hoặc
còn nguyên overlay. Keyframe neo-theo-giữa cũng chỉ đúng với shot `impact ± pad`; shot reviewer chỉnh tay
(median 16s) thì "giữa" chỉ là phỏng đoán tốt nhất, không phải impact thật.

**Not doing:**
- Ghi bất cứ thứ gì vào `pipeline.db` — sẽ tạo ra người ghi thứ ba vào dữ liệu mà runner và reviewer đang tranh chấp.
- Dùng `clips.trimmed_path` — cột chết, trả về 0 dòng (#1).
- Đẩy video thẳng vào llama-server ở V1 — ffmpeg có sẵn nên khả thi, nhưng Qwen3-VL chưa có trong danh sách model video của `docs/multimodal.md` (Q1 đã chốt multi-keyframe).
- Copy keyframe vào `work/` với tên `source.*` — trùng glob của `download.py:101`.
