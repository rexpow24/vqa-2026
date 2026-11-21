# Hướng dẫn gán nhãn Nhóm Prev: phòng ngừa (Prevention)

- Câu hỏi chuẩn: Lẽ ra người lái hoặc người liên quan nên làm gì để tránh va chạm này?
- Prev được hệ thống tự sinh từ nhóm V theo quy tắc nội bộ của codebook Prev.v3.
- Annotator không sửa bên hoặc hành động phòng tránh được sinh.
- Prev là nhãn phản thực tế, không phải hành động quan sát trực tiếp trong video.
- Ánh xạ chỉ áp dụng khi bên V xác định và mọi tag của bên đó dẫn đến cùng một hành động phòng tránh duy nhất.
- Nếu thiếu bên, có hành vi chưa ánh xạ, hoặc cùng một bên cần nhiều hành động khác nhau, hệ thống ghi “Không thể xác định.”
- Không thêm hành động phụ.

## Ánh xạ hiện hành

| Hành vi V | Hành động Prev |
| --- | --- |
| Đi ngược chiều hoặc đi sai làn | Đi đúng phần đường |
| Không giữ khoảng cách an toàn | Giữ khoảng cách an toàn |
| Vượt đèn đỏ hoặc không chấp hành biển báo/vạch kẻ đường | Chấp hành đèn tín hiệu |
| Không nhường đường | Quan sát và nhường đường |
| Không đội mũ bảo hiểm | Đội mũ bảo hiểm |
| Tag khác hoặc tag không nằm trong bảng | Không thể xác định |

Nếu một bên có nhiều tag V nhưng các tag cùng ánh xạ về một hành động, hệ thống giữ hành động đó.

Nếu cùng một bên có tag ánh xạ sang các hành động khác nhau, hệ thống không chọn tùy ý một hành động.

## Cơ sở và giới hạn

Luật Trật tự, an toàn giao thông đường bộ quy định nghĩa vụ giao thông cụ thể, nhưng không khẳng định một hành động phản thực tế duy nhất sẽ tránh được một va chạm cụ thể.

NHTSA tách sự kiện tiền va chạm khỏi thao tác né tránh đã thực hiện.

FHWA khuyến nghị chẩn đoán vấn đề và yếu tố góp phần trước khi chọn biện pháp đối ứng.

Do đó bảng trên là chính sách mã hóa của dự án, chưa được xác nhận là mô hình nhân quả hoặc khuyến nghị an toàn đã kiểm định.

Các trích dẫn pháp lý và nghiên cứu được lưu tại `docs/research/v-prev-derivation-evidence.md`.

Frontend không hiển thị citations; citations chỉ nằm trong tài liệu nội bộ để viết khóa luận.

## Mẫu câu

| Trường hợp | Mẫu câu |
| --- | --- |
| Một bên | [Bên] nên [hành động chính]. |
| Hai bên | [A] nên [hành động A]; [B] nên [hành động B]. |
| Thiếu căn cứ duy nhất | Không thể xác định. |
