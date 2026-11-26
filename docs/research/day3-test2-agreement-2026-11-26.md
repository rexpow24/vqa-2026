# Agreement của 4 annotator trên `day3_test2.csv`

Ngày chạy: 2026-11-26.

## Phạm vi

Nguồn: `csvs/day3_test2.csv`, SHA-256 `ED7BD7D17470988C0CB0043E7A258B923CE99C4BE5116CD89D06F681A8B8464E`.
File có 635 dòng, gồm 632 câu trả lời `completed` và 3 dòng `in_progress` bị loại.
Hai dòng của Mai Linh đều `in_progress`, nên tập hoàn thành chỉ có Đức Mạnh, Huỳnh Trung, Nhật Trường và Tuyết Hạnh.
Có 20 video, số thứ tự #41-#60; video #54 có 3 người, 19 video còn lại có 4 người ở mỗi nhóm.
Mỗi nhóm có 79 nhãn đã hoàn thành trên 20 video.

## Kết quả theo nhóm

Với bảy nhóm cấu trúc, alpha danh nghĩa được tính trên toàn bộ câu trả lời của nhóm sau khi chuẩn hóa theo codebook.
Tỷ lệ khớp cặp là tỷ lệ các cặp người chọn đáp án toàn nhóm giống hệt nhau trên cùng video.
"Quá bán" nghĩa là hơn một nửa số người trên video chọn cùng đáp án toàn nhóm.
Khoảng tin cậy 95% của alpha được ước lượng bằng 1.000 lần bootstrap theo video, nên các cận có thể thay đổi nhẹ nếu chạy lại.

| Nhóm | Alpha | CI 95% | Khớp cặp | Fleiss kappa | Gwet AC1 | Video quá bán | Video nhất trí |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| S.v3 | 0,132 | 0,059-0,178 | 15,4% | 0,123 | 0,139 | 3/20 | 0/20 |
| E.v6 | 0,537 | 0,384-0,663 | 55,6% | 0,524 | 0,528 | 11/20 | 6/20 |
| C.v4 | 0,220 | 0,129-0,276 | 23,9% | 0,207 | 0,215 | 5/20 | 0/20 |
| R.v2 | 0,366 | 0,195-0,516 | 47,0% | 0,355 | 0,395 | 10/20 | 5/20 |
| O.v2 | 0,474 | 0,307-0,638 | 56,4% | 0,474 | 0,538 | 13/20 | 8/20 |
| Attr.v1 | 0,500 | 0,230-0,729 | 70,1% | 0,479 | 0,639 | 13/20 | 12/20 |
| Prev.v4 | 0,463 | 0,304-0,598 | 54,7% | 0,448 | 0,501 | 13/20 | 6/20 |
| N | Không xác định | Không xác định | 100% phán quyết | Không xác định | 1,000 | 20/20 | 20/20 |

Tất cả bảy nhóm cấu trúc có alpha điểm ước lượng dưới 0,667.
S và C có mức khớp toàn nhóm thấp nhất.
N có 79/79 phán quyết `AGREE`; mỗi video cũng có cùng `effective_answer` ở mọi người đã hoàn thành.
Vì N chỉ có một giá trị phán quyết, Krippendorff alpha và Fleiss kappa không xác định, dù tỷ lệ khớp là 100%.
Hàm alpha trong repo quy ước trả về 1,000 khi cả bất đồng quan sát lẫn bất đồng kỳ vọng đều bằng 0; báo cáo này ghi "không xác định" để tránh diễn giải 1,000 như độ tin cậy đã được kiểm chứng.
Kết quả N không chứng minh độ đúng của lời mô tả; nó chỉ cho biết mọi người chấp nhận bản mô tả đã cho.

## Quy tắc tính và giới hạn

Các ô optional được loại theo quy tắc codebook hiện hành: `object` ở C.v4 và R.v2, `parties` ở O.v2.
Điều này chỉ ảnh hưởng phép tính agreement, không có nghĩa xóa ô khỏi biểu mẫu hoặc dữ liệu.
Ở E.v6, ô camera hành trình và màu xe được tính theo điều kiện áp dụng của từng thực thể.
Các tham chiếu thực thể A/B giữa nhóm được ghép theo danh tính thực thể như script audit hiện hành.
Alpha toàn nhóm chấm câu trả lời ghép nhiều ô như một nhãn danh nghĩa; nó không phải trung bình alpha của từng ô.
Với 20 video, đặc biệt các K hiếm trong C, không nên xem điểm alpha hoặc khoảng tin cậy này là bảo đảm cho bộ dữ liệu gán riêng sau training.

File kiểm tra chi tiết theo video, annotator và ô được lưu tại `C:\Users\Admin\AppData\Local\codex-with-chatgpt\research-evidence\day3-test2-20261126\audit`.
Bảng tổng hợp máy đọc được là `C:\Users\Admin\AppData\Local\codex-with-chatgpt\research-evidence\day3-test2-20261126\group-summary.csv` và `C:\Users\Admin\AppData\Local\codex-with-chatgpt\research-evidence\day3-test2-20261126\iaa\by_slot_group.csv`.
