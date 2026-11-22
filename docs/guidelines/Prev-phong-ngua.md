# Hướng dẫn gán nhãn Nhóm Prev: phòng ngừa (Prevention)

- Câu hỏi chuẩn: Từ tình huống đã ghi ở nhóm C, bên nào nên làm gì để phòng tránh xung đột?
- Nhóm Prev được hệ thống tự sinh trực tiếp từ C; annotator không sửa bên hoặc hành động.
- Prev là khuyến nghị phản thực tế theo chính sách codebook, không phải hành động đã quan sát hay kết luận lỗi pháp lý.
- Mỗi bên có tối đa một hành động chính.
- Không thêm hành động phụ.
- Nếu actor hoặc hành động phụ thuộc thông tin không thấy được, hệ thống ghi “Không thể xác định từ tình huống C.”
- Prev chỉ đề xuất phòng tránh xung đột; hành động giảm mức độ chấn thương như đội mũ bảo hiểm thuộc một construct khác.

## Ánh xạ từ C

| C | Bên và hành động Prev mặc định |
| --- | --- |
| K01, K03 | Chủ thể: giữ khoảng cách an toàn. |
| K02 | Đối tượng phía sau: giữ khoảng cách an toàn. |
| K04 | Chủ thể chuyển làn: chỉ chuyển làn khi an toàn. |
| K05 | Chủ thể: chỉ vượt khi đủ điều kiện an toàn. |
| K06 | Chủ thể rẽ: quan sát và nhường đường. |
| K07 | Chủ thể: quan sát xung quanh trước khi mở cửa hoặc rời chỗ đỗ. |
| K08 | Lấn khi vượt: chỉ vượt khi đủ điều kiện an toàn; lấn khi cua/đi thẳng: đi đúng phần đường. |
| K09 | Chủ thể: đi đúng phần đường. |
| K10, K12, K13 | Chủ thể: quan sát và nhường đường. |
| K11 | Hai bên: giảm tốc; nếu không xác định được đủ hai bên thì không thể xác định. |
| K14 | Người đi bộ: dừng quan sát trước khi băng qua; phương tiện: quan sát và nhường đường. |
| K15 | Người đi bộ băng qua: dừng quan sát; đi dọc lòng đường: đi trên lề/vỉa hè nếu có; tài xế gặp người đi bộ: giảm tốc. |
| K16 | Bên lái xe: giảm tốc; không gán Prev cho động vật. |
| K17 | Chủ thể lùi xe: quan sát xung quanh trước khi thao tác. |
| K18 | Không thể xác định nếu không có bằng chứng về nguyên nhân có thể phòng tránh. |

Ánh xạ chi tiết, điều kiện suy luận và căn cứ được ghi tại [`c-prev-derivation-evidence.md`](../research/c-prev-derivation-evidence.md).

## Quy tắc áp dụng

Hệ thống dùng mã K, hành động con, subject/object và thực thể đã khai báo trong E.

Chỉ dùng ngữ cảnh S/E nếu thông tin được gán nhãn và nhìn thấy rõ.

Không tự điền đèn tín hiệu, biển báo, vạch đường, quyền ưu tiên hoặc nguyên nhân không có trong video.

Không kết luận một bên vi phạm luật chỉ từ C hoặc Prev.

K14–K16 phải xét loại thực thể để không áp cùng một khuyến nghị cho người đi bộ, tài xế và động vật.

K11 chỉ gợi ý cả hai giảm tốc; việc bên nào phải nhường cần thêm bằng chứng về tín hiệu hoặc quyền ưu tiên.

K18 mặc định không đủ căn cứ vì mã này không ghi nguyên nhân trượt, văng khỏi làn hoặc nổ lốp.

## Cơ sở và giới hạn

Các bài nghiên cứu về traffic conflict hỗ trợ dùng tình huống xung đột làm đầu vào cho đánh giá an toàn, nhưng không xác nhận mapping một-một K → Prev của dự án.

FHWA khuyến nghị chẩn đoán tình huống và yếu tố góp phần trước khi chọn biện pháp đối ứng.

Luật giao thông quy định hành vi an toàn theo điều kiện cụ thể, nhưng không cung cấp một đáp án phản thực tế duy nhất cho mỗi video.

Mapping là chính sách của dự án và cần được chuyên gia an toàn giao thông rà soát độc lập trên mẫu video.

Đo riêng chất lượng C, độ phủ mapping Prev và độ đúng của Prev được suy ra.

Không tính Prev tự sinh như một phán đoán độc lập của annotator trong thống kê đồng thuận.

Citations chỉ nằm trong tài liệu nội bộ để viết khóa luận; frontend không hiển thị citations.

## Mẫu câu

| Trường hợp | Mẫu câu |
| --- | --- |
| Một bên | [Bên] nên [hành động chính]. |
| Hai bên | [A] nên [hành động A]; [B] nên [hành động B]. |
| Thiếu căn cứ | Không thể xác định từ tình huống C. |
