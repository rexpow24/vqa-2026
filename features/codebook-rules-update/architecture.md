# Kiến trúc

## Hình dạng

- `frontend/src/lib/codebook/*.json` là nguồn cho giao diện; bản `codebook/*.json` và migration giữ cùng nội dung theo kiểm tra repository.
- `frontend/src/lib/codebook/form.ts` quyết định trường được hiển thị, bắt buộc và payload.
- `frontend/src/lib/codebook/compose.ts` tạo câu trả lời đọc được từ lựa chọn.
- API annotation lưu câu trả lời; RPC `save_slot_answers` ghi các rows trong một transaction.
- Migration mới đăng ký codebook phiên bản mới, xác thực điều kiện E và mở rộng RPC mà không sửa migration cũ.

## Dữ liệu

| Dữ liệu | Kiểu | Mặc định/điều kiện | Chủ sở hữu ghi |
|---|---|---|---|
| S.surface_material | option ID | bắt buộc; thêm `surface_material.concrete` | Form S và route slot answer |
| E.dashcam | option ID | bắt buộc khi type.car | Form E, entities route |
| E.vehicle_color | option ID | không lưu khi car dashcam=yes; bắt buộc nếu vehicle color được hiển thị; không dùng cho xe đạp, người đi bộ, động vật | Form E, entities route |
| C.event_type | option ID | chỉ collision hoặc near_miss | Form C, slot answer route |
| C.object | entity reference hoặc bỏ trống theo quy tắc C hiện hành | trường optional, tự điền khi đủ dữ liệu | Form C và slot answer route |
| V.additional_behavior | nhiều option IDs | optional | Form V, slot answer route |
| Các rows slot answer | bản ghi `qa_annotations` | 1..N rows theo gói đã kiểm tra | RPC DB trong một transaction |

## Luồng

1. Trang gán nhãn tải codebook hiện hành và entities đã khai báo.
2. Thay đổi loại entity / lựa chọn dashcam sẽ quyết định trường màu; khi màu bị ẩn, giá trị màu cũ bị loại khỏi payload.
3. Form tạo field list từ phiên bản codebook, kiểm tra ô bắt buộc và tạo câu preview.
4. Khi lưu C, server xây danh sách answer chính và các câu dẫn xuất hợp lệ, sau đó gọi RPC một lần.
5. RPC kiểm tra payload, ghi/upsert mọi hàng trong cùng transaction. Exception rollback toàn bộ gói.
6. Refresh lấy lại các bản ghi đã lưu; lần lưu tiếp theo upsert cùng draft/annotator key.

## Lý do theo xung đột

- E có trigger DB riêng nên cập nhật trigger cùng với codebook/form để tránh form hợp lệ bị DB từ chối.
- C có các nhóm dẫn xuất; RPC phải nhận gói có số hàng thay đổi nhưng vẫn transaction atomic.
- Answer đã lưu giữ codebook version cũ; đăng ký phiên bản mới giữ khả năng đọc lịch sử.
- Nhãn dài vẫn cần xác nhận bằng browser; dùng wrapping hiện hữu và chụp ảnh UI thực tế.
- Có nhiều bản sao codebook; kiểm thử so sánh nội dung để tránh chỉ cập nhật một nơi.

## Thiết kế không chọn

- Sửa trực tiếp phiên bản đóng băng: loại vì answer lịch sử cần tái lập.
- Lưu từng nhóm qua các RPC riêng: loại vì lỗi giữa chừng có thể tạo trạng thái một phần.
- Bỏ ô C.object: loại theo chỉ đạo cập nhật; ô vẫn hiện và tiếp tục cung cấp dữ liệu cho câu ghép/nhóm R.
