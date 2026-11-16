# TODO codebook v2

Sổ theo dõi cho [requirements.md](requirements.md).
Đánh dấu khi đã chạy kiểm, không phải khi mới viết.

- [x] T1. File codebook mới `S.v2`, `C.v2`, `V.v2`, `Attr.v1` ở `codebook/` và bản sao trong `frontend/src/lib/codebook/`; test bản sao.
- [x] T2. Migration `20261116200000_codebook_v2.sql`: 4 dòng mới, check `qgroup` thêm `Attr`, `validate_slots` cho V hai bên.
- [x] T3. `index.ts` đăng ký bản mới; `compose.ts` ghép câu v2 theo mẫu trong codebook; sửa lặp "và ... và" ở Prev.
- [x] T4. Form: V hai bên, Attr dạng ô, điền sẵn V từ C (F-V), N cuối form (F-N), câu hỏi to hơn (F-Q), mở câu v1 (F-v1).
- [x] T5. Guideline S, C, V, Attr; `annotator-guidelines/` và zip.
- [x] T6. `verify-slots.mjs` thêm AC1-AC5; chạy verify cũ, test node, pytest, tsc, lint, build.
- [x] T7. Ảnh chụp form mới ở `screenshots/`.

Kết quả kiểm trên local (2026-11-16): `verify-slots.mjs` 141 PASS, 0 FAIL (chạy 2 lần); verify cũ adjudication 39, assignments 65, difficulty 17, revisions 10 OK, labeling OK; test node 49/49; pytest 246 pass, 1 fail là `test_app_run` (lỗi thời gian đã biết), bỏ 3 file cần cv2; tsc, lint, build pass.
Chưa làm: migration production và deploy (AC8, cần trưởng nhóm cho phép).
