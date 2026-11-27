# Quyết định đo agreement và đề xuất hiệu chỉnh ô phân vân C.K

Ngày: 2026-11-27.

## Quyết định đã chốt: báo cáo hai cách đo agreement

- **Theo từng ô:** tính Krippendorff's alpha danh nghĩa riêng cho từng trường của S, E và C trên cùng tập video và cùng phiên bản codebook.
- **Theo cả câu trả lời nhóm:** ghép các ô của một nhóm thành một tổ hợp cho mỗi người và video, rồi tính alpha danh nghĩa của các tổ hợp đó.
- Báo cáo số video, số người, tỷ lệ ô thiếu, phiên bản codebook, cách chuẩn hóa thực thể, khoảng tin cậy bootstrap lấy mẫu theo **video** và kết quả của cả hai cách.
- Alpha từng ô là kết quả chính để sửa guideline và codebook; alpha cả tổ hợp là kết quả bổ sung về việc hai người có đưa ra cùng một câu trả lời đầy đủ hay không.
- Alpha gộp tất cả ô làm các đơn vị độc lập là một thống kê thứ ba; không dùng nó thay cho hai kết quả trên.
- K chính của C vẫn là đầu vào đo agreement chính thức.
- Ô phân vân, nếu được thêm, không được tính là người gán nhãn đã đồng thuận với cả hai K.

Quyết định này là **quy tắc báo cáo**, chưa khẳng định script hiện có đã xuất đủ hai loại kết quả hoặc đã kiểm chứng trên dữ liệu mới.

## Nhận xét về hướng đi của ô phân vân

Nên thử thêm ô phân vân trước vòng training tiếp theo nếu mục tiêu là chấm VLM có điểm một phần cho K thứ hai.
Trọng số của K thứ hai cần được kiểm định trên dữ liệu chồng lấn hoặc kết luận độc lập; tần suất người gán nhãn tự khai cặp K trong 200 video riêng không chứng minh K thứ hai đúng hay được người khác chọn.
Với khoảng 100 video chung và 18 mã K, có thể thí điểm một hàm hiệu chỉnh chung, nhưng không thể mặc định đã đủ để học trọng số riêng đáng tin cậy cho mọi người và mọi cặp K.
Mọi thay đổi guideline hoặc codebook giữa các vòng cần được lưu phiên bản; dữ liệu cũ vẫn giúp tìm cặp đáng xem xét nhưng không tự động gộp vào bộ hiệu chỉnh của phiên bản mới.

[Collins, Bhatt và Weller (2022)](https://ojs.aaai.org/index.php/HCOMP/article/download/21986/21762) hỏi nhãn có khả năng cao nhất cùng xác suất, cho phép khai nhãn thứ hai cùng xác suất, và phân bổ xác suất còn lại cho các nhãn khác.
Tác giả cũng lưu ý xác suất người gán nhãn tự báo có thể chưa được hiệu chỉnh.
Công thức bên dưới là **đề xuất cho dự án này**, không phải công thức trong bài Collins.

## Xác định chính xác trọng số đo điều gì

Đề xuất đầu tiên là đo **mức được người gán nhãn độc lập ủng hộ**: nếu người A phân vân giữa K08 và K09, trọng số của K09 dự đoán tỷ lệ người khác, khi xem cùng video theo cùng guideline, chọn K09 làm K chính.
Đây là tín hiệu bất đồng có thể ước lượng từ vòng training nhiều người cùng xem.
Nó **không phải** xác suất K09 đúng theo thực tế.
Muốn chấm K09 là một đáp án đúng thay thế, cần tiêu chuẩn chấp nhận đáp án rõ ràng và ít nhất một lượt đánh giá độc lập, làm mù nhãn của A, trên mẫu kiểm tra.
Không được gọi phiếu bầu của số đông là ground truth nếu chính nhóm đang tranh luận về mã K đó.

## Giao diện thu thập đề xuất

1. Giữ **K chính** bắt buộc.
2. Hỏi bắt buộc **“Bạn có cân nhắc một mã K thứ hai không?”** với Có/Không để phân biệt Không với bỏ quên ô.
3. Nếu Có, chọn đúng **một K thứ hai** khác K chính và hỏi **“Bạn ước lượng bao nhiêu % người gán nhãn khác sẽ chọn K này làm K chính cho cùng video?”**.
4. Nếu Không, lưu `has_alternative=false`, không tạo K thứ hai và không suy ra độ chắc chắn 100%.
5. Có thể hỏi thêm % cho K chính nếu sau này cần một phân phối xác suất đầy đủ; không bắt buộc ở bản thí điểm vì tăng việc nhập liệu.

Cách hỏi ở bước 3 được chỉnh theo đại lượng sẽ kiểm định trong vòng training.
Nếu thay bằng câu hỏi “K thứ hai đúng bao nhiêu %”, phải hiệu chỉnh bằng kết luận độc lập về tính đúng, không bằng phiếu bầu đồng nghiệp.
Chọn một cách hỏi và giữ nguyên trong vòng training lẫn vòng làm riêng.

## Công thức hiệu chỉnh đề xuất

Với mỗi lần người A báo K thứ hai trên video `v`, đặt `p_v` là % A tự báo đổi sang số từ 0 đến 1.
Đặt `t_v = số người khác chọn K thứ hai của A làm K chính / số người khác đã gán nhãn video v`.
Không tính K chính của A vào `t_v`.
Ví dụ bốn người cùng xem, hai trong ba người còn lại chọn K09 thì `t_v = 2/3`.

Chia các lần báo K thứ hai trong training thành vài khoảng % được định nghĩa trước, chẳng hạn 0-20, 21-40, 41-60, 61-80 và 81-100; gộp khoảng nếu có quá ít ca.
Ban đầu gộp mọi người và mọi cặp K trong cùng khoảng, rồi chỉ thêm phân tầng theo người hoặc cặp khi có đủ lượt kiểm tra.
Với khoảng chứa câu trả lời hiện tại, gọi `n` là số lần báo K thứ hai trong training và `T = tổng t_v` của các lần đó.
Trọng số điểm một phần cho **từng câu trả lời** là:

```text
w(K_thu_hai | p, khoang) = (κ × p + T) / (κ + n)
                         = λ × p + (1 - λ) × (T / n)
λ = κ / (κ + n)
```

`κ` biểu thị mức giữ lại ước lượng của chính người gán nhãn khi dữ liệu kiểm chứng còn ít; nó không phải một hằng số lấy từ Collins.
Chọn `κ` bằng kiểm định chéo theo **video** trên 100 video chung, tối thiểu so sánh các phương án chỉ dùng `% tự báo`, chỉ dùng `T/n`, và vài giá trị `κ` bằng lỗi Brier `mean((w-t_v)^2)`.
Mọi nhãn trên cùng video phải nằm cùng một fold để tránh rò rỉ thông tin.
Giữ phương án đơn giản nhất có kết quả kiểm định ổn định; nếu không cải thiện đáng tin cậy, chỉ báo cáo điểm cứng và giữ điểm một phần là thử nghiệm.
Vì `t_v` là tỷ lệ đồng nghiệp trên một video, sai số và khoảng tin cậy phải lấy mẫu theo video, không giả vờ mỗi phiếu hoặc mỗi câu là mẫu độc lập.

### Ví dụ số

A chọn K08, khai phân vân K09, dự đoán `p = 30%`.
Trong khoảng % tương ứng của training có `n = 20` lần báo K thứ hai; tổng tỷ lệ đồng nghiệp chọn đúng K thứ hai qua 20 lần là `T = 8`, tức mức thực nghiệm `8/20 = 40%`.
Giả sử kiểm định chéo chọn `κ = 10`, khi đó `w = (10 × 0,30 + 8) / (10 + 20) = 0,367`.
Đây là ví dụ minh họa; `n`, `T` và `κ` phải thay bằng số thật của vòng mới.

| VLM trả lời | Điểm cứng | Điểm một phần đề xuất |
| --- | ---: | ---: |
| K08 | 1 | 1 |
| K09 | 0 | 0,367 |
| K khác | 0 | 0 |

Điểm một phần trên là **quy tắc chấm**, không phải phân phối xác suất gold vì tổng điểm của K08 và K09 lớn hơn 1.
Nếu mục tiêu sau này là huấn luyện mô hình bằng soft cross-entropy, phải thiết kế và kiểm định riêng một phân phối xác suất chuẩn hóa trên toàn bộ 18 mã K.

## Dùng vòng training và vòng 200 video riêng như thế nào

1. **Trước vòng 100 video chung:** khóa phiên bản guideline và codebook, lưu K chính, Có/Không K thứ hai, K thứ hai nếu Có và % tự báo.
   Chọn video có đủ các K quan trọng và cặp hay nhầm; vẫn cần phần video đại diện ngẫu nhiên nếu muốn ước lượng hiệu năng trên phân bố thực.
2. **Sau vòng chung:** tính alpha của K chính, alpha từng ô S/E/C và alpha cả nhóm theo quyết định trên.
   Tính `t_v` theo người khác, tỷ lệ Có/Không của từng người, bảng số ca theo khoảng % và theo cặp, cùng độ lệch giữa % tự báo và tỷ lệ đồng nghiệp.
3. **Hiệu chỉnh:** chọn hàm và `κ` bằng kiểm định chéo theo video; báo cáo số ca và khoảng tin cậy.
   Với ít ca ở một người hoặc cặp, dùng hàm chung; không tự suy trọng số riêng từ một vài ví dụ.
4. **Khi mỗi người làm 200 video riêng:** áp dụng hàm đã khóa cho **mỗi câu trả lời có K thứ hai**.
   Dữ liệu riêng có ích để đếm cặp K, theo dõi tỷ lệ Có/Không, % tự báo, thay đổi theo thời gian và chọn ca cần xem lại.
   Tổng cộng 800 hoặc 1.400 video riêng vẫn không tự tạo ra `t_v`, vì không có người thứ hai xem cùng video.
5. **Trong vòng riêng:** cho người khác kiểm tra độc lập một mẫu chồng lấn lấy ngẫu nhiên để đo lại mức ủng hộ và phát hiện drift.
   Có thể xem thêm các ca % cao hoặc cặp hiếm, nhưng mẫu chọn có chủ đích phải được báo cáo riêng; không dùng tỷ lệ từ mẫu đó như tỷ lệ chung nếu không hiệu chỉnh xác suất chọn mẫu.
6. **Khi đánh giá VLM:** báo song song điểm cứng trên K chính và điểm một phần trên K thứ hai, cùng số lượng video có K thứ hai và phiên bản hàm hiệu chỉnh.
   Không cộng điểm một phần vào alpha, và không gọi điểm một phần là accuracy theo ground truth nếu chưa có xét duyệt độc lập.

Không có ngưỡng phổ quát “100 video là đủ”.
Điều cần kiểm tra là số **lần báo K thứ hai đã được đối chiếu**, số video độc lập, sự phủ của từng cặp và độ rộng khoảng tin cậy.
Mục tiêu alpha vượt 0,667 là một câu hỏi khác với lượng dữ liệu đủ để hiệu chỉnh trọng số; một mẫu có thể đáp ứng câu hỏi này mà chưa đáp ứng câu hỏi kia.
