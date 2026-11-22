# Tiêu chí nghiệm thu

| # | Tiêu chí | Cách kiểm tra | Bao phủ |
|---|---|---|---|
| A1 | S.v3 có lựa chọn “bê tông” | Kiểm thử form và JSON đối chiếu | S |
| A2 | Ô tô có dashcam=yes không hỏi/lưu màu; dashcam=no yêu cầu màu | Unit test logic form, API lưu, query local DB | E |
| A3 | Xe máy/xe khách/xe tải/xe cứu thương/xe ba gác/loại xe khác cần màu; xe đạp/người đi bộ/động vật không có trường màu xe | Unit test entityCells/entityProblems và browser | E |
| A4 | C không có event unclear; ô Đối tượng vẫn hiện/hoạt động; K01-K18 giữ nhãn đầy đủ, K14 không bị cắt | Kiểm tra C.v4 + screenshot browser | C |
| A5 | Lưu C và answer dẫn xuất nhiều hơn hai rows thành công nguyên tử; payload không hợp lệ rollback | Migration đã áp dụng local; cần chạy RPC integration với gói C đầy đủ | Chưa xác minh bằng lượt UI |
| A6 | Tập câu mới bỏ V; API/DB từ chối ghi V mới; dữ liệu V cũ vẫn được giữ | CSV/form/API test và query DB trước/sau migration | V removal |
| A7 | Prev.v4 suy trực tiếp từ C; chỉ có một hành động chính, không có hành động phụ hoặc kết luận vi phạm | Codebook copy test và unit test mapping | C → Prev |
| A8 | Codebook JSON root/frontend/migration khớp và bản cũ không đổi | `python -m pytest tests/test_codebook_copies.py -q` + hash cũ | Versioning |
| A9 | Refresh và lưu lần hai giữ một answer hiện hành cho cùng draft/annotator | Browser + query Supabase local | Second run/data owner |
| A10 | Migration chạy trên Supabase local; N tự tổng hợp từ 7 nhóm nguồn; bản nháp V lịch sử không chặn assignment | Migration + UI + query local DB | Local E2E |
| A11 | Có ảnh thực tế của form local trong `artifacts/` | Mở PNG và kiểm tra ảnh chụp | Evidence |
