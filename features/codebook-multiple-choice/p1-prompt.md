# P1: prompt map câu tự do sang ô (bản để duyệt)

Trạng thái: chờ duyệt theo nguyên tắc 7 của [plan.md](plan.md).
Chưa gọi API lần nào.

## 1. Cách chạy

- Đầu vào: file export agreement (`answers-agreement-*.csv`), chỉ nhóm S và C.
- Gộp câu trùng: mỗi (câu hỏi, câu trả lời đã chuẩn hóa khoảng trắng) gọi LLM một lần, giữ số người đã viết câu đó.
- Mỗi lần gọi chỉ gửi văn bản: nhóm, câu hỏi, câu trả lời. Không gửi video, không gửi draft, không gửi tên annotator.
- LLM chỉ map những gì câu chữ nói. Nó không biết video thật ra sao.
- Nhiệt độ 0, bắt trả JSON.
- Gửi theo lô: mỗi lần gọi tối đa 7 câu, đánh số [1] đến [7], xếp theo số video để các biến thể của cùng một câu nằm chung lô.
  Model trả về `{"kết quả": [...]}`, mỗi phần tử theo schema mục 5 và có thêm khóa "id".
  Lô thiếu id, không parse được hoặc có câu sai codebook thì câu đó vào mục lỗi của báo cáo, không tính vào độ phủ.
- Script: `scripts/codebook_map.py`. `prepare` tạo các lô và in đầy đủ prompt của lô 1 ra `prompt_batch_001.txt` để duyệt; `report` đọc output và ghi `coverage_S.txt`.
  Script đọc prompt, codebook và few-shot trực tiếp từ file này, nên thứ đã duyệt ở đây là thứ được gửi đi.
- Few-shot: 4 câu thật ở mục 6, gửi thành các lượt hội thoại (câu hỏi rồi output mẫu) trước câu cần map.
  Các câu này không dùng cho lần chạy thử ở mục 7, 8 và không tính vào mẫu 50 câu duyệt tay.

## 2. Nhãn và mã

Codebook có hai lớp:

| Lớp | Ví dụ | Ai dùng |
| --- | --- | --- |
| Nhãn hiển thị, tiếng Việt có dấu, đúng chữ trong guideline | `nắng`, `âm u`, `không rõ` | LLM đọc và trả về; annotator nhìn thấy |
| Mã cố định | `weather.sunny`, `weather.unclear` | lưu trong DB và `codebook/v1.json`; không gửi cho LLM |

Lý do không dùng chữ không dấu: nhiều chữ trùng nhau khi bỏ dấu (`mua` là mưa, mua hay múa; `dong` là đông, đóng hay dòng).
Lý do không dùng tiếng Anh: thêm một bước dịch (âm u là overcast hay cloudy) và team khó đọc kết quả.

Script kiểm sau khi nhận output:

- Chuẩn hóa nhãn LLM trả về (Unicode NFC, chữ thường, bỏ khoảng trắng thừa), rồi tra ra mã. Nhãn không khớp lựa chọn nào là lỗi.
- Hành động phải nằm trong danh sách của kiểu xung đột đã chọn.
- `bằng chứng` phải là chuỗi con có thật trong câu (so sau khi chuẩn hóa NFC).
- M phải có giá trị; T không có giá trị.
- Lỗi thì gọi lại một lần, vẫn lỗi thì gắn cờ để duyệt tay.

Ước lượng: khoảng 60 video × (S khoảng 2 + C khoảng 6 câu khác nhau) ≈ 500 lần gọi.

## 3. Prompt hệ thống

```text
Bạn là người gán nhãn dữ liệu giao thông. Bạn nhận MỘT câu trả lời tiếng Việt do người viết cho một câu hỏi về video tai nạn giao thông. Bạn KHÔNG xem video. Nhiệm vụ: tách câu trả lời thành các ô theo codebook bên dưới.

Với mỗi ô, chọn đúng một trạng thái:
- "M": câu có nói về ô này và có lựa chọn trong codebook khớp với điều câu nói.
- "T": câu không nói gì về ô này.
- "K": câu có nói về ô này nhưng không lựa chọn nào khớp.

Quy tắc:
1. Chỉ dựa vào chữ trong câu. Không suy đoán từ kiến thức chung, không đoán điều video có thể cho thấy.
2. "giá trị" phải chép NGUYÊN VĂN một lựa chọn trong codebook, giữ đủ dấu tiếng Việt. Không viết lại, không thêm chữ.
3. "không rõ" chỉ là M khi câu nói rõ là không nhìn rõ hoặc không xác định được. Câu không nhắc thì là T.
4. Câu nhắc đến ô nhưng không đủ chi tiết để chọn đúng một lựa chọn (ví dụ "đường 2 chiều" mà không nói có dải phân cách hay không, "phanh" mà không nói phanh gấp) thì là T, không phải K. K chỉ dùng khi điều câu nói rõ ràng không khớp lựa chọn nào.
5. "bằng chứng" phải chép nguyên văn một đoạn liên tục của câu, với M, K, và T theo quy tắc 4. T vì câu không nhắc thì để null.
6. Với K, ghi vào "cụm không khớp" cụm từ không tìm được lựa chọn.
7. Câu có thể hiểu theo hai cách thì chọn cách gần nghĩa đen nhất và ghi lý do vào "ghi chú".
8. Mọi đoạn của câu không thuộc ô nào thì đưa vào "ngoài codebook", kèm loại:
   - "nhóm khác: <mã nhóm>" khi đó là thông tin của nhóm khác (S bối cảnh, E thực thể, V vi phạm, Attr quy lỗi, O kết quả).
   - "kết luận lỗi" khi câu kết luận lỗi (ví dụ "không quan sát", "không giữ khoảng cách an toàn").
   - "ý định" khi câu đoán ý định (ví dụ "cố", "muốn").
   - "khác" cho phần còn lại.
9. Chỉ trả về JSON đúng schema, không viết gì thêm.
```

## 4. Codebook gửi kèm (tin nhắn người dùng, phần đầu)

Nhóm S, lấy từ [S-boi-canh.md](../../docs/guidelines/S-boi-canh.md):

```json
{
  "thời tiết": ["nắng", "âm u", "mưa", "sương mù", "không rõ"],
  "ánh sáng": ["ban ngày", "ban đêm", "không rõ"],
  "loại đường": ["hai chiều có dải phân cách", "hai chiều không có dải phân cách", "một chiều", "không rõ"],
  "mặt đường": ["khô", "ướt", "không rõ"],
  "mật độ xe": ["thưa", "đông", "ùn tắc", "không rõ"],
  "đoạn đường": ["thẳng", "khúc cua", "giao lộ", "không rõ"]
}
```

Nhóm C, lấy từ [C-nguyen-nhan.md](../../docs/guidelines/C-nguyen-nhan.md):

```json
{
  "loại sự kiện": ["va chạm", "suýt va chạm", "không rõ"],
  "chủ thể": "bên thay đổi chuyển động trước (phanh, rẽ, chuyển làn, băng ngang...), dù câu lấy bên nào làm chủ ngữ; ghi mô tả thực thể (loại, màu) như câu viết, hoặc \"cả hai\" kèm hai mô tả",
  "đối tượng": "bên đầu tiên phải né hoặc bị chạm; mô tả MỘT thực thể; câu nêu từ hai đối tượng trở lên thì K",
  "kiểu xung đột": {
    "K01": {"tên": "Xe phía trước dừng hoặc đứng yên", "hành động": ["không giảm tốc", "tăng tốc"]},
    "K02": {"tên": "Xe phía trước phanh, giảm tốc", "hành động": ["phanh gấp", "dừng đột ngột"]},
    "K03": {"tên": "Tiến sát xe phía trước chạy chậm", "hành động": ["không giảm tốc", "tăng tốc"]},
    "K04": {"tên": "Chuyển làn, nhập làn", "hành động": ["chuyển sang làn bên trái", "chuyển sang làn bên phải"]},
    "K05": {"tên": "Vượt, len giữa các xe", "hành động": ["vượt bên trái", "vượt bên phải", "len giữa"]},
    "K06": {"tên": "Rẽ cắt qua xe đi cùng chiều bên cạnh", "hành động": ["rẽ trái", "rẽ phải"]},
    "K07": {"tên": "Xe đỗ ven đường, mở cửa, ra khỏi chỗ đỗ", "hành động": ["mở cửa xe", "ra khỏi chỗ đỗ"]},
    "K08": {"tên": "Lấn sang phần đường ngược chiều", "hành động": ["lấn khi vượt", "lấn khi vào cua", "lấn khi đi thẳng"]},
    "K09": {"tên": "Đi ngược chiều trên làn của người khác", "hành động": ["đi thẳng ngược chiều"]},
    "K10": {"tên": "Rẽ trái hoặc quay đầu cắt đầu xe ngược chiều", "hành động": ["rẽ trái", "quay đầu"]},
    "K11": {"tên": "Hai hướng cắt nhau tại giao lộ, cùng đi thẳng", "hành động": ["từ trái sang phải", "từ phải sang trái"]},
    "K12": {"tên": "Ra từ đường nhánh, hẻm, bãi xe", "hành động": ["ra từ bên trái", "ra từ bên phải"]},
    "K13": {"tên": "Quay đầu giữa đường", "hành động": ["quay đầu sang trái", "quay đầu sang phải"]},
    "K14": {"tên": "Băng ngang đường giữa đoạn", "hành động": ["từ trái sang phải", "từ phải sang trái"]},
    "K15": {"tên": "Người đi bộ băng qua hoặc đi dưới lòng đường", "hành động": ["từ trái sang phải", "từ phải sang trái", "đi dọc đường"]},
    "K16": {"tên": "Động vật lao ra đường", "hành động": ["từ trái sang phải", "từ phải sang trái"]},
    "K17": {"tên": "Lùi xe vào bên khác", "hành động": ["lùi xe"]},
    "K18": {"tên": "Một bên trượt, văng, không do bên kia", "hành động": ["trượt", "văng khỏi làn", "nổ lốp"]}
  },
  "tốc độ": ["phanh gấp", "dừng đột ngột", "tăng tốc", "không giảm tốc", "đứng yên"],
  "bên né": ["chủ thể", "đối tượng", "cả hai"],
  "cách né": ["phanh gấp", "đánh lái sang trái", "đánh lái sang phải", "phanh gấp và đánh lái"],
  "kết quả né": ["tránh được", "ngã, trượt", "vẫn chạm", "chạm vào thực thể khác"]
}
```

Ô "kiểu xung đột" trả về mã K01 đến K18 hoặc "không rõ"; đây là ô duy nhất trả về mã, vì mã đã có trong guideline.
Ô "hành động" chỉ được chọn trong danh sách của kiểu xung đột đã chọn.
Kiểu xung đột là T thì hành động cũng là T.
Mốc Start, End không có trong câu chữ nên không map.

## 5. Schema output

```json
{
  "ô": {
    "<tên ô>": {
      "trạng thái": "M | T | K",
      "giá trị": "<nhãn nguyên văn trong codebook, hoặc mô tả thực thể> | null",
      "bằng chứng": "<đoạn nguyên văn> | null",
      "cụm không khớp": "<chỉ khi K> | null"
    }
  },
  "ngoài codebook": [{"đoạn": "<nguyên văn>", "loại": "<loại>"}],
  "ghi chú": "<chỉ khi câu mơ hồ> | null"
}
```

## 6. Few-shot: 4 câu thật

Mỗi câu gửi thành một cặp lượt: lượt người dùng là input, lượt trợ lý là output mẫu.
Chọn để phủ các trường hợp dễ sai: T vì thiếu chi tiết, loại đường có M, kết luận lỗi và vi phạm ra ngoài C, chủ thể khác chủ ngữ của câu.

### 6.1. Nhóm S, video #8 (1 người)

```text
Nhóm: S
Câu hỏi: Thời tiết, ánh sáng, loại đường, tình trạng mặt đường ra sao?
Câu trả lời: Trời mưa, ban ngày, mặt đường nhựa ướt và trơn trượt, đường 2 chiều.
```

```json
{
  "ô": {
    "thời tiết":  {"trạng thái": "M", "giá trị": "mưa",      "bằng chứng": "Trời mưa",                         "cụm không khớp": null},
    "ánh sáng":   {"trạng thái": "M", "giá trị": "ban ngày", "bằng chứng": "ban ngày",                         "cụm không khớp": null},
    "loại đường": {"trạng thái": "T", "giá trị": null,       "bằng chứng": "đường 2 chiều",                    "cụm không khớp": null},
    "mặt đường":  {"trạng thái": "M", "giá trị": "ướt",      "bằng chứng": "mặt đường nhựa ướt và trơn trượt", "cụm không khớp": null},
    "mật độ xe":  {"trạng thái": "T", "giá trị": null,       "bằng chứng": null,                               "cụm không khớp": null},
    "đoạn đường": {"trạng thái": "T", "giá trị": null,       "bằng chứng": null,                               "cụm không khớp": null}
  },
  "ngoài codebook": [],
  "ghi chú": "Loại đường: câu nói 2 chiều nhưng không nói có dải phân cách hay không, nên là T."
}
```

### 6.2. Nhóm S, video #14 (3 người)

```text
Nhóm: S
Câu hỏi: Thời tiết, ánh sáng, loại đường, tình trạng mặt đường ra sao?
Câu trả lời: Ban ngày, trời nắng, đường nhựa hai chiều có dải phân cách cứng.
```

```json
{
  "ô": {
    "thời tiết":  {"trạng thái": "M", "giá trị": "nắng",                       "bằng chứng": "trời nắng",                      "cụm không khớp": null},
    "ánh sáng":   {"trạng thái": "M", "giá trị": "ban ngày",                   "bằng chứng": "Ban ngày",                       "cụm không khớp": null},
    "loại đường": {"trạng thái": "M", "giá trị": "hai chiều có dải phân cách", "bằng chứng": "hai chiều có dải phân cách cứng", "cụm không khớp": null},
    "mặt đường":  {"trạng thái": "T", "giá trị": null,                         "bằng chứng": null,                             "cụm không khớp": null},
    "mật độ xe":  {"trạng thái": "T", "giá trị": null,                         "bằng chứng": null,                             "cụm không khớp": null},
    "đoạn đường": {"trạng thái": "T", "giá trị": null,                         "bằng chứng": null,                             "cụm không khớp": null}
  },
  "ngoài codebook": [{"đoạn": "đường nhựa", "loại": "khác"}],
  "ghi chú": null
}
```

### 6.3. Nhóm C, video #2 (1 người)

```text
Nhóm: C
Câu hỏi: Nguyên nhân trực tiếp hoặc hành động ngay trước va chạm là gì?
Câu trả lời: Xe ba gác rẽ trái nhưng không nhường đường cho ô tô con màu bạc đang đi thẳng ở chiều ngược lại.
```

```json
{
  "ô": {
    "loại sự kiện":  {"trạng thái": "T", "giá trị": null,                "bằng chứng": null,                              "cụm không khớp": null},
    "chủ thể":       {"trạng thái": "M", "giá trị": "xe ba gác",         "bằng chứng": "Xe ba gác",                       "cụm không khớp": null},
    "đối tượng":     {"trạng thái": "M", "giá trị": "ô tô con màu bạc",  "bằng chứng": "ô tô con màu bạc",                "cụm không khớp": null},
    "kiểu xung đột": {"trạng thái": "M", "giá trị": "K10",               "bằng chứng": "đang đi thẳng ở chiều ngược lại", "cụm không khớp": null},
    "hành động":     {"trạng thái": "M", "giá trị": "rẽ trái",           "bằng chứng": "rẽ trái",                         "cụm không khớp": null},
    "tốc độ":        {"trạng thái": "T", "giá trị": null,                "bằng chứng": null,                              "cụm không khớp": null},
    "bên né":        {"trạng thái": "T", "giá trị": null,                "bằng chứng": null,                              "cụm không khớp": null},
    "cách né":       {"trạng thái": "T", "giá trị": null,                "bằng chứng": null,                              "cụm không khớp": null},
    "kết quả né":    {"trạng thái": "T", "giá trị": null,                "bằng chứng": null,                              "cụm không khớp": null}
  },
  "ngoài codebook": [{"đoạn": "không nhường đường", "loại": "nhóm khác: V"}],
  "ghi chú": null
}
```

### 6.4. Nhóm C, video #30 (7 người, giữ nguyên draft)

```text
Nhóm: C
Câu hỏi: Nguyên nhân trực tiếp hoặc hành động ngay trước va chạm là gì?
Câu trả lời: Xe camera hành trình không giữ khoảng cách an toàn và không kịp phản ứng khi xe phía trước phanh.
```

```json
{
  "ô": {
    "loại sự kiện":  {"trạng thái": "T", "giá trị": null,                   "bằng chứng": null,                    "cụm không khớp": null},
    "chủ thể":       {"trạng thái": "M", "giá trị": "xe phía trước",        "bằng chứng": "xe phía trước phanh",   "cụm không khớp": null},
    "đối tượng":     {"trạng thái": "M", "giá trị": "xe camera hành trình", "bằng chứng": "Xe camera hành trình",  "cụm không khớp": null},
    "kiểu xung đột": {"trạng thái": "M", "giá trị": "K02",                  "bằng chứng": "khi xe phía trước phanh", "cụm không khớp": null},
    "hành động":     {"trạng thái": "T", "giá trị": null,                   "bằng chứng": "phanh",                 "cụm không khớp": null},
    "tốc độ":        {"trạng thái": "T", "giá trị": null,                   "bằng chứng": null,                    "cụm không khớp": null},
    "bên né":        {"trạng thái": "T", "giá trị": null,                   "bằng chứng": null,                    "cụm không khớp": null},
    "cách né":       {"trạng thái": "T", "giá trị": null,                   "bằng chứng": null,                    "cụm không khớp": null},
    "kết quả né":    {"trạng thái": "T", "giá trị": null,                   "bằng chứng": null,                    "cụm không khớp": null}
  },
  "ngoài codebook": [
    {"đoạn": "không giữ khoảng cách an toàn", "loại": "kết luận lỗi"},
    {"đoạn": "không kịp phản ứng", "loại": "kết luận lỗi"}
  ],
  "ghi chú": "Câu lấy xe camera làm chủ ngữ, nhưng chủ thể là bên thay đổi chuyển động trước: xe phía trước phanh. Hành động là T vì câu không nói phanh gấp hay dừng đột ngột."
}
```

## 7. Chạy thử 1: input thật, nhóm S

Video #27, câu của Tuấn Anh (1 người viết câu này):

```text
Nhóm: S
Câu hỏi: Thời tiết, ánh sáng, loại đường, tình trạng mặt đường ra sao?
Câu trả lời: Thời tiết nắng, ánh sáng ban ngày, đường phố đô thị mật độ giao thông cao, mặt đường khô ráo.
```

Output mong muốn:

```json
{
  "ô": {
    "thời tiết":  {"trạng thái": "M", "giá trị": "nắng",     "bằng chứng": "Thời tiết nắng",        "cụm không khớp": null},
    "ánh sáng":   {"trạng thái": "M", "giá trị": "ban ngày", "bằng chứng": "ánh sáng ban ngày",     "cụm không khớp": null},
    "loại đường": {"trạng thái": "T", "giá trị": null,       "bằng chứng": null,                    "cụm không khớp": null},
    "mặt đường":  {"trạng thái": "M", "giá trị": "khô",      "bằng chứng": "mặt đường khô ráo",     "cụm không khớp": null},
    "mật độ xe":  {"trạng thái": "M", "giá trị": "đông",     "bằng chứng": "mật độ giao thông cao", "cụm không khớp": null},
    "đoạn đường": {"trạng thái": "T", "giá trị": null,       "bằng chứng": null,                    "cụm không khớp": null}
  },
  "ngoài codebook": [{"đoạn": "đường phố đô thị", "loại": "khác"}],
  "ghi chú": null
}
```

Điểm cần bạn xem: "đường phố đô thị" không phải loại đường theo codebook (không nói có dải phân cách hay một chiều), nên loại đường là T, còn cụm này vào danh sách ngoài codebook.
Nếu bạn muốn coi nó là K của ô loại đường thì đổi quy tắc trong prompt.

## 8. Chạy thử 2: input thật, nhóm C

Video #27, câu của Huỳnh Trung (1 người):

```text
Nhóm: C
Câu hỏi: Nguyên nhân trực tiếp hoặc hành động ngay trước va chạm là gì?
Câu trả lời: Xe tải ben màu xám đậm di chuyển quá sát bên trái ô tô màu trắng và xe ô tô Ford quá sát bên phải trong khoảng đường hẹp.
```

Output mong muốn:

```json
{
  "ô": {
    "loại sự kiện":  {"trạng thái": "T", "giá trị": null, "bằng chứng": null, "cụm không khớp": null},
    "chủ thể":       {"trạng thái": "M", "giá trị": "xe tải ben màu xám đậm", "bằng chứng": "Xe tải ben màu xám đậm", "cụm không khớp": null},
    "đối tượng":     {"trạng thái": "K", "giá trị": null, "bằng chứng": "ô tô màu trắng và xe ô tô Ford", "cụm không khớp": "hai đối tượng: ô tô màu trắng, xe ô tô Ford"},
    "kiểu xung đột": {"trạng thái": "M", "giá trị": "K05", "bằng chứng": "di chuyển quá sát bên trái ô tô màu trắng", "cụm không khớp": null},
    "hành động":     {"trạng thái": "K", "giá trị": null, "bằng chứng": "di chuyển quá sát bên trái", "cụm không khớp": "đi sát bên hông, không vượt, không len"},
    "tốc độ":        {"trạng thái": "T", "giá trị": null, "bằng chứng": null, "cụm không khớp": null},
    "bên né":        {"trạng thái": "T", "giá trị": null, "bằng chứng": null, "cụm không khớp": null},
    "cách né":       {"trạng thái": "T", "giá trị": null, "bằng chứng": null, "cụm không khớp": null},
    "kết quả né":    {"trạng thái": "T", "giá trị": null, "bằng chứng": null, "cụm không khớp": null}
  },
  "ngoài codebook": [
    {"đoạn": "trong khoảng đường hẹp", "loại": "nhóm khác: S"}
  ],
  "ghi chú": "Câu có thể hiểu là xe tải nằm giữa hai xe (một chủ thể, hai đối tượng) hoặc xe Ford cũng là chủ thể. Chọn cách thứ nhất."
}
```

Điểm cần bạn xem:

- Kiểu xung đột K05 có quan hệ "tiến sát bên hông", khớp với "quá sát bên trái". Nhưng hành động của K05 chỉ có vượt hoặc len, không có "đi sát song song", nên hành động là K. Nếu nhiều câu rơi vào đây thì đó là lựa chọn nên thêm.
- Đối tượng là K vì câu nêu hai đối tượng. Đây là giới hạn đã biết, xử lý bằng luật "cặp chính" khi gán trên video.
- Câu mơ hồ nên có `ghi chú`. Câu có `ghi chú` sẽ được ưu tiên vào mẫu 50 câu duyệt tay.

## 9. Cần bạn quyết

1. Duyệt prompt, codebook và hai output mong muốn ở trên (hoặc sửa).
2. Chọn LLM và tên biến môi trường chứa API key.
3. Sau khi duyệt: mình viết script, chạy thử đúng 2 input này, so với output mong muốn, rồi mới chạy toàn bộ.
