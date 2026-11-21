# Tiêu chí nghiệm thu

| # | Tiêu chí | Cách kiểm tra | Bao phủ |
|---|---|---|---|
| A1 | S.v3 có lựa chọn “bê tông” | Kiểm thử form và JSON đối chiếu | S |
| A2 | Ô tô có dashcam=yes không hỏi/lưu màu; dashcam=no yêu cầu màu | Unit test logic form, API lưu, query local DB | E |
| A3 | Xe máy/xe khách/xe tải/xe cứu thương/xe ba gác/loại xe khác cần màu; xe đạp/người đi bộ/động vật không có trường màu xe | Unit test entityCells/entityProblems và browser | E |
| A4 | C không có event unclear; ô Đối tượng vẫn hiện/hoạt động; K01-K18 giữ nhãn đầy đủ, K14 không bị cắt | Kiểm tra C.v4 + screenshot browser | C |
| A5 | Lưu C và answer dẫn xuất nhiều hơn hai rows thành công nguyên tử; payload không hợp lệ rollback | Migration đã áp dụng local; cần chạy RPC integration với gói C đầy đủ | Chưa xác minh bằng lượt UI |
| A6 | V additional behavior optional và danh sách option khớp yêu cầu | Form test và codebook copy test | V |
| A7 | Codebook JSON root/frontend/migration khớp và bản cũ không đổi | `python -m pytest tests/test_codebook_copies.py -q` + hash cũ | Versioning |
| A8 | Refresh và lưu lần hai giữ một answer hiện hành cho cùng draft/annotator | Browser + query Supabase local | Second run/data owner |
| A9 | Migration chạy trên Supabase và app production đăng nhập được | Migration đã chạy local và production; vtest đăng nhập production thành công rồi được xoá. S.v3/E.v4 có dữ liệu local; lượt production không tạo answer. C chưa lưu local vì fixture thiếu media/keyframes | Một phần |
| A10 | Có ảnh thực tế của form local trong `artifacts/` | Mở PNG và kiểm tra ảnh chụp | Evidence |
| A11 | Production deploy hoạt động và test data được dọn | Deployment Vercel READY; tài khoản vtest đã đăng xuất, Auth user/profile bị xoá, 0 assignment/annotation rows | PASS |
