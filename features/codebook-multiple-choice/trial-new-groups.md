# Chạy thử guideline các nhóm mới trên câu trả lời thật

Ngày 2026-11-14.
Mục đích: xem guideline E, V, O, R, Attr, Prev, N có chứa được câu trả lời thật không, trước khi viết prompt và chạy codebook.
Nguồn: `answers-agreement-202611140458.csv`, câu trả lời cuối (effective_answer) của một annotator (Huỳnh Trung) trên 3 video nhóm agreement.
Map bằng tay theo guideline, chưa gọi LLM, chưa xem video.
Ký hiệu như P1: M (map được), T (câu không nhắc hoặc không đủ chi tiết), K (có nhắc nhưng không có lựa chọn hợp).

Ba video được chọn vì mỗi video thử một trường hợp khác nhau: #20 suýt va chạm hai bên, #37 va chạm với xe đang đỗ, #10 một xe tự lật khi các xe khác đang dừng.

## Video #20: suýt va chạm, xe máy băng ngang trước ô tô

| Nhóm | Câu gốc | Ô | Câu ghép |
| --- | --- | --- | --- |
| E | Xe ô tô con màu xanh (xe camera) và xe máy màu đen. | A: loại ô tô, camera có (M). B: loại xe máy, màu đen (M), màu áo T, số người T. | Xe ô tô (có camera hành trình), xe máy màu đen. |
| C | Xe máy bất ngờ băng qua đường ngay trước đầu xe ô tô đang di chuyển. | Loại sự kiện suýt va chạm (nhãn event). Chủ thể B, đối tượng A, K14 băng ngang giữa đoạn (M). Hành động: hướng T (câu không nói; N nói "từ phía bên phải"). Bên né, cách né T. | Xe máy màu đen băng ngang, cắt ngang phía trước xe ô tô (có camera hành trình), tránh được. |
| V | Xe máy sang đường không đảm bảo an toàn và không nhường đường cho phương tiện đi thẳng. | Có, bên B (M). Hành vi: "không nhường đường tại giao lộ" chỉ hợp nếu đây là giao lộ; câu không nói, nên K, ghi "khác". | Xe máy màu đen sang đường không nhường đường cho xe đi thẳng. |
| O | hậu quả không có thật | Không va chạm (M). | Không quan sát thấy va chạm hoặc hư hỏng phương tiện. |
| R | cả 2 phương tiện vẫn tiếp tục di chuyển | Ô 0 có; chủ thể và đối tượng: tiếp tục di chuyển, rời đi (M); người xung quanh T. | Các bên tiếp tục di chuyển, rời đi. |
| Attr | Người điều khiển xe máy do sang đường thiếu quan sát và cắt ngang hướng đi của xe khác. | Tự điền B từ C (M). Phần lý do bị bỏ, vì đã nằm ở C. | Xe máy màu đen. |
| Prev | Người đi xe máy nên quan sát kỹ và nhường đường cho xe đi thẳng; tài xế ô tô nên giảm tốc độ khi tới gần khu vực có vạch kẻ đường. | Điền sẵn theo K14: dừng quan sát trước khi băng qua. Annotator viết "quan sát và nhường đường" (M, đổi ô 1). Vế về ô tô giảm tốc: K, vì Prev chỉ có một bên. | Xe máy màu đen nên quan sát và nhường đường. |
| N | Xe ô tô đang đi thẳng trên đường đô thị thì suýt va chạm với một xe máy đang băng ngang qua đường từ phía bên phải. | Ghép từ C, O, R. | Xe máy màu đen băng ngang, cắt ngang phía trước xe ô tô (có camera hành trình), tránh được. Các bên tiếp tục di chuyển, rời đi. |

## Video #37: xe máy đang chạy tông đuôi xe máy đang đỗ

| Nhóm | Câu gốc | Ô | Câu ghép |
| --- | --- | --- | --- |
| E | Hai chiếc xe tay ga màu trắng (một chiếc đang đỗ và một chiếc đang di chuyển. | A, B: loại xe máy, màu trắng (M). "Đang đỗ", "đang di chuyển": K, E không có ô trạng thái. Màu áo T. | Xe máy màu trắng, xe máy màu trắng. |
| C | Người điều khiển xe máy đang di chuyển thiếu quan sát hoặc không giữ khoảng cách an toàn khi đi quá sát xe đang đỗ. | Va chạm. Chủ thể B (xe đang chạy), đối tượng A, K01 xe phía trước dừng hoặc đứng yên (M). Hành động T (không nói không giảm tốc hay tăng tốc). "Thiếu quan sát" nằm ngoài codebook (kết luận lỗi). | Xe máy màu trắng tiến sát phía sau xe máy màu trắng, dẫn đến va chạm. |
| V | Người lái xe thiếu quan sát và không giữ khoảng cách an toàn với phương tiện đang dừng đỗ. | Có, bên B. Hành vi: K, danh sách không có "không giữ khoảng cách", ghi "khác". | Xe máy màu trắng không giữ khoảng cách an toàn. |
| O | Cả hai xe máy bị đổ, cả hai người điều khiển trên xe ngã xuống đường, phương tiện có thể bị trầy xước nhẹ. | Va chạm vừa, người hoặc xe ngã (M). "Có thể bị trầy xước" là đoán, bị bỏ. | Xe máy màu trắng và xe máy màu trắng va chạm vừa, người hoặc xe ngã. |
| R | Những người xung quanh và nhân viên tiệm sửa xe nhanh chóng chạy ra hỗ trợ dựng xe và giúp đỡ người bị nạn. | Ô 0 có; người xung quanh: dừng lại hoặc đến hỗ trợ (M); chủ thể, đối tượng T. | Người xung quanh dừng lại hoặc đến hỗ trợ. |
| Attr | Người điều khiển chiếc xe máy màu trắng đang di chuyển. | Tự điền B (M). | Xe máy màu trắng. |
| Prev | Người lái xe nên tập trung quan sát phía trước và chủ động điều khiển xe tránh xa phương tiện đang đỗ bên đường. | Điền sẵn theo K01: giữ khoảng cách an toàn (M). | Xe máy màu trắng nên giữ khoảng cách an toàn. |
| N | Một chiếc xe máy đang lưu thông thì va chạm vào đuôi một chiếc xe máy khác đang đỗ bên lề đường, khiến cả hai xe đổ ngã và người trên xe ngã xuống đường. | Ghép từ C, O, R. | Xe máy màu trắng tiến sát phía sau xe máy màu trắng. Hai bên va chạm vừa, người hoặc xe ngã. Người xung quanh dừng lại hoặc đến hỗ trợ. |

## Video #10: xe tải tự lật khi các xe phía trước đang dừng

| Nhóm | Câu gốc | Ô | Câu ghép |
| --- | --- | --- | --- |
| E | Xe container màu trắng, xe bán tải màu trắng, xe khách màu vàng và xe tải màu xám. | Annotator khai cả các xe đang dừng. Theo E chỉ khai bên liên quan, nên phụ thuộc cách ghi C (bên dưới). Xe tải: cỡ T, màu xám (M). "Container", "bán tải": K, không có trong danh sách loại. | Cách 1: Xe tải màu xám. Cách 2: thêm xe đầu tiên đang dừng. |
| C | Xe tải màu xám mất lái hoặc đánh lái gấp để tránh va chạm với các phương tiện phía trước. | Hai cách ghi, tùy video. Cách 1: K18, chủ thể xe tải, hành động văng khỏi làn, không có đối tượng. Cách 2: K01 xe phía trước đứng yên, chủ thể xe tải, đối tượng xe đầu tiên đang dừng, bên né xe tải, cách né đánh lái, kết quả né ngã, trượt. "Để tránh" là ý định, bị bỏ. | Cách 1: Xe tải màu xám văng khỏi làn, dẫn đến va chạm. Cách 2: Xe tải màu xám tiến sát phía sau [xe đang dừng], xe tải màu xám phải đánh lái, ngã, trượt. |
| V | Xe tải màu xám không làm chủ tốc độ và hướng lái khi đi qua khu vực có xe đang dừng. | "Không làm chủ tốc độ" là suy ra tốc độ, guideline cấm. K, nên chọn "không rõ" hoặc "khác". | Không thể xác định. |
| O | Xe tải màu xám lật nghiêng hoàn toàn xuống rãnh bên đường. | Va chạm mạnh, xe lật (M). | Cách 1: Xe tải màu xám xe lật. |
| R | Các phương tiện liên quan như xe container và xe bán tải đã dừng lại tại hiện trường. | Ô 0 có. Cách 1: các xe này là xe xung quanh, nhưng ô 3 chỉ ghi "người" xung quanh (K). Cách 2: đối tượng dừng lại (M). Chủ thể T. | Cách 2: [Xe đang dừng] dừng lại. |
| Attr | Người lái xe tải màu xám. | Tự điền xe tải (M). | Xe tải màu xám. |
| Prev | Người lái xe tải nên giảm tốc độ và giữ khoảng cách an toàn khi thấy các phương tiện phía trước đang dừng. | Ô 1 giảm tốc, ô 2 giữ khoảng cách an toàn (M). | Xe tải màu xám nên giảm tốc và giữ khoảng cách an toàn. |
| N | Xe tải màu xám mất lái lao xuống rãnh bên đường và lật nghiêng khi các xe khác đang dừng đỗ trên đường. | Ghép từ C, O, R. | Cách 2: Xe tải màu xám tiến sát phía sau [xe đang dừng]. Xe tải màu xám phải đánh lái, ngã, trượt. Xe tải màu xám xe lật. |

Nhãn event của #10 là "near-miss" dù xe tải lật; annotator khác ghi cả "accident".

## Phát hiện

| # | Vấn đề | Video | Đề xuất |
| --- | --- | --- | --- |
| 1 | E không phân biệt được hai bên cùng loại, cùng màu, nên C, O, Attr ghép ra "xe máy màu trắng ... xe máy màu trắng". | #37 | Thêm ô "trạng thái" cho E: đang chạy · đang dừng, đỗ. Chỉ điền khi hai bên trùng loại và màu. |
| 2 | Ô bỏ trống làm câu ghép cụt hoặc sai ngữ pháp ("xe tải màu xám xe lật", "người hoặc xe ngã"). | #37, #10 | Viết lại nhãn lựa chọn để đọc được trong câu: tách "người ngã" và "xe ngã"; O mẫu một bên là "[Chủ thể] bị lật". Quy tắc chung: ô "không rõ" thì bỏ vế đó. |
| 3 | V thiếu hành vi gặp nhiều: "không giữ khoảng cách an toàn", "sang đường không nhường đường" ngoài giao lộ. | #20, #37 | Thêm 2 lựa chọn này vào V. |
| 4 | Prev chỉ có một bên; annotator khuyên cả hai bên. | #20 | Giữ một bên (khớp Attr), hoặc thêm ô bên thứ hai không bắt buộc. Cần bạn quyết. |
| 5 | Một xe tự gặp nạn khi né xe đang dừng: K18 hay K01 có né. | #10 | Theo định nghĩa ở C (K18 là "không do bên kia"), nên chọn K01 có né khi thấy rõ xe phía trước dừng. Cần xem video. |
| 6 | E thiếu loại "container", "bán tải". | #10 | Gộp container vào "xe tải to", bán tải vào "ô tô"; ghi ví dụ vào E. |
| 7 | R ô 3 chỉ nói "người" xung quanh, không có "xe xung quanh dừng lại". | #10 | Đổi nhãn thành "người hoặc xe xung quanh dừng lại, đến hỗ trợ". |
| 8 | Ràng buộc O với C sai khi suýt va chạm mà bên né tự lật. | #10 | Đã sửa trong O: chỉ "tránh được" mới bắt buộc "không va chạm". |

## Quyết định 2026-11-14

| # | Quyết định | Đã áp vào |
| --- | --- | --- |
| 1 | Hai bên trùng loại và màu thì thêm chữ cái: "xe máy màu trắng A", "xe máy màu trắng B". A, B, C xếp theo vị trí trong khung hình, từ trái sang phải; thẳng hàng dọc thì bên trên tính trước. Không thêm ô trạng thái. | E |
| 2 | Nhãn lựa chọn viết lại để đọc được trong câu; ô "không rõ" thì bỏ vế. | O, E |
| 3 | Thêm "sang đường không nhường đường" và "không giữ khoảng cách an toàn". | V |
| 4 | Prev có một bên hoặc cả hai bên, mỗi bên một hành động. | Prev |
| 5 | Để sau. | |
| 6 | Container và bán tải ghi là xe tải. | E |
| 7 | "Người xung quanh" gồm cả xe xung quanh. | R |
