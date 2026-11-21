# Cập nhật quy tắc codebook và lưu câu trả lời

1. Nhóm S, thêm lựa chọn “bê tông” vào “Chất liệu mặt đường”.
2. Nhóm E, camera hành trình là bắt buộc với ô tô. Nếu có dashcam thì không chọn màu xe; nếu không có dashcam thì màu xe bắt buộc. Màu xe không còn là optional; xe đạp không cần màu.
3. Nhóm C, bỏ “không rõ” ở “Loại sự kiện”, giữ ô “Đối tượng”, hiển thị đủ chữ ở “Kiểu xung đột”, và sửa lỗi lưu `invalid_slots`.
4. Nhóm V, “Hành vi vi phạm bổ sung” là optional; xóa “không giảm tốc độ qua giao lộ”, “vượt xe sai quy định”, “không chấp hành biển báo, vạch kẻ đường”; đổi “chuyển hướng, quay đầu sai quy định” thành “quay đầu sai quy định”.

Chạy migration và kiểm thử toàn bộ quy trình trên Supabase local.
Chụp ảnh form thực tế và lưu vào `artifacts/` để review.
