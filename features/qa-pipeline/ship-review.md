# qa-pipeline V1 — ship review

**Shipped:** 2026-09-05 · **Acceptance:** 18/18 pass (A1–A12, C1–C6) · **Suite:** 66 tests, green

## What shipped

Một VLM server tự host, chạy được và **đã chứng minh là thật sự đọc ảnh**. `docker compose up -d`
dựng llama.cpp `server-cuda` (pin theo digest) với Qwen3-VL-2B-Instruct Q4_K_M + mmproj FP16 trên
GTX 1660 Ti, nghe ở `127.0.0.1:8080`. `python -m vlm.scripts.test_api` lấy 4 keyframe từ một clip
đã duyệt thật, hỏi cùng một câu theo **ba điều kiện** — ảnh thật, ảnh xám đặc, không ảnh — và chỉ
báo PASS khi ba câu trả lời khác nhau. Với 4 frame xám model nói "Không có phương tiện nào được
nhìn thấy"; với ảnh thật nó tả đúng chiếc xe tải Hyundai và chiếc xe khách màu vàng mà người đã
tự nhìn thấy trong khung hình. Server trả HTTP 200 không chứng minh được gì; phép thử này thì có.

Đường VLM chỉ đọc: `pipeline.db` mở `mode=ro`, mọi output nằm trong `vlm/data/output/*.jsonl`,
và `tests/test_vlm_isolation.py` làm đỏ build nếu có câu SQL ghi nào lọt vào `vlm/`.

## Decisions worth remembering

Đã chuyển vào Decision Log của `CLAUDE.md`:

- llama.cpp `server-cuda` pin theo digest; 2.7 GB VRAM / 6, 4 ảnh = 1378 token / 4096, 3–7s khi ấm.
- Input **chỉ** là `trimmed/` của clip APPROVED — không bao giờ `clips/` (master chưa blur) hay
  `delivered/` (còn 105 clip chưa duyệt).
- Định danh bản ghi là `clip_id` + `shot` + `source_sha256`, **không bao giờ là đường dẫn file**.
- `vlm/` được import `vqa/`; `vqa/` không bao giờ import `vlm/`. Đây là ngoại lệ duy nhất được cấp
  cho luật "Don't add a layer", và nó có biên rõ ràng.
- VLM **có** sinh đáp án nháp — chấp nhận có ý thức, kèm cái giá đã ghi thành văn.
- 4 keyframe **cụm quanh giữa shot**, không chia đều.

## What changed about the plan

| Chỗ build cãi lại spec | Bên nào thắng |
|---|---|
| A2 đòi log in tên thiết bị CUDA | **Runtime thắng.** Image chỉ log 27 dòng và không in tên GPU. Thay bằng thí nghiệm tắt/bật VRAM (3314→532→3259 MiB), mạnh hơn một dòng grep |
| A3 đòi VRAM theo từng process | **Windows thắng.** WDDM trả `[N/A]` cho `--query-compute-apps`. Dùng delta tổng |
| C4 dùng clip 10s làm ví dụ | **Dữ liệu thắng.** Ở 10s thì chia-đều và neo-giữa trùng nhau; phải dùng clip dài nhất thật (29s) mới phân biệt được |
| C1 nói "trả về 27 clip" | **Dữ liệu thắng.** Đơn vị annotate là *file shot*: 27 clip sinh ra 30 file |
| C2 nói Reject đẩy clip vào `missing` | **Code thắng.** `discard()` dọn luôn `trim_segments` nên clip rớt khỏi truy vấn; `missing` dành cho ca file mất ngoài luồng app. Đã chạy riêng để chứng minh nhánh đó không phải code chết |
| A7 đòi output giống hệt từng byte | **Runtime thắng, sau một FAIL thật ở bước 07.** Prompt cache của llama.cpp đổi thứ tự cộng dồn float trên CUDA. Ba lần chạy ở trạng thái ổn định thì giống hệt; thứ phải tái lập là *kết luận*, và nó tái lập |
| Lo 4 ảnh không lọt ctx 4096 | **Đo đạc thắng.** ~344 token/ảnh chứ không phải 1024 → 1378/4096. D1 và D8 giữ nguyên |

`vlm/scripts/check_server.py` (scaffolding của T1) đã xoá ở bước này: nó dựng lại HTTP bằng tay,
trùng với `vlm/client.py`, và `test_api.py` bao trọn việc nó làm.

## Not shipped

Tất cả đã vào phần **Phase 2 — open items** của `TODO.md` repo:

- `batch_inference.py` + checkpoint/retry/resume/chống trùng.
- Dashboard annotation.
- Q10 — Team B còn gán nhãn đôi độc lập (κ) nữa không, khi đã có nhãn nháp. Đổi schema nhãn.
- Distractor, Pass-1/Pass-2, κ/α, Gate B.
- Đo P50/P95, throughput, concurrency — `CLAUDE.md` Principle 3 cấm ở phase này.

## Still broken

Không có mục nào chạm vào feature này. Cả hai đều có **trước** nó và đã vào `TODO.md` mục
BLOCKED:

1. **30 file trong `trimmed/` còn biển số `37B-016.09` cháy chữ chưa blur.** Chúng được dựng
   trước khi vùng `middle_bottom` vào `config.json`. Phát hiện bằng cách nhìn keyframe, không
   phải bằng đọc code.
2. **Pipeline không blur mặt hay biển số** — chỉ xoá overlay của kênh, và calibration đo
   *chuyển động* nên về mặt cấu trúc không thể che biển số trên xe đang chạy. `docs/01…TeamA.md`
   bước 2 đã được sửa để thôi tuyên bố ngược lại, nhưng khoảng trống năng lực là có thật và
   phải xử lý trước khi dataset rời khỏi máy này.
