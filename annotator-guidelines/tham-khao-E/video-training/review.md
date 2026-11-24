# Video huấn luyện nhóm E - bản đề xuất để duyệt (phase 1)

Trạng thái: **BẢN NHÁP, vòng 2** (2026-11-24).
C1, C2, C3 đã được chủ dự án xác nhận.
C4, C5, C7 đã sửa theo chủ dự án; C6 đã xác nhận là xe đạp.
Chưa chạy TTS, chưa render video.

Quy tắc dạy (chỉ những quy tắc này, theo `docs/guidelines/E-thuc-the.md`):

1. Chọn bên: tối đa 2 bên chính, cặp của va chạm đầu tiên; không có va chạm thì cặp của lần suýt va chạm đầu tiên; một xe tự trượt, tự lật (C K18) thì 1 bên.
   Va chạm thắng cả khi suýt va chạm xảy ra trước.
2. Gọi tên: đúng một bên là xe ghi hình thì xe đó là A.
   Còn lại theo vị trí ở khung hình đầu tiên mọi bên cùng xuất hiện và nhận diện được: trái sang phải; gần như cùng cột thì trên xuống.
   Tên giữ nguyên cả video.
3. Loại: xe máy = xe số, tay ga, côn tay, xe máy điện (không bàn đạp); xe đạp = xe đạp thường, xe đạp điện (có bàn đạp); xe ba gác = mọi xe 3 bánh kể cả tự chế; không còn "khác"; container, bán tải là xe tải.

## Giới hạn dữ liệu

Trong 40 video agreement, chỉ 13 video có bản ẩn danh trong `finished/` trên máy này: #5, #13, #14, #16, #21, #22, #23, #29, #32, #34, #36, #38, #40.
27 video còn lại không có file nào trên máy (không có cả `finished/` lẫn `trimmed/`), trong đó có **#1** và phần lớn danh sách bất đồng vị trí (#24, #26, #27, #28, #31, #33).
Vì vậy #23 thay cho #1, và C4, C6, C7 lấy từ video ngoài nhóm agreement (chỉ có bản nháp Gemini, không có nhãn người).
Tất cả 7 clip dùng bản **`finished/`**; không clip nào dùng `trimmed/`.
Không tải gì từ Drive hay internet.

**Hiện không có clip K18 nào đã xác minh.** Quy tắc K18 chỉ được nói trong lời thoại trên thẻ chữ (cảnh S04), không chiếu footage nào gắn nhãn K18.

## Bảng clip

| Clip | Seq | File | Dạy gì | A / B đang vẽ | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| C1 | #23 | `dqZf2LTzIy8_305300_335567_t01.mp4` | Va chạm thắng suýt va chạm xảy ra trước (thay #1). | A = xe máy (người áo sáng), B = xe máy (tay ga xanh); xe ghi hình và xe máy tạt sát lúc 0.6 s không khai báo. | **Đã xác nhận.** Thêm che mặt người lái và biển số 0-1.6 s. |
| C2 | #16 | `ulavEbwx0gg_328167_344900_t01.mp4` | Xe ghi hình trong cặp là A. | A = ô tô (có camera hành trình, ngoài khung), B = xe tải. | **Đã xác nhận.** |
| C3 | #38 | `qGmTgtNrMJw_529800_541500_t01.mp4` | Theo vị trí; đổi chỗ vẫn giữ tên. | A = xe máy người áo đen, B = xe máy người áo xanh. | **Đã xác nhận.** |
| C4 | ngoài agreement | `AeseZkBqBf0_435733_453000_t01.mp4` | Không va chạm: cặp suýt va chạm đầu tiên; theo vị trí. | A = xe máy, B = xe tải (khung 7.2 s). | **Đã sửa theo chủ dự án** (không phải K18). |
| C5 | #22 | `Awei5Z4MiQQ_116867_131867_t01.mp4` | Xe ghi hình là A; xe đạp thường. | A = ô tô (có camera hành trình), B = xe đạp người áo trắng giữa đường. | **Đã sửa theo chủ dự án** (sai người đi xe đạp). |
| C6 | ngoài agreement | `dqZf2LTzIy8_699567_722500_t01.mp4` | Xe đạp điện chọn "xe đạp"; theo vị trí. | A = xe tải, B = xe đạp (khung 0.0 s). | **Đã xác nhận: xe đạp.** A/B theo vị trí chờ xác nhận. |
| C7 | ngoài agreement | `_aFA9cPBTYQ_350967_389767_t01.mp4` (ban đêm) | Xe ba gác; theo vị trí. | A = xe ba gác, B = xe máy bật đèn phía sau bên phải (khung 5.2 s). | **Đã sửa theo chủ dự án** (sai cặp). |

## Chi tiết từng clip

Ảnh trong `stills/`; tọa độ hộp trong `boxes.json` (khung 1920x1080, ước lượng bằng mắt trên khung có lưới); `make_stills.py` vẽ lại được.
Mọi ảnh có dấu đỏ "BẢN NHÁP".

### C1 - #23 (đã xác nhận)

- `C1-a` 0.6 s: xe máy tạt sát xe ghi hình (hộp xám "KHÔNG khai báo").
- `C1-b` 9.45 s: hai xe máy cạnh nhau, A bên trái, B bên phải.
- `C1-c` 10.0 s: xe A ngã, xe B rẽ trái.
- Riêng tư: `C1-a` che biển số `34C-...` sơn trên thùng xe tải và nửa mặt người lái xe máy.
  Với đoạn phát 0.0-1.6 s, `boxes.json` → `clips.C1.segment_masks` ghi các mốc che (biển số: 0.0, 0.3, 0.6, 0.75 s; mặt: 0.45, 0.6, 0.9, 1.2, 1.6 s) để nội suy khi render; các mốc là ước lượng, phải xem lại từng khung sau khi render.

### C2 - #16 (đã xác nhận)

- `C2-a` 3.0 s, `C2-b` 6.0 s: B = xe tải ép vào làn; góc trái ghi A là xe ghi hình.
- Annotator (E.v2): 3/6 A = ô tô ghi hình, 3/6 A = xe tải.

### C3 - #38 (đã xác nhận)

- `C3-a` 0.9 s: A ở trái và trên, B ở phải và dưới.
- `C3-b` 2.6 s: A vẫn bên trái.
- `C3-c` 3.4 s: hai xe đã đổi chỗ, tên giữ nguyên.

### C4 - đã sửa theo chủ dự án

- **Sai trước đây:** tôi gọi là K18 (một xe máy tự ngã, 1 bên).
- **Đúng (chủ dự án):** xe tải đi ngược chiều khiến xe máy phải tránh sát lề, sụp ổ gà và suýt ngã: suýt va chạm giữa xe tải và xe máy, 2 bên; xe ghi hình không thuộc cặp.
- **Vì sao tôi đọc sai:** tôi chỉ phóng to vùng quanh xe máy ở 6.5-9 s, nơi xe tải đã chạy xa phía trước, nên không thấy quan hệ giữa hai xe.
  Tôi cũng dựa vào nháp Gemini ("mất thăng bằng ... lề đường") thay vì xem toàn cảnh. Xe tải là xe vừa vượt xe ghi hình rồi chạy ở làn bên trái (làn ngược chiều).
- Xe máy xuất hiện từ sau mép trái thùng xe tải ở khoảng 7.05 s (còn bị che một phần); 7.2 s là khung đầu tiên nhận rõ cả hai.
  Xe máy (tâm x≈815) nằm hẳn bên trái xe tải (x 858-1030), không cùng cột → **A = xe máy, B = xe tải**.
- `C4-a` 7.2 s: khung đầu tiên cả hai cùng xuất hiện.
- `C4-b` 7.8 s: xe máy tránh sát lề (vòng đỏ của video gốc); xe ghi hình không khai báo.
- Xe tải sàn (chở rơ moóc) bên phải không thuộc cặp và không được vẽ.

### C5 - đã sửa theo chủ dự án

- **Sai trước đây:** tôi vẽ B lên người áo đỏ dắt xe đạp ở lề phải.
- **Đúng (chủ dự án):** B là người đi xe đạp áo trắng giữa đường, đi về phía xe ghi hình khoảng 0:04, bên phải người phụ nữ đẩy xe đạp chở hàng ở lề trái. A vẫn là xe ghi hình.
- **Vì sao tôi đọc sai:** tôi chọn người có xe đạp to và rõ nhất trong khung 3.9 s mà không đối chiếu với mô tả nhóm C. Người áo trắng ở xa và nhỏ hơn nên tôi bỏ qua.
- `C5-a` 3.9 s: hộp B trên người áo trắng giữa đường (còn nhỏ).
- `C5-b` 4.4 s: người áo trắng đến gần, thấy rõ xe đạp thường.
- Còn chưa chắc: ở 4.4 s có một người mặc áo xanh đi xe máy chồng lên gần sát người áo trắng; hộp chỉ ôm người áo trắng.

### C6 - đã xác nhận: xe đạp

- Chủ dự án xác nhận xe là xe đạp. Lời thoại không nói gì về bàn đạp, không thêm quy tắc nào về cỡ lốp.
- Khung đầu tiên cả hai cùng xuất hiện là **0.0 s** (khung đầu của clip): xe tải trắng ở giữa xa (x 940-993), xe đạp điện người áo hồng bên phải (x 1092-1158), tách hẳn, không cùng cột → **A = xe tải, B = xe đạp**. Kết quả trùng với bản trước.
- `C6-a` 0.0 s: khung đặt tên.
- `C6-b` 4.5 s: xe đạp điện dừng trước đầu xe tải.
- Lưu ý: phía sau xe tải trắng có một xe tải xám khác; hộp A là xe tải trắng, chiếc sau này đến sát xe đạp.

### C7 - đã sửa theo chủ dự án

- **Sai trước đây:** tôi ghép xe ba gác với tay ga trắng vượt lên từ bên trái xe ghi hình, rồi viết "sau va chạm hai bên đổi chỗ".
- **Đúng (chủ dự án):** cặp là xe ba gác ở giữa đường (người lái nhìn từ phía sau) và xe máy bật đèn ở bên phải, phía xa hơn.
- **Vì sao tôi đọc sai:** ban đêm, tay ga trắng ở gần camera và chiếm nửa khung ngay trước lúc xe ba gác đổ, nên tôi tưởng nó là bên va chạm. Tôi đã không xem kỹ vùng bên phải xe ba gác ở 5-6 s, nơi xe máy bật đèn tiến lại sát.
- Xe máy bật đèn đã thấy dưới dạng một đốm đèn từ khoảng 4.8-5.0 s, nhưng lúc đó người áo cam đi ngược chiều che vùng này.
  **5.2 s** là khung đầu tiên nhận rõ là xe máy có người lái → **A = xe ba gác** (x 976-1086, bên trái), **B = xe máy** (x 1263-1331).
- `C7-a` 5.2 s: khung đặt tên.
- `C7-b` 6.0 s: xe máy sát bên phải xe ba gác, ngay trước va chạm (khoảng 6.4-6.6 s).
- **Đã bỏ câu "đổi chỗ, tên giữ nguyên" cho C7:** đến 6.0 s xe máy vẫn bên phải; lúc đổ (6.6-7.0 s) hai xe và thùng hàng chồng lên nhau, không thấy rõ là đổi chỗ.

## Kịch bản lời thoại (nháp vòng 2)

Bản máy đọc là `narration.vi.draft.json` (17 cảnh).
Ước tính khoảng 3.3-3.6 phút (VieNeu khoảng 4.2 âm tiết/giây, đo trên series C).

| Cảnh | Clip | Đoạn (s) | Hình | Lời thoại | Quy tắc |
| --- | --- | --- | --- | --- | --- |
| S00 | - | - | Thẻ chữ mở đầu | Bài này hướng dẫn nhóm E. Có ba việc: khai báo những bên nào, gọi tên A và B ra sao, và chọn loại xe nào. Mỗi phần có một video thật để xem. | Mở đầu |
| S01 | - | - | Thẻ chữ quy tắc 1 | Quy tắc thứ nhất: chỉ khai báo tối đa hai bên chính. Đó là hai bên của va chạm đầu tiên. Nếu không có va chạm, lấy hai bên của lần suýt va chạm đầu tiên. | 1 |
| S02 | C1 | 0.0-1.6 (che mặt, biển số) | `C1-a` | Xem video này. Ngay đầu video, một xe máy tạt sát đầu xe ghi hình. Đây là suýt va chạm, nhưng video chưa hết. | 1 |
| S03 | C1 | 8.4-10.6 (0.5x) | `C1-b`, `C1-c` | Phía trước, hai xe máy va chạm và một xe ngã. Có va chạm thì lấy cặp va chạm, dù lần suýt va chạm xảy ra trước. Vậy chỉ khai báo hai xe máy này. Xe ghi hình và xe máy lúc đầu không khai báo. | 1 |
| S04 | - | - | Thẻ chữ K18, không footage | Nếu chỉ có một xe tự trượt hoặc tự lật, không có bên nào khác, thì chỉ khai báo một bên. | 1 (K18) |
| S05 | - | - | Thẻ chữ quy tắc 2 | Quy tắc thứ hai là cách gọi tên. Nếu trong các bên có đúng một xe ghi hình, xe đó là A. Xe ghi hình thường không thấy trong khung hình, nhưng vẫn là A. | 2 |
| S06 | C2 | 2.5-7.0 | `C2-a`, `C2-b` | Ở video này, xe tải ép vào làn của xe ghi hình. Xe ghi hình là A, xe tải là B. Khi xe ghi hình thuộc cặp chính, xe ghi hình là A. | 2 |
| S07 | C5 | 3.0-4.8 | `C5-a`, `C5-b` | Tương tự, người đi xe đạp áo trắng giữa đường đi về phía xe ghi hình. Xe ghi hình là A, xe đạp là B. | 2 |
| S08 | - | - | Thẻ chữ: theo vị trí | Nếu không có xe ghi hình trong cặp, hãy tìm khung hình đầu tiên mà cả hai bên cùng xuất hiện và nhận ra được. Bên nằm bên trái là A. Nếu hai bên gần như cùng một cột, bên ở trên là A. | 2 |
| S09 | C3 | 0.0-1.2 | `C3-a` | Ở khung hình này, hai xe máy cùng xuất hiện. Xe ở bên trái, cũng là xe ở trên, là A. Xe còn lại là B. | 2 |
| S10 | C3 | 2.2-3.8 (0.5x) | `C3-b`, `C3-c` | Sau đó hai xe đổi chỗ cho nhau. Tên vẫn giữ nguyên: A vẫn là A, B vẫn là B. Tên đặt một lần và dùng cho cả video, kể cả khi xe bị che rồi xuất hiện lại. | 2 (giữ tên) |
| S11 | C4 | 4.6-8.6 | `C4-a`, `C4-b` | Video này không có va chạm. Xe tải đi ngược chiều khiến xe máy phải tránh sát lề, sụp ổ gà và suýt ngã. Vậy khai báo cặp suýt va chạm đầu tiên: xe máy và xe tải. Ở khung đầu tiên cả hai cùng xuất hiện, xe máy bên trái là A, xe tải là B. Xe ghi hình không khai báo. | 1 + 2 |
| S12 | C7 | 4.6-6.8 | `C7-a`, `C7-b` | Video ban đêm này có xe ba gác ở giữa đường và một xe máy bật đèn ở phía sau, bên phải. Ở khung đầu tiên cả hai cùng xuất hiện, xe ba gác bên trái là A, xe máy là B. | 2 (+ ba gác) |
| S13 | - | - | Thẻ chữ quy tắc 3, rồi `C5-b`, `C7-b` | Quy tắc thứ ba là loại xe. Xe máy gồm xe số, xe tay ga, xe côn tay và xe máy điện, tức là xe không có bàn đạp. Xe đạp gồm xe đạp thường và xe đạp điện, tức là xe có bàn đạp. Mọi xe ba bánh, kể cả xe tự chế, đều chọn xe ba gác. | 3 |
| S14 | C6 | `C6-a`, rồi 3.5-5.0 | `C6-a`, `C6-b` | Đây là xe đạp điện, nên chọn xe đạp. Khung đầu tiên cả hai cùng xuất hiện là ngay đầu video: xe tải bên trái là A, xe đạp là B. | 3 + 2 |
| S15 | - | - | Thẻ chữ: các loại còn lại | Các loại còn lại là ô tô, xe khách, xe tải, xe cứu thương, người đi bộ và động vật. Xe container và xe bán tải chọn xe tải. Với ô tô, chọn thêm có hay không có camera hành trình. Không còn lựa chọn khác, mỗi bên phải thuộc một loại trong danh sách. | 3 |
| S16 | - | - | Thẻ chữ tóm tắt | Tóm lại. Chọn cặp của va chạm đầu tiên, không có thì cặp suýt va chạm đầu tiên, một xe tự ngã thì chỉ một bên. Xe ghi hình là A. Không có xe ghi hình thì xếp từ trái sang phải ở khung đầu tiên cả hai cùng xuất hiện. Tên giữ nguyên cả video. | Tóm tắt |

## Riêng tư

- C1 (#23), 0-1.6 s: biển số `34C-...` sơn trên thùng xe tải và nửa mặt người lái xe máy không được bộ ẩn danh làm mờ trong `finished/`. Đã che trong `C1-a`; render phải che theo `segment_masks`.
- C1: góc phải dưới có tọa độ GPS của xe ghi hình (một phần đã mờ).
- Bộ ẩn danh không xử lý chữ (số điện thoại trên thân xe, biển hiệu); các clip có lỗi này (`bqH0eeeTBcE_082833_097467`, #40) không dùng.
- `stills/` chứa khung hình footage thật và không nằm trong `.gitignore`; chưa commit.

## Câu hỏi còn mở cho chủ dự án

1. **Cần một clip K18 đã xác minh** (một xe tự trượt/tự lật, không bên nào khác) có bản `finished/` trên máy. Hiện S04 chỉ là thẻ chữ.
2. C4: xác nhận khung 7.2 s và A = xe máy, B = xe tải.
3. C7: xác nhận khung 5.2 s và A = xe ba gác, B = xe máy.
4. C6: xác nhận khung 0.0 s và A = xe tải, B = xe đạp.
5. Có thêm màu xe vào nhãn trên hình không (E.v6 có lại màu xe)?
6. Ảnh `stills/` và video render ra có được commit vào repo không?
