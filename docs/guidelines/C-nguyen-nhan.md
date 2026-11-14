# Hướng dẫn gán nhãn Nhóm C: nguyên nhân trực tiếp (Causal)

- Câu hỏi chuẩn: Nguyên nhân trực tiếp hoặc hành động ngay trước va chạm là gì?
- Tên thực thể A, B, C lấy từ Nhóm E.
- Mỗi ô chọn đúng một giá trị. Không nhìn rõ ô nào thì chọn "không rõ".
- Chỉ mô tả hành động nhìn thấy được; không kết luận lỗi, không đoán ý định.

## Các ô

| Ô | Lựa chọn |
| --- | --- |
| 0. Loại sự kiện | va chạm · suýt va chạm · không rõ |
| 1. Chủ thể | chọn từ E · cả hai bên · không rõ |
| 2. Kiểu xung đột | chọn nhóm, rồi chọn kiểu (bảng dưới) · không rõ |
| 3. Hành động | lựa chọn theo kiểu xung đột (bảng dưới) |
| 4. Tốc độ (không bắt buộc) | phanh gấp · dừng đột ngột · tăng tốc · không giảm tốc · đứng yên |
| 5. Bên né (chỉ khi có né) | chọn từ E · cả hai bên |
| 6. Cách né | phanh gấp · đánh lái sang trái · đánh lái sang phải · phanh gấp và đánh lái |
| 7. Kết quả né | tránh được · ngã, trượt · vẫn chạm · chạm vào thực thể khác [chọn từ E] |
| Mốc | Start · End |

Ô 0 "va chạm" gồm cả trường hợp phương tiện tự lật hoặc văng khỏi đường dù không chạm bên nào, kể cả khi trước đó có né.
Cơ sở: ANSI D16.1-2007 (Manual on Classification of Motor Vehicle Traffic Accidents, bản NHTSA phát hành), mục 2.6.1 định nghĩa overturning accident là tai nạn có sự kiện gây hại đầu tiên là phương tiện bị lật, và mục 2.6.3 xếp nó vào noncollision accident, tức vẫn là tai nạn.
"Suýt va chạm" chỉ dùng khi không có thiệt hại nào; định nghĩa near-crash của SHRP2 (Hankey et al. 2016) là tình huống phải né gấp để tránh tai nạn.

Cặp chính gồm chủ thể (bên thay đổi chuyển động trước) và đối tượng.
Đối tượng là bên bị chủ thể chạm đầu tiên; chủ thể không chạm ai thì là bên đầu tiên phải né.
Bên né đâm vào bên thứ ba thì ghi ở kết quả né, không tạo cặp mới.

Đối tượng: video có 2 thực thể thì hệ thống tự điền bên còn lại; từ 3 thực thể trở lên thì chọn từ E.
Quan hệ được tự điền theo kiểu xung đột.

## Video có từ 3 bên trở lên

Chỉ ghi cặp chính như định nghĩa ở trên; các va chạm hoặc bên xuất hiện sau đó không tạo cặp mới.
Bên chỉ có mặt trong khung hình mà không phải né, không bị chạm thì không ghi.
Cơ sở: bộ phân loại tình huống trước va chạm của NHTSA (Najm và cộng sự, 2007, DOT HS 810 767) xếp tai nạn nhiều xe vào cùng các tình huống của tai nạn hai xe, dựa vào sự kiện đầu tiên của vụ việc.
Unfalltypen-Katalog của Đức cũng xác định loại tai nạn chỉ bằng tình huống xung đột dẫn tới tai nạn, không theo diễn biến va chạm sau đó.

Ví dụ thật từ nhóm agreement (mô tả lấy từ câu trả lời của người gán nhãn):

| Video | Diễn biến | Cách ghi |
| --- | --- | --- |
| #10 | Xe tải xám mất lái, lật xuống rãnh; xe container, bán tải, xe khách đang dừng trên đường. | K18, chủ thể là xe tải xám, không có đối tượng. Các xe đang dừng không phải né, không bị chạm nên không ghi. |
| #54 | Xe tải lấn sang làn ngược chiều để vượt, suýt va chạm với các ô tô trắng đi ngược chiều. | K08 lấn khi vượt, chủ thể là xe tải, đối tượng là ô tô trắng đầu tiên phải né. Các ô tô sau không ghi. |
| #1 | Xe máy áo trắng băng qua đường cắt ngang ô tô gắn camera (ô tô phanh gấp), rồi tông xe máy áo xanh đang đi thẳng tới. | Va chạm, chủ thể là xe máy áo trắng, đối tượng là xe máy áo xanh (bên bị chủ thể chạm), không phải ô tô dù ô tô phải né trước. |
| #24 | Xe máy trắng cắt ngang giữa ngã tư, chạm đầu ô tô gắn camera rồi chạm hông ô tô màu bạc. | Chủ thể là xe máy trắng, đối tượng là ô tô bị chạm trước (theo thứ tự trên video). Va chạm với ô tô thứ hai không ghi. |

## Kiểu xung đột

| Mã | Nhóm | Kiểu | Quan hệ (tự điền) | Hành động |
| --- | --- | --- | --- | --- |
| K01 | Cùng chiều, phía trước | Xe phía trước dừng hoặc đứng yên | tiến sát phía sau | không giảm tốc · tăng tốc |
| K02 | Cùng chiều, phía trước | Xe phía trước phanh, giảm tốc | ở ngay phía trước | phanh gấp · dừng đột ngột |
| K03 | Cùng chiều, phía trước | Tiến sát xe phía trước chạy chậm | tiến sát phía sau | không giảm tốc · tăng tốc |
| K04 | Cùng chiều, bên cạnh | Chuyển làn, nhập làn | đi vào đường đi của | chuyển sang làn bên trái · chuyển sang làn bên phải |
| K05 | Cùng chiều, bên cạnh | Vượt, len giữa các xe | tiến sát bên hông | vượt bên trái · vượt bên phải · len giữa |
| K06 | Cùng chiều, bên cạnh | Rẽ cắt qua xe đi cùng chiều bên cạnh | cắt ngang phía trước | rẽ trái · rẽ phải |
| K07 | Cùng chiều, bên cạnh | Xe đỗ ven đường, mở cửa, ra khỏi chỗ đỗ | đi vào đường đi của | mở cửa xe · ra khỏi chỗ đỗ |
| K08 | Ngược chiều | Lấn sang phần đường ngược chiều | đi đối đầu với | lấn khi vượt · lấn khi vào cua · lấn khi đi thẳng |
| K09 | Ngược chiều | Đi ngược chiều trên làn của người khác | đi đối đầu với | đi thẳng ngược chiều |
| K10 | Ngược chiều | Rẽ trái hoặc quay đầu cắt đầu xe ngược chiều | cắt ngang phía trước | rẽ trái · quay đầu |
| K11 | Cắt ngang | Hai hướng cắt nhau tại giao lộ, cùng đi thẳng | cắt ngang phía trước | từ trái sang phải · từ phải sang trái |
| K12 | Cắt ngang | Ra từ đường nhánh, hẻm, bãi xe | đi vào đường đi của | ra từ bên trái · ra từ bên phải |
| K13 | Cắt ngang | Quay đầu giữa đường | cắt ngang phía trước | quay đầu sang trái · quay đầu sang phải |
| K14 | Cắt ngang | Băng ngang đường giữa đoạn | cắt ngang phía trước | từ trái sang phải · từ phải sang trái |
| K15 | Người đi bộ, động vật | Người đi bộ băng qua hoặc đi dưới lòng đường | cắt ngang phía trước | từ trái sang phải · từ phải sang trái · đi dọc đường |
| K16 | Người đi bộ, động vật | Động vật lao ra đường | cắt ngang phía trước | từ trái sang phải · từ phải sang trái |
| K17 | Khác | Lùi xe vào bên khác | tiến sát phía sau | lùi xe |
| K18 | Khác | Một bên trượt, văng, không do bên kia | không có | trượt · văng khỏi làn · nổ lốp |

## Mẫu câu

| Trường hợp | Mẫu câu |
| --- | --- |
| Va chạm | [Chủ thể] [hành động] (và [tốc độ]), [quan hệ] [đối tượng], dẫn đến va chạm. |
| Suýt va chạm | [Chủ thể] [hành động] (và [tốc độ]), [quan hệ] [đối tượng], [bên né] phải [cách né], [kết quả né]. |
| Cả A và B | [A] [hành động của A], đồng thời [B] [hành động của B], đi vào đường đi của nhau, dẫn đến [va chạm hoặc suýt va chạm]. |
