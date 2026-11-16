# P1 nhóm R: phần prompt riêng của nhóm (bản nháp để duyệt)

Trạng thái: chờ duyệt theo nguyên tắc 7 của [plan.md](../plan.md).
Chưa gọi API lần nào.
Prompt hệ thống (mục 3), schema (mục 5) và cách chạy dùng chung với [p1-prompt.md](../p1-prompt.md); file này chỉ thêm phần của nhóm R.
Khi duyệt xong, mục 1 dán vào mục 4 của `p1-prompt.md`, hai câu ở mục 2 thành mục 6.5 và 6.6, mục 3 và 4 thành hai mục "Chạy thử" mới.

## 1. Codebook R

Nhóm R, lấy từ [R-ung-xu.md](../../docs/guidelines/R-ung-xu.md):

```json
{
  "clip có đoạn sau sự kiện": {"lựa chọn": ["có", "không"], "ghi chú": "có khi câu kể bất kỳ hành vi nào sau va chạm hoặc sau lúc suýt va chạm, bằng chứng là đoạn kể hành vi đầu tiên; không khi câu nói clip hoặc video kết thúc ngay lúc hoặc ngay sau sự kiện (hoặc trước sự kiện), hoặc cả câu chỉ là \"Không thể xác định\", mẫu câu của guideline cho trường hợp này; ô này là không thì mọi ô còn lại là T"},
  "bên thứ nhất": "bên liên quan đầu tiên mà câu kể hành vi, theo thứ tự câu viết, không phân chủ thể hay đối tượng; ghi mô tả thực thể (loại, màu, người điều khiển) như câu viết; câu kể chung một hành vi cho nhiều bên (\"các bên\", \"cả hai xe\", \"xe tải và ô tô màu đen\") thì ghi cả cụm vào đây; bên chỉ được nhắc mà câu không nói bên đó làm gì (ví dụ \"nạn nhân\" được người khác giúp) thì không ghi; người, xe xung quanh không phải bên liên quan",
  "hành vi bên thứ nhất": {"lựa chọn": ["dừng lại", "tiếp tục di chuyển, rời đi", "tự đứng dậy, dựng xe", "giằng co", "không rõ"], "ghi chú": "chỉ hành vi sau sự kiện; bên có nhiều hành vi thì chọn hành vi đầu tiên khớp một lựa chọn, các hành vi còn lại đưa vào ngoài codebook với loại \"khác\"; K chỉ khi không hành vi nào của bên này khớp"},
  "bên thứ hai": "bên liên quan thứ hai mà câu kể hành vi, khác bên thứ nhất, cùng cách ghi như bên thứ nhất; câu kể hành vi riêng của từ ba bên (hoặc ba cụm bên) trở lên thì từ bên thứ ba trở đi đưa vào ngoài codebook với loại \"khác\" và nói trong ghi chú",
  "hành vi bên thứ hai": {"lựa chọn": ["dừng lại", "tiếp tục di chuyển, rời đi", "tự đứng dậy, dựng xe", "giằng co", "không rõ"], "ghi chú": "như hành vi bên thứ nhất"},
  "người, xe xung quanh": {"lựa chọn": ["dừng lại hoặc đến hỗ trợ", "không thấy ai dừng lại", "không rõ"], "ghi chú": "người đi đường, người dân, các xe khác, cảnh sát: những ai không phải bên liên quan"}
}
```

### Cách biểu diễn các bên

Guideline R gọi hai bên là chủ thể và đối tượng, và hai vai này được định nghĩa ở nhóm C (chủ thể là bên thay đổi chuyển động trước).
Lúc map R, LLM chỉ thấy câu trả lời R, không thấy câu C của cùng người, nên không biết bên nào là chủ thể.
Ví dụ video #1: câu R thường kể "Ô tô dừng lại" trước, nhưng theo [C-nguyen-nhan.md](../../docs/guidelines/C-nguyen-nhan.md) ô tô ở #1 không thuộc cặp chính.
Nếu bắt LLM đoán vai, lỗi đoán vai lẫn vào số độ phủ, trong khi P1 chỉ cần biết danh sách hành vi có chứa được điều annotator viết hay không.

Vì vậy codebook trên tách bên theo thứ tự câu kể ("bên thứ nhất", "bên thứ hai"), mỗi bên một cặp ô:

- Ô mô tả bên là ô chữ tự do, cùng kiểu với "chủ thể" và "đối tượng" của nhóm C: giữ mô tả thực thể như câu viết.
- Ô hành vi của bên là danh sách lựa chọn, chép nguyên văn ô 1 của guideline.
- Độ phủ được đo trên hai ô hành vi và hai ô "clip có đoạn sau sự kiện", "người, xe xung quanh".
- Vai chủ thể hoặc đối tượng được gán sau, ở bước chuyển dữ liệu (P2), bằng cách ghép mô tả bên ở R với "chủ thể" và "đối tượng" đã map từ câu C của cùng annotator trên cùng video.

Mọi ô đều thuộc các kiểu `cell_specs()` đã hiểu (danh sách có ghi chú, và chuỗi cho ô tự do), nên không cần sửa script.

## 2. Few-shot: 2 câu thật

Chọn để phủ hai trường hợp dễ sai nhất: clip hết ngay ở sự kiện (ô 0 là "không", các ô khác không được thành "không rõ"), và người xung quanh hỗ trợ trong lúc một bên có hai hành vi và nạn nhân được nhắc mà không có hành vi.
Không dùng video #20, #37, #10.

### 2.1. Nhóm R, video #36 (1 người)

```text
Nhóm: R
Câu hỏi: Hành vi của các bên sau tai nạn là gì (dừng lại, bỏ chạy, hỗ trợ)?
Câu trả lời: Video kết thúc ngay trước va chạm nên không thể xác định rõ hành vi tiếp theo.
```

```json
{
  "ô": {
    "clip có đoạn sau sự kiện": {"trạng thái": "M", "giá trị": "không", "bằng chứng": "Video kết thúc ngay trước va chạm", "cụm không khớp": null},
    "bên thứ nhất":             {"trạng thái": "T", "giá trị": null,    "bằng chứng": null,                                 "cụm không khớp": null},
    "hành vi bên thứ nhất":     {"trạng thái": "T", "giá trị": null,    "bằng chứng": null,                                 "cụm không khớp": null},
    "bên thứ hai":              {"trạng thái": "T", "giá trị": null,    "bằng chứng": null,                                 "cụm không khớp": null},
    "hành vi bên thứ hai":      {"trạng thái": "T", "giá trị": null,    "bằng chứng": null,                                 "cụm không khớp": null},
    "người, xe xung quanh":     {"trạng thái": "T", "giá trị": null,    "bằng chứng": null,                                 "cụm không khớp": null}
  },
  "ngoài codebook": [],
  "ghi chú": "Video kết thúc trước sự kiện nên không có đoạn sau; các ô còn lại là T, không phải không rõ, vì ô clip có đoạn sau sự kiện là không."
}
```

### 2.2. Nhóm R, video #8 (6 người)

```text
Nhóm: R
Câu hỏi: Hành vi của các bên sau tai nạn là gì?
Câu trả lời: Tài xế xe tải dừng lại, xuống xe cùng người dân xung quanh hỗ trợ nạn nhân.
```

```json
{
  "ô": {
    "clip có đoạn sau sự kiện": {"trạng thái": "M", "giá trị": "có",                       "bằng chứng": "Tài xế xe tải dừng lại",               "cụm không khớp": null},
    "bên thứ nhất":             {"trạng thái": "M", "giá trị": "tài xế xe tải",            "bằng chứng": "Tài xế xe tải",                        "cụm không khớp": null},
    "hành vi bên thứ nhất":     {"trạng thái": "M", "giá trị": "dừng lại",                 "bằng chứng": "dừng lại",                             "cụm không khớp": null},
    "bên thứ hai":              {"trạng thái": "T", "giá trị": null,                       "bằng chứng": null,                                   "cụm không khớp": null},
    "hành vi bên thứ hai":      {"trạng thái": "T", "giá trị": null,                       "bằng chứng": null,                                   "cụm không khớp": null},
    "người, xe xung quanh":     {"trạng thái": "M", "giá trị": "dừng lại hoặc đến hỗ trợ", "bằng chứng": "người dân xung quanh hỗ trợ nạn nhân", "cụm không khớp": null}
  },
  "ngoài codebook": [{"đoạn": "xuống xe", "loại": "khác"}],
  "ghi chú": "Tài xế xe tải có hai hành vi: dừng lại (khớp) và xuống xe cùng hỗ trợ nạn nhân, nên đoạn xuống xe vào ngoài codebook. Nạn nhân được nhắc nhưng câu không nói nạn nhân làm gì, nên bên thứ hai là T."
}
```

## 3. Chạy thử 1: input thật, nhóm R, hai bên cùng hành vi

Video #20, câu của Huỳnh Trung (1 người viết câu này):

```text
Nhóm: R
Câu hỏi: Hành vi của các bên sau tai nạn là gì (dừng lại, bỏ chạy, hỗ trợ)?
Câu trả lời: cả 2 phương tiện vẫn tiếp tục di chuyển
```

Output mong muốn:

```json
{
  "ô": {
    "clip có đoạn sau sự kiện": {"trạng thái": "M", "giá trị": "có",                        "bằng chứng": "vẫn tiếp tục di chuyển", "cụm không khớp": null},
    "bên thứ nhất":             {"trạng thái": "M", "giá trị": "cả 2 phương tiện",          "bằng chứng": "cả 2 phương tiện",       "cụm không khớp": null},
    "hành vi bên thứ nhất":     {"trạng thái": "M", "giá trị": "tiếp tục di chuyển, rời đi", "bằng chứng": "vẫn tiếp tục di chuyển", "cụm không khớp": null},
    "bên thứ hai":              {"trạng thái": "T", "giá trị": null,                        "bằng chứng": null,                     "cụm không khớp": null},
    "hành vi bên thứ hai":      {"trạng thái": "T", "giá trị": null,                        "bằng chứng": null,                     "cụm không khớp": null},
    "người, xe xung quanh":     {"trạng thái": "T", "giá trị": null,                        "bằng chứng": null,                     "cụm không khớp": null}
  },
  "ngoài codebook": [],
  "ghi chú": null
}
```

Điểm cần bạn xem:

- Bản map tay ở [trial-new-groups.md](../trial-new-groups.md) ghi "chủ thể và đối tượng: tiếp tục di chuyển, rời đi", tức hai ô.
  Ở đây câu kể chung cho hai bên nên cả cụm vào bên thứ nhất, bên thứ hai là T, đúng mẫu câu "Hai bên cùng hành vi: Các bên [1]" của guideline.
  Ở P2, "cả 2 phương tiện" được trải ra cho cả chủ thể và đối tượng.
- Cách này không có trong few-shot; nếu model tách thành hai bên hoặc để bên thứ nhất là T thì cần thêm một few-shot cho câu kể chung (Cần quyết, mục 8).

## 4. Chạy thử 2: input thật, nhóm R, chỉ có người xung quanh

Video #37, câu của Huỳnh Trung (7 người viết câu này):

```text
Nhóm: R
Câu hỏi: Hành vi của các bên sau tai nạn là gì (dừng lại, bỏ chạy, hỗ trợ)?
Câu trả lời: Những người xung quanh và nhân viên tiệm sửa xe nhanh chóng chạy ra hỗ trợ dựng xe và giúp đỡ người bị nạn.
```

Output mong muốn:

```json
{
  "ô": {
    "clip có đoạn sau sự kiện": {"trạng thái": "M", "giá trị": "có",                       "bằng chứng": "nhanh chóng chạy ra hỗ trợ dựng xe", "cụm không khớp": null},
    "bên thứ nhất":             {"trạng thái": "T", "giá trị": null,                       "bằng chứng": null,                                 "cụm không khớp": null},
    "hành vi bên thứ nhất":     {"trạng thái": "T", "giá trị": null,                       "bằng chứng": null,                                 "cụm không khớp": null},
    "bên thứ hai":              {"trạng thái": "T", "giá trị": null,                       "bằng chứng": null,                                 "cụm không khớp": null},
    "hành vi bên thứ hai":      {"trạng thái": "T", "giá trị": null,                       "bằng chứng": null,                                 "cụm không khớp": null},
    "người, xe xung quanh":     {"trạng thái": "M", "giá trị": "dừng lại hoặc đến hỗ trợ", "bằng chứng": "Những người xung quanh và nhân viên tiệm sửa xe nhanh chóng chạy ra hỗ trợ dựng xe và giúp đỡ người bị nạn", "cụm không khớp": null}
  },
  "ngoài codebook": [],
  "ghi chú": "Dựng xe ở đây do người xung quanh làm, không phải một bên tự dựng xe. Người bị nạn được nhắc nhưng câu không nói người đó làm gì, nên các ô của bên là T."
}
```

Điểm cần bạn xem:

- Khớp bản map tay: ô 0 có, người xung quanh "dừng lại hoặc đến hỗ trợ", chủ thể và đối tượng T.
- Chỗ dễ sai: "dựng xe" trùng chữ với lựa chọn "tự đứng dậy, dựng xe", nhưng người làm là người xung quanh, nên không map vào ô hành vi của bên nào.
- "nhân viên tiệm sửa xe" được xếp vào người xung quanh vì không phải bên va chạm.

## 5. Đề xuất sửa prompt hệ thống

Không cần sửa mục 3 của `p1-prompt.md`.
Các quy tắc riêng của R (ô 0 là "không" thì các ô khác là T, cách ghi các bên, bên có nhiều hành vi, bên thứ ba) nằm trong "ghi chú" của từng ô trong codebook, giống cách nhóm C đặt định nghĩa chủ thể và đối tượng vào codebook.
Quy tắc 8 của prompt hệ thống đã có "R ứng xử sau sự kiện" và các loại "nhóm khác", nên đoạn thuộc nhóm O (ví dụ "không có va chạm", "sau khi bị lật") đi vào "nhóm khác: O" mà không cần thêm gì.

Khi gộp vào `p1-prompt.md`, chỉ cần sửa chữ ở mục 1 (đang ghi "chỉ nhóm S và C" và "4 câu thật ở mục 6") cho khớp; phần này không gửi cho LLM.

## 6. Cần quyết

1. Các bên được tách theo thứ tự câu kể ("bên thứ nhất", "bên thứ hai") thay vì chủ thể và đối tượng, và vai được ghép ở P2 bằng mô tả thực thể với câu C của cùng annotator; mình đề nghị duyệt, vì LLM không thấy câu C nên không thể gán vai mà không đoán.
2. Câu chỉ có "Không thể xác định" được map ô 0 là "không" theo mẫu câu của guideline; mình đề nghị duyệt, dù một số câu loại này có thể do video khó xem chứ không do clip hết sớm (4 câu: R0082 #22, R0124 #31, R0142 #36, R0151 #39 do 2 người viết; thêm "Không thể xác định khi" ở #32).
3. Ô 0 là "không" thì mọi ô còn lại là T; guideline không ghi thẳng, mình suy ra từ mẫu câu "Không có đoạn sau: Không thể xác định", đề nghị duyệt.
4. Một bên có nhiều hành vi thì ô nhận hành vi đầu tiên khớp, phần còn lại vào ngoài codebook loại "khác"; mình đề nghị duyệt, vì báo cáo mục 5 sẽ đếm được các cụm hay gặp như "xuống xe", "kiểm tra" (#7, #8, #24, #27) để quyết có thêm lựa chọn hay không.
5. Bên thứ ba trở lên vào ngoài codebook loại "khác" kèm ghi chú, vì guideline R chỉ có hai bên; mình đề nghị duyệt, trường hợp này hiếm (ví dụ #43 "Các phương tiện dừng lại ngay tại hiện trường, xe máy tự đứng dậy và xe tải lớn tiếp tục di chuyển").
6. Bên chỉ được nhắc mà câu không nói làm gì (nạn nhân, người bị nạn) thì không ghi thành một bên; mình đề nghị duyệt.
7. Guideline không định nghĩa "giằng co", trong khi câu thật có "đánh vào mặt" (#1), "tranh cãi", "nói chuyện" (#27), "cãi vã", "chửi" (#38); mình đề nghị không thêm quy tắc trước, để lượt chạy P1 cho ra K rồi quyết theo danh sách K.
8. Chỉ có 2 few-shot, không câu nào kể chung "cả hai bên"; mình đề nghị chạy `trial` trước, chỉ thêm few-shot thứ ba (ví dụ R0094 #25 "Các bên liên quan đều dừng lại tại hiện trường.", 5 người) nếu model sai ở Chạy thử 1.

## 7. Số liệu

Đếm bằng `make_units()` của `scripts/codebook_map.py` trên `answers-agreement-202611140458.csv` (qgroup R, `assignment_status = completed`, verdict khác `NOT_ANSWERABLE`, gộp theo `draft_id` và câu đã chuẩn hóa khoảng trắng):

| Số đo | Giá trị |
| --- | --- |
| Dòng R trong file | 392 (38 dòng NOT_ANSWERABLE bị bỏ) |
| Lượt viết của annotator được dùng | 354 |
| Câu trả lời khác nhau (đơn vị gọi LLM) | 228 |
| Video | 59 (#1 đến #60, không có #41) |
| Lô gửi đi, mỗi lô tối đa 7 câu | 33, chưa tính gọi lại |
| Số cách hỏi khác nhau trong cột câu hỏi | 34 |
