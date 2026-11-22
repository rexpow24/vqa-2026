# Video huấn luyện Nhóm C

Series này tạo 3 clip nền tảng, 18 clip theo mã K01–K18 và 6 clip đối chiếu cặp mã có bất đồng lặp lại trong audit video #21–#40.

Codebook chuẩn là `codebook/C.v4.json`.

Lời thoại chỉ mô tả hành vi quan sát được, nhắc các trường hợp gần giống và hướng dẫn chọn “không rõ” khi video thiếu bối cảnh.

Hình minh họa là sơ đồ giao thông tổng hợp, không phải footage thật và không đại diện cho một vụ tai nạn cụ thể.

## Cơ sở chọn clip đối chiếu

Audit nhóm C trên video #21–#40 có bất đồng ở cả 20 câu hỏi.

Kiểu xung đột khác nhau ở 17 video; hành động khác nhau ở 19 video.

Các cặp K08/K09, K11/K12 và K12/K14 cùng xuất hiện trong ba video; K10/K14, K11/K14 và K09/K14 cùng xuất hiện trong hai video.

Clip K10/K14 nhắc video #22, nơi số phiếu cao nhất là 3/6 cho K10, còn K14 có 2/6 và K08 có 1/6.

Đây là thống kê bất đồng, không phải kiểm chứng đáp án đúng của video.

## Render

Môi trường TTS dùng Python 3.12 và VieNeu-TTS v3 Turbo với giọng Hải Đăng.

Tạo môi trường cô lập và cài runtime:

```powershell
py -3.12 -m venv .venv-c-video
.\.venv-c-video\Scripts\python.exe -m pip install -r .\annotator-guidelines\tham-khao-C\video-training\requirements.txt
```

Chạy preview một clip:

```powershell
.\.venv-c-video\Scripts\python.exe .\annotator-guidelines\tham-khao-C\video-training\render_training.py --limit 1
```

Render toàn bộ series:

```powershell
.\.venv-c-video\Scripts\python.exe .\annotator-guidelines\tham-khao-C\video-training\render_training.py
```

Các file video nằm trong `annotator-guidelines/tham-khao-C/video-training/output/videos/`.

`C-training-full.mp4` là playlist ghép theo thứ tự: ba clip nền tảng, K01–K18, rồi các clip so sánh.

Mỗi video có một ảnh sơ đồ trong `output/stills/` và WAV giọng đọc tương ứng trong `output/audio/` để dễ review.

Giọng được tổng hợp cục bộ; lần chạy đầu cần tải weights VieNeu-TTS Turbo nếu máy chưa có đủ model files.

## Cách dùng cho annotator

Xem clip mã K trước khi làm quiz hoặc gán nhãn.

Với clip so sánh, dừng lại ở câu hỏi “dấu hiệu nào phân biệt hai mã?” rồi mới nghe phần giải thích.

Không dùng số phiếu trong dữ liệu audit làm nhãn chuẩn; audit chỉ cho biết nơi annotator đang bất đồng.
