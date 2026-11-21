# Yêu cầu

## Reality

| Yêu cầu | Hiện trạng đã kiểm tra | Chênh lệch |
|---|---|---|
| S có chất liệu bê tông | `frontend/src/lib/codebook/S.v2.json` hiện chỉ có nhựa, đất cát, không rõ | Thiếu bê tông |
| E điều kiện camera/màu | `frontend/src/lib/codebook/E.v3.json` ghi cả hai optional; form hiện hiển thị cả hai cho ô tô; DB trigger yêu cầu cả hai | Không theo quy tắc yêu cầu |
| C loại sự kiện và đối tượng | `C.v3` có `event_type.unclear` và ô `object` optional; form có thể hiển thị ô này | Bỏ lựa chọn “không rõ”; giữ ô đối tượng |
| C kiểu xung đột hiển thị | UI slot option dùng layout tự xuống dòng, không có lớp cắt chữ; K14 trong JSON hiện là “Băng ngang đường giữa đoạn” | Cần cập nhật nhãn K14 theo wording đầy đủ đã yêu cầu trước đó: “Băng ngang đường giữa đoạn, không ở giao lộ” |
| C lưu câu trả lời | `save_slot_answers` ở migration `20261116100000_slot_data_model.sql` giới hạn 1-2 rows; route annotation có thể gửi thêm các câu dẫn xuất C/V/Prev/R | RPC có thể từ chối payload hợp lệ nhiều hơn hai hàng và route hiển thị `invalid_slots` |
| V vi phạm bổ sung | `V.v8` vẫn có các lựa chọn cần bỏ; `form.ts` ép `additional_behavior` thành required khi đã chọn người vi phạm bổ sung | UI trái với tính optional trong codebook |
| Phiên bản codebook | Các phiên bản hiện hành đã được đóng băng và được nhân đôi giữa `codebook/` và `frontend/src/lib/codebook/` | Tạo phiên bản mới, không sửa nội dung phiên bản cũ |

## Assumptions

- `verified`: phiên bản hiện hành là S.v2, E.v3, C.v3, V.v8 theo `frontend/src/lib/codebook/index.ts` và các JSON đang được import.
- `verified`: codebook được lưu cùng migration SQL; DB validation và trigger cần khớp với JSON và form.
- `verified`: `additional_behavior` bị ép bắt buộc tại `frontend/src/lib/codebook/form.ts`, dù định nghĩa JSON optional.
- `verified`: ô C `object` đang được dùng để tạo câu ghép và làm nguồn cho R; giữ nguyên ô này và quy tắc tự điền/chọn hiện hành.
- `verified`: dashcam chỉ áp dụng cho ô tô; màu xe áp dụng cho ô tô khi không có dashcam, xe máy, xe khách, xe tải, xe cứu thương, xe ba gác và loại phương tiện khác; không áp dụng xe đạp, người đi bộ và động vật.
- `unverified`: Docker Engine/Supabase local có thể chạy trên máy hiện tại. Xác minh bằng khởi động Docker Desktop, `supabase start`, rồi health check local.
- `unverified`: có tài khoản local phù hợp để hoàn tất luồng UI có lưu dữ liệu. Xác minh sau khi đọc auth seed/config local; không dùng project production.

## Open questions

| # | Question | Why it matters | My default | Level | Status |
|---|---|---|---|---|---|
| 1 | Có triển khai production trong yêu cầu này không? | Thay đổi schema và codebook lưu trữ | Không; yêu cầu hiện tại chỉ định Supabase local | 🟢 | ✅ |

## Acceptance criteria

- [ ] Mở form S, “Chất liệu mặt đường” có lựa chọn “bê tông”; câu trả lời lưu bằng ID ổn định ở S.v3.
- [ ] Mở E và chọn ô tô: dashcam bắt buộc; chọn có thì màu xe ẩn và payload không chứa màu; chọn không thì màu xe hiện và bắt buộc.
- [ ] E với xe máy/xe khách/xe tải/xe cứu thương/xe ba gác/loại xe khác bắt buộc có màu; xe đạp/người đi bộ/động vật không hiện màu xe.
- [ ] C không còn lựa chọn “không rõ” cho loại sự kiện; ô “Đối tượng” vẫn hiện và giữ khả năng tự điền/chọn hiện tại.
- [ ] Mọi lựa chọn K01-K18 hiện đủ nhãn; K14 hiển thị “Băng ngang đường giữa đoạn, không ở giao lộ” mà không bị cắt.
- [ ] Lưu C cùng các câu trả lời dẫn xuất có thể cần thiết trong một giao dịch thành công trên Supabase local; payload sai không ghi dở dang.
- [ ] V không còn ba lựa chọn đã nêu; nhãn lựa chọn còn lại là “quay đầu sai quy định”; hành vi vi phạm bổ sung không bắt buộc.
- [ ] Cập nhật phiên bản codebook không làm thay đổi các JSON phiên bản cũ; bản gốc và bản frontend khớp nhau.
- [ ] Làm mới trang sau khi lưu vẫn đọc được dữ liệu đã lưu; lưu lần hai cập nhật cùng câu trả lời, không tạo bản ghi trùng.
- [ ] Chạy các bài kiểm tra liên quan, lint/build frontend và migration reset trên Supabase local thành công.
- [ ] Lưu ảnh chụp form thật từ app local vào `artifacts/`.
