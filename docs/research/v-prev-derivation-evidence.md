# Quy tắc suy ra V và Prev

Ngày rà soát: 21/11/2026.

## Quyết định cho bộ dữ liệu

Nhóm C ghi nhận kiểu xung đột và hành động ngay trước va chạm.

Nhóm V gắn nhãn hành vi vi phạm quan sát được hoặc trường hợp hẹp được suy ra từ C.

Nhóm Prev là một hành động phòng tránh phản thực tế, nên không đồng nhất với hành vi trước va chạm.

Nghiên cứu mã hóa tai nạn tách sự kiện tiền va chạm khỏi việc xác định lỗi.

Luật Việt Nam cũng quy định các hành vi theo điều kiện như làn đường, báo hiệu, quyền ưu tiên, vị trí và chủ thể.

Do đó, hệ thống chỉ tự suy ra V từ mã C K09, khi C xác định bên đi ngược chiều trên làn của bên khác và bên đó là một thực thể không phải động vật.

Các mã C còn lại không đủ để kết luận V vì chuyển động nhìn thấy không tự cho biết biển báo, vạch đường, quyền ưu tiên, chiều đường hoặc các tình tiết ngoài khung hình.

Với các trường hợp khác, V có kết quả “không rõ”.

Annotator được thêm một hành vi V quan sát rõ và phải chọn bên thực hiện hành vi đó.

Động vật không thể là bên vi phạm.

Nếu người điều khiển hoặc dẫn dắt vật nuôi xuất hiện và đã được khai báo thành thực thể E, annotator có thể chọn người đó và hành vi nhìn thấy.

Không suy đoán chủ vật nuôi, người thả vật nuôi hoặc danh tính của người không xuất hiện trong video.

Prev tự sinh từ các hành vi V có chủ thể xác định.

Hệ thống chỉ sinh Prev khi mọi hành vi được gắn với mỗi bên cùng ánh xạ về đúng một hành động phòng tránh.

Ánh xạ hiện hành là đi ngược chiều hoặc sai làn sang đi đúng phần đường, bám sát xe trước sang giữ khoảng cách an toàn, vượt đèn đỏ hoặc không chấp hành biển/vạch sang chấp hành báo hiệu, không nhường đường sang quan sát và nhường đường, và không đội mũ bảo hiểm sang đội mũ bảo hiểm.

Nếu thiếu bên thực hiện, có hành vi chưa được ánh xạ, hoặc một bên có nhiều hành động phòng tránh khác nhau, Prev được đặt thành “không thể xác định”.

Đây là chính sách gán nhãn nhất quán của dự án, không phải kết luận của cơ quan điều tra hay một mô hình nhân quả đã được kiểm định.

## Căn cứ pháp lý Việt Nam

Văn bản hợp nhất 55/VBHN-VPQH năm 2026 hợp nhất Luật 36/2024/QH15 và phần sửa đổi có hiệu lực từ ngày 01/07/2026.

Điều 2 khoản 8 xác định người điều khiển hoặc dẫn dắt vật nuôi là người tham gia giao thông.

Điều 10 quy định đi bên phải, đúng làn/phần đường và chấp hành báo hiệu.

Điều 13 quy định sử dụng làn và chuyển làn; Điều 14 quy định vượt xe; Điều 16 quy định lùi xe; Điều 22 quy định nhường đường tại nơi giao nhau.

Điều 30 quy định cách người đi bộ đi và qua đường.

Điều 32 yêu cầu người điều khiển hoặc dẫn dắt vật nuôi cho vật nuôi đi sát mép phải, chỉ qua đường khi đủ điều kiện an toàn, không vào làn xe cơ giới và không thả vật nuôi trên đường bộ.

Điều 83 yêu cầu điều tra tai nạn khách quan và chính xác, xem xét diễn biến, nguyên nhân, lỗi và điều kiện liên quan.

Các điều kiện cấu thành hành vi trong luật không thể được thay bằng một chuyển động C nếu video không thể hiện điều kiện đó.

Nghị định 168/2024/NĐ-CP quy định xử phạt theo từng hành vi và chủ thể.

Nghị định 238/2026/NĐ-CP sửa đổi một số quy định xử phạt của Nghị định 168, nên khi trích mức phạt trong luận văn cần dùng văn bản hợp nhất hoặc bản cập nhật tại thời điểm viết.

## Căn cứ nghiên cứu và thực hành mã hóa

NHTSA xây dựng taxonomy tiền va chạm để phân loại chuyển động xe và sự kiện tới hạn cho nghiên cứu tránh va chạm.

Sổ tay NASS/CDS của NHTSA xác định sự kiện tiền va chạm là tình huống dẫn đến va chạm đầu tiên và ghi rõ không dùng biến này để xác định culpability.

FHWA khuyến nghị chẩn đoán các yếu tố an toàn bằng dữ liệu, tài liệu và điều kiện hiện trường trước khi lựa chọn biện pháp đối ứng.

Các nguồn Hoa Kỳ hỗ trợ việc tách khái niệm C, V và Prev, nhưng không xác nhận các ánh xạ cụ thể của codebook dự án.

## Triển khai trong ứng dụng

V.v8 khóa các ô kết quả, bên và hành vi chính do hệ thống suy ra.

Ô hành vi bổ sung cho phép chọn nhiều tag và yêu cầu chọn một thực thể người tham gia không phải động vật.

Prev.v3 khóa bên và hành động được sinh từ V.

Lưu C sẽ cập nhật V và Prev trong cùng giao dịch lưu câu trả lời.

Khi mở video đã có C, ứng dụng đồng bộ V và Prev để các bản gán nhãn cũ nhận quy tắc mới.

API lưu không tin giá trị V/Prev do trình duyệt gửi cho các ô dẫn xuất; máy chủ tính lại từ C, E và các tag V bổ sung đã lưu.

Migration đăng ký hai codebook mới và kiểm tra actor/tag V bổ sung được cung cấp theo cặp.

## Nguồn

1. Văn phòng Quốc hội, [Văn bản hợp nhất 55/VBHN-VPQH năm 2026 - Luật Trật tự, an toàn giao thông đường bộ](https://vanban.chinhphu.vn/?docid=217295&pageid=27160).

2. Cổng Thông tin điện tử Chính phủ, [bản PDF Văn bản hợp nhất 55/VBHN-VPQH](https://datafiles.chinhphu.vn/cpp/files/vbpq/2026/3/55-vbhn-vpqh.pdf).

3. Cổng Thông tin điện tử Chính phủ, [Nghị định 168/2024/NĐ-CP - bản ký](https://datafiles.chinhphu.vn/cpp/files/vbpq/2025/01/168-nd-cp.signed.pdf).

4. Cổng Thông tin điện tử Chính phủ, [Nghị định 238/2026/NĐ-CP sửa đổi quy định xử phạt giao thông](https://xaydungchinhsach.chinhphu.vn/nghi-dinh-so-238-2026-nd-cp-sua-doi-quy-dinh-xu-phat-vi-pham-giao-thong-duong-bo-tru-diem-phuc-hoi-diem-giay-phep-lai-xe-119260630142033452.htm).

5. Thư viện Pháp luật, [hỏi đáp về xử phạt khi để vật nuôi trên đường không bảo đảm an toàn](https://thuvienphapluat.vn/phap-luat/ho-tro-phap-luat/chu-vat-nuoi-tha-rong-vat-nuoi-tren-duong-bo-khong-bao-dam-an-toan-giao-thong-bi-xu-phat-hanh-chinh-632809-271533.html).

6. Thư viện Pháp luật, [Bản án 03/2019/DS-ST về bồi thường thiệt hại do súc vật gây ra](https://thuvienphapluat.vn/banan/ban-an/ban-an-ve-tranh-chap-boi-thuong-thiet-hai-do-suc-vat-gay-ra-so-032019dsst-74855).

7. Najm, W. G., Smith, J. D., & Yanagisawa, M. (2007). [Pre-crash scenario typology for crash avoidance research](https://www.nhtsa.gov/sites/nhtsa.gov/files/pre-crash_scenario_typology-final_pdf_version_5-2-07.pdf). NHTSA, DOT HS 810 767.

8. National Highway Traffic Safety Administration, [NASS/CDS 2009 Coding and Editing Manual](https://static.nhtsa.gov/nhtsa/downloads/NASS/2009/Manuals/CDS2009.pdf), phần Critical Pre-Crash Event.

9. Federal Highway Administration, [Road Safety Fundamentals, Unit 4: Solving Safety Problems](https://highways.dot.gov/safety/learn-safety/road-safety-fundamentals-html-version/unit-4-solving-safety-problems).

10. Khattak, A. J., Ahmad, N., Wali, B., & Dumbaugh, E. (2021). [A taxonomy of driving errors and violations: Evidence from the naturalistic driving study](https://doi.org/10.1016/j.aap.2020.105873). *Accident Analysis & Prevention*, 151, 105873.

Các bài hỏi đáp và bản án trên Thư viện Pháp luật được dùng để hiểu tình huống và cách chứng minh trách nhiệm, không thay thế văn bản quy phạm hiện hành.
