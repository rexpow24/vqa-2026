# Căn cứ nghiên cứu cho quan hệ giữa nhãn C, V và Prev

Ngày tra cứu: 20/11/2026.

## Câu hỏi và kết luận ngắn

Tài liệu nghiên cứu và hướng dẫn chính thức tìm được không thiết lập một phép biến đổi phổ quát, một-một từ kiểu xung đột hoặc hành động ở C sang vi phạm ở V, hay từ V sang một hành động phòng tránh duy nhất ở Prev.

Các nguồn ủng hộ việc dùng sự kiện tiền va chạm làm ngữ cảnh để phân tích yếu tố góp phần, và dùng yếu tố góp phần đã được chẩn đoán để đề xuất biện pháp phòng tránh.

Các nguồn không chứng minh rằng mọi nhãn C đều hàm ý vi phạm pháp luật, hoặc một nhãn V tự nó đủ thông tin để xác định đầy đủ nhãn Prev.

Vì vậy, nếu ứng dụng tự điền V từ C hoặc Prev từ V, nên coi đây là gợi ý quy tắc theo codebook, không phải kết luận pháp lý hay nhãn quan sát độc lập đã được nguồn bên ngoài xác thực.

Nếu sản phẩm muốn các trường dẫn xuất không thể sửa, cần mô tả đó là chính sách thiết kế của bộ dữ liệu, lưu dấu nguồn/điều kiện suy ra, và để riêng trạng thái chưa đủ bằng chứng.

## Phân biệt ý nghĩa các nhóm

Trong codebook hiện tại, C mô tả loại xung đột và hành động xảy ra ngay trước va chạm hoặc suýt va chạm.

V hỏi có hành vi vi phạm quy tắc giao thông nào quan sát được hay không.

Prev hỏi người liên quan lẽ ra nên làm gì để tránh sự kiện.

Đây là ba câu hỏi khác nhau: mô tả sự kiện, đánh giá hành vi theo quy tắc, và đề xuất hành động phòng tránh mang tính phản thực tế.

## Căn cứ cho quan hệ C → V

### Luật Việt Nam xác định vi phạm bằng quy tắc và điều kiện cụ thể

Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15 yêu cầu người tham gia giao thông đi đúng làn/phần đường và chấp hành báo hiệu tại Điều 10 khoản 1.

Điều 13 quy định cách sử dụng làn và điều kiện chuyển làn; Điều 12 quy định tốc độ và khoảng cách an toàn, đồng thời yêu cầu điều chỉnh tốc độ theo điều kiện đường, mật độ, địa hình và thời tiết.

Điều 30 quy định cách người đi bộ sử dụng đường và qua đường, trong đó việc qua đường phụ thuộc vào nơi có tín hiệu/vạch/cầu/hầm hoặc quan sát và bảo đảm an toàn khi không có các hạ tầng đó.

Như vậy, cùng một hành động hình học trong video có thể chưa đủ để xác định vi phạm nếu thiếu thông tin về làn, biển/vạch/đèn, quyền ưu tiên, điều kiện đường hoặc phần diễn biến không lọt vào khung hình.

Nguồn chính thức: [Toàn văn Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15](https://xaydungchinhsach.chinhphu.vn/toan-van-luat-trat-tu-an-toan-giao-thong-duong-bo-119240909105718285.htm), đặc biệt Điều 10, 12, 13, 15 và 30.

Nghị định 168/2024/NĐ-CP quy định xử phạt theo từng hành vi và điều kiện, chẳng hạn không nhường đường khi chuyển hướng, không giảm tốc/nhường đường khi đi từ đường nhánh ra đường chính, không chấp hành tín hiệu đèn, hoặc để vật nuôi đi trên đường không bảo đảm an toàn.

Các quy định này cho thấy không nên đồng nhất một mã xung đột C với một tội danh/hành vi V nếu chưa xác minh điều kiện cấu thành hành vi trong cảnh.

Nguồn chính thức: [Toàn văn Nghị định 168/2024/NĐ-CP](https://xaydungchinhsach.chinhphu.vn/toan-van-nghi-dinh-168-2024-nd-cp-quy-dinh-xu-phat-vi-pham-hanh-chinh-ve-trat-tu-atgt-duong-bo-119241231164556785.htm), xem các Điều 6–11 theo loại người/phương tiện tương ứng.

### Nghiên cứu tai nạn phân tách sự kiện tiền va chạm và phân tích nguyên nhân

Wang và cộng sự dùng video/động học để xác định va chạm và suýt va chạm, phân nhóm theo kịch bản tiền va chạm, rồi áp dụng một khung phân tích hai giai đoạn để phân loại yếu tố góp phần.

Bài báo nêu các yếu tố gồm hành vi, hạ tầng và môi trường, thay vì coi kịch bản tiền va chạm tự nó là nhãn vi phạm.

Nguồn: Wang, X., Liu, Q., Guo, F., Fang, S., Xu, X., & Chen, X. (2022). “Causation analysis of crashes and near crashes using naturalistic driving data.” *Accident Analysis & Prevention*, 177, 106821. DOI: [10.1016/j.aap.2022.106821](https://doi.org/10.1016/j.aap.2022.106821).

Khattak và cộng sự xây dựng taxonomy lỗi và vi phạm dựa trên dữ liệu NDS chi tiết trước va chạm; đây là phân loại được khảo sát từ dữ liệu và khung định nghĩa, không phải bảng suy luận phổ quát từ từng kiểu xung đột sang lỗi/vi phạm.

Nguồn: Khattak, A. J., Ahmad, N., Wali, B., & Dumbaugh, E. (2021). “A taxonomy of driving errors and violations: Evidence from the naturalistic driving study.” *Accident Analysis & Prevention*, 151, 105873. DOI: [10.1016/j.aap.2020.105873](https://doi.org/10.1016/j.aap.2020.105873).

### Hướng dẫn mã hóa chính thức giữ các biến riêng biệt

Sổ tay mã hóa FARS/CRSS 2021 của NHTSA trước hết xác định sự kiện tiền va chạm quan trọng bằng thông tin từ báo cáo cảnh sát, kiểm tra xe, hiện trường và người được phỏng vấn.

Sau đó, sổ tay lần lượt mã hóa sự kiện, chuyển động trước sự kiện, và hành động né tránh mà tài xế đã thử để tránh va chạm.

Cấu trúc này là bằng chứng thực hành mạnh rằng sự kiện kích hoạt, trạng thái/chuyển động, và hành động né tránh là các biến liên quan nhưng riêng biệt; nó không nói rằng một biến có thể được thay bằng biến kia.

Nguồn: National Highway Traffic Safety Administration. (2023). *2021 FARS CRSS Coding and Validation Manual*, mục Precrash Data Overview, phần “Determine the Critical Precrash Event” và “Determine Attempted Avoidance Maneuver”. [Bản PDF chính thức](https://crashstats.nhtsa.dot.gov/Api/Public/ViewPublication/813426).

## Căn cứ cho quan hệ V → Prev

### Vi phạm có thể gợi ý hành động sửa sai, nhưng không xác định duy nhất phản thực tế

Nếu V đã được xác lập bằng chứng rõ, quy tắc pháp lý có thể giúp tạo một hành động phòng tránh đối ứng ở mức chung, ví dụ chấp hành tín hiệu đèn hoặc nhường đường khi luật yêu cầu.

Tuy nhiên, kết luận Prev cho một vụ việc còn tùy diễn biến, thời điểm nhận biết nguy cơ, khả năng quan sát/phản ứng, hành vi của các bên khác và điều kiện đường.

Trong khung Haddon, phân tích phòng ngừa xem xét đồng thời yếu tố con người, phương tiện và môi trường ở các giai đoạn trước, trong và sau va chạm.

Hướng dẫn của FHWA yêu cầu chẩn đoán vấn đề an toàn và các yếu tố góp phần trước khi lựa chọn biện pháp đối ứng; Haddon Matrix dùng để hiểu tập hợp yếu tố và lựa chọn biện pháp nhắm đến yếu tố nền.

Nguồn: Federal Highway Administration. “Unit 4: Solving Safety Problems.” *Road Safety Fundamentals*. [FHWA](https://highways.dot.gov/safety/learn-safety/road-safety-fundamentals-html-version/unit-4-solving-safety-problems).

Nguồn: Transportation Research Board. (2023). *Diagnostic Assessment and Countermeasure Selection: A Toolbox for Traffic Safety Practitioners*, chương 3. [National Academies Press](https://www.nationalacademies.org/read/27890/chapter/5).

National Academies nêu rằng quy một xung đột đơn lẻ làm nguyên nhân gần nhất mà bỏ qua yếu tố góp phần khác là hạn chế; cách tiếp cận Safe System yêu cầu chẩn đoán toàn diện trước khi lựa chọn biện pháp.

Điều này không cấm tạo nhãn Prev theo quy tắc, nhưng không hỗ trợ tuyên bố rằng Prev được suy ra đầy đủ từ V đơn lẻ.

## Khuyến nghị phương pháp cho bộ dữ liệu

1. Giữ C là mô tả sự kiện/hành động quan sát được.

2. Chỉ gán V khi hành vi và điều kiện cần thiết cho nhãn vi phạm nhìn thấy hoặc được ghi nhận đủ rõ; nếu không, dùng “không rõ” hoặc không gán theo quy tắc của codebook.

3. Có thể dùng C để gợi ý các lựa chọn V cụ thể, nhưng từng lựa chọn phải có điều kiện áp dụng rõ và không được coi việc chọn C là bằng chứng tự động cho V.

4. Có thể sinh Prev từ cả C, V và bối cảnh liên quan như E/O/R, nhưng nên đánh dấu đó là đề xuất phản thực tế theo chính sách codebook.

5. Nếu Prev cần giữ không thể chỉnh sửa để tạo tính nhất quán sản phẩm, ghi rõ bộ quy tắc xác định ánh xạ và lưu phiên bản quy tắc; không mô tả trường này như một quan sát trực tiếp của video.

6. Đánh giá riêng độ tin cậy của nhãn nguồn và độ đúng của các nhãn được suy ra; không tính nhãn hệ thống sao chép từ nhãn cha như một phán đoán độc lập của annotator.

## Danh mục nguồn và giới hạn

Luật Việt Nam và nghị định là nguồn có thẩm quyền cho nội dung quy tắc và xử phạt, nhưng không phải hướng dẫn về thiết kế ontology gán nhãn video.

NHTSA, FHWA và National Academies cung cấp quy trình/nguyên tắc phân tích an toàn giao thông của Hoa Kỳ; chúng hỗ trợ phân biệt các khái niệm và phương pháp, không thay thế luật Việt Nam.

Hai bài báo *Accident Analysis & Prevention* là nghiên cứu bình duyệt về dữ liệu lái xe tự nhiên và phân tích yếu tố góp phần; chúng không xác nhận các mã C/V/Prev riêng của dự án.

Trong các nguồn đã rà soát, không tìm thấy nghiên cứu bình duyệt hay văn bản chính thức nào xác thực chính xác các ánh xạ tất định hiện có giữa từng mã C và V, hoặc từng mã V và Prev.

## Quyết định triển khai sau rà soát nguồn

Ứng dụng dùng quy tắc bảo thủ hơn các gợi ý C-to-V cũ: chỉ K09 được tự suy ra V, các mã C khác trả về “không rõ”.

Annotator có thể bổ sung nhiều tag V quan sát rõ bằng cách gắn chúng với một thực thể người tham gia không phải động vật.

Prev được tạo từ V theo bảng ánh xạ được ghi trong [quy tắc suy ra V và Prev](v-prev-derivation-evidence.md); trường hợp không có một hành động duy nhất được lưu thành không thể xác định.

Đây là quyết định thiết kế dự án, không phải kết luận được xác nhận bởi các nguồn nghiên cứu đã nêu.

Ngày 22/11/2026, trưởng dự án quyết định bỏ V khỏi luồng gán nhãn chính và nghiên cứu suy ra Prev trực tiếp từ C.

Lý do là annotator không có thẩm quyền kết luận vi phạm pháp luật; các bản ghi V lịch sử vẫn được bảo toàn.

Nguồn bên ngoài hỗ trợ việc dùng tình huống/xung đột để chẩn đoán an toàn và đề xuất biện pháp, nhưng không xác thực ánh xạ một-một cho mọi mã C.

Phần căn cứ, các điều luật Việt Nam liên quan và giới hạn của giả định C → Prev được ghi tại [C-to-Prev derivation evidence](c-prev-derivation-evidence.md).
