# Đề xuất taxonomy cho Nhóm V (vi phạm)

Ngày 2026-11-14. Trạng thái: đã áp vào `docs/guidelines/V-vi-pham.md` cùng ngày.

## Nguồn

- MMUCC 5th Edition (2017), NHTSA, phần tử P14 "Driver Actions at Time of Crash", trang 73. Đã đọc bản gốc.
  Đây là bộ tiêu chí tối thiểu mà các bang Hoa Kỳ dùng để ghi biên bản tai nạn; P14 là danh sách hành động của người lái góp phần gây tai nạn, chọn 1-4 giá trị.
- MMUCC 5th Edition, NM3 "Non-Motorist Contributing Action(s)/Circumstance(s)", trang 116, cho người đi bộ và xe đạp. Đã đọc bản gốc.
- MMUCC 5th Edition, P8 "Restraint Systems/Motorcycle Helmet Use", cho mũ bảo hiểm. Đã đọc bản gốc.
- Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15, Chương II (quy tắc giao thông), để đối chiếu với luật Việt Nam. Mới kiểm qua tài liệu thứ cấp; số điều chưa đối chiếu với văn bản gốc nên chưa ghi.

Lý do chọn P14 thay vì P15 "Violation Codes": P15 là mã vi phạm theo luật từng bang, không phải danh mục chung.

## Đối chiếu P14 với guideline V

Guideline V chỉ ghi hành vi nhìn thấy được, không đoán tốc độ, trạng thái người lái hay ý định.
Vì vậy các giá trị P14 dựa trên phán đoán của cảnh sát hoặc mô tả hành động né được loại ra.

| Mã P14 | Tên gốc | Nhãn đề xuất cho V | Có trong V hiện tại |
| --- | --- | --- | --- |
| 03 | Failed to Keep in Proper Lane | đi sai làn, lấn làn | có ("đi sai làn") |
| 16 | Wrong Side or Wrong Way | đi ngược chiều | có |
| 13 | Ran Red Light | vượt đèn đỏ (chỉ khi thấy rõ đèn) | có |
| 01, 02, 14 | Disregarded Other Road Markings; Disregarded Other Traffic Sign; Ran Stop Sign | không chấp hành biển báo, vạch kẻ đường (chỉ khi thấy rõ biển hoặc vạch) | chưa |
| 04 | Failed to Yield Right-of-Way | không nhường đường | có, nhưng đang tách làm hai ("tại giao lộ", "sang đường"); P14 chỉ có một |
| 05 | Followed Too Closely | không giữ khoảng cách an toàn | có |
| 07 | Improper Passing | vượt xe sai quy định (chỉ khi thấy rõ vạch liền, giao lộ hoặc khúc cua) | chưa |
| 08 | Improper Turn | chuyển hướng, quay đầu sai quy định | chưa |
| 06 | Improper Backing | lùi xe sai quy định | chưa |
| 98 | Other Contributing Action | khác | có |
| 00 | No Contributing Action | (ô 0 "không quan sát thấy") | có |
| 99 | Unknown | (ô 0 "không rõ") | có |

Loại ra:

| Mã P14 | Tên gốc | Lý do |
| --- | --- | --- |
| 09 | Inattentive, Careless, Negligent, or Erratic Manner | Đoán trạng thái người lái, guideline cấm |
| 10 | Reckless or Aggressive Manner | Kết luận đánh giá, không phải hành vi nhìn thấy |
| 11 | Over-Correcting/Over-Steering | Hành động né, thuộc C (cách né) |
| 12 | Ran Off Roadway | Hậu quả, thuộc C (K18) và O |
| 15 | Swerved or Avoided Due to ... | Hành động né, thuộc C |

## Bổ sung ngoài P14

| Nhãn | Nguồn | Ghi chú |
| --- | --- | --- |
| không đội mũ bảo hiểm | MMUCC P8 (mũ bảo hiểm xe máy); Luật 36/2024 | Đã có trong V |
| người đi bộ đi dưới lòng đường không đúng chỗ | MMUCC NM3 mã 09 (In Roadway Improperly) | Cho bên là người đi bộ |
| người đi bộ không chấp hành tín hiệu | MMUCC NM3 mã 04 | Chỉ khi thấy rõ đèn hoặc biển |

Người đi bộ dùng chung "không nhường đường" (NM3 mã 05) và "đi ngược chiều" (NM3 mã 11).
NM3 mã 01 "Dart/Dash" (lao ra đột ngột) là hành động, đã nằm ở C (K15), không đưa vào V.

## Danh sách ô 2 đề xuất

đi sai làn, lấn làn · đi ngược chiều · vượt đèn đỏ · không chấp hành biển báo, vạch kẻ đường · không nhường đường · không giữ khoảng cách an toàn · vượt xe sai quy định · chuyển hướng, quay đầu sai quy định · lùi xe sai quy định · không đội mũ bảo hiểm · đi bộ dưới lòng đường · khác

So với V hiện tại: gộp hai lựa chọn "không nhường đường" thành một, thêm 5 lựa chọn (biển báo và vạch, vượt xe, chuyển hướng, lùi xe, đi bộ dưới lòng đường).

## Liên hệ với C

| Kiểu xung đột ở C | Vi phạm thường đi kèm |
| --- | --- |
| K01-K03 | không giữ khoảng cách an toàn |
| K04 | đi sai làn, lấn làn |
| K05, K08 khi vượt | vượt xe sai quy định |
| K06, K10, K13 | chuyển hướng, quay đầu sai quy định; không nhường đường |
| K08 khi vào cua, đi thẳng | đi sai làn, lấn làn |
| K09 | đi ngược chiều |
| K11, K12, K14 | không nhường đường; vượt đèn đỏ khi thấy rõ đèn |
| K15 | không nhường đường (bên xe); đi bộ dưới lòng đường (bên người đi bộ) |
| K17 | lùi xe sai quy định |

Bảng này chỉ để gợi ý điền sẵn, giống Prev; V vẫn có thể là "không quan sát thấy" khi C có xung đột.
