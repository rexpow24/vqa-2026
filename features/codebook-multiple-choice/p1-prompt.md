# P1: prompt map câu tự do sang ô (bản để duyệt)

Trạng thái: chờ duyệt theo nguyên tắc 7 của [plan.md](plan.md).
Chưa gọi API lần nào.

## 1. Cách chạy

- Đầu vào: file export agreement (`answers-agreement-*.csv`), các nhóm S, E, C, V, O, R, Prev; mỗi lần chạy một nhóm (`--group`).
- Gộp câu trùng: mỗi (câu hỏi, câu trả lời đã chuẩn hóa khoảng trắng) gọi LLM một lần, giữ số người đã viết câu đó.
- Mỗi lần gọi chỉ gửi văn bản: nhóm, câu hỏi, câu trả lời. Không gửi video, không gửi draft, không gửi tên annotator.
- LLM chỉ map những gì câu chữ nói. Nó không biết video thật ra sao.
- Nhiệt độ 0, bắt trả JSON.
- Gửi theo lô: mỗi lần gọi tối đa 7 câu, đánh số [1] đến [7], xếp theo số video để các biến thể của cùng một câu nằm chung lô.
  Model trả về `{"kết quả": [...]}`, mỗi phần tử theo schema mục 5 và có thêm khóa "id".
  Lô thiếu id, không parse được hoặc có câu sai codebook thì câu đó vào mục lỗi của báo cáo, không tính vào độ phủ.
- Script: `scripts/codebook_map.py`. `prepare` tạo các lô và in đầy đủ prompt của lô 1 ra `prompt_batch_001.txt` để duyệt; `report` đọc output và ghi `coverage_S.txt`.
  Script đọc prompt, codebook và few-shot trực tiếp từ file này, nên thứ đã duyệt ở đây là thứ được gửi đi.
- Few-shot: mỗi nhóm 2 câu thật ở mục 6, gửi thành các lượt hội thoại (câu hỏi rồi output mẫu) trước câu cần map; chỉ gửi few-shot của nhóm đang chạy.
  Các câu này không dùng cho các mục "Chạy thử".
- Nhóm R và Prev ghi các bên theo thứ tự câu kể ("bên thứ nhất", "bên thứ hai"), không theo chủ thể và đối tượng, vì LLM không thấy câu C; vai được ghép với C ở P2.
  Nhóm O không map các bên, vì guideline O tự điền các bên từ C.
- Nhóm E là danh sách các bên, mỗi bên có cùng một bộ ô, nên output E dùng schema riêng ở mục 5; độ phủ của mỗi ô tính trên mọi bên của mọi câu.
  LLM ghi các bên theo thứ tự câu viết, không đặt tên A, B, C, vì tên đặt theo vị trí trong khung hình mà LLM không thấy video.

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
   - "nhóm khác: <mã nhóm>" khi đó là thông tin của nhóm khác (S bối cảnh, E thực thể, C nguyên nhân, V vi phạm, Attr quy lỗi, O kết quả, R ứng xử sau sự kiện, Prev phòng ngừa), trừ nhóm đang map.
     Với V, các hành vi sau là thông tin nhóm V: đi sai làn, lấn làn, đi ngược chiều, vượt đèn đỏ, không chấp hành biển báo hoặc vạch kẻ đường, không nhường đường, không giữ khoảng cách an toàn, vượt xe sai quy định, chuyển hướng hoặc quay đầu sai quy định, lùi xe sai quy định, không đội mũ bảo hiểm, đi bộ dưới lòng đường.
   - "kết luận lỗi" khi câu kết luận lỗi hoặc trạng thái người lái mà mắt không thấy được (ví dụ "không quan sát", "thiếu quan sát", "không kịp phản ứng", "không làm chủ tốc độ").
   - "ý định" khi câu đoán ý định (ví dụ "cố", "muốn").
   - "suy đoán" khi câu nói điều mắt không thấy được về hậu quả: thương tích, tử vong (kể cả khi câu nói là không có), hoặc hư hỏng mà câu chỉ đoán ("có thể", "có khả năng").
   - "lời khuyên chung" khi câu khuyên chung chung, không nêu hành động cụ thể (ví dụ "tuân thủ luật giao thông", "cẩn thận hơn").
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
  "loại sự kiện": {"lựa chọn": ["va chạm", "suýt va chạm", "không rõ"], "ghi chú": "va chạm gồm cả xe tự lật hoặc văng khỏi đường dù không chạm bên nào; suýt va chạm chỉ khi không có thiệt hại"},
  "chủ thể": "bên thay đổi chuyển động trước (phanh, rẽ, chuyển làn, băng ngang...), dù câu lấy bên nào làm chủ ngữ; ghi mô tả thực thể (loại, màu) như câu viết, hoặc \"cả hai\" kèm hai mô tả",
  "đối tượng": "bên bị chủ thể chạm đầu tiên; chủ thể không chạm ai thì là bên đầu tiên phải né; mô tả MỘT thực thể; câu nêu từ hai đối tượng trở lên thì lấy bên bị chạm hoặc phải né trước theo thứ tự câu kể, câu không cho biết thứ tự thì K; K18 không có đối tượng thì T",
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

Nhóm O, lấy từ [O-hau-qua.md](../../docs/guidelines/O-hau-qua.md):

```json
{
  "mức độ": {"lựa chọn": ["không va chạm", "va chạm nhẹ", "va chạm vừa", "va chạm mạnh", "không rõ"], "ghi chú": "mỗi dấu hiệu nhìn thấy thuộc đúng một mức độ (bảng ở ô dấu hiệu nhìn thấy); câu nêu dấu hiệu thì mức độ là mức của dấu hiệu đó; không rõ khi va chạm xảy ra ngoài khung hình hoặc bị che hoàn toàn; suýt va chạm mà tránh được thì là không va chạm; suýt va chạm nhưng bên né ngã, trượt hoặc chạm thực thể khác thì ghi mức độ theo hậu quả nhìn thấy; chữ nhẹ, vừa, mạnh nói về hư hỏng (ví dụ \"hư hỏng nhẹ\"), không nói về va chạm, thì không chọn mức độ; câu chỉ nói không có hư hại thì mức độ là T kèm bằng chứng, vì không hư hại chưa chắc là không va chạm; câu nêu mức độ trái với dấu hiệu thì dấu hiệu nặng nhất quyết định mức độ, ghi chú nêu mâu thuẫn"},
  "dấu hiệu nhìn thấy": {"theo": "mức độ", "lựa chọn": {"không va chạm": ["không có"], "va chạm nhẹ": ["chạm quẹt, vẫn đứng yên", "chạm quẹt, vẫn đi tiếp"], "va chạm vừa": ["lệch hướng", "dừng đột ngột", "xe ngã", "người ngã"], "va chạm mạnh": ["bị lật", "bị văng", "biến dạng rõ", "người nằm trên đường"]}, "ghi chú": "dấu hiệu phải thuộc danh sách của mức độ đã chọn; mức độ là không rõ, T hoặc K thì dấu hiệu không được là M; chọn dấu hiệu nặng nhất nhìn thấy; cùng mức thì chọn dấu hiệu đứng sau trong danh sách; không ghi thương tích hay tử vong, chỉ ghi điều nhìn thấy, ví dụ người nằm trên đường"}
}
```

Ô "dấu hiệu nhìn thấy" phụ thuộc ô "mức độ": dấu hiệu phải nằm trong danh sách của mức độ đã chọn; script kiểm điều này.
Các bên không được map (tự điền từ C).

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

Các bên ghi theo thứ tự câu kể; vai chủ thể, đối tượng ghép với C ở P2.

Nhóm Prev, lấy từ [Prev-phong-ngua.md](../../docs/guidelines/Prev-phong-ngua.md):

```json
{
  "bên thứ nhất": "bên đầu tiên mà câu trả lời khuyên, theo thứ tự câu viết; ghi mô tả thực thể (loại, màu, người điều khiển) như câu viết, kể cả khi chỉ là \"người lái xe\", \"tài xế\"; câu khuyên chung một hành động cho cả hai bên (\"cả hai bên\", \"các xe\") thì ghi cả cụm vào đây; câu không nêu bên nào thì T, và các hành động vẫn ghi vào ô của bên thứ nhất; chỉ lấy bên từ câu trả lời, không lấy từ câu hỏi",
  "hành động chính bên thứ nhất": {"lựa chọn": ["giảm tốc", "giữ khoảng cách an toàn", "quan sát và nhường đường", "chỉ chuyển làn khi an toàn", "đi đúng phần đường", "giữ ổn định hướng lái", "dừng quan sát trước khi băng qua", "bật xi nhan xin đường", "tránh điểm mù xe lớn", "chấp hành đèn tín hiệu", "kiểm tra xe trước khi đi", "đội mũ bảo hiểm"], "ghi chú": "hành động đầu tiên câu khuyên bên này. Quy tắc chung cho cả bốn ô hành động: (a) không có lựa chọn \"khác\": hành động cụ thể không khớp lựa chọn nào (ví dụ bấm còi, bật đèn pha) thì K; (b) lời khuyên chung không nêu hành động cụ thể (ví dụ \"tuân thủ luật giao thông\", \"cẩn thận hơn\", \"làm chủ tốc độ\", \"sẵn sàng xử lý tình huống\") không chiếm ô nào, đưa vào ngoài codebook với loại \"lời khuyên chung\"; (c) \"quan sát\" gắn với một thao tác thì chọn lựa chọn của thao tác đó: rẽ, quay đầu, ra từ đường nhánh, lùi xe, nhường đường là \"quan sát và nhường đường\"; chuyển làn, vượt, len là \"chỉ chuyển làn khi an toàn\"; băng qua, sang đường là \"dừng quan sát trước khi băng qua\"; (d) lời khuyên tránh một hành vi (ví dụ \"không đi ngược chiều\", \"không lấn làn\") map vào lựa chọn tương ứng, không đưa sang nhóm V; (e) \"quan sát\" đứng riêng, không gắn thao tác nào, là hành động chưa đủ chi tiết: ô hành động nó rơi vào theo thứ tự câu viết là T, bằng chứng là cụm đó; (f) hoàn cảnh đi kèm hành động (ví dụ \"khi đi qua ngã tư\", \"trên đường ướt\") không thuộc ô hành động, đưa vào ngoài codebook theo quy tắc 8"},
  "hành động thêm bên thứ nhất": {"lựa chọn": ["giảm tốc", "giữ khoảng cách an toàn", "quan sát và nhường đường", "chỉ chuyển làn khi an toàn", "đi đúng phần đường", "giữ ổn định hướng lái", "dừng quan sát trước khi băng qua", "bật xi nhan xin đường", "tránh điểm mù xe lớn", "chấp hành đèn tín hiệu", "kiểm tra xe trước khi đi", "đội mũ bảo hiểm"], "ghi chú": "hành động thứ hai câu khuyên bên này, khác hành động chính; câu chỉ khuyên một hành động thì T; hành động thứ ba trở đi đưa vào ngoài codebook với loại \"hành động thứ ba\""},
  "bên thứ hai": "bên thứ hai mà câu trả lời khuyên một hành động riêng, khác bên thứ nhất, cùng cách ghi như bên thứ nhất; câu chỉ khuyên một bên, hoặc khuyên chung một hành động cho cả hai bên, thì T",
  "hành động chính bên thứ hai": {"lựa chọn": ["giảm tốc", "giữ khoảng cách an toàn", "quan sát và nhường đường", "chỉ chuyển làn khi an toàn", "đi đúng phần đường", "giữ ổn định hướng lái", "dừng quan sát trước khi băng qua", "bật xi nhan xin đường", "tránh điểm mù xe lớn", "chấp hành đèn tín hiệu", "kiểm tra xe trước khi đi", "đội mũ bảo hiểm"], "ghi chú": "như hành động chính bên thứ nhất, cho bên thứ hai; bên thứ hai là T thì ô này là T"},
  "hành động thêm bên thứ hai": {"lựa chọn": ["giảm tốc", "giữ khoảng cách an toàn", "quan sát và nhường đường", "chỉ chuyển làn khi an toàn", "đi đúng phần đường", "giữ ổn định hướng lái", "dừng quan sát trước khi băng qua", "bật xi nhan xin đường", "tránh điểm mù xe lớn", "chấp hành đèn tín hiệu", "kiểm tra xe trước khi đi", "đội mũ bảo hiểm"], "ghi chú": "như hành động thêm bên thứ nhất, cho bên thứ hai; bên thứ hai là T thì ô này là T"}
}
```

Không có lựa chọn "khác" trong codebook gửi LLM, để hành động không khớp thành K.
"Quan sát" đứng riêng là T kèm bằng chứng (thiếu chi tiết), không phải lời khuyên chung.

Nhóm V, lấy từ [V-vi-pham.md](../../docs/guidelines/V-vi-pham.md):

```json
{
  "kết quả": {
    "lựa chọn": [
      "có",
      "không quan sát thấy",
      "không rõ"
    ],
    "ghi chú": "có khi câu nêu ít nhất một hành vi vi phạm nhìn thấy được, khớp lựa chọn ở ô hành vi hay không, bằng chứng là đoạn nêu hành vi đầu tiên; câu chỉ nêu kết luận lỗi, trạng thái người lái hoặc tốc độ (ví dụ \"thiếu quan sát\", \"không làm chủ tốc độ\", \"chạy nhanh\") mà không nêu hành vi nào thì T kèm bằng chứng là cụm đó; không quan sát thấy khi câu nói không có hoặc không thấy vi phạm; không rõ khi câu nói không xác định được, kể cả khi cả câu chỉ là \"Không thể xác định\"; ô này không phải có thì hai ô còn lại là T"
  },
  "bên vi phạm": "bên thực hiện hành vi ghi ở ô hành vi; ghi mô tả thực thể (loại, màu, người điều khiển) như câu viết; câu không nêu bên thì T; chỉ lấy bên từ câu trả lời, không lấy từ câu hỏi",
  "hành vi": {
    "lựa chọn": [
      "đi sai làn, lấn làn",
      "đi ngược chiều",
      "vượt đèn đỏ",
      "không chấp hành biển báo, vạch kẻ đường",
      "không nhường đường",
      "không giữ khoảng cách an toàn",
      "vượt xe sai quy định",
      "chuyển hướng, quay đầu sai quy định",
      "lùi xe sai quy định",
      "không đội mũ bảo hiểm",
      "đi bộ dưới lòng đường"
    ],
    "ghi chú": "chỉ dựa vào chữ, không kiểm điều kiện nhìn thấy (đèn, biển, vạch) vì bạn không xem video; câu nêu nhiều hành vi thì chọn hành vi đầu tiên khớp một lựa chọn, các hành vi còn lại đưa vào ngoài codebook với loại \"khác\"; K chỉ khi câu nêu hành vi nhìn thấy được mà không hành vi nào khớp; không có lựa chọn \"khác\"; đè vạch, vượt vạch liền, không theo biển là không chấp hành biển báo, vạch kẻ đường; vượt ẩu, vượt sai là vượt xe sai quy định; chen làn, lấn làn, đi sai làn là đi sai làn, lấn làn; rẽ, quay đầu sai là chuyển hướng, quay đầu sai quy định; tốc độ (chạy nhanh, không giảm tốc độ, không làm chủ tốc độ) và trạng thái người lái (thiếu quan sát, không chú ý) không phải hành vi của ô này mà là kết luận lỗi theo quy tắc 8, kể cả khi gắn với một thao tác (ví dụ \"chuyển hướng thiếu quan sát\")"
  }
}
```

Không có lựa chọn "khác" trong codebook gửi LLM, để hành vi không khớp thành K.
Mỗi ô một giá trị như guideline; guideline chọn vi phạm gắn với C, LLM không thấy C nên lấy hành vi đầu tiên khớp.
Điều kiện "chỉ khi thấy rõ" của guideline do annotator kiểm trên video, không kiểm được từ câu chữ.

Nhóm E, lấy từ [E-thuc-the.md](../../docs/guidelines/E-thuc-the.md):

```json
{
  "các bên": {
    "ghi chú": "mỗi bên là một phương tiện, người hoặc động vật mà câu trả lời liệt kê, theo thứ tự câu viết; \"đoạn\" chép nguyên văn đoạn của câu nói về bên đó; câu gộp nhiều bên (ví dụ \"hai xe máy, một chiếc màu xanh và một chiếc màu tối\") thì tách thành từng bên, mỗi bên lấy đoạn riêng; câu không nêu bên nào (ví dụ \"Không thể xác định\") thì danh sách rỗng; mỗi ô của mỗi bên chọn M, T, K theo quy tắc chung; ô không áp dụng cho loại của bên này thì T; giới tính, tuổi, nhãn hiệu, đời xe, số chỗ, màu quần, màu mũ không thuộc ô nào, đưa vào ngoài codebook với loại \"khác\"; hành động, vị trí của một bên đưa vào ngoài codebook theo quy tắc 8",
    "ô": {
      "loại": {
        "lựa chọn": [
          "ô tô",
          "xe khách",
          "xe tải",
          "xe máy, xe hai bánh",
          "xe ba gác",
          "người đi bộ",
          "động vật",
          "khác"
        ],
        "ghi chú": "loại chi tiết map về loại chung: ô tô con, xe con, SUV, xe 7 chỗ, taxi là ô tô; xe container, xe bán tải, xe ben, xe bồn, xe tải thùng là xe tải; xe tay ga, xe máy điện, xe đạp là xe máy, xe hai bánh; xe máy ba bánh là xe ba gác; người đi xe máy, người điều khiển xe máy là xe máy, xe hai bánh; câu chỉ ghi \"xe\" hoặc chỉ ghi một người mà không nói đi bộ hay đi xe thì T kèm bằng chứng là cụm đó"
      },
      "cỡ": {
        "lựa chọn": [
          "to",
          "nhỏ"
        ],
        "ghi chú": "chỉ với xe khách, xe tải; to, lớn, cỡ lớn là to; nhỏ, cỡ nhỏ là nhỏ; câu không nói cỡ, hoặc bên không phải xe khách, xe tải, thì T"
      },
      "camera hành trình": {
        "lựa chọn": [
          "có",
          "không"
        ],
        "ghi chú": "chỉ với ô tô hoặc xe không rõ loại; câu nói xe có hoặc gắn camera hành trình, xe camera là có; câu nói rõ không phải xe gắn camera là không; câu không nhắc camera thì T, không suy ra không"
      },
      "màu xe": {
        "lựa chọn": [
          "trắng",
          "đen",
          "xám, bạc",
          "đỏ",
          "xanh",
          "vàng",
          "nâu",
          "màu khác",
          "màu sáng",
          "màu tối",
          "không rõ"
        ],
        "ghi chú": "màu thân xe như câu viết; sắc đậm nhạt giữ màu gốc (xanh đen, xanh lá cây, xanh dương là xanh); bạc, xám, ghi là xám, bạc; tím, hồng, cam là màu khác; câu ghi hai màu cho một xe (ví dụ trắng xanh, trắng/bạc) thì chọn màu đầu tiên và nói trong ghi chú; màu sáng, màu tối chỉ khi câu viết như vậy; người đi bộ và động vật không có ô này, nên T"
      },
      "màu áo người điều khiển": {
        "lựa chọn": [
          "trắng",
          "đen",
          "xám, bạc",
          "đỏ",
          "xanh",
          "vàng",
          "nâu",
          "màu khác",
          "màu sáng",
          "màu tối",
          "không rõ"
        ],
        "ghi chú": "màu áo (kể cả áo khoác, áo mưa) của người điều khiển xe máy, xe hai bánh, hoặc của người đi bộ, hoặc của một người không rõ đi bộ hay đi xe; cùng cách quy màu như ô màu xe; bên khác thì T"
      },
      "số người trên xe": {
        "lựa chọn": [
          "1",
          "2",
          "3 trở lên"
        ],
        "ghi chú": "chỉ với xe máy, xe hai bánh; theo mẫu câu của guideline, \"chở N người\" là tổng số người trên xe: chở 2 người là 2, chở 3 hoặc nhiều hơn là 3 trở lên; câu không nói số người thì T, không suy ra 1 từ \"do người ... điều khiển\""
      }
    }
  }
}
```

Các ô và lựa chọn giữ đúng bảng của guideline, kể cả "khác" ở ô loại.
Điều kiện "chỉ điền khi" của guideline (ví dụ cỡ chỉ với xe khách, xe tải) thành T khi không áp dụng; script không kiểm điều kiện này.

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

Riêng nhóm E (danh sách các bên, mỗi bên đủ các ô):

```json
{
  "các bên": [
    {
      "đoạn": "<nguyên văn đoạn nói về bên này>",
      "ô": {
        "<tên ô>": {
          "trạng thái": "M | T | K",
          "giá trị": "<nhãn nguyên văn trong codebook> | null",
          "bằng chứng": "<đoạn nguyên văn> | null",
          "cụm không khớp": "<chỉ khi K> | null"
        }
      }
    }
  ],
  "ngoài codebook": [
    {
      "đoạn": "<nguyên văn>",
      "loại": "<loại>"
    }
  ],
  "ghi chú": "<chỉ khi câu mơ hồ> | null"
}
```

## 6. Few-shot: mỗi nhóm 2 câu thật

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
    {"đoạn": "không giữ khoảng cách an toàn", "loại": "nhóm khác: V"},
    {"đoạn": "không kịp phản ứng", "loại": "kết luận lỗi"}
  ],
  "ghi chú": "Câu lấy xe camera làm chủ ngữ, nhưng chủ thể là bên thay đổi chuyển động trước: xe phía trước phanh. Hành động là T vì câu không nói phanh gấp hay dừng đột ngột."
}
```

### 6.5. Nhóm O, video #12 (4 người, giữ nguyên draft)

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

### 6.6. Nhóm O, video #2 (1 người)

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

### 6.7. Nhóm R, video #36 (1 người)

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

### 6.8. Nhóm R, video #8 (6 người)

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

### 6.9. Nhóm Prev, video #8 (1 người, giữ nguyên draft)

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

### 6.10. Nhóm Prev, video #19 (7 người, giữ nguyên draft)

```text
Nhóm: Prev
Câu hỏi: Người tham gia giao thông nên làm gì để tránh những tình huống tương tự?
Câu trả lời: Nên giảm tốc độ, chú ý quan sát và sẵn sàng xử lý tình huống khi đi vào đường hẹp hoặc góc khuất.
```

```json
{
  "ô": {
    "bên thứ nhất": {"trạng thái": "T", "giá trị": null, "bằng chứng": null, "cụm không khớp": null},
    "hành động chính bên thứ nhất": {"trạng thái": "M", "giá trị": "giảm tốc", "bằng chứng": "giảm tốc độ", "cụm không khớp": null},
    "hành động thêm bên thứ nhất": {"trạng thái": "T", "giá trị": null, "bằng chứng": "chú ý quan sát", "cụm không khớp": null},
    "bên thứ hai": {"trạng thái": "T", "giá trị": null, "bằng chứng": null, "cụm không khớp": null},
    "hành động chính bên thứ hai": {"trạng thái": "T", "giá trị": null, "bằng chứng": null, "cụm không khớp": null},
    "hành động thêm bên thứ hai": {"trạng thái": "T", "giá trị": null, "bằng chứng": null, "cụm không khớp": null}
  },
  "ngoài codebook": [{"đoạn": "sẵn sàng xử lý tình huống", "loại": "lời khuyên chung"}, {"đoạn": "khi đi vào đường hẹp hoặc góc khuất", "loại": "nhóm khác: S"}],
  "ghi chú": "Câu không nêu bên nào nên bên thứ nhất là T, hành động vẫn ghi vào bên thứ nhất. Chú ý quan sát đứng riêng, không gắn thao tác nào, nên hành động thêm là T kèm bằng chứng."
}
```

### 6.11. Nhóm V, video #31 (6 người)

```text
Nhóm: V
Câu hỏi: Có hành vi vi phạm quy tắc giao thông nào được quan sát thấy không?
Câu trả lời: Xe bồn vi phạm quy tắc nhường đường khi đi từ đường không ưu tiên ra đường ưu tiên.
```

```json
{
  "ô": {
    "kết quả": {
      "trạng thái": "M",
      "giá trị": "có",
      "bằng chứng": "Xe bồn vi phạm quy tắc nhường đường",
      "cụm không khớp": null
    },
    "bên vi phạm": {
      "trạng thái": "M",
      "giá trị": "Xe bồn",
      "bằng chứng": "Xe bồn",
      "cụm không khớp": null
    },
    "hành vi": {
      "trạng thái": "M",
      "giá trị": "không nhường đường",
      "bằng chứng": "vi phạm quy tắc nhường đường",
      "cụm không khớp": null
    }
  },
  "ngoài codebook": [
    {
      "đoạn": "khi đi từ đường không ưu tiên ra đường ưu tiên",
      "loại": "nhóm khác: C"
    }
  ],
  "ghi chú": null
}
```

### 6.12. Nhóm V, video #23 (6 người)

```text
Nhóm: V
Câu hỏi: Có hành vi vi phạm quy tắc giao thông nào được quan sát thấy không?
Câu trả lời: Thiếu quan sát và không giảm tốc độ đảm bảo an toàn khi đi qua nơi đường giao nhau.
```

```json
{
  "ô": {
    "kết quả": {
      "trạng thái": "T",
      "giá trị": null,
      "bằng chứng": "Thiếu quan sát và không giảm tốc độ đảm bảo an toàn",
      "cụm không khớp": null
    },
    "bên vi phạm": {
      "trạng thái": "T",
      "giá trị": null,
      "bằng chứng": null,
      "cụm không khớp": null
    },
    "hành vi": {
      "trạng thái": "T",
      "giá trị": null,
      "bằng chứng": null,
      "cụm không khớp": null
    }
  },
  "ngoài codebook": [
    {
      "đoạn": "Thiếu quan sát",
      "loại": "kết luận lỗi"
    },
    {
      "đoạn": "không giảm tốc độ đảm bảo an toàn",
      "loại": "kết luận lỗi"
    },
    {
      "đoạn": "khi đi qua nơi đường giao nhau",
      "loại": "nhóm khác: S"
    }
  ],
  "ghi chú": "Câu chỉ nêu trạng thái người lái và tốc độ, không nêu hành vi vi phạm nhìn thấy được, nên kết quả là T kèm bằng chứng."
}
```

### 6.13. Nhóm E, video #26 (1 người)

```text
Nhóm: E
Câu hỏi: Các phương tiện chính liên quan đến vụ va chạm là gì?
Câu trả lời: Một chiếc xe (có camera hành trình), xe máy màu đỏ do phụ nữ áo đen chở 2 người.
```

```json
{
  "các bên": [
    {
      "đoạn": "Một chiếc xe (có camera hành trình)",
      "ô": {
        "loại": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": "Một chiếc xe",
          "cụm không khớp": null
        },
        "cỡ": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "camera hành trình": {
          "trạng thái": "M",
          "giá trị": "có",
          "bằng chứng": "có camera hành trình",
          "cụm không khớp": null
        },
        "màu xe": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "màu áo người điều khiển": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "số người trên xe": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        }
      }
    },
    {
      "đoạn": "xe máy màu đỏ do phụ nữ áo đen chở 2 người",
      "ô": {
        "loại": {
          "trạng thái": "M",
          "giá trị": "xe máy, xe hai bánh",
          "bằng chứng": "xe máy",
          "cụm không khớp": null
        },
        "cỡ": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "camera hành trình": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "màu xe": {
          "trạng thái": "M",
          "giá trị": "đỏ",
          "bằng chứng": "màu đỏ",
          "cụm không khớp": null
        },
        "màu áo người điều khiển": {
          "trạng thái": "M",
          "giá trị": "đen",
          "bằng chứng": "áo đen",
          "cụm không khớp": null
        },
        "số người trên xe": {
          "trạng thái": "M",
          "giá trị": "2",
          "bằng chứng": "chở 2 người",
          "cụm không khớp": null
        }
      }
    }
  ],
  "ngoài codebook": [
    {
      "đoạn": "phụ nữ",
      "loại": "khác"
    }
  ],
  "ghi chú": "Bên thứ nhất chỉ ghi \"xe\", không nói loại, nên loại là T kèm bằng chứng."
}
```

### 6.14. Nhóm E, video #12 (3 người)

```text
Nhóm: E
Câu hỏi: Các phương tiện chính liên quan trực tiếp đến vụ va chạm là gì?
Câu trả lời: Một chiếc xe SUV hạng sang màu xanh đen (Audi Q8) và một chiếc SUV màu bạc (Honda CR-V).
```

```json
{
  "các bên": [
    {
      "đoạn": "Một chiếc xe SUV hạng sang màu xanh đen (Audi Q8)",
      "ô": {
        "loại": {
          "trạng thái": "M",
          "giá trị": "ô tô",
          "bằng chứng": "xe SUV",
          "cụm không khớp": null
        },
        "cỡ": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "camera hành trình": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "màu xe": {
          "trạng thái": "M",
          "giá trị": "xanh",
          "bằng chứng": "màu xanh đen",
          "cụm không khớp": null
        },
        "màu áo người điều khiển": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "số người trên xe": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        }
      }
    },
    {
      "đoạn": "một chiếc SUV màu bạc (Honda CR-V)",
      "ô": {
        "loại": {
          "trạng thái": "M",
          "giá trị": "ô tô",
          "bằng chứng": "một chiếc SUV",
          "cụm không khớp": null
        },
        "cỡ": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "camera hành trình": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "màu xe": {
          "trạng thái": "M",
          "giá trị": "xám, bạc",
          "bằng chứng": "màu bạc",
          "cụm không khớp": null
        },
        "màu áo người điều khiển": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "số người trên xe": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        }
      }
    }
  ],
  "ngoài codebook": [
    {
      "đoạn": "hạng sang",
      "loại": "khác"
    },
    {
      "đoạn": "Audi Q8",
      "loại": "khác"
    },
    {
      "đoạn": "Honda CR-V",
      "loại": "khác"
    }
  ],
  "ghi chú": null
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
- Đối tượng là K vì câu nêu hai đối tượng mà không nói bên nào bị chạm hoặc phải né trước, nên luật "cặp chính" không áp được từ câu chữ.
- Câu mơ hồ nên có `ghi chú`.

## 9. Chạy thử 3: input thật, nhóm C, trường hợp thường gặp

Video #20, câu của Huỳnh Trung (đồng ý với draft):

```text
Nhóm: C
Câu hỏi: Nguyên nhân trực tiếp hoặc hành động ngay trước va chạm là gì?
Câu trả lời: Xe máy bất ngờ băng qua đường ngay trước đầu xe ô tô đang di chuyển.
```

Output mong muốn:

```json
{
  "ô": {
    "loại sự kiện":  {"trạng thái": "T", "giá trị": null,      "bằng chứng": null,                           "cụm không khớp": null},
    "chủ thể":       {"trạng thái": "M", "giá trị": "xe máy",  "bằng chứng": "Xe máy",                       "cụm không khớp": null},
    "đối tượng":     {"trạng thái": "M", "giá trị": "xe ô tô", "bằng chứng": "xe ô tô đang di chuyển",       "cụm không khớp": null},
    "kiểu xung đột": {"trạng thái": "M", "giá trị": "K14",     "bằng chứng": "băng qua đường ngay trước đầu", "cụm không khớp": null},
    "hành động":     {"trạng thái": "T", "giá trị": null,      "bằng chứng": "băng qua đường",               "cụm không khớp": null},
    "tốc độ":        {"trạng thái": "T", "giá trị": null,      "bằng chứng": null,                           "cụm không khớp": null},
    "bên né":        {"trạng thái": "T", "giá trị": null,      "bằng chứng": null,                           "cụm không khớp": null},
    "cách né":       {"trạng thái": "T", "giá trị": null,      "bằng chứng": null,                           "cụm không khớp": null},
    "kết quả né":    {"trạng thái": "T", "giá trị": null,      "bằng chứng": null,                           "cụm không khớp": null}
  },
  "ngoài codebook": [{"đoạn": "bất ngờ", "loại": "khác"}],
  "ghi chú": "Câu không nói có ở giao lộ hay không; chọn K14 (băng ngang giữa đoạn) theo nghĩa đen, K11 nếu là giao lộ. Hành động là T vì câu không nói hướng băng qua."
}
```

Điểm cần bạn xem:

- Kiểu xung đột: câu không nói giao lộ, nên giữa K14 và K11 mình chọn K14 kèm ghi chú. Nếu bạn muốn những câu thiếu thông tin vị trí là T thì thêm quy tắc vào prompt.
- "bất ngờ" xếp "khác", không phải "kết luận lỗi", vì đây là mô tả cảm nhận về thời điểm, không kết luận ai sai.

## 10. Cần bạn quyết cho nhóm C

1. Duyệt prompt (mục 3, đã thêm danh sách hành vi nhóm V vào quy tắc 8), codebook C (mục 4, đã cập nhật theo guideline C mới) và ba output mong muốn ở mục 6.3, 6.4, 8, 9.
2. Sau khi duyệt: mình mở rộng script cho nhóm C (ô mô tả thực thể không tra codebook; hành động phải thuộc kiểu xung đột đã chọn), chạy thử đúng input mục 8 và 9, so với output mong muốn, rồi mới chạy toàn bộ.

## 11. Chạy thử 4: input thật, nhóm O, hai dấu hiệu cùng mức

Video #37, câu của Huỳnh Trung (1 người viết câu này; 6 người khác viết bản gần giống, "hai người trên xe" thay cho "cả hai người điều khiển trên xe").
Điểm khởi đầu là bản map tay trong [trial-new-groups.md](trial-new-groups.md): "Va chạm vừa, người hoặc xe ngã (M). 'Có thể bị trầy xước' là đoán, bị bỏ."

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

- Bản map tay dùng nhãn cũ "người hoặc xe ngã"; quyết định 2 ngày 2026-11-14 đã tách thành hai nhãn, nên giờ câu này có hai dấu hiệu cùng mức và phải chọn một.
- "ngã xuống đường" là người ngã, không phải người nằm trên đường (mức mạnh): câu nói ngã, không nói nằm lại.
- "Cả hai xe máy bị đổ" không vào ngoài codebook vì nó thuộc ô dấu hiệu, chỉ thua ở bước chọn dấu hiệu nặng nhất; ghi chú nêu lại để không mất.

## 12. Chạy thử 5: input thật, nhóm O, mức độ suy từ dấu hiệu

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

- Câu không có chữ "va chạm mạnh"; mức độ là M vì bảng guideline xếp "bị lật" vào va chạm mạnh. Bản map tay cũng ghi "Va chạm mạnh, xe lật (M)".
- Nhãn event của video là near-miss, nhưng theo guideline C, xe tự lật vẫn là va chạm, nên mức độ không phải "không va chạm".
- "xuống rãnh bên đường" là vị trí xe nằm sau khi lật, không có ô nào trong O, nên vào "khác".

## 13. Chạy thử 6: input thật, nhóm R, hai bên cùng hành vi

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

- Bản map tay ở [trial-new-groups.md](trial-new-groups.md) ghi "chủ thể và đối tượng: tiếp tục di chuyển, rời đi", tức hai ô.
  Ở đây câu kể chung cho hai bên nên cả cụm vào bên thứ nhất, bên thứ hai là T, đúng mẫu câu "Hai bên cùng hành vi: Các bên [1]" của guideline.
  Ở P2, "cả 2 phương tiện" được trải ra cho cả chủ thể và đối tượng.
- Cách này không có trong few-shot; nếu model tách thành hai bên hoặc để bên thứ nhất là T thì cần thêm một few-shot cho câu kể chung.

## 14. Chạy thử 7: input thật, nhóm R, chỉ có người xung quanh

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

## 15. Chạy thử 8: input thật, nhóm Prev, hai bên hai hành động

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

- Bản map tay ở [trial-new-groups.md](trial-new-groups.md) ghi vế ô tô giảm tốc là K, vì lúc đó Prev chỉ có một bên.
  Sau quyết định 4 (một hoặc cả hai bên), vế này là M ở bên thứ hai.
- "khi tới gần khu vực có vạch kẻ đường" là hoàn cảnh, xếp vào nhóm S theo quy tắc 8; codebook S hiện không có ô nào chứa vạch kẻ đường, nên ở nhóm S nó cũng sẽ là phần ngoài codebook.

## 16. Chạy thử 9: input thật, nhóm Prev, một bên hai hành động

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
- "khi thấy các phương tiện phía trước đang dừng" là tình huống của nhóm C (xe phía trước dừng, K01), nên vào "nhóm khác: C"; quy tắc 8 đã thêm C vào danh sách.


## 17. Chạy thử 10: input thật, nhóm V, nhiều hành vi trong một câu

Video #1, câu của Huỳnh Trung (1 người).

```text
Nhóm: V
Câu hỏi: Có hành vi vi phạm giao thông nào được quan sát thấy không?
Câu trả lời: Người đi xe máy mặc áo trắng không đội mũ bảo hiểm chuyển hướng thiếu quan sát và tác động vật lí người khác.
```

Output mong muốn:

```json
{
  "ô": {
    "kết quả": {
      "trạng thái": "M",
      "giá trị": "có",
      "bằng chứng": "không đội mũ bảo hiểm",
      "cụm không khớp": null
    },
    "bên vi phạm": {
      "trạng thái": "M",
      "giá trị": "Người đi xe máy mặc áo trắng",
      "bằng chứng": "Người đi xe máy mặc áo trắng",
      "cụm không khớp": null
    },
    "hành vi": {
      "trạng thái": "M",
      "giá trị": "không đội mũ bảo hiểm",
      "bằng chứng": "không đội mũ bảo hiểm",
      "cụm không khớp": null
    }
  },
  "ngoài codebook": [
    {
      "đoạn": "chuyển hướng thiếu quan sát",
      "loại": "kết luận lỗi"
    },
    {
      "đoạn": "tác động vật lí người khác",
      "loại": "nhóm khác: R"
    }
  ],
  "ghi chú": null
}
```

Điểm cần bạn xem:

- "chuyển hướng thiếu quan sát" là kết luận lỗi, không phải "chuyển hướng, quay đầu sai quy định", vì câu không nói rẽ ở chỗ cấm.
- "tác động vật lí người khác" xảy ra sau va chạm, thuộc R.

## 18. Chạy thử 11: input thật, nhóm V, không thấy vi phạm

Video #59, câu của Mai Linh (1 người).

```text
Nhóm: V
Câu hỏi: Có hành vi vi phạm quy tắc giao thông nào quan sát được không?
Câu trả lời: Không quan sát thấy vi phạm rõ ràng, nhưng tài xế xe con đã không làm chủ được tốc độ và tay lái trong điều kiện đường trơn.
```

Output mong muốn:

```json
{
  "ô": {
    "kết quả": {
      "trạng thái": "M",
      "giá trị": "không quan sát thấy",
      "bằng chứng": "Không quan sát thấy vi phạm rõ ràng",
      "cụm không khớp": null
    },
    "bên vi phạm": {
      "trạng thái": "T",
      "giá trị": null,
      "bằng chứng": null,
      "cụm không khớp": null
    },
    "hành vi": {
      "trạng thái": "T",
      "giá trị": null,
      "bằng chứng": null,
      "cụm không khớp": null
    }
  },
  "ngoài codebook": [
    {
      "đoạn": "tài xế xe con đã không làm chủ được tốc độ và tay lái",
      "loại": "kết luận lỗi"
    },
    {
      "đoạn": "trong điều kiện đường trơn",
      "loại": "nhóm khác: S"
    }
  ],
  "ghi chú": null
}
```

Điểm cần bạn xem:

- Kết quả là "không quan sát thấy" vì câu nói thẳng như vậy; phần sau là kết luận lỗi, không làm đổi kết quả.

## 19. Chạy thử 12: input thật, nhóm V, chuyển làn không xi nhan

Video #27, câu của Mai Linh (1 người).

```text
Nhóm: V
Câu hỏi: Có hành vi vi phạm quy tắc giao thông nào quan sát được không?
Câu trả lời: xe ô tô con màu trắng chuyển làn không xi nhan, chen lấn làn.
```

Output mong muốn:

```json
{
  "ô": {
    "kết quả": {
      "trạng thái": "M",
      "giá trị": "có",
      "bằng chứng": "chuyển làn không xi nhan",
      "cụm không khớp": null
    },
    "bên vi phạm": {
      "trạng thái": "M",
      "giá trị": "xe ô tô con màu trắng",
      "bằng chứng": "xe ô tô con màu trắng",
      "cụm không khớp": null
    },
    "hành vi": {
      "trạng thái": "M",
      "giá trị": "đi sai làn, lấn làn",
      "bằng chứng": "chen lấn làn",
      "cụm không khớp": null
    }
  },
  "ngoài codebook": [
    {
      "đoạn": "chuyển làn không xi nhan",
      "loại": "khác"
    }
  ],
  "ghi chú": null
}
```

Điểm cần bạn xem:

- Codebook V không có lựa chọn cho "không xi nhan"; hành vi đầu tiên khớp là "chen lấn làn", nên "chuyển làn không xi nhan" vào "khác".
- "không xi nhan" xuất hiện trong 6 câu V (#1, #14, #16, #27, #42, #45); câu chỉ có "không xi nhan" sẽ thành K.

## 20. Chạy thử 13: input thật, nhóm E, hai bên gộp trong một cụm

Video #38, câu của Nhật Trường, Tuấn Hùng, Đức Mạnh (3 người).

```text
Nhóm: E
Câu hỏi: Các phương tiện liên quan trực tiếp đến vụ va chạm gồm những loại nào và màu sắc gì?
Câu trả lời: Gồm hai xe máy, một chiếc màu xanh và một chiếc màu tối.
```

Output mong muốn:

```json
{
  "các bên": [
    {
      "đoạn": "một chiếc màu xanh",
      "ô": {
        "loại": {
          "trạng thái": "M",
          "giá trị": "xe máy, xe hai bánh",
          "bằng chứng": "hai xe máy",
          "cụm không khớp": null
        },
        "cỡ": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "camera hành trình": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "màu xe": {
          "trạng thái": "M",
          "giá trị": "xanh",
          "bằng chứng": "màu xanh",
          "cụm không khớp": null
        },
        "màu áo người điều khiển": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "số người trên xe": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        }
      }
    },
    {
      "đoạn": "một chiếc màu tối",
      "ô": {
        "loại": {
          "trạng thái": "M",
          "giá trị": "xe máy, xe hai bánh",
          "bằng chứng": "hai xe máy",
          "cụm không khớp": null
        },
        "cỡ": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "camera hành trình": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "màu xe": {
          "trạng thái": "M",
          "giá trị": "màu tối",
          "bằng chứng": "màu tối",
          "cụm không khớp": null
        },
        "màu áo người điều khiển": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "số người trên xe": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        }
      }
    }
  ],
  "ngoài codebook": [],
  "ghi chú": null
}
```

Điểm cần bạn xem:

- "hai xe máy" tách thành hai bên; cả hai bên lấy loại từ cùng cụm "hai xe máy".

## 21. Chạy thử 14: input thật, nhóm E, một người không rõ đi bộ hay đi xe

Video #1, câu của Tuấn Anh (1 người).

```text
Nhóm: E
Câu hỏi: Các phương tiện chính liên quan đến vụ va chạm gồm những gì?
Câu trả lời: Một ô tô con (xe camera), một xe máy màu đen do người đàn ông mặc áo trắng điều khiển, một người đàn ông áo xanh.
```

Output mong muốn:

```json
{
  "các bên": [
    {
      "đoạn": "Một ô tô con (xe camera)",
      "ô": {
        "loại": {
          "trạng thái": "M",
          "giá trị": "ô tô",
          "bằng chứng": "ô tô con",
          "cụm không khớp": null
        },
        "cỡ": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "camera hành trình": {
          "trạng thái": "M",
          "giá trị": "có",
          "bằng chứng": "xe camera",
          "cụm không khớp": null
        },
        "màu xe": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "màu áo người điều khiển": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "số người trên xe": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        }
      }
    },
    {
      "đoạn": "một xe máy màu đen do người đàn ông mặc áo trắng điều khiển",
      "ô": {
        "loại": {
          "trạng thái": "M",
          "giá trị": "xe máy, xe hai bánh",
          "bằng chứng": "xe máy",
          "cụm không khớp": null
        },
        "cỡ": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "camera hành trình": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "màu xe": {
          "trạng thái": "M",
          "giá trị": "đen",
          "bằng chứng": "màu đen",
          "cụm không khớp": null
        },
        "màu áo người điều khiển": {
          "trạng thái": "M",
          "giá trị": "trắng",
          "bằng chứng": "áo trắng",
          "cụm không khớp": null
        },
        "số người trên xe": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        }
      }
    },
    {
      "đoạn": "một người đàn ông áo xanh",
      "ô": {
        "loại": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": "một người đàn ông",
          "cụm không khớp": null
        },
        "cỡ": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "camera hành trình": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "màu xe": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "màu áo người điều khiển": {
          "trạng thái": "M",
          "giá trị": "xanh",
          "bằng chứng": "áo xanh",
          "cụm không khớp": null
        },
        "số người trên xe": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        }
      }
    }
  ],
  "ngoài codebook": [
    {
      "đoạn": "người đàn ông",
      "loại": "khác"
    }
  ],
  "ghi chú": "Bên thứ ba là một người nhưng câu không nói đi bộ hay đi xe, nên loại là T kèm bằng chứng."
}
```

Điểm cần bạn xem:

- Bên thứ ba: loại là T thay vì đoán "người đi bộ"; màu áo vẫn là M.
- Bên thứ hai: "do người ... điều khiển" không suy ra số người là 1, nên số người là T.

## 22. Chạy thử 15: input thật, nhóm E, xe bán tải và cỡ xe

Video #27, câu của Huỳnh Trung, Mai Linh, Tuyết Hạnh, Tuấn Hùng (4 người).

```text
Nhóm: E
Câu hỏi: Loại phương tiện và màu sắc của các bên liên quan là gì?
Câu trả lời: Xe ô tô con màu trắng, xe bán tải Ford Ranger màu đen và xe tải lớn màu xám.
```

Output mong muốn:

```json
{
  "các bên": [
    {
      "đoạn": "Xe ô tô con màu trắng",
      "ô": {
        "loại": {
          "trạng thái": "M",
          "giá trị": "ô tô",
          "bằng chứng": "Xe ô tô con",
          "cụm không khớp": null
        },
        "cỡ": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "camera hành trình": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "màu xe": {
          "trạng thái": "M",
          "giá trị": "trắng",
          "bằng chứng": "màu trắng",
          "cụm không khớp": null
        },
        "màu áo người điều khiển": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "số người trên xe": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        }
      }
    },
    {
      "đoạn": "xe bán tải Ford Ranger màu đen",
      "ô": {
        "loại": {
          "trạng thái": "M",
          "giá trị": "xe tải",
          "bằng chứng": "xe bán tải",
          "cụm không khớp": null
        },
        "cỡ": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "camera hành trình": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "màu xe": {
          "trạng thái": "M",
          "giá trị": "đen",
          "bằng chứng": "màu đen",
          "cụm không khớp": null
        },
        "màu áo người điều khiển": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "số người trên xe": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        }
      }
    },
    {
      "đoạn": "xe tải lớn màu xám",
      "ô": {
        "loại": {
          "trạng thái": "M",
          "giá trị": "xe tải",
          "bằng chứng": "xe tải lớn",
          "cụm không khớp": null
        },
        "cỡ": {
          "trạng thái": "M",
          "giá trị": "to",
          "bằng chứng": "xe tải lớn",
          "cụm không khớp": null
        },
        "camera hành trình": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "màu xe": {
          "trạng thái": "M",
          "giá trị": "xám, bạc",
          "bằng chứng": "màu xám",
          "cụm không khớp": null
        },
        "màu áo người điều khiển": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        },
        "số người trên xe": {
          "trạng thái": "T",
          "giá trị": null,
          "bằng chứng": null,
          "cụm không khớp": null
        }
      }
    }
  ],
  "ngoài codebook": [
    {
      "đoạn": "Ford Ranger",
      "loại": "khác"
    }
  ],
  "ghi chú": null
}
```

Điểm cần bạn xem:

- Xe bán tải là xe tải theo guideline; câu không nói cỡ nên cỡ là T.
- "xe tải lớn" cho cỡ là to.
