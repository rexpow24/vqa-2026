# P1 nhóm O: phần prompt riêng của nhóm (bản nháp để duyệt)

Trạng thái: bản nháp, chưa gọi API lần nào.
Các mục dưới đây được viết để dán vào [p1-prompt.md](../p1-prompt.md): mục 1 vào mục 4 của file đó, mục 2 vào mục 6, mục 3 và 4 thành các mục "Chạy thử" mới.
Link trong dòng mở đầu codebook viết theo vị trí của p1-prompt.md, nên chỉ đúng sau khi dán.
Prompt hệ thống (mục 3) và schema (mục 5) của p1-prompt.md giữ nguyên, trừ đề xuất ở mục 5 dưới đây.

## 1. Codebook O

Nhóm O, lấy từ [O-hau-qua.md](../../docs/guidelines/O-hau-qua.md):

```json
{
  "mức độ": {"lựa chọn": ["không va chạm", "va chạm nhẹ", "va chạm vừa", "va chạm mạnh", "không rõ"], "ghi chú": "mỗi dấu hiệu nhìn thấy thuộc đúng một mức độ (bảng ở ô dấu hiệu nhìn thấy); câu nêu dấu hiệu thì mức độ là mức của dấu hiệu đó; không rõ khi va chạm xảy ra ngoài khung hình hoặc bị che hoàn toàn; suýt va chạm mà tránh được thì là không va chạm; suýt va chạm nhưng bên né ngã, trượt hoặc chạm thực thể khác thì ghi mức độ theo hậu quả nhìn thấy"},
  "dấu hiệu nhìn thấy": {"lựa chọn": ["không có", "chạm quẹt, vẫn đứng yên", "chạm quẹt, vẫn đi tiếp", "lệch hướng", "dừng đột ngột", "xe ngã", "người ngã", "bị lật", "bị văng", "biến dạng rõ", "người nằm trên đường"], "ghi chú": "dấu hiệu theo mức độ: không va chạm: \"không có\"; va chạm nhẹ: \"chạm quẹt, vẫn đứng yên\", \"chạm quẹt, vẫn đi tiếp\"; va chạm vừa: \"lệch hướng\", \"dừng đột ngột\", \"xe ngã\", \"người ngã\"; va chạm mạnh: \"bị lật\", \"bị văng\", \"biến dạng rõ\", \"người nằm trên đường\"; chọn dấu hiệu nặng nhất nhìn thấy; không ghi thương tích hay tử vong, chỉ ghi điều nhìn thấy, ví dụ người nằm trên đường"}
}
```

Hai ô, nhãn chép nguyên văn từ hai bảng của guideline.
Phần lớn ghi chú cũng là câu của guideline; riêng vế "câu nêu dấu hiệu thì mức độ là mức của dấu hiệu đó" là mình suy từ bảng, cần duyệt (mục 6, quyết định 1).

### Cách xử lý các bên

Không map các bên.
Guideline O nói các bên "được tự điền từ cặp chủ thể và đối tượng của Nhóm C", nên annotator không chọn gì ở đây, và không có độ phủ nào để đo.
Tên bên trong câu đi theo đoạn chứa nó: nằm trong bằng chứng của ô (ví dụ "Xe tải màu xám lật nghiêng hoàn toàn"), hoặc trong đoạn ngoài codebook mà nó thuộc về.
Không tách tên bên thành một mục "nhóm khác: E" riêng, để danh sách ngoài codebook chỉ còn những gì thật sự nằm ngoài O.
Cách này không cần sửa prompt hệ thống; hai few-shot dưới đây làm mẫu.

### Hình dạng codebook và script

`dấu hiệu nhìn thấy` thật ra phụ thuộc `mức độ` (mỗi mức có danh sách dấu hiệu riêng).
Script hiện chỉ hiểu danh sách phẳng, nên ở đây dùng hình dạng `{"lựa chọn": [...], "ghi chú": "..."}` cho cả hai ô, bảng phụ thuộc nằm trong ghi chú.
Như vậy script chạy được ngay, nhưng không bắt được cặp sai (ví dụ "va chạm nhẹ" với "bị lật").
Quy tắc kiểm tra cần thêm nằm ở mục 6, quyết định 2.

## 2. Few-shot: 2 câu thật

Mỗi câu gửi thành một cặp lượt như mục 6 của p1-prompt.md.
Chọn để phủ các trường hợp dễ sai: hư hỏng chỉ đoán ("có thể") phải ra ngoài codebook, "quẹt" không đủ chi tiết để chọn một trong hai lựa chọn chạm quẹt, và câu không va chạm có lẫn hành động né của C (dừng lại, đánh lái) dễ bị map nhầm thành dấu hiệu "dừng đột ngột".

### 2.1. Nhóm O, video #12 (4 người, giữ nguyên draft)

```text
Nhóm: O
Câu hỏi: Hậu quả của vụ va chạm quan sát được trong video là gì?
Câu trả lời: Va chạm nhẹ (quẹt hông), có thể gây trầy xước hoặc móp nhẹ bề mặt vỏ xe của cả hai phương tiện.
```

```json
{
  "ô": {
    "mức độ":             {"trạng thái": "M", "giá trị": "va chạm nhẹ", "bằng chứng": "Va chạm nhẹ", "cụm không khớp": null},
    "dấu hiệu nhìn thấy": {"trạng thái": "T", "giá trị": null,          "bằng chứng": "quẹt hông",   "cụm không khớp": null}
  },
  "ngoài codebook": [
    {"đoạn": "có thể gây trầy xước hoặc móp nhẹ bề mặt vỏ xe của cả hai phương tiện", "loại": "suy đoán"}
  ],
  "ghi chú": "Dấu hiệu: quẹt hông là chạm quẹt, nhưng câu không nói các xe vẫn đứng yên hay vẫn đi tiếp, nên là T. Trầy xước, móp chỉ là đoán (có thể), nên không map."
}
```

### 2.2. Nhóm O, video #2 (1 người)

```text
Nhóm: O
Câu hỏi: Hậu quả của vụ va chạm quan sát được là gì?
Câu trả lời: Xe ô tô phải dừng lại đánh lái vào sát lề để tránh va chạm với xe ba gác. Sau đó hai xe vẫn tiếp tục di chuyển không có va chạm hay thương tích gì.
```

```json
{
  "ô": {
    "mức độ":             {"trạng thái": "M", "giá trị": "không va chạm", "bằng chứng": "không có va chạm", "cụm không khớp": null},
    "dấu hiệu nhìn thấy": {"trạng thái": "M", "giá trị": "không có",      "bằng chứng": "không có va chạm", "cụm không khớp": null}
  },
  "ngoài codebook": [
    {"đoạn": "Xe ô tô phải dừng lại đánh lái vào sát lề", "loại": "nhóm khác: C"},
    {"đoạn": "để tránh va chạm với xe ba gác", "loại": "ý định"},
    {"đoạn": "Sau đó hai xe vẫn tiếp tục di chuyển", "loại": "nhóm khác: R"},
    {"đoạn": "thương tích gì", "loại": "suy đoán"}
  ],
  "ghi chú": "Dừng lại, đánh lái là cách né của nhóm C, không phải dấu hiệu dừng đột ngột của nhóm O, vì câu nói không có va chạm."
}
```

## 3. Chạy thử 1: input thật, nhóm O, hai dấu hiệu cùng mức

Video #37, câu của Huỳnh Trung (1 người viết câu này; 6 người khác viết bản gần giống, "hai người trên xe" thay cho "cả hai người điều khiển trên xe").
Điểm khởi đầu là bản map tay trong [trial-new-groups.md](../trial-new-groups.md): "Va chạm vừa, người hoặc xe ngã (M). 'Có thể bị trầy xước' là đoán, bị bỏ."

```text
Nhóm: O
Câu hỏi: Hậu quả va chạm và mức độ hư hỏng quan sát được là gì?
Câu trả lời: Cả hai xe máy bị đổ, cả hai người điều khiển trên xe ngã xuống đường, phương tiện có thể bị trầy xước nhẹ.
```

Output mong muốn:

```json
{
  "ô": {
    "mức độ":             {"trạng thái": "M", "giá trị": "va chạm vừa", "bằng chứng": "cả hai người điều khiển trên xe ngã xuống đường", "cụm không khớp": null},
    "dấu hiệu nhìn thấy": {"trạng thái": "M", "giá trị": "người ngã",   "bằng chứng": "cả hai người điều khiển trên xe ngã xuống đường", "cụm không khớp": null}
  },
  "ngoài codebook": [
    {"đoạn": "phương tiện có thể bị trầy xước nhẹ", "loại": "suy đoán"}
  ],
  "ghi chú": "Câu nêu hai dấu hiệu cùng mức va chạm vừa: xe ngã (Cả hai xe máy bị đổ) và người ngã. Guideline chưa xếp hạng trong cùng một mức; chọn người ngã, dấu hiệu đứng sau trong danh sách."
}
```

Điểm cần bạn xem:

- Bản map tay dùng nhãn cũ "người hoặc xe ngã"; quyết định 2 ngày 2026-11-14 đã tách thành hai nhãn, nên giờ câu này có hai dấu hiệu cùng mức và phải chọn một (mục 6, quyết định 5).
- "ngã xuống đường" là người ngã, không phải người nằm trên đường (mức mạnh): câu nói ngã, không nói nằm lại.
- "Cả hai xe máy bị đổ" không vào ngoài codebook vì nó thuộc ô dấu hiệu, chỉ thua ở bước chọn dấu hiệu nặng nhất; ghi chú nêu lại để không mất.

## 4. Chạy thử 2: input thật, nhóm O, mức độ suy từ dấu hiệu

Video #10, câu của Huỳnh Trung (5 người viết đúng câu này, đều giữ nguyên draft).

```text
Nhóm: O
Câu hỏi: Hậu quả va chạm và mức độ hư hỏng quan sát được là gì?
Câu trả lời: Xe tải màu xám lật nghiêng hoàn toàn xuống rãnh bên đường.
```

Output mong muốn:

```json
{
  "ô": {
    "mức độ":             {"trạng thái": "M", "giá trị": "va chạm mạnh", "bằng chứng": "Xe tải màu xám lật nghiêng hoàn toàn", "cụm không khớp": null},
    "dấu hiệu nhìn thấy": {"trạng thái": "M", "giá trị": "bị lật",       "bằng chứng": "Xe tải màu xám lật nghiêng hoàn toàn", "cụm không khớp": null}
  },
  "ngoài codebook": [
    {"đoạn": "xuống rãnh bên đường", "loại": "khác"}
  ],
  "ghi chú": null
}
```

Điểm cần bạn xem:

- Câu không có chữ "va chạm mạnh"; mức độ là M vì bảng guideline xếp "bị lật" vào va chạm mạnh (mục 6, quyết định 1). Bản map tay cũng ghi "Va chạm mạnh, xe lật (M)".
- Nhãn event của video là near-miss, nhưng theo guideline C, xe tự lật vẫn là va chạm, nên mức độ không phải "không va chạm".
- "xuống rãnh bên đường" là vị trí xe nằm sau khi lật, không có ô nào trong O, nên vào "khác".

## 5. Đề xuất sửa prompt hệ thống

Thêm một loại vào quy tắc 8 của mục 3, ngay sau dòng "ý định":

```text
   - "suy đoán" khi câu nói điều mắt không thấy được về hậu quả: thương tích, tử vong (kể cả khi câu nói là không có), hoặc hư hỏng mà câu chỉ đoán ("có thể", "có khả năng").
```

Lý do: guideline O ghi "Không ghi thương tích hay tử vong. Chỉ ghi điều nhìn thấy".
Trong dữ liệu, 7 câu khác nhau (16 lượt) đoán hư hỏng hoặc thương tích bằng "có thể" hoặc "có khả năng", và 4 câu (10 lượt) nói thương tích hoặc tử vong.
Một bẫy: "có thể tự đứng dậy" (5 câu, 9 lượt) nghĩa là đã đứng dậy được, không phải đoán; đó là thông tin nhóm R, không phải "suy đoán".
Gộp chúng vào "khác" thì báo cáo không đếm được annotator viết điều guideline cấm bao nhiêu lần, là thứ cần cho buổi rà guideline.
Dòng này không đổi gì cho nhóm S và C, vì câu của hai nhóm đó gần như không nói về hậu quả.
Nếu bạn không duyệt, thay "suy đoán" bằng "khác" trong ba output ở mục 2.1, 2.2 và 3.

## 6. Cần quyết

1. Mức độ suy từ dấu hiệu: câu chỉ nêu dấu hiệu (ví dụ "xe tải lật") thì mức độ là M theo bảng của guideline, bằng chứng là đoạn nêu dấu hiệu. Đề xuất: duyệt, vì codebook chứa được câu đó và bản map tay #37, #10 đã làm vậy.
2. Kiểm tra cặp mức độ và dấu hiệu: script hiện không bắt được cặp sai. Đề xuất: trước khi chạy toàn bộ, thêm vào `cell_specs` một hình dạng ô phụ thuộc `"dấu hiệu nhìn thấy": {"theo": "mức độ", "lựa chọn": {"không va chạm": ["không có"], "va chạm nhẹ": [...], "va chạm vừa": [...], "va chạm mạnh": [...]}}`, với quy tắc: dấu hiệu là M thì ô "theo" phải là M, giá trị khác "không rõ", và dấu hiệu nằm trong danh sách của giá trị đó; mức độ là "không rõ", T hoặc K thì dấu hiệu không được là M; báo cáo ghi giá trị dạng "va chạm vừa: người ngã". Hình dạng này tổng quát hơn cặp kiểu xung đột và hành động của C nên có thể dùng lại.
3. Không map các bên (mục 1). Đề xuất: giữ, vì các bên tự điền từ C.
4. Dấu hiệu không ghi bên nào chịu: câu như "Xe máy bị đổ, xe ô tô đen bị trầy nhẹ" nói rõ bên nào, nhưng mẫu câu "[Chủ thể] và [đối tượng] [1], [2]" làm mất thông tin đó. Đề xuất: P1 không map phần này; xem lại ở guideline O sau khi có báo cáo P1.
5. Hai dấu hiệu cùng mức (#37: xe ngã và người ngã), guideline chưa nói chọn cái nào. Đề xuất: coi thứ tự trong danh sách là tăng dần độ nặng, như giữa các mức, và thêm vào ghi chú ô dấu hiệu câu "cùng mức thì chọn dấu hiệu đứng sau trong danh sách".
6. Chữ về hư hỏng không phải dấu hiệu: "hư hỏng nhẹ", "trầy xước", "móp", "hư hỏng nặng" (67 câu khác nhau có hư hại hoặc hư hỏng, 29 có trầy hoặc xước, 14 có móp). Đề xuất: mức độ chỉ là M khi chữ nhẹ, vừa, mạnh đi với va chạm ("va chạm nhẹ"), còn "hư hỏng nhẹ" thì mức độ T kèm bằng chứng và dấu hiệu K với cụm đó; nếu duyệt, thêm vào ghi chú ô mức độ câu "chữ nhẹ, nặng nói về hư hỏng, không nói về va chạm, thì không chọn mức độ". Hệ quả: độ phủ ô dấu hiệu sẽ thấp, và đó chính là tín hiệu danh sách dấu hiệu thiếu lựa chọn về hư hỏng ngoài "biến dạng rõ".
7. "Không có hư hại" (12 câu khác nhau, 17 lượt): không hư hại chưa chắc là không va chạm. Đề xuất: mức độ T kèm bằng chứng, dấu hiệu T, không map thành "không va chạm".
8. Suýt va chạm mà một bên tự gặp nạn, câu vẫn viết "không có va chạm" (ví dụ #29 "không có chạm xảy ra nhưng xe bán tải màu đen đi lệch khỏi đường", #35, #59). Đề xuất: theo guideline, mức độ đi theo dấu hiệu nhìn thấy, ghi chú nêu mâu thuẫn; nhãn "va chạm vừa" cho tình huống không chạm đọc lạ, nên xem lại cách đặt tên mức ở guideline O.
9. Câu nêu mức độ trái với dấu hiệu (ví dụ #11 "Xe máy bị đổ, người lái xe máy ngã xuống đường, va chạm nhẹ với người đi xe đạp"). Đề xuất: dấu hiệu nặng nhất quyết định mức độ, ghi chú nêu mâu thuẫn.
10. "Mất thăng bằng", "loạng choạng", "lạng tay lái" (16 câu khác nhau) không khớp chữ nào; gần nhất là "lệch hướng". Đề xuất: để LLM ghi K, không thêm quy tắc, để báo cáo P1 cho thấy có cần thêm lựa chọn hay không.
11. Loại "suy đoán" ở mục 5. Đề xuất: duyệt.

## 7. Số liệu

Từ `answers-agreement-202611140458.csv`, nhóm O, `assignment_status = completed`, bỏ `NOT_ANSWERABLE`, gộp theo `draft_id` và câu đã chuẩn hóa khoảng trắng (đúng như `make_units` của script):

| Số | Giá trị |
| --- | --- |
| Lượt trả lời đưa vào | 371 (bỏ 21 lượt NOT_ANSWERABLE) |
| Câu khác nhau (unit) | 295 |
| Video | 60 |
| Câu hỏi khác nhau | 19 cách viết |
| Lô 7 câu | 43 lần gọi, thêm 1 lần chạy thử |

Tỉ lệ câu khác nhau trên lượt cao (295 trên 371) vì nhóm O có 269 lượt DISAGREE, annotator viết lại câu của mình.
