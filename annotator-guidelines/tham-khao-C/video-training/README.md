# Video huấn luyện Nhóm C

Series này tạo 3 clip nền tảng, 18 clip theo mã K01–K18 và 6 clip đối chiếu cặp mã có bất đồng lặp lại trong audit video #21–#40.

Codebook chuẩn là `codebook/C.v4.json`.

Lời thoại chỉ mô tả hành vi quan sát được, nhắc các trường hợp gần giống và hướng dẫn chọn “không rõ” khi video thiếu bối cảnh.

Hình là mô phỏng giao thông nhìn từ trên xuống, không phải footage thật và không đại diện cho một vụ tai nạn cụ thể.

## Hình ảnh được dựng thế nào

Mỗi mã có một tình huống chuyển động thật trong `anim/scenarios.js`: xe chạy theo quỹ đạo và profile tốc độ, rẽ, quay đầu, lùi, trượt, có đèn phanh, xi-nhan, đèn lùi.

Giao thông theo chiều bên phải như ở Việt Nam: xe đi lên nằm ở nửa phải lòng đường.

Thời điểm va chạm không viết tay mà do `anim/engine.js` mô phỏng: lần chồng lấn đầu tiên giữa hai thân xe là điểm va chạm.

Mỗi câu thoại chọn một cảnh:

- Câu nhắc mã khác thì chia màn hình, các tình huống chạy song song và va chạm cùng lúc, ví dụ K01 | K02 | K03 kèm đồ thị tốc độ của B.
- Câu về thiếu bằng chứng thì che phần ngoài khung hình và hiện nhắc “chọn không rõ”.
- Câu lặp lại cảnh cũ thì phát lại chậm 0.5× có vệt quỹ đạo đã đi và nét đứt quỹ đạo sắp đi.

Một số câu chỉ định cảnh riêng qua trường `shots` trong `narration.vi.json`, ví dụ K13 so với quay đầu cắt xe ngược chiều (K10), K16 so với chó chỉ đi dọc vỉa hè, K18 so với trượt do xe khác chuyển làn trước.

Cột phải lấy nhãn mã từ codebook và các gạch đầu dòng “nhìn vào đâu” từ trường `cues`.

## Cơ sở chọn clip đối chiếu

Audit nhóm C trên video #21–#40 có bất đồng ở cả 20 câu hỏi.

Kiểu xung đột khác nhau ở 17 video; hành động khác nhau ở 19 video.

Các cặp K08/K09, K11/K12 và K12/K14 cùng xuất hiện trong ba video; K10/K14, K11/K14 và K09/K14 cùng xuất hiện trong hai video.

Clip K10/K14 nhắc video #22, nơi số phiếu cao nhất là 3/6 cho K10, còn K14 có 2/6 và K08 có 1/6.

Đây là thống kê bất đồng, không phải kiểm chứng đáp án đúng của video.

## Render

Cần Python 3.12, Google Chrome (dùng để vẽ frame), ffmpeg và Node.js (chỉ cho bước kiểm tra).

Tạo môi trường cô lập và cài runtime:

```powershell
py -3.12 -m venv .venv-c-video
.\.venv-c-video\Scripts\python.exe -m pip install -r .\annotator-guidelines\tham-khao-C\video-training\requirements.txt
```

Kiểm tra mô phỏng sau khi sửa một tình huống (in thời điểm va chạm, báo xe nền đâm vào xe chính hoặc điểm va chạm lệch khỏi khung):

```powershell
node .\annotator-guidelines\tham-khao-C\video-training\anim\check.js
```

Xuất ảnh review, mỗi cảnh một ảnh ngay trước xung đột, vào `output/stills/`:

```powershell
.\.venv-c-video\Scripts\python.exe .\annotator-guidelines\tham-khao-C\video-training\render_training.py --stills K01 K10
```

Render một vài clip hoặc toàn bộ series:

```powershell
.\.venv-c-video\Scripts\python.exe .\annotator-guidelines\tham-khao-C\video-training\render_training.py K01 K02
.\.venv-c-video\Scripts\python.exe .\annotator-guidelines\tham-khao-C\video-training\render_training.py
```

Clip đã mới hơn mã nguồn và audio thì được bỏ qua; thêm `--force` để render lại.

Giọng Hải Đăng được tổng hợp cục bộ bằng VieNeu-TTS theo từng câu, cache trong `output/audio/parts/`; `output/audio/<id>.timing.json` ghi mốc bắt đầu và kết thúc của từng câu.

Các file video nằm trong `output/videos/`.

`C-training-full.mp4` là playlist ghép theo thứ tự: ba clip nền tảng, K01–K18, rồi các clip so sánh.

## Cách dùng cho annotator

Xem clip mã K trước khi làm quiz hoặc gán nhãn.

Với clip so sánh, dừng lại ở câu hỏi “dấu hiệu nào phân biệt hai mã?” rồi mới nghe phần giải thích.

Không dùng số phiếu trong dữ liệu audit làm nhãn chuẩn; audit chỉ cho biết nơi annotator đang bất đồng.
