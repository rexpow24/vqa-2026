# Hướng dẫn Annotator (Team B) — EG-TrafficQA-VN

> Tài liệu này dành cho bạn — người trực tiếp xem video và gán nhãn. Đọc hết 1 lần trước khi bắt đầu; sau đó dùng như tài liệu tra cứu nhanh.

---

## Việc của bạn là gì (3 câu)

Bạn nhận một **video** + một **câu hỏi** + một **guideline** (do Team A viết sẵn cho câu hỏi đó). Bạn xem video, áp dụng đúng guideline, rồi **tự quyết định**: đáp án đúng nhất, 1–3 khung hình (keyframe) làm bằng chứng, và mức độ rõ ràng của câu hỏi (answerability). Bạn làm việc **độc lập** — không xem, hỏi, hay đoán đáp án của annotator khác trước khi cả hai đã nộp xong.

---

## Quy trình 1 item, từng bước

1. Đọc câu hỏi + guideline (không xem đáp án gợi ý nếu có — nếu file có cột "đáp án dự kiến của Team A", **đừng mở** cho tới khi bạn đã tự quyết xong).

   > **CẬP NHẬT 2026-09-05.** Từ Phase 2, hệ thống có thể hiển thị **đáp án nháp do VLM sinh**.
   > Quy tắc trên vẫn giữ nguyên và giờ còn quan trọng hơn: **tự quyết đáp án trước khi đọc
   > đáp án nháp**. Đáp án của máy không phải đáp án đúng — nó chỉ là gợi ý và nó *sai thường
   > xuyên*. Nếu bạn đọc nó trước, bạn sẽ có xu hướng đồng ý với nó, và toàn bộ giá trị của
   > việc hai annotator làm độc lập sẽ mất. Khi bạn không đồng ý với đáp án nháp, **cứ nộp
   > đáp án của bạn** — bất đồng đó là dữ liệu, không phải lỗi.
2. Xem toàn bộ video ít nhất 1 lần trước khi trả lời (không tua nhanh qua đoạn có vẻ "không liên quan" — nhiều câu cố ý có bằng chứng nằm ngoài đoạn va chạm).
3. Chọn đáp án theo nguyên tắc ở mục "Nguyên tắc chọn đáp án" bên dưới.
4. Ghi lại 1–3 chỉ số khung hình (keyframe) làm bằng chứng — theo mục "Chọn keyframe".
5. Gắn nhãn answerability (`answerable` / `ambiguous` / `not-answerable`) — theo cây quyết định bên dưới.
6. Nộp. Không sửa lại sau khi đã thấy nhãn của annotator kia hoặc của Team A.

---

## Nguyên tắc chọn đáp án

- **Chỉ dựa vào những gì bạn THỰC SỰ THẤY trong video.** Không suy diễn dựa trên kinh nghiệm cá nhân về giao thông nói chung, không đoán "thường thì hay xảy ra vậy".
- Nếu guideline mô tả điều kiện A → đáp án X, điều kiện B → đáp án Y, và bạn thấy rõ điều kiện nào thì chọn đáp án tương ứng — **không tự sáng tạo tiêu chí ngoài guideline**.
- Nếu bạn **không chắc chắn** giữa 2 lựa chọn dù đã xem kỹ: chọn đáp án bạn tin nhiều hơn, KHÔNG tự ý chọn "Cannot be determined" chỉ vì phân vân — "Cannot be determined" chỉ dùng khi video thực sự **thiếu thông tin**, không phải khi bạn thấy khó quyết định giữa 2 lựa chọn đều có căn cứ.
- Nếu bằng chứng bị che khuất (vật cản, góc quay xấu) khiến bạn **không thể** xác định — đây mới là lúc chọn "Cannot be determined" và đánh dấu answerability tương ứng.

---

## Chọn keyframe evidence

- 1–3 khung hình, mỗi khung phải **trực tiếp chứa bằng chứng** cho đáp án bạn chọn — không chọn khung "gần đúng" hoặc khung đẹp/rõ nét nhưng không có bằng chứng.
- Với câu hỏi loại **T (trình tự thời gian)**: cần 2 khung — một khung *trước*, một khung *sau* sự kiện được hỏi.
- Với câu hỏi loại **C (nguyên nhân)**: chọn khung ngay *trước* thời điểm va chạm (hành động gây ra), không phải khung tại lúc va chạm.
- Nếu bạn thấy nhiều khung đều có bằng chứng tương đương, chọn khung **rõ ràng nhất** (ít bị che khuất, nhìn thấy đối tượng đầy đủ nhất) — không cần liệt kê hết.

---

## Answerability — cây quyết định

```
Video có đủ thông tin nhìn thấy trực tiếp để trả lời không?
│
├── CÓ, và bạn tự tin vào đáp án đã chọn
│     → answerable
│
├── CÓ MỘT PHẦN, nhưng bằng chứng yếu / có thể hiểu theo nhiều cách hợp lý khác nhau
│     → ambiguous
│     (ví dụ: hành động của người đi bộ có thể hiểu là "chuẩn bị băng qua" hoặc
│      "chỉ đứng chờ" tuỳ góc nhìn — cả hai đều có căn cứ hình ảnh)
│
└── KHÔNG, bị che khuất / ngoài khung hình / video kết thúc trước khi đủ thông tin
      → not-answerable  (đáp án MCQ tương ứng = "Cannot be determined")
```

**Lưu ý quan trọng:** nếu bạn và annotator kia đều xem cùng video, cùng guideline, mà ra **2 đáp án MCQ khác nhau** (không phải khác answerability, mà khác cả nội dung đáp án) — đó chính là tín hiệu quan trọng nhất của toàn hệ thống. Đừng cố "thống nhất trước" — cứ nộp độc lập, hệ thống sẽ tự phát hiện bất đồng và chuyển cho Team A xử lý.

---

## Ví dụ minh hoạ theo từng nhóm

### S — Scene/Context
> *Câu hỏi:* "Điều kiện thời tiết và ánh sáng trong video là gì?"
> *Guideline:* Nếu mặt đường khô, ánh sáng ban ngày rõ → "sunny day". Nếu mặt đường ướt/có phản chiếu dù không thấy mưa đang rơi → "rainy" (ưu tiên an toàn, vì ướt ảnh hưởng độ bám đường).
> *Cách làm:* Quan sát 2–3 khung đầu video, kiểm tra mặt đường + bầu trời. Không cần xem hết video cho câu này.
> *Keyframe:* 1 khung đại diện, càng sớm trong video càng tốt.

### E — Entities
> *Câu hỏi:* "Phương tiện nào gây ra va chạm có màu và loại gì?"
> *Guideline:* Xác định phương tiện có hành động dẫn đến va chạm trực tiếp (không phải phương tiện xuất hiện gần nhất).
> *Cách làm:* Nếu có 2+ phương tiện, xem lại đoạn ngay trước va chạm để xác định đúng phương tiện chủ động gây va chạm.
> *Keyframe:* 1 khung thấy rõ màu/loại xe, có thể kèm 1 khung phụ nếu góc đầu bị che.

### T — Temporal/Sequence
> *Câu hỏi:* "Người đi bộ bước xuống đường trước hay sau khi xe màu xám xuất hiện?"
> *Cách làm:* Xác định 2 mốc thời gian riêng biệt (thời điểm người bước xuống, thời điểm xe xuất hiện trong khung hình), so sánh thứ tự.
> *Keyframe:* BẮT BUỘC 2 khung — 1 khung tại mốc "trước", 1 khung tại mốc "sau".

### C — Causal
> *Câu hỏi:* "Hành động nào ngay trước va chạm là nguyên nhân chính?"
> *Guideline:* Chỉ tính hành động **trực tiếp, sát thời điểm va chạm** (5–10 giây trước) — không tính điều kiện nền (thời tiết, hạ tầng) trừ khi guideline nói rõ đó là nguyên nhân.
> *Keyframe:* 1–2 khung quanh thời điểm hành động gây nguyên nhân (không phải khung tại lúc va chạm).

### V — Violation/Risk
> *Câu hỏi:* "Có vi phạm giao thông nào quan sát được không (sai làn / không quan sát)?"
> *Guideline:* Chỉ mô tả hành vi **quan sát được trực tiếp** (vd "xe đi sai làn đường dành cho...") — **không tự phán "có lỗi" nếu guideline không chỉ rõ điều luật tương ứng**. Nếu không chắc hành vi có phải vi phạm hay chỉ là tình huống mơ hồ về luật, ưu tiên gắn `ambiguous` thay vì tự đoán.
> Xem bảng cheat-sheet luật ở mục dưới trước khi trả lời câu nhóm này.

---

## Cheat-sheet luật giao thông cơ bản (nhóm V)

> Team A điền bảng này trước khi giao việc cho Team B — annotator chỉ tra cứu, không tự tìm luật.

| Hành vi quan sát được | Điều luật liên quan (điền cụ thể) | Ghi chú |
|---|---|---|
| Vượt đèn đỏ | *(Team A điền)* | |
| Đi sai làn đường | *(Team A điền)* | |
| Không nhường đường người đi bộ tại vạch kẻ | *(Team A điền)* | |
| Đi ngược chiều | *(Team A điền)* | |
| Không đội mũ bảo hiểm (xe máy) | *(Team A điền)* | |
| ... | | |

---

## Những điều KHÔNG được làm

- ❌ Không xem đáp án của annotator khác trước khi tự mình nộp xong.
- ❌ Không tự đoán ý đồ/đáp án mà Team A "mong muốn" — chỉ làm theo guideline viết sẵn.
- ❌ Không bỏ trống nhãn answerability — mọi câu đều phải có, kể cả khi bạn tự tin 100%.
- ❌ Không chọn keyframe ngoài khoảng thời gian video hoặc khung không chứa bằng chứng thực sự.
- ❌ Không tự ý gộp/sửa câu hỏi — nếu thấy câu hỏi có vấn đề (mơ hồ, sai ngữ pháp, không khớp video), báo lại Team A thay vì tự sửa.
- ❌ Không dùng "Cannot be determined" như một lựa chọn "an toàn" khi chỉ đơn giản là bạn phân vân giữa 2 đáp án đều có căn cứ.

---

## Khi nào cần hỏi lại Team A

- Guideline không bao quát tình huống bạn đang thấy trong video (vd video có 3 phương tiện liên quan nhưng guideline chỉ giả định 2).
- Câu hỏi và video có vẻ không khớp (câu hỏi hỏi về đêm nhưng video quay ban ngày).
- Bạn nghi ngờ video bị lỗi/cắt thiếu đoạn quan trọng.
- Sau khi nộp, hệ thống báo bạn và annotator kia bất đồng — chờ Team A phân xử, không tự thảo luận trực tiếp với annotator kia trước.
