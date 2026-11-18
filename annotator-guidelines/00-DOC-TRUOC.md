# Hướng dẫn gán nhãn VQA giao thông

Bộ hướng dẫn cho annotator, cập nhật 2026-11-16.
Mỗi nhóm câu hỏi có một file; mở bản `.html` để đọc dễ hơn, bản `.md` có cùng nội dung.

## Thứ tự đọc

Đọc theo thứ tự dưới đây: các nhóm sau dùng tên các bên A, B, C khai báo ở E, và V, O, R, Attr, Prev dựa trên nguyên nhân ở C.

| # | Nhóm | File |
| --- | --- | --- |
| 01 | Nhóm S: bối cảnh (Scene) | [huong-dan/01-S-boi-canh.html](huong-dan/01-S-boi-canh.html) |
| 02 | Nhóm E: thực thể (Entities) | [huong-dan/02-E-thuc-the.html](huong-dan/02-E-thuc-the.html) |
| 03 | Nhóm C: nguyên nhân trực tiếp (Causal) | [huong-dan/03-C-nguyen-nhan.html](huong-dan/03-C-nguyen-nhan.html) |
| 04 | Nhóm V: vi phạm (Violation) | [huong-dan/04-V-vi-pham.html](huong-dan/04-V-vi-pham.html) |
| 05 | Nhóm Attr: bên góp phần chính (Attribution) | [huong-dan/05-Attr-ben-gop-phan.html](huong-dan/05-Attr-ben-gop-phan.html) |
| 06 | Nhóm O: hậu quả (Outcome) | [huong-dan/06-O-hau-qua.html](huong-dan/06-O-hau-qua.html) |
| 07 | Nhóm R: ứng xử sau sự kiện (Response) | [huong-dan/07-R-ung-xu.html](huong-dan/07-R-ung-xu.html) |
| 08 | Nhóm Prev: phòng ngừa (Prevention) | [huong-dan/08-Prev-phong-ngua.html](huong-dan/08-Prev-phong-ngua.html) |
| 09 | Nhóm N: diễn biến (Narrative) | [huong-dan/09-N-dien-bien.html](huong-dan/09-N-dien-bien.html) |

## Tài liệu tham khảo cho C và V

- [tham-khao-C/kieu-xung-dot.html](tham-khao-C/kieu-xung-dot.html): 18 kiểu xung đột của nhóm C, nguồn gốc, và luật phân xử 4 cặp dễ nhầm (K11/K14, K04/K05, K08/K10, K18).
  Số liệu trong trang là phân bố sơ bộ trên 40 video vòng đầu; bảng kiểu xung đột chính thức nằm trong hướng dẫn nhóm C.
- [tham-khao-V/doi-chieu-MMUCC.html](tham-khao-V/doi-chieu-MMUCC.html): danh sách hành vi vi phạm nhóm V lấy từ đâu (MMUCC 5th Edition, NHTSA) và vì sao bỏ một số mục.

## Sửa câu ghép

Sau khi chọn đủ các ô, form ghép câu trả lời; bấm "Sửa câu" để sửa câu đó cho mạch lạc hơn.
Chỉ được thêm từ nối (ví dụ "chiếc", "rồi", "nên", "và"), đổi chữ hoa hoặc dấu câu.
Không xóa, đổi hay đảo chữ nào của câu ghép; form báo lỗi và không lưu nếu thiếu chữ.
Muốn đổi nội dung thì đổi ô; khi đổi ô, câu sửa tay bị bỏ và ghép lại từ đầu.
Câu của nhóm E (danh sách các bên) không sửa được.

## Khi hướng dẫn và tài liệu tham khảo khác nhau

File trong `huong-dan/` là bản chính thức. Tài liệu tham khảo chỉ giải thích thêm.
