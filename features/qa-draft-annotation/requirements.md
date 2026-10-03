# qa-draft-annotation — requirements

Vòng 1 · 2026-10-03

## Reality

Đo trực tiếp trên máy, không đọc code đoán.

| Điều được nói / giả định | Thực tế đo được | Lệch ở đâu |
|---|---|---|
| "VLM input: 30 shot files / 27 clips" (Decision Log) | `vlm.source.approved_clips()` → **166 shot files / 157 clips**, 1 missing | Decision Log cũ gấp 5.5 lần. Mọi ước lượng thời gian chạy phải tính lại |
| "thêm nhãn difficulty + accident/near-miss cho team B" | **Đã có rồi.** `sidecar/main.py:342-345` bắt buộc cả hai khi Approve (422 nếu thiếu); tab Relabel `sidecar/main.py:434` backfill | Không phải tính năng mới. Câu hỏi thật là: nhãn của Team B có phải *lá phiếu độc lập thứ hai* hay không |
| vocabulary nhãn | `difficulty ∈ {easy, medium, high}`, `event_label ∈ {accident, near-miss}` — chữ thường, gạch nối. Enforce 2 nơi | Đề xuất `ACCIDENT`/`NEAR_MISS` của tôi **sai**. Phải dùng đúng vocabulary cũ nếu không hai kho nhãn sẽ phân kỳ |
| tình trạng nhãn hiện tại | 158 clip APPROVED có `trim_segments`; **136 clip thiếu nhãn**; chỉ **17 clip** có `review_segments` | Backlog lớn. Tab Relabel tồn tại đúng để xử lý 136 clip này |
| "image nhẹ nhất" | Máy **không có image llama.cpp nào**. Registry: `server` 297 MB · `server-vulkan` 294 MB · `server-cuda` **2 472 MB** (nén) | Người dùng đã chọn `server-cuda` dù nặng 8.4×, vì đó là đường đã đo chạy được |
| "8 ảnh có lọt ctx 4096 không" | 338 token/ảnh @768px (probe cũ: 4 ảnh = 1384, blind = 32). 8 ảnh = **2 704** | Lọt, **chỉ khi mỗi nhóm một request riêng**. Gộp 9 nhóm → output ~1 200 token → tràn |
| mlflow | `3.16.1` có ở Python 3.14 global, **không có trong venv** | Phải cài vào venv |
| component UI tái dùng được | `frontend/src/components/Timeline.tsx` (73 dòng), `LabelGroup.tsx` (34 dòng), proxy `api/media/[...path]` | Không phải dựng từ đầu phần đánh mốc thời gian và chọn nhãn |

### Ràng buộc bắt buộc tìm thấy

- **`tests/test_vlm_isolation.py`** quét regex toàn bộ `vlm/**/*.py`: cấm `INSERT|UPDATE|DELETE|DROP|ALTER`,
  bắt buộc `mode=ro` ở mọi file gọi `sqlite3.connect`, cấm `master_path`/`delivered_path`/`trimmed_path`.
  → **Batch runner không thể nằm trong `vlm/` nếu nó ghi DB.**
- **Decision Log:** `vlm/` import `vqa/` được; `vqa/` không bao giờ import `vlm/`.
- **CLAUDE.md:** `app.py` Streamlit frozen legacy — UI mới chỉ vào Next.js + `sidecar/`.
- **CLAUDE.md:** `python -m pytest tests -q` (66 test) phải xanh.
- **Decision Log:** định danh là `clip_id` + `shot` + `source_sha256`, không bao giờ là path.

### Đảo một quyết định cũ, có lý do

Decision Log ghi: *"Keyframes: 4 per shot, **clustered around the middle** — not spread evenly.
Even spacing lands ~9s from impact on the longest real clip (29s)."*

Người dùng yêu cầu **8 ảnh uniform**. Tính lại trên clip dài nhất (29s):

| cách lấy | khoảng cách xa nhất từ frame gần nhất tới giữa clip |
|---|---|
| `even_times(29, 4)` | 2.9s |
| `even_times(29, 8)` | **1.6s** |

Lý do phản đối ban đầu là *mật độ*, và tăng từ 4 lên 8 frame đã xử lý nó. Thêm nữa 5/9 nhóm
(S, E, N, O, R) cần toàn cảnh clip chứ không chỉ khoảnh khắc va chạm. → **Đảo có cơ sở**, ghi
vào Decision Log ở bước 08. `select.even_times()` đã có sẵn, không cần code mới.

## Assumptions

- `verified` — 338 prompt-token/ảnh ở width 768. Đo: probe `probe_20260905_211605.jsonl`, 4 ảnh = 1384 token, blind = 32.
- `verified` — 166 shot file approved tồn tại trên đĩa. Đo: chạy `vlm.source.approved_clips()`.
- `verified` — difficulty/event_label đã bắt buộc khi Approve. Đo: đọc `sidecar/main.py:342-345`.
- `verified` — 136 clip thiếu nhãn. Đo: `db.list_missing_labels(trimmed_only=True)`.
- `verified` — mlflow vắng trong venv. Đo: `venv\Scripts\python.exe -c "import mlflow"` → ModuleNotFoundError.
- `verified` — `server-cuda` 2 472 MB vs `server-vulkan` 294 MB. Đo: `docker manifest inspect` trên digest amd64.
- `verified` — **8 ảnh uniform @768px = 2 729-2 741 prompt token**, lọt ctx 4096. Đo: 5 request thật lên server ngày 2026-10-03.
- `verified` — **llama.cpp prefix-cache hoạt động**. Đo: log llama.cpp, request thứ 2 trở đi trên cùng bộ ảnh chỉ eval **1-28 token** thay vì 2 741 (`prompt eval time = 55 ms / 1 tokens`). Nhưng nó **không** phải đòn bẩy chính — xem dòng dưới.
- `verified` — **đòn bẩy thời gian là số token sinh ra, không phải cache**. Sinh chữ chạy ~**94 tok/s** và chiếm gần hết thời gian mỗi request. Đo: 4 request, 325/359/400/400 token ra trong 3 374/3 917/4 247/4 156 ms.
- `verified` — **encode 8 ảnh của một shot mới, server ấm, tốn ~17s** (16 829 ms / 2 725 token @ 162 tok/s). Lần đầu tiên sau khi load model tốn 71s vì warm-up CUDA, chỉ xảy ra một lần.
- `verified` — **Qwen3-VL-2B trả lời tiếng Việt trôi chảy**, có dấu, đúng ngữ pháp. Đo: 5 câu trả lời thật, đọc bằng mắt. *Nhưng* nó hay rào đón ("có thể là", "có thể thấy") và tả sai chi tiết — chất lượng nhóm suy luận là rủi ro thật, sẽ đánh giá ở pilot.
- `verified` — **prompt phải có dấu tiếng Việt đầy đủ.** Đo: probe đầu dùng prompt không dấu ("anh sang"), model trả lời "Không có thông tin về anh sang trong ảnh" — nó không hiểu từ mất dấu.
- `verified` — **`source_sha256` ổn định khi cắt lại cùng mốc.** Đo: `media.trim_clip` hai lần cùng tham số lên cùng nguồn → 1 033 665 bytes, sha trùng khít. Nên re-approve giữ nguyên mốc **không** làm mồ côi draft.
- `verified` — **mỗi request chỉ được hỏi một nhóm.** Đo 4 cấu hình trên cùng shot: 9 request riêng trả lời đủ 9/9; gộp 4+5 → batch 2 chép lại câu hỏi; gộp cả 9 → lặp vô hạn ở nhóm N; gộp 3+3+3 → batch 3 chép câu hỏi hai lần. Model 2B không giữ nổi quá một chỉ thị khi tiền tố đã là 2 700 token ảnh.
- `verified` — **`max_tokens` phải đặt theo từng nhóm.** Đo cấu hình A: với trần 400, bốn nhóm E/C/Attr/Prev chạm trần và bị cắt.
- `unverified` — model trả về được JSON có cấu trúc ổn định (question/answer/keyframes). Quan sát ở probe: output là văn xuôi markdown tự do, **chưa** có cấu trúc; khi được yêu cầu theo định dạng `'MÃ: câu trả lời'` nó viết `MÃ: S` thay vì `S:`. Phép thử: đếm tỉ lệ parse lỗi trong pilot; nếu cao thì chuyển sang delimiter thay vì JSON.
- `unverified` — ctx 4096 đủ cho nhóm N (Narrative). Quan sát ở probe: với `max_tokens=400` thì N **bị cắt giữa câu**. Còn chỗ: 2 741 + ~1 300 = 4 041. Phép thử: đặt `max_tokens` ~800 cho N và xem có chạm trần không.

## Open questions

Không còn dòng ⏳. Mọi dòng 🔴 đã ✅.

| # | Câu hỏi | Vì sao quan trọng | Quyết định | Mức | Trạng thái |
|---|---|---|---|---|---|
| Q1 | Nhãn difficulty/event trong UI Team B là **lá phiếu độc lập thứ hai** (IAA, lưu `annotations.db`), hay **thay thế** tab Relabel (ghi `pipeline.db`)? | Hai kho nhãn cho cùng một khái niệm = hai writer. Nếu không chốt, đây đúng là loại lỗi mà 01 sẽ BLOCK | **Lá phiếu độc lập thứ hai.** `pipeline.db` giữ nhãn thao tác của 1 reviewer lúc duyệt clip; `annotations.db` giữ phiếu độc lập của từng người Team B để tính IAA (bước 6-7 DC.pdf). Trùng tên là **có chủ ý** — phải ghi rõ ở docs bước 08 | 🔴 | ✅ |
| Q2 | Batch runner ghi thẳng DB, hay ghi JSONL rồi importer nạp vào DB? | Nếu ghi thẳng mà đặt trong `vlm/` thì 5 test isolation đỏ | **JSONL trước, importer ở `vqa/` nạp sau.** JSONL chính là cơ chế checkpoint/resume mà `TODO.md` đòi | 🟡 | ✅ |
| Q3 | Mỗi (shot, nhóm) sinh **1** cặp QA hay nhiều? | DC.pdf đặt mục tiêu 3 000 video × 27 000 QA = **9 QA/video** | **1 cặp QA mỗi nhóm** | 🟢 | ✅ |
| Q4 | Mốc keyframe bằng chứng: VLM có tự đề xuất không, hay chỉ người đánh? | Metric "Grounding Accuracy" của DC.pdf cần có predicted để so với GT | **VLM chọn 1-3 trong 8 mốc nó đã nhìn thấy**; người đánh lại tự do ở bất kỳ giây nào trên timeline | 🟡 | ✅ |
| Q5 | Bao nhiêu annotator Team B mỗi draft? | Q10 còn treo từ `features/qa-pipeline`. Nó quyết định khoá chính của bảng nhãn | **Khoá `(draft_id, annotator_id)`** — chịu được n≥1, pilot chạy n=1, không cần migration khi lên n=3. Đây cũng là câu trả lời cho **Q10** đang treo | 🟡 | ✅ |
| Q6 | Prompt và output bằng tiếng Việt? | Dataset là tiếng Việt; nhưng CLAUDE.md bắt code/docs tiếng Anh | **Prompt + output tiếng Việt** (chúng là dữ liệu, không phải code); tên biến/test/docstring vẫn tiếng Anh | 🟢 | ✅ |
| Q7 | MLflow chạy file-store hay có server? | Server thêm một process phải trông | **File-store `./mlruns`**, xem bằng `mlflow ui` khi cần. Không thêm layer thường trú | 🟢 | ✅ |
| Q8 | Pilot chạy 2 shot nào? | Cần tái lập được | **2 shot đầu theo thứ tự `clip_id` và đã có difficulty/event sẵn**, để so nhãn người với nhãn draft ngay | 🟢 | ✅ |
| Q9 | Verdict của Team B có mấy giá trị? | Người dùng bổ sung vòng 2: không phải nhị phân | **Ba giá trị**: `AGREE` (đồng ý) · `NOT_ANSWERABLE` (không trả lời được — trong video không có sự kiện liên quan tới câu hỏi) · `DISAGREE` (không đồng ý, **bắt buộc kèm lý do**). `NOT_ANSWERABLE` là thuộc tính hợp lệ của dataset chứ không phải lỗi model — ví dụ nhóm V trên clip không có vi phạm nào nhìn thấy được. Nó cũng chính là mục "câu hỏi không đáp án" ở bước 4 DC.pdf | 🟡 | ✅ |
| Q10 | Lý do khi DISAGREE ghi thế nào? | Muốn thống kê được model sai kiểu gì, không chỉ sai bao nhiêu | **Danh mục đóng + ô ghi chú tự do.** Danh mục: `thiếu thực thể` · `sai thực thể` · `sai nhân quả` · `sai mốc thời gian` · `bịa chi tiết` · `sai diễn đạt` · `khác`. Chọn `khác` thì bắt buộc gõ ghi chú. Danh mục đóng cho ra thống kê được; ô tự do giữ lại cái chưa phân loại nổi | 🟢 | 💭 |

## Acceptance criteria

Mỗi dòng nêu một lệnh hoặc một quan sát cho ra có/không.

**Draft**

- A1 · `docker compose -f docker/docker-compose.yml up -d` rồi `python -m vlm.scripts.ask <shot> "..." --frames 8` → in ra câu trả lời tiếng Việt, `prompt_tokens` nằm trong khoảng **2 700-3 100**, không có lỗi tràn ctx.
- A2 · Chạy batch pilot 2 shot → sinh đúng **18 bản ghi** (2 shot × 9 nhóm), mỗi bản ghi có `qgroup` khác nhau trong cùng một shot.
- A3 · Mỗi bản ghi mang `clip_id`, `shot`, `source_sha256`, `frame_times_s` gồm **8 mốc**, và `prompt_version`.
- A4 · So `latency_ms` của request đầu tiên với 8 request sau trong cùng shot → trả lời được câu "prefix-cache có hiệu lực không", và con số đó được ghi lại.
- A5 · **Chạy lại batch lần hai trên cùng 2 shot không tạo thêm bản ghi trùng** — số dòng trong DB vẫn là 18.
- A6 · Giết batch giữa chừng rồi chạy lại → nó tiếp tục từ chỗ dở, không làm lại từ đầu.

**MLflow**

- A7 · Sau pilot, `mlflow ui` hiện **9 prompt** đã đăng ký (một cho mỗi nhóm), mỗi cái có version number.
- A8 · Một run ghi được: số bản ghi, tỉ lệ lỗi, latency p50/p95, tổng prompt token, tên model, digest image.
- A9 · Sửa một prompt rồi chạy lại → MLflow hiện **version 2**, và bản ghi mới trỏ đúng version 2 trong khi bản ghi cũ vẫn trỏ version 1.

**DB**

- A10 · `annotations.db` là **file riêng**; `pipeline.db` không có bảng mới nào sau khi chạy (so `sqlite_master` trước/sau).
- A11 · `python -m pytest tests -q` → **xanh**, gồm cả 5 test trong `test_vlm_isolation.py` không bị sửa.
- A12 · `annotators` có cột `team` chỉ nhận `A` hoặc `B`; nhét giá trị khác → lỗi CHECK constraint.
- A13 · Hai annotator khác nhau chấm **cùng một draft** → ra **hai dòng**, không phải một dòng ghi đè dòng kia.

**UI Team B**

- A14 · Mở trang → thấy video shot, 8 keyframe, và 9 draft QA theo đúng thứ tự S→E→N→C→V→O→R→Attr→Prev.
- A15 · Bấm Đồng ý trên một draft → reload trang thì nó vẫn Đồng ý (đã lưu DB, không phải state React).
- A16 · Sửa câu trả lời rồi lưu → DB giữ **cả** bản nháp gốc **lẫn** bản đã sửa, truy ra được bản gốc.
- A17 · Đánh một mốc keyframe trên timeline → lưu rồi reload, mốc vẫn ở đúng giây đó.
- A18 · Bấm lưu khi **chưa** chọn difficulty hoặc event_label → bị chặn, báo lỗi ngay tại chỗ (giống luật 422 của Approve).
- A19 · Nhãn Team B ghi vào `annotations.db` **không** làm đổi `reviews.difficulty` trong `pipeline.db` (so trước/sau).
- A20 · Trang Relabel và Review cũ vẫn chạy đúng như trước — hồi quy.
- A21 · Chọn `DISAGREE` mà **không** chọn lý do → bị chặn. Chọn lý do `khác` mà bỏ trống ghi chú → cũng bị chặn.
- A22 · Chọn `NOT_ANSWERABLE` → lưu được **mà không cần** sửa câu trả lời, và truy vấn ra được danh sách "câu hỏi không đáp án" theo từng nhóm (phục vụ bước 4 DC.pdf).
- A23 · Truy vấn thống kê ra được: với mỗi nhóm trong 9 nhóm, bao nhiêu `AGREE` / `NOT_ANSWERABLE` / `DISAGREE`, và `DISAGREE` tách theo từng lý do.

**An toàn dữ liệu — yêu cầu người dùng nêu trực tiếp**

- A24 · Sau toàn bộ feature, `pipeline.db` **không mất một nhãn nào**: `SELECT count(*) FROM reviews WHERE difficulty IS NOT NULL` và `SELECT count(*) FROM review_segments` cho ra số **bằng hoặc lớn hơn** lúc bắt đầu (2026-10-03: 22 và 20).
- A25 · Không file nào trong `work/*/trimmed/` bị xoá hay sửa bởi feature này — so danh sách sha256 của 166 file trước/sau.
