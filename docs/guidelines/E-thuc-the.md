# Hướng dẫn gán nhãn Nhóm E: thực thể (Entities)

- Câu hỏi chuẩn: Loại phương tiện và màu sắc của các bên liên quan là gì?
- Chỉ khai báo các bên trực tiếp va chạm hoặc suýt va chạm. Phương tiện nền chỉ khai báo khi có tác động đến sự việc.
- Mỗi phương tiện hoặc bên liên quan là một thực thể riêng, có tên ổn định A, B, C xuyên suốt video; tên thực thể không phụ thuộc vào loại hoặc màu.
- Khi các bên liên quan cùng nhìn thấy và nhận diện được, gán tên theo vị trí từ trái sang phải; nếu nằm gần như cùng một cột thì bên ở trên tính trước. Nếu các bên không cùng xuất hiện rõ trong một khung hình, gán theo thứ tự lần đầu nhận diện được.
- Giữ nguyên tên khi các bên đổi vị trí, cắt ngang nhau, bị che khuất rồi xuất hiện lại. Dùng tính liên tục giữa các khung hình, quỹ đạo và vai trò trong sự kiện để theo dõi từng bên; không đổi tên theo vị trí mới.
- Hai thực thể cùng loại vẫn nhận hai tên riêng, ví dụ "xe máy A" và "xe máy B" hoặc "ô tô A" và "ô tô B". Không cần dựa vào màu để phân biệt chúng.
- Khi so giữa hai annotator, ghép thực thể theo danh tính của phương tiện trong video và tính liên tục theo thời gian, không chỉ theo loại hoặc màu. Nếu không thể xác định chắc chắn thực thể nào tương ứng, đánh dấu để phân xử thay vì đoán.
- Các nhóm C, O, R, Attr và Prev dùng lại đúng tên A, B, C đã gán ở nhóm E.
- Mỗi ô chọn đúng một giá trị. Không nhìn rõ ô nào thì chọn "không rõ".
- Bên bị che hoàn toàn hoặc quá xa để nhận diện thì không khai báo; không khai báo được bên nào thì câu trả lời là "Không thể xác định".

## Các ô (cho mỗi bên)

| Ô | Lựa chọn | Khi nào điền |
| --- | --- | --- |
| 1. Loại | ô tô · xe khách · xe tải · xe cứu thương · xe máy · xe đạp · xe ba gác · người đi bộ · động vật · khác | Luôn điền |
| 2. Camera hành trình | có · không | Bắt buộc với ô tô |
| 3. Màu xe | trắng, xám/bạc · đen · đỏ · xanh · vàng | Bắt buộc với ô tô; bỏ trống với người đi bộ và động vật |
| 4. Màu áo người đi bộ | trắng, xám/bạc · đen · đỏ · xanh · vàng | Chỉ với người đi bộ |

Gộp trắng, xám, ghi và bạc vào một lựa chọn "trắng, xám/bạc".
Không dùng màu khác, không rõ, tối hoặc nâu; chỉ chọn màu trong danh sách hiện hành khi nhìn thấy đủ rõ.
Xe máy điện được ghi là xe máy, xe đạp điện được ghi là xe đạp.
Không khai báo màu áo người điều khiển xe máy hoặc xe đạp.
Xe máy điện được ghi là xe máy; xe đạp điện được ghi là xe đạp.
Không ghi loại xe chi tiết hơn bảng trên (không "tay ga", không "24-29 chỗ"), không ghi biển số, khuôn mặt.
Xe container và xe bán tải ghi là xe tải.

Quy tắc định danh theo thực thể và giữ ID xuyên suốt video phù hợp với cách các bộ dữ liệu theo dõi đa đối tượng định danh từng track độc lập với lớp đối tượng. Thứ tự trái-sang-phải và quy tắc đặt tên A/B/C là quy ước vận hành riêng của dự án; xem [ghi chú nghiên cứu về định danh thực thể E](../research/e-entity-identity.md).

## Mẫu câu

| Loại | Mẫu câu cho một bên |
| --- | --- |
| Ô tô có camera hành trình | Xe ô tô (có camera hành trình) |
| Ô tô khác | Xe ô tô màu [4] |
| Ô tô | Xe ô tô màu [3] (có/không có camera hành trình) |
| Xe khách, xe tải | [1] màu [3] |
| Xe máy | Xe máy màu [3] |
| Xe đạp | Xe đạp màu [3] |
| Xe cứu thương, xe ba gác, khác | [1] màu [3] |
| Người đi bộ | Người đi bộ mặc áo [4] |
| Động vật | Động vật |

Câu trả lời ghép các bên theo thứ tự A, B, C, nối bằng dấu phẩy, kết thúc bằng dấu chấm.
Ô "không rõ" thì bỏ vế đó khỏi câu, ví dụ không rõ màu áo thì chỉ ghi "Xe máy màu đen".
