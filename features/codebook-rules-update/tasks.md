# Tasks

| id | Slice | Touches | Bài kiểm chứng | Covers | Depends on |
|---|---|---|---|---|---|
| T1 | Cập nhật S/E/C và bỏ V khỏi câu hỏi mới | JSON, form, admin CSV, endpoint và tests | 8 nhóm mới; V write bị từ chối; historical V còn nguyên | A1-A6, A8 | — |
| T2 | Tạo Prev.v4 suy từ C và tổng hợp N từ 7 nhóm | JSON, `form.ts`, `derivation.ts`, API, migration | Unit test mapping/abstain, lưu C tạo Prev trong cùng giao dịch | A7, A9-A10 | T1 |
| T3 | Cập nhật ràng buộc số nhóm/điều kiện giao và hoàn thành | API, SQL migration | Import 8 nhóm; giao video và complete trên local hoạt động; V cũ không tính vào số hiện hành | A6, A10 | T1,T2 |
| T4 | Chạy app với Supabase local, hoàn thành luồng và chụp bằng chứng | local stack, UI, DB, `artifacts/` | Refresh thấy dữ liệu; query DB đúng; ảnh form thật được lưu | A9-A11 | T1,T2,T3 |
