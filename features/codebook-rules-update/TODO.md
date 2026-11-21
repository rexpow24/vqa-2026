# codebook-rules-update - tiến độ

- [x] T1 - Cập nhật codebook, form và câu ghép. Status: complete.
- [x] T2 - Mở rộng lưu gói slot trong một transaction và cập nhật kiểm tra E. Status: migration đã áp dụng local.
- [ ] T3 - Kiểm thử toàn luồng trên Supabase local. Status: một phần; S và E đã lưu qua UI, C chưa lưu vì video fixture không có media để xác minh keyframes.
- [x] T4 - Chụp và xem lại ảnh bằng chứng. Status: complete.

## Ghi chú

- 2026-11-21: Chọn phiên bản codebook mới thay vì sửa các phiên bản đóng băng.
- 2026-11-21: Giữ nguyên trường `Đối tượng` trong C theo xác nhận mới nhất.
- 2026-11-21: Áp dụng bốn migration codebook/derived mới trên Supabase local.
- 2026-11-21: Lưu S.v3 và E.v4 cho video thử local; query DB xác nhận mỗi nhóm có một answer.
- 2026-11-21: Ảnh local được lưu tại `artifacts/codebook-rules-update/`.
- 2026-11-21: Theo yêu cầu tiếp theo, áp dụng migration `20261121130000_codebook_rules_update` trên production và deploy app production.
- 2026-11-21: Smoke test đăng nhập bằng tài khoản tạm `vtest`; đã xoá Auth user/profile ngay sau kiểm tra. Không tạo assignment hay answer; các bảng liên quan đều có 0 rows cho tài khoản thử.
- 2026-11-21: Production deploy `dpl_BBN1h1BhPiuMaCMxeW7doKYbNce1` ở trạng thái READY. Ảnh đăng nhập thực tế: `artifacts/codebook-rules-update/production-vtest-login.png`.

## Lỗi tìm thấy khi chạy, không phải khi đọc

| Lỗi | Triệu chứng | Nguyên nhân |
|---|---|---|
| C chưa chạy hết luồng qua UI | Không thể phát video fixture local để xác minh keyframes | Form C và trường `Đối tượng` đã được kiểm tra bằng browser; lần lưu C còn cần media fixture hợp lệ |

## Kiểm tra đã chạy

- Frontend form/compose tests: 57 passed.
- Codebook copy consistency: 160 passed.
- `npm run build`: passed trước lần xác nhận UI cuối.
- Python tests ngoài codebook chưa thu thập đủ vì các bài kiểm tra sidecar cần `fastapi` và `pydantic`, vốn không thuộc `requirements.txt` của pipeline.
- Supabase local có các migration từ `20261121100000` đến `20261121130000` và đăng ký S.v3, E.v4, C.v4, V.v9.
