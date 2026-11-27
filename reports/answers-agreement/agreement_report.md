# Báo cáo độ đồng thuận

- Video: #41-#60
- Dữ liệu: 795 dòng, 792 hoàn thành; loại 3 dòng chưa hoàn thành.
- 4 người: trung bình trên mọi tổ hợp 4 người có thể chọn; CI 95% bootstrap theo video (1,000 lần).
- α ô gộp: gom các ô theo nhóm, vẫn giữ tên từng ô; α nguyên bộ: so khớp cả câu trả lời cấu trúc.

| Nhóm | Codebook | Video đủ 4 người | α ô gộp (95% CI) | α nguyên bộ (95% CI) |
|---|---|---:|---:|---:|
| S | S.v3 | 19-20/20 | 0,753 [0,699; 0,806] | 0,194 [0,116; 0,247] |
| E | E.v6 | 19-20/20 | 0,849 [0,770; 0,916] | 0,563 [0,432; 0,675] |
| C | C.v4 | 19-20/20 | 0,621 [0,556; 0,680] | 0,279 [0,191; 0,330] |
| V | - | n/a | n/a | n/a |
| O | O.v2 | 19-20/20 | 0,617 [0,430; 0,760] | 0,514 [0,352; 0,654] |
| R | R.v2 | 19-20/20 | 0,690 [0,594; 0,773] | 0,370 [0,223; 0,497] |
| Attr | Attr.v1 | 19-20/20 | 0,510 [0,273; 0,730] | 0,510 [0,254; 0,724] |
| Prev | Prev.v4 | 19-20/20 | 0,722 [0,538; 0,869] | 0,534 [0,348; 0,677] |

V được giữ trong danh sách tám nhóm; nếu không có trong CSV thì hiển thị `n/a`. N là verdict, không nằm trong tám nhóm nhãn này.
Alpha/CI `n/a` nghĩa là không có biến thiên nhãn để ước lượng độ đồng thuận.
