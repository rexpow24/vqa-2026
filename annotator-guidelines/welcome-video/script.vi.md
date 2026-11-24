# Video welcome cho annotator - kịch bản quay

Trạng thái: owner đã duyệt lời thoại và giao agent xác định giá trị demo từ clip gốc.
Lời thoại gốc nằm trong `shotlist.json`; file này là bản đọc cho người.
Sửa lời thoại thì sửa ở `shotlist.json` trước, rồi cập nhật file này.

- Ứng dụng: bản local, `http://localhost:3006`, tài khoản demo riêng do `frontend/scripts/prepare-welcome-demo.mjs` tạo.
- Video demo: clip suýt va chạm `bqH0eeeTBcE_114833_159400_t01.mp4` (8 giây, ô tô ghi hình và xe máy đi ngược chiều).
- Độ dài ước tính: khoảng 4 phút 45 giây (đo theo tốc độ giọng "Hải Đăng" trong video hướng dẫn E: khoảng 4,4 âm tiết/giây, nghỉ 0,55 giây giữa các câu).
- Giọng: VieNeu-TTS "Hải Đăng", như video hướng dẫn C và E.

Giá trị demo được xác định từ khung hình gốc và ghi trong `shotlist.json`.
Xe máy đã ở làn của xe ghi hình khi bắt đầu nhìn rõ, không thấy chuyển làn, nên chọn K09.
Mốc gần nhau nhất dùng trong video là 7,75 giây.

## Danh sách cảnh

| Cảnh | Nội dung | Ước tính |
| --- | --- | --- |
| S01 | Chào mừng, ba việc với mỗi video | 20 s |
| S02 | Danh sách video được giao | 17 s |
| S03 | Trình phát, phím tắt, nhãn video | 24 s |
| S04 | Thẻ câu hỏi, video hướng dẫn bắt buộc | 21 s |
| S05 | Nhóm E: khai báo bên nào | 20 s |
| S06 | Nhóm E: đặt tên A, B và điền từng bên | 26 s |
| S07 | Nhóm E: loại xe, ô nhắc tên, lưu | 22 s |
| S08 | Nhóm C: loại sự kiện, kiểu xung đột | 15 s |
| S09 | Nhóm C: ô nhắc và video so sánh | 22 s |
| S10 | Nhóm C: hành động, chủ thể, đối tượng | 23 s |
| S11 | Nhóm C: mốc va chạm, câu ghép, lưu | 20 s |
| S12 | Vì sao E và C quan trọng (O, R, Prev, Attr) | 27 s |
| S13 | Hoàn tất video | 15 s |
| S14 | Tóm tắt, tab Hướng dẫn | 17 s |

Tổng khoảng 285 giây; thao tác điền form có thể cộng thêm 5-15 giây.

---

## S01 - Chào mừng và ba việc với mỗi video (~20 s)

**Màn hình:** trang `/login`, phủ một thẻ tiêu đề (chèn khi quay, không sửa app): "Chào mừng đến với VQA-VN-Traffic" và 3 dòng: xem kỹ video; điền E, rồi C, rồi các nhóm còn lại; chọn nhãn video, bấm Hoàn thành video.
Ở câu cuối, gỡ thẻ, điền email và mật khẩu (ô mật khẩu vẫn ẩn), bấm "Đăng nhập".

**Lời thoại:**

> Chào mừng bạn đến với dự án gán nhãn video giao thông Việt Nam.
> Video này giới thiệu trang gán nhãn mà bạn sẽ dùng hằng ngày.
> Với mỗi video, bạn làm ba việc.
> Một, xem kỹ video, tua chậm ở đoạn va chạm.
> Hai, điền nhóm E rồi nhóm C trước, sau đó các nhóm còn lại.
> Ba, chọn nhãn video và bấm Hoàn thành video.

**Dạy:** quy trình 3 bước. Thứ tự E trước C vì các nhóm khác chọn bên từ danh sách E ("Chưa có bên nào: khai báo và lưu các bên ở nhóm E trước"), và O, R, Prev cần C đã lưu.

## S02 - Danh sách video được giao (~17 s)

**Màn hình:** `/annotate`. Khung lần lượt: tab "Gán nhãn", khối tiến độ "Bạn đã gán nhãn 0 / 3 video được giao", dòng đầu (số `#`, tên file, thời lượng, "0/8 câu", "Chưa làm"), ô tìm "Số thứ tự (vd. 125) hoặc tên file".
Câu cuối: bấm dòng của clip suýt va chạm.

**Lời thoại:**

> Xem xong video này, bạn bấm Bắt đầu gán nhãn hoặc mở tab Gán nhãn.
> Đây là danh sách video được giao cho bạn, kèm thanh tiến độ.
> Mỗi dòng có số thứ tự, thời lượng, số câu đã làm và trạng thái.
> Bạn có thể tìm theo số thứ tự hoặc tên file.
> Bấm vào một dòng để mở video.

**Dạy:** trang danh sách (`frontend/src/app/annotate/page.tsx`): chỉ thấy video được giao, 10 video mỗi trang, tìm theo số hoặc tên file.
Nút "Bắt đầu gán nhãn" xuất hiện trên `/huong-dan` sau khi xem hết video welcome (`features/welcome-gate`, W2).

## S03 - Trình phát, phím tắt, nhãn video (~24 s)

**Màn hình:** trang gán nhãn. Khung video bên trái.
Bấm vào vùng trống, nhấn Space (phát), Space (dừng), nhấn → bốn lần; khung nút "+0.25s"; khung ô "Vị trí hiện tại".
Khung nhóm nút "Event", bấm "near-miss", chờ "✓ Đã lưu".

**Lời thoại:**

> Video nằm bên trái, các thẻ câu hỏi nằm bên phải.
> Phím cách để phát hoặc dừng.
> Phím mũi tên trái, phải để tua từng bước nhỏ, mặc định 0,25 giây.
> Nếu vừa bấm một nút, hãy bấm ra vùng trống trước khi dùng phím tắt.
> Ô Vị trí hiện tại cho biết bạn đang ở giây thứ mấy.
> Bên dưới là nhãn của cả video: accident nếu có va chạm, near-miss nếu chỉ suýt va chạm.
> Nhãn tự lưu ngay khi bạn bấm.

**Dạy:** phím tắt Space, ←/→; bước 0,25 s (có thể đổi 0,20 s ở ô Step); phím tắt bị bỏ qua khi một nút, ô nhập đang được focus (code `HostedLabeling.tsx`); nhãn video lưu ngay khi bấm.

## S04 - Thẻ câu hỏi và video hướng dẫn bắt buộc (~21 s)

**Màn hình:** cuộn tới thẻ S, khung "Bản nháp Gemini (chỉ để tham khảo)".
Cuộn tới thẻ E rồi thẻ C đang khóa: khung đoạn "Bắt buộc: xem hết video hướng dẫn trước khi gán nhãn nhóm E/C".
Cắt cảnh: ngoài khung hình, ghi nhận đã xem cả hai video hướng dẫn cho tài khoản demo, tải lại trang.

**Lời thoại:**

> Mỗi thẻ bên phải là một nhóm câu hỏi.
> Phần Bản nháp Gemini chỉ để tham khảo và có thể sai; form luôn bắt đầu trống.
> Lần đầu, nhóm E và nhóm C hiện video hướng dẫn bắt buộc thay cho form.
> Bạn xem hết video đó thì form mới mở, trong lúc đó các nhóm khác vẫn làm bình thường.
> Khi có video hướng dẫn mới, bạn sẽ được yêu cầu xem lại.

**Dạy:** `TrainingGate` (xem đến hết mới mở form, các nhóm khác không bị khóa); mã video có phiên bản (`C-v1`, `E-v1`) nên video mới thì xem lại.

## S05 - Nhóm E: khai báo bên nào (~20 s)

**Màn hình:** thẻ E, khung dòng "Khai báo tối đa 2 bên chính...".
Tua video tới 5,5 s, phát tới 7,5 s: xe máy đi tới phía ô tô ghi hình.
Có thể vẽ khung trong hậu kỳ quanh các xe đỗ ven đường, ghi "không khai báo".

**Lời thoại:**

> Bắt đầu với nhóm E, khai báo các bên liên quan.
> Chỉ khai báo tối đa hai bên chính: cặp của va chạm đầu tiên, không có va chạm thì cặp của lần suýt va chạm đầu tiên.
> Xe tự trượt hoặc tự lật mà không có bên nào khác thì chỉ khai báo một bên.
> Xe chỉ có mặt trong khung hình, không phải né và không bị chạm, thì không khai báo.

**Dạy:** `docs/guidelines/E-thuc-the.md` (tối đa 2 bên, K18 một bên); câu cuối lấy từ `docs/guidelines/C-nguyen-nhan.md` mục "Video có nhiều hơn 2 bên".

## S06 - Nhóm E: đặt tên A, B và điền từng bên (~26 s)

**Màn hình:** thẻ E. Bên A: bấm "ô tô", "Camera hành trình: có" (không hiện ô màu).
Bấm "+ Thêm bên B"; bên B: "xe máy", "Màu xe: trắng, xám/bạc". Nút "+ Thêm bên" biến mất.

**Lời thoại:**

> Tiếp theo là tên A và B.
> Ô tô có camera hành trình, tức xe ghi hình, nếu thuộc cặp chính thì là A.
> Không có xe ghi hình thì dừng ở khung đầu tiên cả hai bên cùng xuất hiện: bên trái là A, cùng một cột thì bên trên là A.
> Tên giữ nguyên cả video, kể cả khi hai bên đổi chỗ hoặc bị che.
> Ở video này, A là ô tô ghi hình, nên chọn camera hành trình là có.
> B là xe máy, chọn thêm màu xe.

**Giá trị demo:** A = ô tô, camera hành trình có; B = xe máy, màu trắng, xám/bạc.

**Dạy:** quy tắc đặt tên (`NAMING_RULES` trong `entity-naming.ts`, khớp guideline E); ô tô có camera hành trình không ghi màu; tối đa 2 bên.

## S07 - Nhóm E: loại xe, ô nhắc tên, lưu (~22 s)

**Màn hình:** khung các chip "Loại" của bên B.
Khung ô vàng "Bạn đã kiểm tra kĩ tên A, B chưa?"; bấm "Xem lại video hướng dẫn E": video E mở cạnh clip vài giây, bấm "Đóng".
Bấm "Lưu các bên", chờ "Câu đã lưu (server ghép)".

**Lời thoại:**

> Về loại xe: xe máy gồm cả xe tay ga và xe máy điện không có bàn đạp.
> Xe đạp gồm cả xe đạp điện có bàn đạp, còn mọi xe ba bánh là xe ba gác.
> Không có lựa chọn khác, mỗi bên phải thuộc một loại trong danh sách.
> Ô màu vàng nhắc lại cách đặt tên, và có nút mở lại video hướng dẫn E ngay cạnh video.
> Kiểm tra xong, bấm Lưu các bên.

**Dạy:** định nghĩa loại xe (`features/e-type-definitions`, guideline E); `EntityHint` không chặn lưu.

## S08 - Nhóm C: loại sự kiện và kiểu xung đột (~15 s)

**Màn hình:** thẻ C. Bấm "suýt va chạm". Khung danh sách "Kiểu xung đột" (chia nhóm theo hướng đi). Bấm kiểu demo.

**Lời thoại:**

> Giờ đến nhóm C, nguyên nhân trực tiếp.
> Đầu tiên chọn loại sự kiện, video này chỉ suýt va chạm.
> Lưu ý, xe tự lật hoặc văng khỏi đường cũng tính là va chạm.
> Tiếp theo chọn kiểu xung đột, từ K01 đến K18, xếp theo nhóm hướng đi.

**Giá trị demo:** loại sự kiện "suýt va chạm"; kiểu xung đột K09 "Đi ngược chiều trên làn của người khác".

**Dạy:** thứ tự form C mới (`features/c-role-question`): loại sự kiện, kiểu xung đột, hành động, rồi chủ thể; định nghĩa va chạm gồm xe tự lật (guideline C, ANSI D16.1).

## S09 - Nhóm C: ô nhắc và video so sánh (~22 s)

**Màn hình:** khung ô vàng "Bạn đã xem kĩ chưa? K09 · ..." với các dấu hiệu và dòng "Bạn có nhầm với K08 ... không?".
Bấm "So sánh K09 ↔ K08": video so sánh phát cạnh clip. Khung ô "Đang phân vân với". Bấm "Đóng".

**Lời thoại:**

> Khi bạn chọn một kiểu, ô màu vàng hiện các dấu hiệu cần kiểm tra và hỏi bạn có nhầm với kiểu gần giống không.
> Bấm So sánh để xem video mẫu ngay bên cạnh video đang gán nhãn.
> Ví dụ, K08 là thấy xe chuyển từ làn đúng sang làn đối diện, còn K09 là xe đã đi ngược chiều từ đầu.
> Nếu đang phân vân với một kiểu khác, chọn nó trong ô Đang phân vân với.

**Dạy:** `ConflictHint` (`features/c-reference-hints`); câu ví dụ lấy từ dấu hiệu của cặp K08-K09 trong `frontend/src/lib/references/C.json`.
Cặp này nêu rõ dấu hiệu phân biệt K08 và K09.

## S10 - Nhóm C: hành động, chủ thể, đối tượng (~23 s)

**Màn hình:** bấm "đi thẳng ngược chiều". Khung câu hỏi "Bên nào là xe đi ngược chiều?", bấm B. Khung ô "Đối tượng" đã tự chọn A.

**Lời thoại:**

> Sau đó chọn hành động.
> Câu hỏi về chủ thể đổi theo kiểu xung đột, ví dụ: Bên nào là xe đi ngược chiều?
> Chủ thể là bên mà nếu không có hành động đó thì đã không xảy ra va chạm hay suýt va chạm.
> Không xét lỗi, và xe ghi hình không mặc định là chủ thể.
> Chỉ chọn cả hai bên khi thật sự không phân định được.
> Đối tượng được tự điền là bên còn lại.

**Giá trị demo:** hành động "đi thẳng ngược chiều"; chủ thể B.

**Dạy:** quy tắc chủ thể SHRP 2 trong guideline C (phép thử "nếu không có", không xét lỗi, cả hai bên chỉ khi không phân định được, xe ghi hình không mặc định là chủ thể); đối tượng tự điền khi có 2 bên.

## S11 - Nhóm C: mốc va chạm, câu ghép, lưu (~20 s)

**Màn hình:** tua tới 7,25 s, nhấn → hai lần tới mốc demo, bấm "Đặt mốc va chạm = 7.75s".
Khung "Mốc 7.75s → Start 5.75s, End 8.00s" (End bị cắt ở cuối clip 8 s).
Khung "Câu ghép (xem trước, chưa lưu)" và nút "Sửa câu". Bấm "Lưu", chờ "✓ Đã lưu".

**Lời thoại:**

> Cuối cùng là mốc va chạm.
> Tua tới khung va chạm, nếu suýt va chạm thì tới lúc hai bên gần nhau nhất, rồi bấm Đặt mốc va chạm.
> Start và End tự đặt hai giây trước và sau mốc.
> Bên dưới là câu ghép từ các ô bạn chọn.
> Nút Sửa câu chỉ cho thêm từ nối, không được xóa hay đổi chữ.
> Bấm Lưu.

**Giá trị demo:** mốc 7,75 s, gần cuối clip khi hai bên gần nhau nhất.

**Dạy:** `ImpactKeyframes` (`features/impact-keyframe`), quy ước ±2 s; quy tắc sửa câu ("Chỉ thêm từ nối cho câu mạch lạc; không xóa, đổi hay đảo chữ của câu ghép.").

## S12 - Vì sao E và C quan trọng (~27 s)

**Màn hình:** cuộn qua thẻ O (Mức độ "không va chạm", nhãn "tự suy ra, không sửa", đã lưu sẵn khi lưu C), thẻ R (ô "Clip có đoạn sau sự kiện" = "không", nhãn "gợi ý từ mốc C"), thẻ Prev (nhãn "tự suy ra, không sửa"), thẻ Attr (chip A, B).

**Lời thoại:**

> Vì sao E và C quan trọng? Các nhóm sau lấy dữ liệu từ hai nhóm này.
> Nhóm O suy ra mức độ từ C: suýt va chạm là không va chạm; có va chạm thì bạn tích các dấu hiệu thấy rõ, mức độ là mức cao nhất.
> Nhóm R lấy chủ thể và đối tượng từ C, và gợi ý ô đầu tiên từ mốc End.
> Nhóm Prev tự suy ra từ C, bạn không sửa được.
> Nhóm Attr chọn bên từ danh sách E.
> Nếu E hoặc C sai, các nhóm này sai theo.

**Dạy:** O.v2 (`features/o-signs-max-grouped`: dấu hiệu chia nhóm theo mức, mức = mức cao nhất), R gợi ý từ End (End + 2 s), Prev chỉ đọc, Attr chọn từ E.
Clip suýt va chạm không hiện danh sách dấu hiệu O; xem câu hỏi mở Q3.

## S13 - Hoàn tất video (~15 s)

**Màn hình:** điền nhanh thẻ S (7 ô) và Attr (bên, mốc va chạm), bấm Lưu từng thẻ; lưu R với gợi ý.
Cuộn tới thẻ N: "Tự tổng hợp · đã hoàn tất". Khung nút "Hoàn thành video", bấm.
Tiếp tục quay để thấy trang tự mở video K18 kế tiếp.

**Lời thoại:**

> Điền các nhóm còn lại như S và Attr, rồi bấm Lưu ở từng thẻ.
> Khi đủ bảy nhóm, câu N tự tổng hợp.
> Nút Hoàn thành video chỉ sáng khi đã chọn nhãn video và lưu đủ các câu.
> Bấm vào, trang tự mở video kế tiếp.

**Giá trị demo:** S = tạnh ráo, ban ngày, đường hai chiều không có dải phân cách, mặt đường khô, mật độ xe thưa, đoạn đường thẳng, mặt đường nhựa.
Attr = bên B.

**Dạy:** điều kiện nút Hoàn thành (nhãn video + đủ 8 câu); N tự sinh từ 7 nhóm; tự mở video kế tiếp.

## S14 - Tóm tắt và nơi tìm trợ giúp (~17 s)

**Màn hình:** cảnh quay mới từ `/annotate`, bấm tab "Hướng dẫn" (`/huong-dan`, đang được xây ở `features/welcome-gate`), khung các mục "Video welcome (bắt buộc)", "Hướng dẫn nhóm C", "Hướng dẫn nhóm E".
Kết bằng thẻ tóm tắt: "Xem kỹ video · E rồi C trước · Hoàn thành video" và "Tab Hướng dẫn: video welcome, video nhóm C, nhóm E".

**Lời thoại:**

> Tóm lại: xem kỹ video, điền E rồi C trước, rồi các nhóm còn lại, chọn nhãn video và bấm Hoàn thành.
> Bạn đang xem video này ở tab Hướng dẫn, nơi có cả video hướng dẫn nhóm C và nhóm E; cần xem lại thì mở tab này.
> Có thắc mắc, hãy hỏi admin của nhóm.
> Chúc bạn làm việc hiệu quả.

**Dạy:** tab Hướng dẫn (`features/welcome-gate`, đang xây; kiểm lại tên tab và các mục khi quay).
Annotator xem video welcome này lần đầu ngay trên tab đó: chưa xem hết thì `/annotate` chuyển về `/huong-dan` và không lưu được câu nào.
