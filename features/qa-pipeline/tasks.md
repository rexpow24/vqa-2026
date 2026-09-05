# tasks.md — qa-pipeline V1

**Bước 03** · Inputs: `spec.md`, `architecture.md`, `acceptance.md`

T1 là lát cắt mỏng nhất chứng minh **cả đường đi**, và cũng là chỗ chứa toàn bộ rủi ro chưa biết
(A4 VRAM, A5 compute 7.5). Những gì học được từ T1 nhiều khả năng viết lại T4–T6 — và viết lại là
đúng, không phải thất bại.

| id | Slice | Touches | Test chứng minh nó | Covers | Depends on |
|----|-------|---------|--------------------|--------|------------|
| **T1** | Server sống thật và trả lời được **một** ảnh thật | `docker/docker-compose.yml`, `docker/.env.example`, `models/SHA256SUMS`, `.gitignore` | Gửi 1 keyframe có sẵn + câu hỏi → nhận câu trả lời tiếng Việt/Anh khác rỗng; log có tên GPU **và** dòng mmproj; `nvidia-smi` ghi được 3 mốc VRAM | A1, A2, A3 | — |
| **T2** | Chọn mốc keyframe neo theo **giữa** segment | `vlm/select.py::keyframe_times` | `keyframe_times((17000,27000), 4)` cho 4 mốc đối xứng quanh 22.0s, có ≥1 mốc trước và ≥1 mốc sau trung điểm — thuần số học, không cần ffmpeg | C4 | — |
| **T3** | Liệt kê clip đã duyệt từ DB **read-only**, có sha256 | `vlm/source.py::approved_clips` | Trả về đúng **27** clip, tất cả đường dẫn nằm dưới `trimmed/`; xoá 1 file trên bản sao → lần chạy sau còn 26 và clip đó vào mục "nguồn đã biến mất"; sửa nội dung file → `source_sha256` đổi | C1, C2, C3, C5 | — |
| **T4** | Trích N keyframe **màu** ra JPEG | `vlm/frames.py::keyframes` | 4 phần tử, mỗi phần tử bắt đầu bằng magic `\xff\xd8\xff`, kích thước > 0, và **không** giống hệt nhau byte-wise | (tiền đề A5) | T2 |
| **T5** | Client HTTP: hỏi kèm nhiều ảnh, lỗi có tên | `vlm/client.py::health,ask` | Server tắt → `connection refused` rõ ràng, không traceback trần; timeout 1s → ghi 1 dòng JSONL `status="error"` có field `error`, exit non-zero; ảnh 0 byte → tên lỗi cụ thể | A10, A11 | T1 |
| **T6** | **Chứng minh model thật sự đọc ảnh** — 3 điều kiện | `vlm/scripts/test_api.py` | Ảnh thật→A, xám đặc→B, không ảnh→C trên 1 clip APPROVED thật. Exit 0 **chỉ khi** A≠B và A≠C; A==C thì exit non-zero và in ra điều kiện nào trùng. A khớp sự thật người đã kiểm bằng mắt | A4, A5, A6 | T3, T4, T5 |
| **T7** | Lần chạy thứ hai + không làm bẩn gì | `vlm/scripts/test_api.py`, `tests/test_vlm_isolation.py` | Chạy 2 lần `temperature=0` → trả lời giống hệt, restart count không tăng; `sha256sum pipeline.db` không đổi; `grep -rn "INSERT\|UPDATE\|DELETE" vlm/` → 0 hit; `pytest tests -q` vẫn xanh; không sinh file `source.*` mới | A7, A8, A9, C6 | T6 |
| **T8** | Tài liệu thôi mô tả thiết kế mà code không còn | `CLAUDE.md`, `architecture.md`, `docs/01…TeamA.md`, `docs/02…TeamB.md`, `TODO.md` | Grep: không còn "VQA annotation is out of scope"; §4 TeamA và phần "đừng mở đáp án gợi ý" của TeamB đã sửa theo D2 | A12 | T7 |

**Coverage:** A1·A2·A3→T1 · A4·A5·A6→T6 · A7·A8·A9→T7 (A8 cũng ở T3) · A10·A11→T5 · A12→T8 ·
C1·C2·C3·C5→T3 · C4→T2 · C6→T7. **Không tiêu chí nào trong `acceptance.md` bị bỏ trống.**

**Chuỗi phụ thuộc dài nhất là 4** (T2→T4→T6→T7). T1, T2, T3 khởi động độc lập nhau.

**Rủi ro tập trung ở T1.** Nếu 4 ảnh ở ctx 4096 gây OOM trên 6 GB, quyết định D1 (N=4) và D8
(ctx 4096) phải chỉnh — và đó là lý do T1 đi trước T4/T6 chứ không phải sau.
