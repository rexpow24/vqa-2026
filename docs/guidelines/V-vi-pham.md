# Hướng dẫn gán nhãn Nhóm V: vi phạm (Violation)

- Câu hỏi chuẩn: Có hành vi vi phạm quy tắc giao thông nào quan sát được không?
- Tên thực thể A, B, C lấy từ Nhóm E.
- Mỗi ô chọn đúng một giá trị. Có nhiều vi phạm thì chọn vi phạm gắn với hành động ở Nhóm C.
- Chỉ ghi hành vi nhìn thấy được. Không ghi quá tốc độ, nồng độ cồn, giấy phép, đăng kiểm, trạng thái người lái (mất tập trung, liều lĩnh).
- "Không thấy" khác "không có": chỉ chọn "không quan sát thấy" khi video đủ rõ để khẳng định.

## Các ô

| Ô | Lựa chọn |
| --- | --- |
| 0. Kết quả | có · không quan sát thấy · không rõ |
| 1. Bên vi phạm (khi có) | chọn từ E |
| 2. Hành vi (khi có) | đi sai làn, lấn làn · đi ngược chiều · vượt đèn đỏ · không chấp hành biển báo, vạch kẻ đường · không nhường đường · không giữ khoảng cách an toàn · vượt xe sai quy định · chuyển hướng, quay đầu sai quy định · lùi xe sai quy định · không đội mũ bảo hiểm · đi bộ dưới lòng đường · khác |

Điều kiện cho ô 2:
- Vượt đèn đỏ: chỉ khi thấy rõ đèn.
- Không chấp hành biển báo, vạch kẻ đường: chỉ khi thấy rõ biển hoặc vạch. Người đi bộ sang đường khi đèn dành cho người đi bộ đỏ cũng chọn lựa chọn này.
- Không nhường đường: chỉ khi thấy rõ bên có quyền đi trước (xe đang đi thẳng trên đường chính, người đi bộ trên vạch, xe trong giao lộ). Dùng cho cả xe và người đi bộ.
- Vượt xe sai quy định: chỉ khi thấy rõ vượt qua vạch liền, tại giao lộ hoặc khúc cua.
- Chuyển hướng, quay đầu sai quy định: chỉ khi thấy rõ biển cấm, vạch liền hoặc vị trí không được rẽ, quay đầu.
- Không đội mũ bảo hiểm: chỉ khi thấy rõ đầu người trên xe máy.
- Đi bộ dưới lòng đường: người đi bộ đứng hoặc đi dọc trong phần đường xe chạy, không phải băng qua.
- Khác: ghi ngắn hành vi nhìn thấy, không dùng từ "lỗi", "vi phạm điều/khoản", mức phạt.

Gợi ý điền sẵn ô 2 theo kiểu xung đột ở C (annotator đổi được):

| Kiểu xung đột ở C | Hành vi điền sẵn |
| --- | --- |
| K01-K03 | không giữ khoảng cách an toàn |
| K04; K08 khi vào cua hoặc đi thẳng | đi sai làn, lấn làn |
| K05; K08 khi vượt | vượt xe sai quy định |
| K06, K10, K13 | chuyển hướng, quay đầu sai quy định |
| K09 | đi ngược chiều |
| K11, K12, K14, K15 | không nhường đường |
| K17 | lùi xe sai quy định |

## Cơ sở

Danh sách ô 2 lấy từ MMUCC 5th Edition (NHTSA 2017), phần tử P14 "Driver Actions at Time of Crash", giữ các giá trị nhìn thấy được trên video (mã 01-08, 13, 14, 16, 98).
Bỏ mã 09 và 10 (đánh giá trạng thái người lái), 11 và 15 (hành động né, thuộc C), 12 (chạy khỏi đường, thuộc C và O).
"Không đội mũ bảo hiểm" theo MMUCC P8; "đi bộ dưới lòng đường" theo MMUCC NM3 mã 09.
Chi tiết đối chiếu: `features/codebook-multiple-choice/v-taxonomy.md`.

## Mẫu câu

| Kết quả | Mẫu câu |
| --- | --- |
| Có | [1] [2]. |
| Không quan sát thấy | Không quan sát thấy vi phạm quy tắc giao thông rõ ràng. |
| Không rõ | Không thể xác định. |
