# P1 nhóm Prev: phần prompt riêng của nhóm (bản nháp để duyệt)

Trạng thái: chờ duyệt theo nguyên tắc 7 của [plan.md](../plan.md).
Chưa gọi API lần nào.
Prompt hệ thống (mục 3), schema (mục 5) và cách chạy dùng chung với [p1-prompt.md](../p1-prompt.md); file này chỉ thêm phần của nhóm Prev.
Khi duyệt xong, mục 1 dán vào mục 4 của `p1-prompt.md`, hai câu ở mục 2 thành hai mục mới của mục 6, mục 3 và 4 thành hai mục "Chạy thử" mới.

## 1. Codebook Prev

Nhóm Prev, lấy từ [Prev-phong-ngua.md](../../docs/guidelines/Prev-phong-ngua.md):

```json
{
  "bên thứ nhất": "bên đầu tiên mà câu trả lời khuyên, theo thứ tự câu viết; ghi mô tả thực thể (loại, màu, người điều khiển) như câu viết, kể cả khi chỉ là \"người lái xe\", \"tài xế\"; câu khuyên chung một hành động cho cả hai bên (\"cả hai bên\", \"các xe\") thì ghi cả cụm vào đây; câu không nêu bên nào thì T, và các hành động vẫn ghi vào ô của bên thứ nhất; chỉ lấy bên từ câu trả lời, không lấy từ câu hỏi",
  "hành động chính bên thứ nhất": {"lựa chọn": ["giảm tốc", "giữ khoảng cách an toàn", "quan sát và nhường đường", "chỉ chuyển làn khi an toàn", "đi đúng phần đường", "giữ ổn định hướng lái", "dừng quan sát trước khi băng qua"], "ghi chú": "hành động đầu tiên câu khuyên bên này. Quy tắc chung cho cả bốn ô hành động: (a) không có lựa chọn \"khác\": hành động cụ thể không khớp lựa chọn nào (ví dụ đội mũ bảo hiểm, bật xi nhan, kiểm tra xe, bấm còi) thì K; (b) lời khuyên chung không nêu hành động cụ thể (ví dụ \"tuân thủ luật giao thông\", \"cẩn thận hơn\", \"làm chủ tốc độ\", \"sẵn sàng xử lý tình huống\", \"quan sát\" đứng riêng) không chiếm ô nào, đưa vào ngoài codebook với loại \"lời khuyên chung\"; (c) \"quan sát\" gắn với một thao tác thì chọn lựa chọn của thao tác đó: rẽ, quay đầu, ra từ đường nhánh, lùi xe, nhường đường là \"quan sát và nhường đường\"; chuyển làn, vượt, len là \"chỉ chuyển làn khi an toàn\"; băng qua, sang đường là \"dừng quan sát trước khi băng qua\"; (d) lời khuyên tránh một hành vi (ví dụ \"không đi ngược chiều\", \"không lấn làn\") map vào lựa chọn tương ứng, không đưa sang nhóm V; (e) hoàn cảnh đi kèm hành động (ví dụ \"khi đi qua ngã tư\", \"trên đường ướt\") không thuộc ô hành động, đưa vào ngoài codebook theo quy tắc 8"},
  "hành động thêm bên thứ nhất": {"lựa chọn": ["giảm tốc", "giữ khoảng cách an toàn", "quan sát và nhường đường", "chỉ chuyển làn khi an toàn", "đi đúng phần đường", "giữ ổn định hướng lái", "dừng quan sát trước khi băng qua"], "ghi chú": "hành động thứ hai câu khuyên bên này, khác hành động chính; câu chỉ khuyên một hành động thì T; hành động thứ ba trở đi đưa vào ngoài codebook với loại \"hành động thứ ba\""},
  "bên thứ hai": "bên thứ hai mà câu trả lời khuyên một hành động riêng, khác bên thứ nhất, cùng cách ghi như bên thứ nhất; câu chỉ khuyên một bên, hoặc khuyên chung một hành động cho cả hai bên, thì T",
  "hành động chính bên thứ hai": {"lựa chọn": ["giảm tốc", "giữ khoảng cách an toàn", "quan sát và nhường đường", "chỉ chuyển làn khi an toàn", "đi đúng phần đường", "giữ ổn định hướng lái", "dừng quan sát trước khi băng qua"], "ghi chú": "như hành động chính bên thứ nhất, cho bên thứ hai; bên thứ hai là T thì ô này là T"},
  "hành động thêm bên thứ hai": {"lựa chọn": ["giảm tốc", "giữ khoảng cách an toàn", "quan sát và nhường đường", "chỉ chuyển làn khi an toàn", "đi đúng phần đường", "giữ ổn định hướng lái", "dừng quan sát trước khi băng qua"], "ghi chú": "như hành động thêm bên thứ nhất, cho bên thứ hai; bên thứ hai là T thì ô này là T"}
}
```

### Cách biểu diễn hai bên

Guideline Prev có ba ô: bên (một bên hoặc cả hai bên), hành động chính và hành động thêm, hai ô sau "mỗi bên một ô".
Một câu thật có thể khuyên hai bên hai việc khác nhau, ví dụ video #20: xe máy nên nhường đường, ô tô nên giảm tốc.
Script chỉ hiểu các ô phẳng, nên codebook trên trải guideline thành sáu ô, mỗi bên ba ô:

- Ô mô tả bên là ô chữ tự do, cùng kiểu với "chủ thể" và "đối tượng" của nhóm C, và cùng cách đặt tên "bên thứ nhất", "bên thứ hai" với bản nháp nhóm R ([p1-R.md](p1-R.md)).
- Bốn ô hành động là danh sách lựa chọn, chép nguyên văn ô 2 của guideline, trừ "khác" (Cần quyết, mục 2).
- Ô 1 của guideline ("một bên" hay "cả hai bên") không thành ô riêng: nó suy ra được từ ô "bên thứ hai" có là T hay không.
- Các bên được tách theo thứ tự câu viết, không theo bên góp phần chính ở Attr: LLM chỉ thấy câu Prev, không thấy câu Attr hay C, nên không biết bên nào là chủ thể. Bên được ghép với thực thể E ở bước P2, như cách bản nháp R làm.
- Độ phủ có nghĩa ở bốn ô hành động. Hai ô mô tả bên là ô tự do nên luôn là M hoặc T.

Mọi ô đều thuộc các kiểu `cell_specs()` đã hiểu (chuỗi cho ô tự do, danh sách có ghi chú), nên không cần sửa script để chạy.
Script không kiểm hai ràng buộc của guideline: hành động thêm khác hành động chính, và bên thứ hai là T thì hai ô hành động của nó là T (Cần quyết, mục 9).

## 2. Few-shot: 2 câu thật

Chọn để phủ hai trường hợp dễ sai nhất: câu khuyên hai bên hai việc khác nhau, kèm một lời khuyên tránh hành vi vi phạm; và câu không nêu bên nào, có lời khuyên chung và hoàn cảnh đi kèm.
Không dùng video #20, #37, #10.

### 2.1. Nhóm Prev, video #8 (1 người, giữ nguyên draft)

```text
Nhóm: Prev
Câu hỏi: Lẽ ra người liên quan nên làm gì để tránh va chạm này?
Câu trả lời: Tài xế xe tải nên giảm tốc độ và quan sát kỹ trước khi vượt; người đi xe đạp không nên đi ngược chiều.
```

```json
{
  "ô": {
    "bên thứ nhất":                {"trạng thái": "M", "giá trị": "tài xế xe tải",              "bằng chứng": "Tài xế xe tải",              "cụm không khớp": null},
    "hành động chính bên thứ nhất": {"trạng thái": "M", "giá trị": "giảm tốc",                   "bằng chứng": "giảm tốc độ",                "cụm không khớp": null},
    "hành động thêm bên thứ nhất":  {"trạng thái": "M", "giá trị": "chỉ chuyển làn khi an toàn", "bằng chứng": "quan sát kỹ trước khi vượt", "cụm không khớp": null},
    "bên thứ hai":                 {"trạng thái": "M", "giá trị": "người đi xe đạp",            "bằng chứng": "người đi xe đạp",            "cụm không khớp": null},
    "hành động chính bên thứ hai":  {"trạng thái": "M", "giá trị": "đi đúng phần đường",         "bằng chứng": "không nên đi ngược chiều",   "cụm không khớp": null},
    "hành động thêm bên thứ hai":   {"trạng thái": "T", "giá trị": null,                         "bằng chứng": null,                         "cụm không khớp": null}
  },
  "ngoài codebook": [],
  "ghi chú": "Câu khuyên hai bên, tách bằng dấu chấm phẩy. Quan sát trước khi vượt thuộc chỉ chuyển làn khi an toàn. Không nên đi ngược chiều là lời khuyên đi đúng phần đường, không đưa sang nhóm V."
}
```

### 2.2. Nhóm Prev, video #19 (7 người, giữ nguyên draft)

```text
Nhóm: Prev
Câu hỏi: Người tham gia giao thông nên làm gì để tránh những tình huống tương tự?
Câu trả lời: Nên giảm tốc độ, chú ý quan sát và sẵn sàng xử lý tình huống khi đi vào đường hẹp hoặc góc khuất.
```

```json
{
  "ô": {
    "bên thứ nhất":                {"trạng thái": "T", "giá trị": null,       "bằng chứng": null,          "cụm không khớp": null},
    "hành động chính bên thứ nhất": {"trạng thái": "M", "giá trị": "giảm tốc", "bằng chứng": "giảm tốc độ", "cụm không khớp": null},
    "hành động thêm bên thứ nhất":  {"trạng thái": "T", "giá trị": null,       "bằng chứng": null,          "cụm không khớp": null},
    "bên thứ hai":                 {"trạng thái": "T", "giá trị": null,       "bằng chứng": null,          "cụm không khớp": null},
    "hành động chính bên thứ hai":  {"trạng thái": "T", "giá trị": null,       "bằng chứng": null,          "cụm không khớp": null},
    "hành động thêm bên thứ hai":   {"trạng thái": "T", "giá trị": null,       "bằng chứng": null,          "cụm không khớp": null}
  },
  "ngoài codebook": [
    {"đoạn": "chú ý quan sát", "loại": "lời khuyên chung"},
    {"đoạn": "sẵn sàng xử lý tình huống", "loại": "lời khuyên chung"},
    {"đoạn": "khi đi vào đường hẹp hoặc góc khuất", "loại": "nhóm khác: S"}
  ],
  "ghi chú": "Câu không nêu bên nào nên bên thứ nhất là T, hành động vẫn ghi vào bên thứ nhất. Chú ý quan sát đứng riêng, không gắn thao tác nào, nên là lời khuyên chung và không chiếm ô hành động thêm."
}
```

## 3. Chạy thử 1: input thật, nhóm Prev, hai bên hai hành động

Video #20 (7 người viết câu này, giữ nguyên draft):

```text
Nhóm: Prev
Câu hỏi: Lẽ ra người lái/người liên quan nên làm gì để tránh va chạm này?
Câu trả lời: Người đi xe máy nên quan sát kỹ và nhường đường cho xe đi thẳng; tài xế ô tô nên giảm tốc độ khi tới gần khu vực có vạch kẻ đường.
```

Output mong muốn:

```json
{
  "ô": {
    "bên thứ nhất":                {"trạng thái": "M", "giá trị": "người đi xe máy",          "bằng chứng": "Người đi xe máy",                              "cụm không khớp": null},
    "hành động chính bên thứ nhất": {"trạng thái": "M", "giá trị": "quan sát và nhường đường", "bằng chứng": "quan sát kỹ và nhường đường cho xe đi thẳng", "cụm không khớp": null},
    "hành động thêm bên thứ nhất":  {"trạng thái": "T", "giá trị": null,                       "bằng chứng": null,                                           "cụm không khớp": null},
    "bên thứ hai":                 {"trạng thái": "M", "giá trị": "tài xế ô tô",              "bằng chứng": "tài xế ô tô",                                  "cụm không khớp": null},
    "hành động chính bên thứ hai":  {"trạng thái": "M", "giá trị": "giảm tốc",                 "bằng chứng": "giảm tốc độ",                                  "cụm không khớp": null},
    "hành động thêm bên thứ hai":   {"trạng thái": "T", "giá trị": null,                       "bằng chứng": null,                                           "cụm không khớp": null}
  },
  "ngoài codebook": [
    {"đoạn": "khi tới gần khu vực có vạch kẻ đường", "loại": "nhóm khác: S"}
  ],
  "ghi chú": null
}
```

Điểm cần bạn xem:

- Bản map tay ở [trial-new-groups.md](../trial-new-groups.md) ghi vế ô tô giảm tốc là K, vì lúc đó Prev chỉ có một bên.
  Sau quyết định 4 (một hoặc cả hai bên), vế này là M ở bên thứ hai.
- "khi tới gần khu vực có vạch kẻ đường" là hoàn cảnh, xếp vào nhóm S theo quy tắc 8; codebook S hiện không có ô nào chứa vạch kẻ đường, nên ở nhóm S nó cũng sẽ là phần ngoài codebook.

## 4. Chạy thử 2: input thật, nhóm Prev, một bên hai hành động

Video #10 (6 người viết câu này, giữ nguyên draft):

```text
Nhóm: Prev
Câu hỏi: Lẽ ra người lái/người liên quan nên làm gì để tránh va chạm này?
Câu trả lời: Người lái xe tải nên giảm tốc độ và giữ khoảng cách an toàn khi thấy các phương tiện phía trước đang dừng.
```

Output mong muốn:

```json
{
  "ô": {
    "bên thứ nhất":                {"trạng thái": "M", "giá trị": "người lái xe tải",        "bằng chứng": "Người lái xe tải",        "cụm không khớp": null},
    "hành động chính bên thứ nhất": {"trạng thái": "M", "giá trị": "giảm tốc",                "bằng chứng": "giảm tốc độ",             "cụm không khớp": null},
    "hành động thêm bên thứ nhất":  {"trạng thái": "M", "giá trị": "giữ khoảng cách an toàn", "bằng chứng": "giữ khoảng cách an toàn", "cụm không khớp": null},
    "bên thứ hai":                 {"trạng thái": "T", "giá trị": null,                      "bằng chứng": null,                      "cụm không khớp": null},
    "hành động chính bên thứ hai":  {"trạng thái": "T", "giá trị": null,                      "bằng chứng": null,                      "cụm không khớp": null},
    "hành động thêm bên thứ hai":   {"trạng thái": "T", "giá trị": null,                      "bằng chứng": null,                      "cụm không khớp": null}
  },
  "ngoài codebook": [
    {"đoạn": "khi thấy các phương tiện phía trước đang dừng", "loại": "nhóm khác: C"}
  ],
  "ghi chú": null
}
```

Điểm cần bạn xem:

- Khớp bản map tay: hành động chính giảm tốc, hành động thêm giữ khoảng cách an toàn, theo thứ tự câu viết.
- "khi thấy các phương tiện phía trước đang dừng" là tình huống của nhóm C (xe phía trước dừng, K01), nhưng quy tắc 8 hiện không liệt kê C trong các nhóm khác, nên model có thể ghi "khác"; mục 5 đề xuất thêm C vào danh sách.

## 5. Đề xuất sửa prompt hệ thống

Phần lớn quy tắc riêng của Prev nằm trong "ghi chú" của các ô trong codebook, vì prompt hệ thống dùng chung cho mọi nhóm.
Hai chỗ dưới đây chạm vào quy tắc 8 của mục 3, nên cần sửa ở đó; cả hai đều chỉ thêm chữ, nhưng sẽ đổi prompt của S và C nếu chạy lại hai nhóm đó.

Sửa 1, dòng đầu của quy tắc 8, thay danh sách nhóm:

> "nhóm khác: <mã nhóm>" khi đó là thông tin của nhóm khác (S bối cảnh, E thực thể, C nguyên nhân, V vi phạm, Attr quy lỗi, O kết quả, R ứng xử sau sự kiện, Prev phòng ngừa), trừ nhóm đang map.

Lý do: câu Prev hay nhắc lại tình huống ở C ("khi thấy các phương tiện phía trước đang dừng", "khi xe khác có tín hiệu xin chuyển làn"), mà danh sách hiện tại không có C.

Sửa 2, thêm một dòng vào quy tắc 8, ngay trước dòng "khác":

> - "lời khuyên chung" khi câu khuyên chung chung, không nêu hành động cụ thể (ví dụ "tuân thủ luật giao thông", "cẩn thận hơn").

Lý do: ghi chú của codebook Prev đã dùng loại này; đưa vào danh sách loại của quy tắc 8 thì model ít khi đổi nó thành "khác", và báo cáo mục 5 gom được các cụm này riêng.
Loại "hành động thứ ba" chỉ dùng cho Prev nên để trong ghi chú của codebook, không đưa vào quy tắc 8.

## 6. Cần quyết

1. Sáu ô phẳng (bên thứ nhất, hành động chính, hành động thêm, rồi ba ô tương ứng của bên thứ hai), không có ô riêng cho "một bên hay cả hai bên"; mình đề nghị duyệt, vì ô đó suy ra được từ ô "bên thứ hai" và script không cần sửa.
2. Bỏ lựa chọn "khác" khỏi codebook gửi LLM, để hành động cụ thể không khớp thành K và ghi cụm; mình đề nghị duyệt, vì giữ "khác" thì mọi câu đều thành M và độ phủ luôn 100%, trong khi plan.md đo tỉ lệ "Khác" ở P6 chứ không ở P1.
3. "quan sát" đứng riêng (không gắn rẽ, nhường đường, chuyển làn, vượt, băng qua) là lời khuyên chung, không chiếm ô; đây là suy luận của mình, không có trong guideline, và 111 trên 201 câu khác nhau có chữ "quan sát"; mình đề nghị duyệt cho P1 rồi đọc số lần nó xuất hiện ở mục 5 của báo cáo để quyết có thêm lựa chọn hay không.
4. "quan sát trước khi sang đường" không có chữ "dừng" vẫn map vào "dừng quan sát trước khi băng qua" (quy tắc c), vì đây là lựa chọn duy nhất về băng qua đường; mình đề nghị duyệt, gặp ở #1 (một câu, 5 người), #8, #14, #16, #39, #45, #52.
5. Quy tắc c ghép "quan sát" với thao tác theo đúng bảng điền sẵn theo kiểu xung đột của guideline (rẽ, quay đầu, lùi xe là quan sát và nhường đường; chuyển làn, vượt, len là chỉ chuyển làn khi an toàn; băng ngang là dừng quan sát); mình đề nghị duyệt.
6. "làm chủ tốc độ", "làm chủ tay lái" là lời khuyên chung, không phải "giảm tốc" hay "giữ ổn định hướng lái", còn "đi chậm" là "giảm tốc"; mình đề nghị duyệt, vì prompt hệ thống đã coi "không làm chủ tốc độ" là kết luận lỗi không thấy được, gặp ở #11, #21, #29, #36, #38, #44, #47, #50.
7. Hành động cụ thể không có lựa chọn (đội mũ bảo hiểm, bật xi nhan, kiểm tra xe, bấm còi, tránh điểm mù xe lớn) là K kể cả khi không gắn với nguyên nhân ở C; mình đề nghị duyệt, rồi loại những cụm không phải phòng ngừa va chạm (như đội mũ bảo hiểm) lúc đọc danh sách K.
8. Một bên có hơn hai hành động thì hai ô nhận hai hành động đầu theo thứ tự câu viết, phần còn lại vào ngoài codebook loại "hành động thứ ba" và không tính vào độ phủ; mình đề nghị duyệt, dù khác bản nháp R (R lấy hành vi đầu tiên khớp), vì Prev có hai ô và "chính" theo nghĩa thông thường là việc được nói trước.
9. Script không kiểm hành động thêm khác hành động chính, và bên thứ hai là T thì hai ô hành động của nó là T; mình đề nghị chưa thêm cho P1 (chỉ ảnh hưởng vài câu), còn nếu muốn thì quy tắc kiểm là: với mỗi bên, nếu cả hai ô hành động là M thì `norm(giá trị chính) != norm(giá trị thêm)`, và nếu ô "bên thứ hai" là T thì hai ô hành động của bên thứ hai không được là M hoặc K.
10. Bên chỉ lấy từ câu trả lời, không từ câu hỏi, dù một số câu hỏi đã nêu bên ("Người lái ô tô nên làm gì...") và câu trả lời thì không; mình đề nghị duyệt, vì bằng chứng phải là chuỗi con của câu trả lời và bên có thể ghép lại ở P2.
11. Câu khuyên chung một hành động cho "cả hai bên" ghi cả cụm vào bên thứ nhất, bên thứ hai là T, giống cách bản nháp R ghi câu kể chung; mình đề nghị duyệt, gặp ở #35 ("Cả hai bên nên giảm tốc độ và nhường đường...").
12. Hai sửa đổi quy tắc 8 ở mục 5 (thêm C và Prev vào danh sách nhóm, thêm loại "lời khuyên chung"); mình đề nghị duyệt cả hai, vì chỉ thêm chữ, và nếu không duyệt thì hai loại này sẽ thành "khác".

## 7. Số liệu

Đếm bằng `make_units()` của `scripts/codebook_map.py` trên `answers-agreement-202611140458.csv` (qgroup Prev, `assignment_status = completed`, verdict khác `NOT_ANSWERABLE`, gộp theo `draft_id` và câu đã chuẩn hóa khoảng trắng):

| Số đo | Giá trị |
| --- | --- |
| Dòng Prev trong file | 392 (10 dòng NOT_ANSWERABLE bị bỏ) |
| Lượt viết của annotator được dùng | 382 |
| Câu trả lời khác nhau (đơn vị gọi LLM) | 201 |
| Video | 60 (#1 đến #60) |
| Lô gửi đi, mỗi lô tối đa 7 câu | 29, chưa tính gọi lại |
| Số cách hỏi khác nhau trong cột câu hỏi | 39 |
| Câu khác nhau có chữ "quan sát" | 111 |
