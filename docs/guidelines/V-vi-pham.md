# Hướng dẫn gán nhãn Nhóm V: vi phạm (Violation)

- Câu hỏi chuẩn: Có hành vi vi phạm quy tắc giao thông nào quan sát được hoặc suy ra hẹp từ C không?
- Tên thực thể A, B, C lấy từ Nhóm E.
- Kết quả, bên và hành vi chính được hệ thống suy ra từ nhóm C theo quy tắc hẹp; annotator không sửa các ô này.
- Chỉ K09 của C mới tự sinh hành vi đi ngược chiều, và chỉ khi chủ thể là thực thể xác định, không phải động vật.
- Với K01-K08, K10-K18 hoặc C không rõ, kết quả V tự sinh là “không rõ”; không suy ra lỗi chỉ từ kiểu xung đột.
- Annotator có thể chọn nhiều hành vi bổ sung nhìn thấy rõ và phải gắn chúng với một thực thể người tham gia đã khai báo ở E.
- Chỉ ghi hành vi nhìn thấy được. Không ghi quá tốc độ, nồng độ cồn, giấy phép, đăng kiểm, trạng thái người lái (mất tập trung, liều lĩnh).
- “Không thấy” khác “không có”; kết quả chính do hệ thống xác định và không được annotator tự đổi.

## Các ô

| Ô | Nội dung |
| --- | --- |
| Kết quả, bên, hành vi chính | Tự suy ra từ C; không sửa được |
| Bên có hành vi bổ sung | Chọn một thực thể người tham gia từ E; không chọn động vật |
| Hành vi vi phạm bổ sung | Chọn nhiều tag khi nhìn thấy rõ; chỉ lưu cùng bên đã chọn ở ô trên |

Các tag bổ sung được gắn với đúng một bên đã chọn ở E để câu trả lời không mất attribution.
Nếu người điều khiển vật nuôi nhìn thấy rõ, đã khai báo ở E, và hành vi của người đó nhìn thấy rõ, có thể chọn người đó.

## Vật nuôi và động vật

- Không bao giờ chọn con vật làm bên vi phạm ở V.
- Con vật vẫn có thể là thực thể trong E và là chủ thể/tác nhân trong C khi nó tham gia diễn biến va chạm.
- Nếu video cho thấy rõ người điều khiển hoặc dẫn dắt vật nuôi có hành vi vi phạm, khai báo người đó ở E rồi chọn người đó cùng tag vi phạm bổ sung.
- Chỉ nhận diện được chủ nuôi, thấy họ đứng gần con vật hoặc đến nhận con vật sau sự việc chưa đủ để gán V cho họ.
- Nếu không thấy rõ hành vi của người đó, không suy đoán trách nhiệm chỉ từ việc con vật gây tai nạn.
- Nếu vật nuôi đi rông nhưng không thấy người điều khiển/dẫn dắt, không gán V cho con vật hoặc một người không xuất hiện; giữ V là “không rõ” trừ khi có một hành vi khác của người nhìn thấy rõ.
- Nếu không xác định được đó là vật nuôi hay động vật hoang dã, không gán vi phạm cho con vật hoặc người không nhìn thấy.

Điều kiện cho các tag bổ sung:
- Vượt đèn đỏ: chỉ khi thấy rõ đèn.
- Không chấp hành biển báo, vạch kẻ đường: chỉ khi thấy rõ biển hoặc vạch. Người đi bộ sang đường khi đèn dành cho người đi bộ đỏ cũng chọn lựa chọn này.
- Không nhường đường: chỉ khi thấy rõ bên có quyền đi trước (xe đang đi thẳng trên đường chính, người đi bộ trên vạch, xe trong giao lộ). Dùng cho cả xe và người đi bộ.
- Vượt xe sai quy định: chỉ khi thấy rõ vượt qua vạch liền, tại giao lộ hoặc khúc cua.
- Chuyển hướng, quay đầu sai quy định: chỉ khi thấy rõ biển cấm, vạch liền hoặc vị trí không được rẽ, quay đầu.
- Không đội mũ bảo hiểm: chỉ khi thấy rõ đầu người trên xe máy.
- Đi bộ dưới lòng đường: người đi bộ đứng hoặc đi dọc trong phần đường xe chạy, không phải băng qua.
- Không giảm tốc độ qua giao lộ: chỉ khi thấy rõ là giao lộ và thấy rõ xe không giảm tốc khi vào giao lộ.
- Khác: ghi ngắn hành vi nhìn thấy, không dùng từ "lỗi", "vi phạm điều/khoản", mức phạt.

Kết quả V được lưu cùng lần lưu C và tự đồng bộ khi mở lại video.

## Cơ sở phân loại

Danh sách ô 2 lấy từ MMUCC 5th Edition (NHTSA 2017), phần tử P14 "Driver Actions at Time of Crash", giữ các giá trị nhìn thấy được trên video (mã 01-08, 13, 14, 16, 98).
Bỏ mã 09 và 10 (đánh giá trạng thái người lái), 11 và 15 (hành động né, thuộc C), 12 (chạy khỏi đường, thuộc C và O).
"Không đội mũ bảo hiểm" theo MMUCC P8; "đi bộ dưới lòng đường" theo MMUCC NM3 mã 09.
"Không giảm tốc độ qua giao lộ": Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15, Điều 12 khoản 3 điểm d (phải quan sát, giảm tốc độ hoặc dừng lại ở nơi đường bộ giao nhau cùng mức).
Các căn cứ pháp lý và đường dẫn nguồn chính thức được lưu tại `docs/research/v-animal-traffic-law.md` để trích dẫn khi viết khóa luận.
Frontend chỉ hiển thị quy tắc gán nhãn, không hiển thị trích dẫn pháp luật.
Chi tiết phân loại hành vi: `features/codebook-multiple-choice/v-taxonomy.md`.

## Cơ sở suy luận và trích dẫn

V chỉ kế thừa K09 từ C vì mã này nói rõ đi ngược chiều trên làn của bên khác.

Các hành vi chuyển làn, vượt, rẽ, quay đầu, băng ngang và lùi xe có thể phụ thuộc biển/vạch, quyền ưu tiên, vị trí hoặc điều kiện không thể suy ra từ mã C.

Luật và nghiên cứu hỗ trợ cách tách sự kiện khỏi lỗi; bảng quy tắc chi tiết của dự án được ghi tại `docs/research/v-prev-derivation-evidence.md`.

## Mẫu câu

| Kết quả | Mẫu câu |
| --- | --- |
| Có | [1] [2]. |
| Có, cả hai bên | [A] [2 của A], đồng thời [B] [2 của B]. |
| Có, cả hai bên cùng hành vi | Cả [A] và [B] cùng [2]. |
| Không rõ | Không thể xác định. |

Tag bổ sung được ghép thành câu riêng, nêu bên đã chọn và các hành vi bổ sung.
