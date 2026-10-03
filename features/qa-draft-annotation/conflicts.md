# qa-draft-annotation — conflict audit

2026-10-03 · server llama.cpp chạy thật trong lúc audit, không chỉ đọc code.

## Conflicts

| # | Mới vs cũ | Cái gì hỏng | Chứng minh bằng |
|---|---|---|---|
| 1 | Importer glob `vlm/data/output/*.jsonl` **vs** 11 file probe vision-check đã nằm sẵn ở đó | 33 dòng probe cũ **đều** có đủ `clip_id`+`shot`+`source_sha256`, nên importer nhận chúng là draft hợp lệ và nạp 33 bản ghi rác. Không dòng nào có `qgroup` | Chạy glob + đếm: `files=11 rows=33`, `rows có 'qgroup': 0`, `rows đủ định danh: 33` |
| 2 | Vòng lặp batch **vs** `--parallel 1` (1 slot cache) trong `docker-compose.yml:32` | Nếu lặp **nhóm ngoài, shot trong** thì mỗi shot phải encode lại 8 ảnh 9 lần: 9×166×17s ≈ **7 giờ** chỉ để encode. Lặp **shot ngoài** thì 166×17s ≈ 47 phút | Log llama.cpp: shot mới `prompt eval = 16 829 ms / 2 725 tokens`; cùng shot đổi câu hỏi `= 57 ms / 22 tokens` |
| 3 | `difficulty`/`event_label` của Team B **vs** cùng hai cột ở `pipeline.db` (`reviews`, `review_segments`) | Hai kho nhãn cùng tên cho hai khái niệm khác nhau. Không ghi rõ thì người sau tưởng là bug và "sửa" cho khớp, phá mất dữ liệu IAA | Đọc `sidecar/main.py:342-345` (bắt buộc khi Approve) và `:434` (tab Relabel backfill); đếm DB: 22 clip có nhãn, **136 clip thiếu** |
| 4 | Vocabulary nhãn mới **vs** vocabulary đang dùng | Tôi đề xuất `ACCIDENT`/`NEAR_MISS`. Thực tế là `accident`/`near-miss` chữ thường có gạch nối. Lệch chữ hoa → join giữa hai DB trượt sạch, IAA tính ra bằng 0 | `SELECT event_label, count(*) ... GROUP BY 1` → `[('accident', 9), ('near-miss', 14)]` |
| 5 | Keyframe do VLM đề xuất hiện trên UI **vs** metric "Grounding Accuracy" của DC.pdf | Annotator nhìn thấy mốc VLM đoán rồi mới đánh mốc của mình → GT bị neo theo predicted → Grounding Accuracy **tự khen mình**. Đây đúng là Mục tiêu 3 của luận văn, nên con số này không được phép hỏng | Suy ra từ chính cái giá đã ghi trong Decision Log cho đáp án nháp ("a draft answer anchors annotators"); cơ chế y hệt, lần này đập vào metric lõi |
| 6 | Batch runner đặt trong `vlm/` **vs** `tests/test_vlm_isolation.py` | Test quét regex `INSERT|UPDATE|DELETE|DROP|ALTER` trên **mọi** file `vlm/**/*.py`, và bắt mọi file gọi `sqlite3.connect` phải có `mode=ro`. Runner ghi DB đặt trong `vlm/` → 5 test đỏ | Đọc `tests/test_vlm_isolation.py`; `_code()` chỉ bóc docstring và comment, **không** bóc string literal |
| 7 | Draft trỏ `source_sha256` **vs** `review.discard()` xoá file trong `trimmed/` | Reviewer Reject sau khi đã draft → `review.py:37` `unlink()` file, `:39` xoá `trim_segments`, `:40` xoá luôn segment labels. Draft trong `annotations.db` trỏ tới shot không còn tồn tại | Đọc `vqa/review.py:27-39`; `materialize()` ở `:99` gọi `discard()` **mỗi lần** Approve |

### Gộp nhiều nhóm vào một request — đo rồi, bác bỏ

Người dùng đề nghị thử gộp (1→4 và 5→9) để đỡ số request. Đo cả 4 cấu hình trên **cùng một shot,
cùng 8 ảnh đã nằm trong cache**, nên chênh lệch đúng là do cách gom nhóm:

| cấu hình | req | prompt tok | output tok | tường | nhóm **dùng được** |
|---|---|---|---|---|---|
| **A. 9 request riêng** | 9 | 24 594 | 2 900 | 36.3s | **9/9** |
| B. gộp 4+5 | 2 | 5 695 | 343 | 4.7s | ~4/9 |
| C. gộp cả 9 | 1 | 2 948 | 1 148 | 14.1s | ~3/9 |
| D. gộp 3+3+3 | 3 | 8 442 | 1 333 | 16.7s | ~3/9 |

Cấu hình gộp nhanh hơn vì nó **bỏ việc**, không phải vì hiệu quả hơn. Hai kiểu hỏng, tái lập được:

1. **Chép lại câu hỏi thay vì trả lời.** B batch 2 (V+O+R+Attr+Prev) ra đúng 101 token và nội dung
   là nguyên văn danh sách câu hỏi. D batch 3 (R+Attr+Prev) ra 161 token, chép danh sách câu hỏi
   **hai lần**. Luôn rơi vào batch cuối, và luôn dính R/Attr/Prev — ba nhóm suy luận nặng nhất.
2. **Lặp vô hạn.** C ở nhóm N sinh *"Xe tải di chuyển trên đường, tiến về phía trước. Xe tải tiến
   gần đến điểm dừng của xe, sau đó xe tải dừng lại."* lặp 4+ lần, đốt sạch budget 1 300 token rồi
   không bao giờ tới C→Prev.

Kết luận: một model 2B với 2 700 token ảnh làm tiền tố **không giữ nổi quá một chỉ thị mỗi request**.
→ **9 request riêng**, chốt. Và vì prefix cache cho đổi câu hỏi chỉ tốn 57 ms, 9 request riêng gần như
không mất gì so với 1 request: chi phí thật nằm ở token sinh ra, mà cấu hình A sinh nhiều hơn chính
vì nó trả lời đủ 9 nhóm.

### Probe trả về sạch

- **`source_sha256` ổn định khi cắt lại.** Lo rằng mỗi lần Approve lại sinh sha mới → mồ côi toàn bộ draft. Cắt cùng mốc hai lần qua `media.trim_clip` (encoder `h264_nvenc`) → 1 033 665 bytes, **sha trùng khít**. Nên chỉ *đổi mốc cắt* mới làm mồ côi, và đó đúng là hành vi quy tắc hash muốn có. Sạch.
- **8 ảnh có lọt ctx 4096 không.** 2 729-2 741 token thật, còn dư ~1 300 cho output. Sạch.
- **`vlm/` có import ngược `vqa/` không.** `vlm/source.py:16` `from vqa import db` — đúng chiều cho phép. Sạch.
- **MLflow có phạm luật "Don't add a layer" / Principle 3 không.** Không. Mục CONSTITUTION tự giới hạn phạm vi ở tiêu đề: *"CONSTITUTION — Preprocessing Pipeline"*. Đây là Phase 2, và MLflow file-store là thư viện ghi ra `./mlruns`, không có process thường trú. Sạch.

### Giả định ở bước 00 bị bác bỏ

| Giả định | Thực tế |
|---|---|
| "prefix cache làm 9 request rẻ đi → 166 shot ≈ 60-80 phút" | Cache **có** chạy, nhưng đòn bẩy là **token sinh ra** (~94 tok/s), không phải cache. Cost thật: 17s encode + 9×(output/94) mỗi shot ≈ 60s → **166 shot ≈ 2h46m** |
| "ctx 4096 có thể không đủ cho nhóm N" | Đủ, nhưng `max_tokens=400` thì N **bị cắt giữa câu**. Phải nâng `max_tokens` theo nhóm, không dùng một giá trị chung |
| "model có thể trả JSON có cấu trúc" | Chưa chứng minh. Output hiện là văn xuôi markdown tự do. Rủi ro còn mở, pilot sẽ đo |
| prompt không dấu vẫn dùng được | **Sai.** Prompt không dấu ("anh sang") → model trả lời "Không có thông tin về anh sang trong ảnh" |

## Verdict: PASS

Bảy conflict, không cái nào cần mở lại quyết định người dùng đã chốt. Sáu cái có fix nằm gọn trong
requirements hiện tại; cái thứ 5 cần một lựa chọn thiết kế UI, nêu rõ bên dưới.

## Recommended approach

Draft chạy **shot ngoài, nhóm trong** (conflict #2) trong `vlm/scripts/`, chỉ ghi JSONL vào thư mục
**mới** `vlm/data/drafts/` — tách khỏi `vlm/data/output/` đang chứa probe cũ (conflict #1) — và
importer riêng ở `vqa/annotations.py` nạp vào `annotations.db`, nên `vlm/` không bao giờ chứa câu SQL
ghi và 5 test isolation không bị động tới (conflict #6). Importer đòi mỗi dòng phải có `qgroup` thuộc
9 nhóm, nên kể cả có ai trỏ nhầm vào thư mục cũ thì 33 dòng probe vẫn bị loại. Vocabulary nhãn copy
**nguyên văn** từ `pipeline.db`: `{easy, medium, high}`, `{accident, near-miss}` (conflict #4).

Điểm thiết kế gỡ được conflict #5 — cái đáng giá nhất của bước này: **UI mặc định giấu mốc keyframe
mà VLM đề xuất.** Annotator đánh mốc của mình trước, lưu xong mới hiện mốc VLM để đối chiếu. Mốc
predicted vẫn nằm trong `qa_drafts`, mốc người vẫn nằm trong `qa_annotations`, nên Grounding Accuracy
so hai cột **độc lập thật**. Giá phải trả gần như bằng không: thêm một cờ `revealed_at`.

Conflict #3 và #7 là chuyện ghi chép và hiển thị: docs bước 08 phải nói thẳng hai kho nhãn là **cố ý**,
và UI phải có trạng thái có tên cho draft mà shot của nó đã biến mất, thay vì vỡ.

**Trade-off:** giấu mốc VLM làm annotator chậm hơn một nhịp và mất cảm giác "máy gợi ý sẵn". Đổi lại
metric lõi của luận văn mới có nghĩa. Và hai kho nhãn trùng tên là nợ nhận thức thật — trả bằng docs,
không trả bằng code.

**Not doing:**
- Ghi draft thẳng vào `pipeline.db` — người dùng đã chốt `annotations.db` riêng, và nó phá 5 test isolation.
- Nới `test_vlm_isolation.py` cho phép `vlm/` ghi `annotations.db` — JSONL trước vẫn cần cho checkpoint/resume, nên nới test chỉ tốn thêm rủi ro mà không mua được gì.
- Gộp 9 nhóm vào một request — đo rồi: output ~1 200 token, cộng 2 741 là tràn ctx.
- Đổi sang `server-vulkan` để nhẹ 8.4× — người dùng đã chốt `server-cuda`, và image đã pull xong, đã chạy được.
- Lặp nhóm ngoài để gom prompt cùng loại — đo rồi: 7 giờ encode thay vì 47 phút.
