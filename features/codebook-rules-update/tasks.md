# Tasks

| id | Slice | Touches | Bài kiểm chứng | Covers | Depends on |
|---|---|---|---|---|---|
| T1 | Cập nhật codebook/form và câu ghép cho S/E/C/V | JSON, `form.ts`, `compose.ts`, test liên quan | Unit test chứng minh điều kiện field và option mới/cũ, object vẫn hoạt động | A1-A4, A6-A7 | — |
| T2 | Cho phép lưu gói C và nhóm dẫn xuất nguyên tử | API route, migration RPC | Integration test: nhiều rows commit, hàng sai rollback | A5, A8 | T1 |
| T3 | Chạy app với Supabase local và hoàn tất một lần gán nhãn | local stack, UI, DB | Browser lưu dữ liệu rồi refresh; query thấy đúng rows | A2-A5, A8-A9 | T1,T2 |
| T4 | Chụp, xem lại và lưu bằng chứng | `artifacts/` | Mở ảnh xác nhận là form chạy local và nhãn đầy đủ | A4,A10 | T3 |
