# requirements.md — qa-pipeline (VLM server cho annotation)

**Bước 00 · Input:** `overview.md` · **Ngày:** 2026-09-05
**Trạng thái:** không còn dòng ⏳; mọi dòng 🔴 đã ✅ → sẵn sàng cho `01_feature-conflict-audit`.

---

## 1. Reality — tuyên bố vs thực tế

| # | `overview.md` nói | Thực tế kiểm chứng được | Lệch ở đâu |
|---|---|---|---|
| R1 | Dataset là **ảnh** (`data/input/image_001.jpg`) | `find work -name '*.mp4' \| wc -l` → **318** (141 `clips/`, 142 `delivered/`, 30 `trimmed/`). `find . -name '*.jpg'` → **2**, cả hai là frame debug | Sản phẩm thật là **video clip**. Không tồn tại dataset ảnh → giải quyết ở Q1 |
| R2 | VLM "automatically generating labels"; dashboard hiện **AI Answer** → Accept/Edit/Reject (§1, §15) | `docs/01_pipeline_overview_TeamA.md` §4: "VLM **không bao giờ** được tự chọn đáp án đúng"; §1: "Team B … **tự quyết** đáp án + chọn keyframe" | Mâu thuẫn trực tiếp với methodology đã ghi → Q2, **đã quyết đi theo `overview.md`**, xem A6 |
| R3 | "Docker GPU passthrough: VERIFIED" | `nvidia-smi` → GTX 1660 Ti, driver 580.88, CUDA 13.0, **6144 MiB**, 420 MiB đang dùng. `docker --version` → 29.7.2, `docker ps` → 0 container | Đúng. Không đụng vào cấu hình Docker GPU |
| R4 | Qwen3-VL-2B GGUF Q4_K_M + mmproj — "đừng giả định là có" | `Qwen/Qwen3-VL-2B-Instruct-GGUF` tồn tại: LLM có FP16/Q8_0/**Q4_K_M**, mmproj có FP16/Q8_0 | Đúng. Tổ hợp yêu cầu **không** bất khả thi → không cần thay model |
| R5 | (ngầm định) llama-server nhận video | Video input đã merge (b9562, PR #24269) nhưng gọi **ffmpeg qua subprocess**; `docs/multimodal.md` chỉ liệt kê **SmolVLM2** là model video, không nhắc Qwen3-VL | Đường video là đất chưa ai đi với model này → Q1 chọn multi-keyframe để tránh |
| R6 | Cần dựng dashboard annotation mới (§15) | `app.py` (663 dòng) đã có tab Review đầy đủ: player, Approve/Reject, timeline, versioned widget keys | Có sẵn một reviewer để học/tái dùng — nhưng V1 không đụng tới (❄️ Q12) |
| R7 | — | Repo **chưa có** bất kỳ code VLM/HTTP/Docker nào: grep `openai\|llama.cpp\|vlm\|qwen\|gguf\|httpx` trên `*.py` → 0 hit; không có Dockerfile/compose | Clean slate. Không có second writer nào để đụng độ |

### Ràng buộc đã có hiệu lực (không phải câu hỏi mở)

- `CLAUDE.md` — "Current phase: YouTube → clean clips. **VQA annotation is out of scope**";
  "One app, one process"; "**Don't add a layer** — no API tier, no task broker, no ORM";
  Principle 3 — "**Don't propose benchmarks, tuning campaigns**".
  Cả ba đều bị feature này vi phạm. Q3 đã quyết: **sửa hiến pháp công khai**, không lách.
- `CLAUDE.md` — test command là `python -m pytest tests -q`, **toàn bộ suite**, không chỉ file mới.
- `architecture.md` §1 — "Out of scope, deliberately: VQA/QA generation". Cùng diện phải sửa.
- Phần cứng: **6144 MiB VRAM là ràng buộc chính**. Ổ D còn 360 GB → dung lượng model không phải vấn đề.
- Python 3.14.3; `requirements.txt` hiện không có HTTP client nào.

---

## 2. Assumptions

| # | Giả định | Trạng thái |
|---|---|---|
| A1 | `Qwen/Qwen3-VL-2B-Instruct-GGUF` có Q4_K_M (LLM) + mmproj, tương thích llama.cpp | **verified** — HF repo, tra ngày 2026-09-05 |
| A2 | GPU + Docker + GPU passthrough hoạt động | **verified** — `nvidia-smi` và `docker ps` chạy sạch |
| A3 | Không có code/second writer nào trong repo đụng đường VLM | **verified** — grep 0 hit, không có Dockerfile |
| A4 | 2B Q4_K_M (~1.2–1.5 GB) + mmproj FP16 (<1 GB) vừa 6 GB; **KV cache + vision token của N frame mới là thứ ăn VRAM**, không phải trọng số | **unverified** — kiểm bằng `nvidia-smi` trước/sau khi nạp và lúc inference (AC-3) |
| A5 | Ảnh `ghcr.io/ggml-org/llama.cpp:server-cuda` có build cho compute capability **7.5** (Turing / 1660 Ti) | **unverified** — kiểm bằng dòng CUDA device trong `docker compose logs` (AC-2); thiếu arch thì server rơi về CPU và lộ ra ở AC-3 |
| A6 | Nhãn đáp án do VLM sinh **làm hỏng luận điểm chống modality-collapse** nếu chảy vào GT — Gate B sẽ đo model trên nhãn do chính model tạo | **verified** về mặt tài liệu (`docs/modality_collapse_evaluation.md` PHẦN 0–1). **Đã nêu, người dùng đã quyết chấp nhận** (Q2). Giảm thiểu rẻ tiền, không đổi phạm vi: output VLM ghi vào kho riêng, `pipeline.db` không được đụng — canh bằng **AC-8** |
| A7 | Một frame đơn không sinh được câu hỏi nhóm **T** (trình tự) và **C** (nguyên nhân) | **verified** — `docs/02_annotator_guideline_TeamB.md`: T cần 2 khung trước/sau, C cần khung *ngay trước* va chạm |
| A8 | Clip bắt đầu tại thời điểm va chạm (cut rule `impact → impact + 5s`) nên đầu clip là chỗ quan trọng nhất | **unverified** — `CLAUDE.md` Decision Log ghi vậy; kiểm bằng mắt trên 1 clip khi chọn keyframe |

---

## 3. Open questions

| # | Câu hỏi | Vì sao quan trọng | Mặc định của tôi | Level | Status |
|---|---|---|---|---|---|
| Q1 | Đơn vị data gửi VLM | Ảnh đơn giết nhóm T/C (A7); video là đường chưa ai đi với Qwen3-VL (R5) | **N keyframe/clip, gửi chung 1 request** | 🔴 | ✅ |
| Q2 | VLM được sinh gì | Quyết định luận điểm chống-shortcut của cả benchmark | **Sinh đáp án nháp theo `overview.md`**; hệ quả ở A6 đã được chấp nhận | 🔴 | ✅ |
| Q3 | Code sống ở đâu | `CLAUDE.md` cấm thêm tầng | **Thư mục tách trong repo này + sửa hiến pháp công khai** | 🟡 | ✅ |
| Q4 | V1 dừng ở đâu | Dựng dashboard trước khi biết model có dùng được không là rủi ro lớn nhất | **Dừng khi chứng minh được model THỰC SỰ đọc ảnh** | 🟡 | ✅ |
| Q5 | Bao nhiêu keyframe, lấy ở đâu | N chi phối vision-token → chi phối VRAM (A4) | **N=4, chia đều trên độ dài clip** — đủ cặp trước/sau cho nhóm T | 🟢 | 💭 |
| Q6 | Quant của mmproj | Ảnh hưởng chất lượng thị giác nhiều hơn quant của LLM | **FP16** — VRAM còn dư, đừng bóp phần nhìn | 🟢 | 💭 |
| Q7 | Context size | Đặt cao là nguồn OOM số 1 trên 6 GB | **Bắt đầu 4096, chỉ tăng khi AC-5 đòi** (`STABILITY > QUALITY > THROUGHPUT`) | 🟢 | 💭 |
| Q8 | Bind address | `overview.md` §17: không phơi ra mặc định | **`127.0.0.1:8080`**, không phải `0.0.0.0` | 🟢 | 💭 |
| Q9 | Pin phiên bản thế nào | `overview.md` §22.4 đòi reproducibility | **Pin digest của image + ghi sha256 của 2 file GGUF** | 🟢 | 💭 |
| Q10 | Team B còn gán nhãn đôi độc lập (κ) nữa không, khi đã có nhãn nháp | Đổi schema: 1 nhãn hay ≥2 nhãn/item | — | 🔴 | ❄️ hoãn tới batch/dashboard; **ngoài V1** |
| Q11 | Batch, resume, checkpoint, retry | — | — | 🟡 | ❄️ hoãn (Q4) |
| Q12 | Dashboard, observability, P50/P95, concurrency | Va Principle 3 | — | 🟡 | ❄️ hoãn (Q4) |

---

## 4. Acceptance criteria — V1

Mỗi dòng là một mệnh đề chạy được, cho ra yes/no.

**Hạ tầng**

- **AC-1** `docker compose up -d` rồi `docker ps` → container `Up`.
  `docker port <name> 8080` in ra **`127.0.0.1:8080`**, KHÔNG phải `0.0.0.0:8080`.
- **AC-2** `docker compose logs` chứa **cả ba**: một dòng nêu **tên GPU thật** (không phải chỉ CPU),
  một dòng xác nhận **mmproj / vision projector đã nạp**, một dòng server listening.
  Thiếu dòng mmproj = fail, kể cả khi server trả 200.
- **AC-3** `nvidia-smi` sau khi nạp: process của container giữ VRAM **> 0 MiB**, tổng **≤ 5500 MiB**
  trên card 6144 MiB. Ghi lại 3 số: trước khi nạp, sau khi nạp, lúc inference.

**Thị giác — phần fail to tiếng khi hỏng ngầm**

- **AC-4** `python vlm/scripts/test_api.py` exit code **0**, in latency (ms) và câu trả lời.
- **AC-5** Cùng một câu hỏi, **3 điều kiện** trên một clip thật lấy từ `work/*/trimmed/`:
  1. 4 keyframe thật → trả lời A
  2. 4 frame xám đặc → trả lời B
  3. không có ảnh (blind) → trả lời C

  PASS **chỉ khi A ≠ B và A ≠ C**. Nếu A == C, model đang đoán bằng ngôn ngữ và vision encoder
  không thực sự tham gia → script exit **non-zero, nói rõ điều kiện nào trùng**.
  (Một câu hỏi mà blind cũng trả lời đúng thì không chứng minh được gì — đây là bản thu nhỏ của
  chính Gate B trong `docs/modality_collapse_evaluation.md`.)
- **AC-6** Câu trả lời cho ảnh thật khớp một sự thật **người đã kiểm bằng mắt** trên clip đó
  (ví dụ: có xe máy hay không / trời mưa hay không), ghi thẳng trong test làm expected.

**Lần chạy thứ hai — vì "một lần" không bao giờ là ca thật**

- **AC-7** Chạy `test_api.py` **hai lần liên tiếp** với `temperature=0` → trả lời **giống hệt** cả hai lần,
  `docker ps` vẫn `Up`, **restart count không tăng**.

**Quyền sở hữu dữ liệu — chốt giữ đường VLM tách khỏi pipeline clip**

- **AC-8** `sha256sum pipeline.db` **không đổi** trước và sau toàn bộ AC-4…AC-7.
  Mọi output VLM chỉ nằm dưới `vlm/data/output/`. Không ghi vào `clips`, `reviews`, `videos`.
  Đây là hàng rào cụ thể cho rủi ro A6.
- **AC-9** `python -m pytest tests -q` vẫn **xanh toàn bộ** sau khi thêm feature.

**Lỗi**

- **AC-10** Ảnh 0 byte / hỏng → in **tên lỗi cụ thể**, exit non-zero, không treo.
  Tắt container rồi gọi → báo `connection refused` rõ ràng, không traceback trần.
- **AC-11** Mỗi request có timeout hữu hạn; quá hạn thì ghi log failed, **không nuốt im lặng**.

**Tài liệu**

- **AC-12** `CLAUDE.md` và `architecture.md` được sửa để Phase 2 (VQA annotation) là **in scope**,
  nêu rõ ngoại lệ cho "Don't add a layer", và ghi A6 vào Decision Log như rủi ro đã chấp nhận
  — thực hiện ở bước 08, liệt kê ở đây để không quên.
