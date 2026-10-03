# qa-draft-annotation — DESIRE

**Mở:** 2026-10-02 · **Tiền nhiệm:** `features/qa-pipeline/` (V1 shipped 2026-09-05)

## Người dùng muốn gì

> "tôi đang muốn chạy thử 9 nhãn sau draft như nào, có quản lý prompt metrics đánh giá
> model sử dụng bằng mlflow."
>
> - sử dụng image nhẹ nhất có thể, check các image có thể sử dụng ở docker hiện tại xem có thỏa không
> - chạy draft nhãn với uniform 8 ảnh trước đi với model qwen3vl
> - có giao diện cho xem nhãn draft, đánh key frame, nút đồng ý hoặc không, chọn nhãn
>   difficulty + accident/near-miss -> đây là cho team B
> - persist metadata ở db
> - tôi nghĩ chắc thêm role team A / B để sau này query cho nó dễ

## Nguồn gốc

Đây là bước 3 của `docs/DC.pdf` ("Sinh câu hỏi - đáp án nháp") cộng bước 6 ("Đánh giá đồng
thuận nhóm B"), và đồng thời đóng 3 mục đang treo ở `TODO.md` §Phase 2 — open items:

- `batch_inference.py` với checkpoint/retry/resume/chống trùng.
- Annotation dashboard.
- Q10 — Team B còn gán nhãn đôi độc lập không, khi đã có nhãn nháp. Nó đổi schema nhãn.

## 9 nhóm câu hỏi (DC.pdf)

| Mã | Nhóm | Đối tượng | Độ khó |
|---|---|---|---|
| S | Bối cảnh (Scene) | cả hai | khách quan cao |
| E | Thực thể (Entities) | cả hai | khách quan cao |
| N | Diễn biến (Narrative) | cả hai | vừa |
| C | Nguyên nhân (Causal) | cả hai | vừa |
| V | Vi phạm (Violation) | điều tra | vừa |
| O | Hậu quả (Outcome) | cả hai | khách quan |
| R | Ứng xử (Response) | điều tra | vừa |
| Attr | Quy trách nhiệm (Attribution) | điều tra | chủ quan |
| Prev | Phòng tránh (Prevention) | đào tạo | chuẩn tắc, đa đáp án |

## Quyết định đã chốt với người dùng trước khi vào pipeline

| Câu hỏi | Chọn | Lý do đã nêu |
|---|---|---|
| Nơi lưu draft + annotation | **`annotations.db` riêng**, không phải `pipeline.db` | cô lập tuyệt đối; backup/reset độc lập; hỏng không ảnh hưởng pipeline |
| Docker image | **`server-cuda`** pin theo digest, giữ nguyên compose hiện tại | đường chính thức, đã đo chạy được trên đúng máy này 2026-09-05 |
| Quy mô lần chạy đầu | **2 shots** | đọc output tiếng Việt, chỉnh prompt rồi mới mở rộng |

## Số liệu đã đo được (2026-10-02, trước khi grill)

- `vlm.source.approved_clips()` → **166 shot files / 157 clips**, 1 missing.
  (Decision Log ghi "30 shot files / 27 clips" — số đó đã cũ.)
- **338 prompt-token mỗi ảnh** ở width 768: probe cũ cho 4 ảnh = 1384 token, blind = 32.
- → 8 ảnh = 2 704 token. Cộng câu hỏi ~300 + đáp án ~300 ≈ **3 300 < ctx 4096 hiện tại**,
  với điều kiện **mỗi nhóm một request riêng**. Gộp 9 nhóm vào 1 request thì output
  ~1 200 token và tràn ctx.
- Docker images hiện có trên máy: **không có image llama.cpp nào** — phải pull lại.
  Đo từ registry: `server` 297 MB · `server-vulkan` 294 MB · `server-cuda` 2 472 MB (nén).
- `mlflow 3.16.1` có ở Python 3.14 global nhưng **không có trong venv** của project.

## Ràng buộc đã biết, không được phá

- **Decision Log:** `vlm/` chỉ ghi `vlm/data/output/*.jsonl`, mở `pipeline.db` ở `mode=ro`.
  Canh bởi 5 test trong `tests/test_vlm_isolation.py` (regex quét `vlm/**/*.py`).
- **Decision Log:** input chỉ là `trimmed/` của clip APPROVED. Không bao giờ `clips/`
  (master chưa blur) hay `delivered/` (chưa duyệt).
- **Decision Log:** định danh bản ghi là `clip_id` + `shot` + `source_sha256`,
  không bao giờ là đường dẫn file.
- **Decision Log:** `vlm/` được import `vqa/`; `vqa/` không bao giờ import `vlm/`.
- **CLAUDE.md:** Streamlit `app.py` là frozen legacy. Mọi UI mới vào Next.js + `sidecar/`.
- **CLAUDE.md:** `python -m pytest tests -q` (66 test) phải xanh trước khi gọi là xong.

## Rủi ro đã biết, chưa xử lý

`TODO.md` §BLOCKED: một số file trong `trimmed/` còn biển số `37B-016.09` cháy chữ chưa blur.
Keyframe gửi cho VLM và hiện trên UI sẽ chứa chúng. Chạy local nên không phải blocker của
feature này, nhưng là blocker trước khi dataset rời máy.

## Không thuộc phạm vi (nêu rõ để khỏi trôi)

Distractor generation, Pass-1/Pass-2, κ/α, Gate B, judge GEPA, benchmark các mô hình
tham chiếu. Đó là bước 7–11 của DC.pdf, sau feature này.
