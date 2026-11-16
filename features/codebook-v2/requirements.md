# Codebook v2 sau lần đánh thử 10 video (yêu cầu)

2026-11-16.
Nguồn: nhận xét của trưởng nhóm và annotator sau khi đánh thử 10 video agreement bằng form ô (P4, [../slot-form/requirements.md](../slot-form/requirements.md)).
Dữ liệu ô đã có từ P2 ([../slot-data-model/spec.md](../slot-data-model/spec.md)); codebook có phiên bản, v1 đã chốt và không sửa.

## Quyết định của trưởng nhóm (không hỏi lại)

1. Giữ C và V là hai câu hỏi riêng, không gộp.
   Lý do: 90% trùng nhau vì form bắt đầu trống, nên annotator chọn lại ở V những gì vừa chọn ở C; 10% còn lại (chủ thể khác bên vi phạm) là trường hợp có giá trị nhất.
   Thay vào đó, form điền sẵn V từ C.
2. Câu ghép: sửa mẫu câu cho mạch lạc (thêm từ nối), không cho annotator sửa tay câu.
   Trưởng nhóm sẽ gửi vài câu ví dụ nhóm muốn sửa.
   Cập nhật cùng ngày: trưởng nhóm đổi quyết định, cho annotator sửa câu ghép nhưng chỉ được thêm từ nối.
   Server kiểm: mọi chữ của câu ghép phải còn, đúng thứ tự (chữ hoa và dấu câu được đổi); sai thì từ chối với mã `sentence_edit`.
3. S: thêm ô mới "Chất liệu mặt đường" (nhựa, đất cát, không rõ); ô "Loại đường" giữ nguyên.
4. C: bỏ hẳn 3 ô bên né, cách né, kết quả né ở mọi loại sự kiện.

## Thay đổi codebook

Codebook mới là file mới (`codebook/<nhóm>.v2.json`, Attr là `Attr.v1.json`); file v1 không sửa.

| Nhóm | Thay đổi |
| --- | --- |
| S | Thời tiết: "tạnh ráo" thay cho "âm u". |
| S | Ô mới "Chất liệu mặt đường": nhựa · đất cát · không rõ. |
| C | Ô Tốc độ thêm "tốc độ cao" (video 81). |
| C | Bỏ ô bên né, cách né, kết quả né; mẫu câu suýt va chạm không còn phần né. |
| V | Bên vi phạm chọn được "cả hai bên"; khi đó mỗi bên một ô hành vi, như C. |
| V | Hành vi thêm "không giảm tốc độ qua giao lộ". |
| Attr | Thành nhóm dạng ô: chọn một hoặc hai bên từ E, hoặc "không rõ"; không còn khóa theo chủ thể của C. Vẫn chọn 2 mốc start, end. |

Cơ sở (nguyên tắc 8):
- "không giảm tốc độ qua giao lộ": Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15, Điều 12 khoản 3 điểm d (phải quan sát, giảm tốc độ hoặc dừng lại ở nơi đường bộ giao nhau cùng mức).
  Thông tư 38/2024/TT-BGTVT, Điều 5 khoản 1 (bản gốc trên datafiles.chinhphu.vn, đã đọc) dẫn sang Điều 12 của Luật; văn bản Điều 12 mới đọc qua hethongphapluat.com, chưa đối chiếu Công báo.
  Điều kiện chọn: chỉ khi thấy rõ là giao lộ và thấy rõ xe không giảm tốc khi vào giao lộ.
- "tốc độ cao": MMUCC 5th Edition (NHTSA 2017), phần tử P13 "Speeding-Related"; NHTSA ghi rằng phần tử này được mã hóa theo bằng chứng lời nói hoặc nhìn thấy.
  Danh sách giá trị của P13 chưa đọc được bản gốc (không tải được file).
  Rủi ro: tốc độ ước bằng mắt nên hai annotator có thể chọn khác nhau; xem lại ở vòng đồng thuận sau.

## Thay đổi form

- F-V: mở V khi V chưa lưu và C đã lưu thì điền sẵn bên vi phạm (chủ thể của C, kể cả "cả hai bên") và hành vi theo bảng `prefill_from_c` của codebook V, kết quả là "có"; annotator sửa được và vẫn phải bấm Lưu.
  Ô điền sẵn có dấu hiệu nhìn thấy được là "điền sẵn từ C".
- F-N: N hiển thị cuối cùng trên form; chỉ đổi thứ tự hiển thị, không đổi dữ liệu hay thứ tự export.
- F-Q: câu hỏi của mỗi nhóm to và nổi bật hơn (ý kiến annotator), ở cả form ô và form câu chữ.
- F-v1: câu đã lưu bằng v1 vẫn mở được; lựa chọn còn trong bản mới được giữ, lựa chọn đã bỏ (ví dụ "âm u") để trống kèm ghi chú, và lưu lại thì lưu bằng bản mới.

## Ngoài phạm vi

- Gộp C và V.
- Cho sửa tự do câu ghép (chỉ được thêm từ nối, xem quyết định 2).
- Điền sẵn Prev từ Attr (guideline Prev có ghi, nhưng trưởng nhóm chỉ yêu cầu V).

## Tiêu chí chấp nhận

- AC1. `codebook_versions` có thêm S.v2, C.v2, V.v2, Attr.v1, trùng file; các dòng v1 không đổi.
- AC2. Câu dạng ô mới lưu bằng bản mới nhất; câu v1 đã lưu trên production (10 video) vẫn đọc, xuất và mở được.
- AC3. Database từ chối lựa chọn đã bỏ khi lưu bằng v2 (ví dụ `weather.overcast` ở S.v2, ô né ở C.v2).
- AC4. V điền sẵn đúng từ C ở cả trường hợp một bên và cả hai bên; không điền sẵn khi V đã lưu.
- AC5. Attr lưu được một bên, hai bên, "không rõ", kèm start và end.
- AC6. Guideline S, C, V, Attr và thư mục `annotator-guidelines/` cập nhật theo bản mới.
- AC7. `verify-slots.mjs`, các verify cũ, test form và compose, pytest, tsc, lint đều pass trên local; có ảnh chụp form mới.
- AC8. Lên production (migration, deploy) cần trưởng nhóm cho phép riêng.
