# Hướng dẫn gán nhãn Nhóm E: thực thể (Entities)

- Câu hỏi chuẩn: Loại phương tiện và màu sắc của các bên liên quan là gì?
- Chỉ khai báo các bên trực tiếp va chạm hoặc suýt va chạm. Phương tiện nền chỉ khai báo khi có tác động đến sự việc.
- Mỗi bên được đặt tên A, B, C theo vị trí trong khung hình lúc các bên cùng xuất hiện: từ trái sang phải; hai bên nằm thẳng hàng dọc thì bên ở trên tính trước. Các nhóm C, V, O, R, Attr, Prev dùng lại đúng các tên này.
- Hai bên trùng cả loại và màu thì thêm chữ cái vào tên trong câu, ví dụ "xe máy màu trắng A" và "xe máy màu trắng B".
- Khi so giữa hai annotator, thực thể được ghép theo loại, màu và chữ cái.
- Mỗi ô chọn đúng một giá trị. Không nhìn rõ ô nào thì chọn "không rõ".
- Bên bị che hoàn toàn hoặc quá xa để nhận diện thì không khai báo; không khai báo được bên nào thì câu trả lời là "Không thể xác định".

## Các ô (cho mỗi bên)

| Ô | Lựa chọn | Khi nào điền |
| --- | --- | --- |
| 1. Loại | ô tô · xe khách · xe tải · xe máy, xe hai bánh · xe ba gác · người đi bộ · động vật · khác | Luôn điền |
| 2. Cỡ | to · nhỏ | Chỉ với xe khách, xe tải |
| 3. Camera hành trình | có · không | Chỉ với ô tô |
| 4. Màu xe | trắng · đen · xám, bạc · đỏ · xanh · vàng · nâu · màu khác · màu sáng · màu tối · không rõ | Bỏ trống với ô tô có camera hành trình, người đi bộ, động vật |
| 5. Màu áo người điều khiển | như ô 4 | Chỉ với xe máy, xe hai bánh và người đi bộ |
| 6. Số người trên xe | 1 · 2 · 3 trở lên | Chỉ với xe máy, xe hai bánh |

Ghi màu cụ thể chỉ khi nhìn rõ. Ban đêm, xa hoặc ngược sáng thì chọn "màu sáng" hoặc "màu tối".
Không ghi loại xe chi tiết hơn bảng trên (không "tay ga", không "24-29 chỗ"), không ghi biển số, khuôn mặt.
Xe container và xe bán tải ghi là xe tải.

## Mẫu câu

| Loại | Mẫu câu cho một bên |
| --- | --- |
| Ô tô có camera hành trình | Xe ô tô (có camera hành trình) |
| Ô tô khác | Xe ô tô màu [4] |
| Xe khách, xe tải | [1] [2] màu [4] |
| Xe máy, xe hai bánh | Xe máy màu [4] do người mặc áo [5] điều khiển (chở [6] người, khi từ 2 trở lên) |
| Xe ba gác, khác | [1] màu [4] |
| Người đi bộ | Người đi bộ mặc áo [5] |
| Động vật | Động vật |

Câu trả lời ghép các bên theo thứ tự A, B, C, nối bằng dấu phẩy, kết thúc bằng dấu chấm.
Ô "không rõ" thì bỏ vế đó khỏi câu, ví dụ không rõ màu áo thì chỉ ghi "Xe máy màu đen".
