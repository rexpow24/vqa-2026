# Kết quả P1: map câu trả lời tự do vào codebook

Cập nhật 2026-11-15.
Độ phủ = M / n, n = M + K.
Ô có n < 10 là chưa đủ dữ liệu.
Ô đạt khi độ phủ ≥ 80%.
Báo cáo đầy đủ của mỗi nhóm nằm ở `csvs/p1*/coverage_<nhóm>.txt` (không commit).

## Tình trạng các nhóm

| Nhóm | Cần map? | Tình trạng |
| --- | --- | --- |
| S bối cảnh | có | đã chạy, chốt (codebook/S.v1.json) |
| E thực thể | có | đã chạy, đạt |
| C nguyên nhân | có | đã chạy, đạt |
| V vi phạm | có | đã chạy, đạt |
| Attr quy lỗi | không | điền tự động từ chủ thể của C |
| O kết quả | có | đã chạy, trưởng nhóm chấp nhận |
| R ứng xử sau sự kiện | có | đã chạy, đạt |
| N diễn biến | không | ghép từ C, O, R |
| Prev phòng ngừa | có | đã chạy, trưởng nhóm chốt đạt sau khi thêm 5 lựa chọn |

Mọi nhóm cần map đã chạy.

## S, gemini-3.8-flash

209 câu khác nhau, 60 video, 209 hợp lệ, 0 lỗi.

| Ô | M | K | n | Độ phủ | Kết luận |
| --- | --- | --- | --- | --- | --- |
| thời tiết | 156 | 22 | 178 | 88% | đạt |
| ánh sáng | 195 | 6 | 201 | 97% | đạt |
| loại đường | 12 | 3 | 15 | 80% | đạt |
| mặt đường | 174 | 4 | 178 | 98% | đạt |
| mật độ xe | 37 | 12 | 49 | 76% | không đạt, trưởng nhóm giữ nguyên |
| đoạn đường | 43 | 1 | 44 | 98% | đạt |

## E, ChatGPT bản web (dán tay, lô 25 câu)

276 câu khác nhau, 60 video, 272 hợp lệ, 4 lỗi.
Mỗi câu tách thành các bên; độ phủ tính trên 578 bên của 272 câu hợp lệ.
4 câu lỗi do model chép sai đoạn hoặc bằng chứng (không có nguyên văn trong câu), không do codebook.

| Ô | M | K | n | Độ phủ | Kết luận |
| --- | --- | --- | --- | --- | --- |
| loại | 545 | 0 | 545 | 100% | đạt |
| cỡ | 30 | 0 | 30 | 100% | đạt |
| camera hành trình | 74 | 0 | 74 | 100% | đạt |
| màu xe | 419 | 0 | 419 | 100% | đạt |
| màu áo người điều khiển | 55 | 4 | 59 | 93% | đạt |
| số người trên xe | 13 | 0 | 13 | 100% | đạt |

4 cụm K đều là áo hoa văn: áo caro (2), áo khoác caro, áo sọc.
33 bên có loại là T vì câu chỉ ghi "xe" hoặc chỉ ghi một người (ví dụ "một em bé").

## V, ChatGPT bản web (dán tay, lô 25 câu)

271 câu khác nhau, 60 video, 270 hợp lệ, 1 lỗi (model chép sai bằng chứng).

| Ô | M | K | n | Độ phủ | Kết luận |
| --- | --- | --- | --- | --- | --- |
| kết quả | 164 | 9 | 173 | 95% | đạt |
| bên vi phạm | 132 | 7 | 139 | 95% | đạt |
| hành vi | 136 | 28 | 164 | 83% | đạt |

K ở "kết quả" và "bên vi phạm" là model dùng sai trạng thái: theo codebook, câu nêu hành vi thì kết quả là "có", và "bên vi phạm" là ô ghi tự do nên không có K.
Độ phủ thật của hai ô này vì thế cao hơn số trong bảng.
Các cụm K của "hành vi" hay gặp: lạng lách, len giữa hai ô tô (6), chuyển làn không an toàn hoặc không xi nhan (7), để chó chạy rông (3), dừng hoặc đỗ giữa đường (3), sang đường sai (2).

## C, gemini-3.8-flash

286 câu khác nhau, 60 video, 284 hợp lệ, 2 lỗi.
Chi phí khoảng $1.69 (148.542 token vào, 421.957 token ra).

| Ô | M | K | n | Độ phủ | Kết luận |
| --- | --- | --- | --- | --- | --- |
| loại sự kiện | 29 | 0 | 29 | 100% | đạt |
| chủ thể | 269 | 2 | 271 | 99% | đạt |
| đối tượng | 130 | 17 | 147 | 88% | đạt |
| kiểu xung đột | 138 | 3 | 141 | 98% | đạt |
| hành động | 36 | 1 | 37 | 97% | đạt |
| tốc độ | 28 | 7 | 35 | 80% | đạt |
| bên né | 15 | 0 | 15 | 100% | đạt |
| cách né | 10 | 2 | 12 | 83% | đạt |
| kết quả né | 7 | 0 | 7 | 100% | chưa đủ dữ liệu |

## O, gemini-3.5-flash

295 câu khác nhau, 60 video, 287 hợp lệ.
8 câu (lô O-042, O-043) chưa chạy vì hết credit Gemini; trưởng nhóm chấp nhận kết quả hiện có.

| Ô | M | K | n | Độ phủ | Kết luận |
| --- | --- | --- | --- | --- | --- |
| mức độ | 222 | 1 | 223 | 100% | đạt |
| dấu hiệu nhìn thấy | 198 | 2 | 200 | 99% | đạt |

## R, gemini-3.5-flash

228 câu khác nhau, 59 video, 228 hợp lệ, 0 lỗi.

| Ô | M | K | n | Độ phủ | Kết luận |
| --- | --- | --- | --- | --- | --- |
| clip có đoạn sau sự kiện | 228 | 0 | 228 | 100% | đạt |
| bên thứ nhất | 207 | 0 | 207 | 100% | đạt |
| hành vi bên thứ nhất | 196 | 11 | 207 | 95% | đạt |
| bên thứ hai | 67 | 0 | 67 | 100% | đạt |
| hành vi bên thứ hai | 59 | 8 | 67 | 88% | đạt |
| người, xe xung quanh | 30 | 6 | 36 | 83% | đạt |

## Prev, gemini-3.5-flash

201 câu khác nhau, 60 video, 201 hợp lệ, 0 lỗi.
Số dưới đây đo trên codebook trước khi thêm 5 lựa chọn.
Sau lượt chạy, codebook thêm: bật xi nhan xin đường, tránh điểm mù xe lớn, chấp hành đèn tín hiệu, kiểm tra xe trước khi đi, đội mũ bảo hiểm.
Trưởng nhóm chốt Prev đạt, không chạy lại.

| Ô | M | K | n | Độ phủ | Kết luận lúc chạy |
| --- | --- | --- | --- | --- | --- |
| bên thứ nhất | 72 | 0 | 72 | 100% | đạt |
| hành động chính bên thứ nhất | 150 | 30 | 180 | 83% | đạt |
| hành động thêm bên thứ nhất | 72 | 21 | 93 | 77% | không đạt, đã thêm lựa chọn |
| bên thứ hai | 8 | 0 | 8 | 100% | chưa đủ dữ liệu |
| hành động chính bên thứ hai | 6 | 2 | 8 | 75% | chưa đủ dữ liệu |
| hành động thêm bên thứ hai | 1 | 0 | 1 | 100% | chưa đủ dữ liệu |
