# O.v2: hậu quả theo dấu hiệu nhìn thấy

Người dùng (2026-11-23), sau audit nhóm O trên video agreement #1-#40:

> rất khó cho annotator phân biệt mạnh và vừa, cùng như không rõ và không xác định là chung 1 chỗ (đang bị thừa)

> xóa không rõ đi nó gần nghĩa với suýt va chạm.

> ok (duyệt đề xuất https://claude.ai/artifact/2pKveg9PHyV61FBvbw5Qya)

Đề xuất đã duyệt:

- Bỏ mức "không rõ" và mẫu câu "Không thể xác định".
- O đọc từ C: C suýt va chạm thì O tự điền "không va chạm"; C không rõ (chỉ còn ở câu C cũ) thì O không hỏi; C va chạm thì annotator tick các dấu hiệu thấy rõ (nhiều lựa chọn), mức độ tự suy ra bằng mức cao nhất.
- Dấu hiệu mới: nhẹ "có chạm, các bên giữ thăng bằng"; vừa "ngã tại chỗ", "xoay ngang hoặc lệch hướng mất lái"; mạnh "bị lật", "người bị hất văng khỏi xe", "xe bị hất khỏi quỹ đạo", "biến dạng lớn", "va chạm thứ cấp".
- Bỏ: người nằm trên đường, dừng đột ngột, biến dạng rõ, hai dạng chạm quẹt, người ngã/xe ngã (gộp).
- Mức độ tính cho toàn sự kiện.
- Cơ sở: GraDE (Darji & Gondaliya 2026, doi:10.36548/jtcsst.2026.4.006), SHRP 2 crash severity levels, audit `csvs/answers-agreement.csv`.
