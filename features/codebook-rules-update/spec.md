# Đặc tả

## Vấn đề

Form đang cho phép thiếu dữ liệu màu/camera, chứa lựa chọn đã bỏ khỏi quy tắc gán nhãn, và có thể báo `invalid_slots` khi lưu C cùng các câu dẫn xuất. Các thay đổi cần đồng bộ giao diện, dữ liệu codebook, câu ghép và kiểm tra DB.

## Hành vi

- S cung cấp lựa chọn chất liệu “bê tông”.
- E bắt buộc ghi nhận camera hành trình cho ô tô. Chỉ khi chọn không có camera mới hỏi màu ô tô; màu bắt buộc cho xe máy, xe khách, xe tải, xe cứu thương, xe ba gác và loại xe khác. Xe đạp không cần màu.
- C chỉ cho chọn va chạm hoặc suýt va chạm, giữ ô nhập đối tượng như hiện tại, và trình bày nguyên văn đầy đủ nhãn kiểu xung đột.
- Bỏ nhóm V khỏi luồng gán nhãn mới vì annotator không có thẩm quyền kết luận vi phạm pháp luật.
- Giữ các bản nháp và câu trả lời V lịch sử để bảo toàn dữ liệu nghiên cứu.
- Prev được hệ thống suy trực tiếp từ C bằng quy tắc có điều kiện; annotator không tự kết luận vi phạm.
- C và Prev dẫn xuất được lưu trong một transaction; lỗi ở bất kỳ hàng nào không để lại dữ liệu dở dang.

## Phạm vi

- Tạo S.v3, E.v4, C.v4 và Prev.v4; V.v9 chỉ còn trong lịch sử.
- Đồng bộ codebook JSON ở root, frontend, migration.
- Cập nhật logic form, validation, compose, server-side validation và migration DB.
- Kiểm thử trên Supabase local và lưu ảnh chụp form thật trong `artifacts/`.

## Ngoài phạm vi

- Deploy production: yêu cầu hiện tại chỉ định kiểm thử local.
- Sửa lại các câu trả lời lịch sử: answer giữ nguyên phiên bản codebook tại thời điểm lưu.
- Thiết kế lại các nhóm ngoài S/E/C/Prev và nhóm R/P/O; V chỉ được giữ lại để đọc dữ liệu lịch sử.

## Quyết định

- Tạo phiên bản mới thay vì sửa bản codebook đóng băng; giữ nguyên ý nghĩa các IDs còn dùng.
- Dashcam chỉ áp dụng cho ô tô; khi có dashcam thì không ghi màu ô tô, khi không có thì màu bắt buộc.
- Màu xe bắt buộc với xe có màu; không hiện màu xe cho xe đạp, người đi bộ và động vật.
- Giữ ô C.object và quy tắc liên kết với câu ghép/nhóm R hiện hành.
- Bản lưu C và các answer dẫn xuất phải được ghi nguyên tử, không giới hạn cứng ở hai rows.
