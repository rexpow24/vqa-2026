# Kiểm tra xung đột

| # | Thay đổi và phần hiện hữu | Rủi ro cụ thể | Đã xác minh bằng |
|---|---|---|---|
| 1 | E.v4 và trigger hiện tại | Trigger cũ cần khớp điều kiện màu theo dashcam; form và DB validation được cập nhật đồng bộ | Migration áp dụng local; UI lưu car có dashcam không kèm màu và truck có màu; SQL xác nhận answer E.v4 |
| 2 | C.v4 giữ `object` và route lưu nhiều câu dẫn xuất | C có thể làm thay đổi V/Prev/R; RPC cần nhận số rows linh hoạt nhưng vẫn transaction atomic | Migration mở rộng RPC đã áp dụng local; chưa chạy lượt lưu C UI vì fixture không có media để xác minh keyframes |
| 3 | Bỏ lựa chọn V và C | Câu trả lời đã lưu bằng option IDs cũ vẫn có thể tồn tại | Codebook tạo phiên bản mới và không sửa phiên bản cũ; IDs đã lưu tiếp tục giải mã bởi phiên bản ghi cùng answer |
| 4 | Giao diện nhãn K14 dài hơn | CSS có thể làm người gán nhãn không đọc hết nhãn | `SlotField.tsx` dùng chip có wrap, không có truncate; xác nhận bằng screenshot local sau sửa |
| 5 | Nhiều nguồn định nghĩa codebook | Bản UI và migration có thể lệch nhau | Kiểm tra bằng `tests/test_codebook_copies.py` và đối chiếu DB codebook sau migration |

## Verdict: PARTIAL

## Cách làm

Tạo S.v3, E.v4, C.v4, V.v9; đồng bộ root, frontend và migration. Cập nhật điều kiện form/compose và quy tắc DB đồng thời. Giữ nguyên ô C.object. Mở rộng RPC `save_slot_answers` trong migration mới theo số hàng thực tế của một lần lưu, giữ một transaction và xác thực từng hàng. S và E đã được lưu qua UI local; ảnh C xác nhận trường `Đối tượng` hiển thị và K14 đầy đủ. Còn thiếu một lần lưu C thực tế với media/keyframes hợp lệ.

**Trade-off:** Không đổi cách C lưu đối tượng; giữ payload và câu ghép hiện tại.

**Không làm:** Không sửa dữ liệu production hoặc deploy trong feature này.
