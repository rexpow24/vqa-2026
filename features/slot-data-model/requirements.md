# Yêu cầu P2: dữ liệu cho gán nhãn theo ô

Bước 00, 2026-11-15.
Nguồn: [overview.md](overview.md), [plan.md](../codebook-multiple-choice/plan.md) mục P2 và P4.

## Quyết định của trưởng nhóm

1. Trưởng nhóm đánh thử 10 video bằng form trong app, không dùng bảng tính.
   Lần đánh thử chỉ làm được sau P2 (dữ liệu) và P4 (form), nên P2 phải đủ để form P4 lưu được ô.
2. Form gồm cả 7 nhóm S, E, C, V, O, R, Prev (rộng hơn plan, vốn chỉ S và C cho pilot).
   N và Attr vẫn tự ghép, không có form.
3. Form bắt đầu trống: annotator tự chọn mọi ô, không điền sẵn từ draft Gemini.
   Không làm P3 (tách draft thành ô) cho lần đánh thử; `video_drafts.draft_slots` để sau.

4. (2026-11-16) Lần đánh thử bỏ qua draft Gemini: câu theo ô dùng verdict mới `SLOTS` ("trả lời bằng ô, không so với draft"), mang câu ghép như DISAGREE.
   Đây là mở rộng quy tắc "chỉ DISAGREE mang câu viết lại" thành "DISAGREE và SLOTS", không đảo quyết định 2026-11-07: AGREE vẫn không bao giờ mang câu viết lại.
   Câu SLOTS không tính vào độ khó, kappa, đồng thuận và thống nhất đáp án (xem conflicts.md).
   Kết quả bước 01 vì vậy là PASS.

## Giả định (chưa hỏi, chọn theo mặc định hợp lý; sửa nếu sai)

- A1. 10 video lấy trong 60 video agreement, như plan P1 ghi ("khoảng 10 video trong 60"), giao cho trưởng nhóm, người chưa gán các video này.
- A2. Form ô chỉ bật cho lần đánh thử: annotator khác đang gán câu tự do không bị đổi giao diện hay dữ liệu.
  Cờ bật nằm ở mức phân công (assignment hoặc lô), không phải cờ toàn cục trong `qgroups.json`.
- A3. Mỗi câu (draft) vẫn lưu một dòng `qa_annotations` cho mỗi annotator; `slots` chứa ô đã chọn, `edited_answer` là câu ghép từ mẫu câu của guideline, nên export, `effective_answer` và adjudication cũ vẫn đọc được.
- A4. Không có AGREE với draft khi form trống; verdict của dòng dạng ô cần một quy ước riêng (bước 01 kiểm ràng buộc hiện có của `verdict`).
- A5. Lựa chọn "khác" cho phép ghi chữ ngắn, như guideline (V hành vi, Prev hành động, E loại).
- A6. Video có từ 3 bên: các nhóm chọn bên từ danh sách E của chính annotator trên video đó.
- A7. Migration chạy trên bản sao trước; lên production và deploy cần trưởng nhóm cho phép riêng từng lần.

## Ngoài phạm vi

- P3 (điền sẵn từ draft), P5 (export theo ô và độ đo alpha), màn admin gộp "khác".
- Chuyển các annotator khác sang form ô.

## Tiêu chí chấp nhận

- AC1. Mỗi codebook v1 có một dòng trong `codebook_versions`, nội dung trùng file `codebook/<nhóm>.v1.json`.
- AC2. Lưu một câu dạng ô với ID không có trong codebook, thiếu ô bắt buộc, hoặc vi phạm ràng buộc (hành động không thuộc kiểu xung đột, dấu hiệu không thuộc mức độ, bên không có trong E của video) bị database từ chối.
- AC3. Lưu một câu dạng ô hợp lệ thì có `slots`, `codebook_version` và `edited_answer` là câu ghép.
- AC4. Sửa `slots` sinh một dòng revision; lưu lại `slots` không đổi thì không sinh.
- AC5. Khai báo thực thể E lưu được A, B, C với đủ ô của E; các nhóm khác chỉ chọn được bên đã khai báo.
- AC6. Annotator không thuộc lần đánh thử vẫn gán câu tự do như cũ; mọi `verify-*.mjs` cũ pass.
- AC7. Trưởng nhóm mở một video được giao trong lần đánh thử, gán đủ 7 nhóm bằng form và lưu được (kiểm ở P4).
