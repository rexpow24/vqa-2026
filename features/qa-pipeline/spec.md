# spec.md — qa-pipeline V1

**Bước 02** · Inputs: `requirements.md`, `conflicts.md` (**PASS**) · **Ngày:** 2026-09-05

---

## Problem

Pipeline hiện tại đã cho ra clip sạch, nhưng việc gán nhãn QA vẫn hoàn toàn thủ công. Ta muốn
một **VLM server tự host** (Qwen3-VL-2B GGUF Q4_K_M trên llama.cpp, trong Docker, dùng GPU
GTX 1660 Ti 6 GB) để sinh nhãn nháp cho dataset QA, chạy local, không phụ thuộc API bên ngoài.
Yêu cầu quan trọng nhất của người đặt hàng: **không được tự nhận là chạy được — phải chứng
minh bằng cách chạy thật**, và nếu tổ hợp model/runtime không tương thích thì phải nói ra chứ
không âm thầm thay model khác.

## Behaviour — sau khi V1 ship

- `docker compose up -d` dựng được một llama.cpp server nghe ở **`127.0.0.1:8080`**, nạp
  Qwen3-VL-2B Q4_K_M cùng mmproj, chạy trên GPU, và **không** phơi ra mạng ngoài.
- `python -m vlm.scripts.test_api` trích 4 keyframe từ một clip **đã duyệt** thật, gửi kèm một
  câu hỏi, in ra latency và câu trả lời, thoát code 0.
- Cùng script đó chạy lại **3 điều kiện** (ảnh thật / ảnh xám đặc / không ảnh) và **thất bại to
  tiếng** nếu câu trả lời khi có ảnh trùng với khi không có ảnh — nghĩa là vision encoder không
  thực sự tham gia.
- Con số VRAM trước khi nạp / sau khi nạp / lúc inference được ghi lại thành số, không phải cảm giác.
- `pipeline.db` **không đổi một byte nào** sau toàn bộ quá trình; 55 test cũ vẫn xanh.

## Scope

- `docker/docker-compose.yml` + `.env.example` — llama.cpp server-cuda, pin theo digest.
- Tải `Qwen3-VL-2B-Instruct` Q4_K_M (LLM) + mmproj FP16, ghi lại sha256.
- `vlm/frames.py` — trích N keyframe **màu** từ một clip, neo theo giữa segment.
- `vlm/client.py` — client OpenAI-compatible tối thiểu: health, chat kèm ảnh, timeout, lỗi có tên.
- `vlm/scripts/test_api.py` — chứng minh model thật sự đọc ảnh (3 điều kiện).
- `vlm/data/output/` — nơi duy nhất V1 được ghi.
- Sửa `CLAUDE.md`, `architecture.md`, `docs/01…TeamA.md`, `docs/02…TeamB.md` (bước 08).

## Non-goals

| Ngoài phạm vi | Lý do |
|---|---|
| `batch_inference.py`, checkpoint / resume / retry | Q4: chưa biết model có dùng được không thì batch là code viết cho một giả định chưa kiểm |
| Dashboard annotation | Như trên; `app.py` đã có sẵn reviewer để học khi tới lúc |
| Đo P50/P95, throughput, tuning concurrency | `CLAUDE.md` Principle 3 cấm tuning campaign; V1 chỉ ghi latency thô của 1 request |
| Đẩy video trực tiếp vào llama-server | Q1 chốt multi-keyframe; `docs/multimodal.md` chưa liệt kê Qwen3-VL là model video |
| Ghi bất cứ gì vào `pipeline.db` | Conflict #2 — runner và reviewer đã tranh chấp store đó rồi, không thêm người ghi thứ ba |
| Sinh distractor, Pass-1/Pass-2, tính κ/α, Gate B | Thuộc methodology ở `docs/`, cần schema nhãn mà Q10 còn ❄️ |
| Cấu hình lại Docker GPU passthrough | R3: đã xác minh là chạy |

## Decisions — không mở lại

| # | Quyết định | Đánh đổi đã chấp nhận |
|---|---|---|
| D1 | **N keyframe màu / 1 request**, không phải ảnh đơn, không phải video | Mất chuyển động mượt giữa 2 frame; vision-token nhân theo N nên đây mới là thứ ăn VRAM |
| D2 | **VLM sinh đáp án nháp** đúng như `overview.md` | Nhãn do model sinh làm hỏng luận điểm chống modality-collapse nếu chảy vào GT; annotator sẽ bị anchoring và κ giữa 2 người mất ý nghĩa. **Đã nêu, đã chấp nhận** (A6). Rào chắn duy nhất còn giữ: output nằm ngoài `pipeline.db` (AC-8) |
| D3 | Sống trong repo này ở thư mục tách, **sửa hiến pháp công khai** | `CLAUDE.md` phải viết lại 3 chỗ; quên là mọi quyết định sau mâu thuẫn với nó |
| D4 | V1 dừng khi chứng minh được model thật sự đọc ảnh | Chưa gán được nhãn nào cho 27 clip |
| D5 | Input cố định là **`trimmed/` của clip APPROVED** (27 clip) | Nhỏ hơn 141 clip rất nhiều; muốn thêm dữ liệu phải duyệt tay trước |
| D6 | Annotation định danh bằng **`clip_id` + sha256**, không bao giờ bằng đường dẫn | Phải tính hash mỗi lần đọc; đổi lại Reject/purge không tạo ra bản ghi mồ côi âm thầm |
| D7 | Keyframe **neo theo giữa segment**, không chia đều mù | Chỉ đúng với shot `impact ± pad`; shot reviewer chỉnh tay thì "giữa" là phỏng đoán tốt nhất |
| D8 | mmproj **FP16**, context **4096**, bind **127.0.0.1**, pin digest + sha256 | Context thấp có thể phải nâng nếu 4 ảnh không đủ chỗ — nâng sau khi đo, không đoán trước |
