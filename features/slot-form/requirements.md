# P4: form gán nhãn theo ô (yêu cầu)

2026-11-16.
Trưởng nhóm muốn xong trong hôm nay để tự đánh thử 10 video trên web.
Dữ liệu đã có từ P2 ([../slot-data-model/](../slot-data-model/spec.md)): `answer_format`, verdict `SLOTS`, `slots`, `video_entities`, route lưu và ghép câu ở server.

## Quyết định đã có (không hỏi lại)

- Form ô chỉ hiện với phân công `answer_format = 'slots'`; phân công `text` giữ nguyên form hiện tại, từng pixel.
- Cả 7 nhóm S, E, C, V, O, R, Prev dạng ô; N và Attr vẫn là câu chữ với Đồng ý / Không đồng ý / Không trả lời được như cũ.
- Form bắt đầu trống, không có nút Đồng ý với draft ở các nhóm dạng ô; draft Gemini vẫn hiện để tham khảo.
- Lựa chọn lấy từ `frontend/src/lib/codebook/*.v1.json`; nhãn đúng chữ của guideline.
- E: khai báo các bên A, B, C... (mỗi bên đủ ô của E theo điều kiện "khi nào điền"), lưu qua `PUT /api/videos/[id]/entities`; các nhóm khác chọn bên từ danh sách này.
- C: hành động lọc theo kiểu xung đột; chủ thể "cả hai bên" thì mỗi bên một ô hành động và bỏ trống tốc độ, các ô né.
- O: dấu hiệu lọc theo mức độ.
- Prev: một bên, cả hai bên (mỗi bên một bộ hành động), hoặc "không rõ".
- R: không chọn bên; câu lấy chủ thể, đối tượng từ C, nên cần lưu C trước.
- "khác" có ô chữ ngắn (tối đa 200 ký tự) ở V hành vi, Prev hành động, E loại.
- C và V vẫn chọn 2 mốc start, end như hôm nay.
- Lưu qua route có sẵn; lỗi 422 có `code` hiện ngay cạnh ô; câu ghép do server trả về hiện dưới form.
- Admin bật hoặc tắt dạng ô cho phân công trên `/admin/assignments` qua RPC `set_answer_format`.

## Tiêu chí chấp nhận

- F1. Trên local, trưởng nhóm mở một video được giao dạng ô, khai báo E, gán đủ S, C, V, O, R, Prev, trả lời N và Attr, rồi hoàn thành video; mỗi bước có ảnh chụp màn hình.
- F2. Chọn sai (thiếu ô bắt buộc, R trước C) thì thấy thông báo tiếng Việt cạnh ô, không mất lựa chọn đã chọn.
- F3. Video phân công `text` hiển thị và lưu y như trước (so ảnh chụp trước và sau).
- F4. Admin bật dạng ô cho một khoảng video của một người trên `/admin/assignments`; annotator không tự bật được.
- F5. `npm run build`, `npm run lint`, `verify-slots.mjs` và các verify cũ trên local đều pass.
- F6. Chạy trên production cần trưởng nhóm cho phép riêng (migration P2, deploy, bật dạng ô cho 10 video).
