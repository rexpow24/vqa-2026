# Căn cứ cho suy luận C → Prev

Ngày rà soát: 22/11/2026.

## Quyết định thiết kế đang xem xét

Dự án quyết định bỏ nhóm V khỏi luồng gán nhãn chính.

Lý do vận hành là annotator không có thẩm quyền kết luận một hành vi vi phạm pháp luật.

Các bản nháp và câu trả lời V đã lưu được giữ làm dữ liệu lịch sử; quyết định này chỉ áp dụng cho luồng gán nhãn mới.

Prev sẽ được suy ra trực tiếp từ tình huống và hành động trong nhóm C.

Giả định nghiên cứu là kiểu xung đột cùng hành động tiền va chạm cung cấp ngữ cảnh để đề xuất một hành động an toàn có thể giúp ngăn sự kiện.

Prev là nhãn khuyến nghị phản thực tế theo quy tắc của dự án, không phải hành động quan sát trực tiếp, kết luận lỗi pháp lý, hay bằng chứng rằng một can thiệp cụ thể chắc chắn đã ngăn được tai nạn.

Nguồn nghiên cứu và pháp luật hỗ trợ mối liên hệ ở mức khung phân tích và nghĩa vụ an toàn.

Các nguồn này không xác thực một ánh xạ tất định cho từng mã K01–K18.

Vì vậy, từng ánh xạ C → Prev cần được định nghĩa trong codebook, rà soát bởi người có chuyên môn an toàn giao thông, và đánh giá trên mẫu video độc lập.

## Căn cứ nghiên cứu

Arun và cộng sự tổng quan có hệ thống 549 nghiên cứu về đánh giá an toàn thay thế bằng kỹ thuật xung đột giao thông.

Bài tổng quan xác định các nhu cầu nghiên cứu gồm xây dựng quan hệ đáng tin cậy giữa xung đột và tai nạn, ghi nhận hành vi người tham gia, và kết hợp mức độ nghiêm trọng.

Điều này hỗ trợ dùng dữ liệu xung đột làm căn cứ phân tích an toàn, đồng thời yêu cầu thận trọng khi diễn giải một tình huống thành nguyên nhân hoặc giải pháp chắc chắn.

Nguồn: Arun, A., Haque, M. M., Bhaskar, A., Washington, S., & Sayed, T. (2021).

“A systematic mapping review of surrogate safety assessment using traffic conflict techniques.”

*Accident Analysis & Prevention*, 153, 106016.

DOI: [10.1016/j.aap.2021.106016](https://doi.org/10.1016/j.aap.2021.106016).

Tarko xem xét cách định nghĩa xung đột giao thông và liên hệ nó với tai nạn bằng khung lý thuyết và bằng chứng thực nghiệm.

Bài viết nhấn mạnh rằng một phần trạng thái quan trọng đối với an toàn không quan sát được từ bên ngoài, và việc nhận diện xung đột/ước lượng nguy cơ cần thỏa các điều kiện hợp lệ.

Nguồn này ủng hộ việc xem C là dữ kiện đầu vào cho một đánh giá an toàn có điều kiện, không ủng hộ coi Prev là sự thật chắc chắn suy ra từ C.

Nguồn: Tarko, A. P. (2021).

“A unifying view on traffic conflicts and their connection with crashes.”

*Accident Analysis & Prevention*, 158, 106187.

DOI: [10.1016/j.aap.2021.106187](https://doi.org/10.1016/j.aap.2021.106187).

FHWA mô tả quy trình quản lý an toàn đường bộ theo các bước: nhận diện vấn đề, chẩn đoán mô hình va chạm và yếu tố góp phần, rồi chọn biện pháp đối ứng phù hợp.

Đây là căn cứ thực hành trực tiếp cho logic “mô tả sự kiện C → chẩn đoán tình huống → đề xuất Prev”.

Quy trình FHWA dựa trên chẩn đoán nhiều dữ liệu và yếu tố, nên chỉ hỗ trợ xem C là một căn cứ quan trọng chứ không mặc định C luôn đủ.

Nguồn: Federal Highway Administration.

“Unit 4: Solving Safety Problems.”

[Road Safety Fundamentals](https://highways.dot.gov/safety/learn-safety/road-safety-fundamentals-html-version/unit-4-solving-safety-problems).

Sổ tay điều tra va chạm NHTSA mã hóa riêng Critical Precrash Event và Attempted Avoidance Maneuver.

Sự kiện tiền va chạm xác định tình huống quan trọng; thao tác né là một biến khác.

Điều này ủng hộ thiết kế Prev là nhãn suy ra riêng từ C, thay vì gọi Prev là một hành động đã được quan sát trong video.

Nguồn: National Highway Traffic Safety Administration.

*Field Crash Investigation Coding and Editing Manual 2024*.

[Bản PDF](https://rosap.ntl.bts.gov/view/dot/88261/dot_88261_DS1.pdf).

## Căn cứ pháp luật Việt Nam

Luật Trật tự, an toàn giao thông đường bộ số 36/2024/QH15 và văn bản hợp nhất 55/VBHN-VPQH quy định nhiều hành động an toàn gắn với các tình huống có thể xuất hiện trong C.

Các nghĩa vụ này cho phép codebook dùng ngôn ngữ luật để xây dựng hành động Prev ở mức khuyến nghị an toàn.

Chúng không chứng minh rằng hành động đó là phản thực tế duy nhất đủ để tránh một vụ việc cụ thể.

Điều 10 yêu cầu đi bên phải, đúng làn/phần đường và chấp hành báo hiệu.

Điều 12 quy định tốc độ và khoảng cách phù hợp điều kiện, đồng thời yêu cầu quan sát, giảm tốc hoặc dừng trong các tình huống như giao lộ, tầm nhìn hạn chế, có người đi bộ hoặc vật nuôi trên đường.

Điều 13 và Điều 14 quy định sử dụng làn, chuyển làn và vượt xe.

Điều 15 và Điều 22 quy định chuyển hướng và nhường đường tại nơi giao nhau.

Điều 16 yêu cầu quan sát và chỉ lùi xe khi bảo đảm an toàn.

Điều 30 quy định người đi bộ đi và qua đường.

Điều 32 quy định cách người điều khiển/dẫn dắt vật nuôi tham gia giao thông.

Nguồn chính thức: [Văn bản hợp nhất 55/VBHN-VPQH năm 2026](https://datafiles.chinhphu.vn/cpp/files/vbpq/2026/3/55-vbhn-vpqh.pdf) và [Luật số 36/2024/QH15 trên Cổng thông tin điện tử Chính phủ](https://vanban.chinhphu.vn/?classid=1&docid=211194&pageid=27160).

Văn bản 55/VBHN-VPQH được ban hành tháng 3/2026.

Tại ngày rà soát, cần đọc cùng Luật số 118/2025/QH15 có hiệu lực từ 01/07/2026; khi trích điều luật trong luận văn cần kiểm tra điều khoản sửa đổi tương ứng, không chỉ dẫn bản gốc 36/2024/QH15.

[Luật số 118/2025/QH15 trên Cổng thông tin Chính phủ](https://vanban.chinhphu.vn/?classid=1&docid=216534&orggroupid=1&pageid=27160).

## Các hành động C có thể gợi ý cho Prev

Bảng dưới đây nêu hướng ánh xạ ứng viên để thiết kế codebook.

Đây chưa phải bảng quy tắc đã được kiểm định, và mỗi ánh xạ cần được giới hạn theo chủ thể, điều kiện nhìn thấy, và câu hỏi Prev mà dự án muốn đo.

| Mã C | Prev ứng viên và bên áp dụng | Điều kiện / giới hạn |
| --- | --- | --- |
| **K01** Xe trước dừng/đứng yên | Bên đi sau: giữ khoảng cách an toàn; quan sát và giảm tốc đủ sớm. | C chỉ cho biết xe trước dừng, chưa nói vì sao dừng. Chọn `keep_distance` làm hành động chính; chỉ ưu tiên `slow_down` nếu diễn biến cho thấy còn thời gian phản ứng. Điều 12. |
| **K02** Xe trước phanh/giảm tốc | Bên đi sau: giữ khoảng cách an toàn và điều chỉnh tốc độ để có thể dừng. | K02 có hành động con “phanh gấp” hoặc “dừng đột ngột”; không kết luận người đi sau luôn có thể tránh va chạm nếu khoảng cách/tầm nhìn không đủ. Điều 12. |
| **K03** Đi sát xe trước đang chạy chậm | Bên đi sau: giữ khoảng cách, giảm tốc theo dòng xe. | Mapping khá trực tiếp, nhưng vẫn cần xác định bên nào đang áp sát từ `subject` và `object`. Điều 12. |
| **K04** Chuyển làn/nhập làn | Bên chuyển làn: quan sát trước-sau-hai bên, báo hiệu và chỉ chuyển làn khi an toàn. | Cần dùng hành động trái/phải và chủ thể; không suy rằng thiếu xi nhan nếu video không thể hiện rõ. Điều 13. |
| **K05** Vượt/len giữa | Bên vượt: chỉ vượt khi đủ điều kiện an toàn; không len vào khoảng trống không an toàn. | Cần biết hướng, vạch, tầm nhìn, xe ngược chiều và dòng xe. “Vượt bên phải” hoặc “len giữa” không đủ để kết luận tính hợp pháp nếu thiếu bối cảnh. Điều 14. |
| **K06** Rẽ cắt xe cùng chiều bên cạnh | Bên rẽ: quan sát, báo hiệu sớm, chọn vị trí/làn phù hợp và chỉ rẽ khi an toàn. | Cần xác định bên rẽ và hướng rẽ. Không tự suy lỗi nhường đường hoặc thiếu tín hiệu. Điều 15. |
| **K07 / mở cửa** | Bên mở cửa: kiểm tra phía trước, sau và phía mở cửa trước khi mở. | Hành động con `open_door` cho mapping tương đối trực tiếp; đây là kiểm tra an toàn, không kết luận bên kia phải đoán trước cửa mở. Điều 19. |
| **K07 / ra khỏi chỗ đỗ** | Bên nhập lại dòng xe: quan sát, báo hiệu và chỉ đi vào dòng xe khi an toàn. | Cần phân biệt rõ với mở cửa; dùng `pull_out` làm nhánh riêng. Điều 18–19. |
| **K08 / lấn khi vượt** | Bên vượt: chỉ vượt khi đủ tầm nhìn/khoảng trống và không lấn vào dòng ngược chiều gây nguy hiểm. | Gắn với `encroach_overtaking`; xem thêm điều kiện K05. Điều 10, 13–14. |
| **K08 / lấn khi vào cua** | Bên vào cua: giữ đúng phần đường/làn và kiểm soát hướng lái. | Gắn với `encroach_curve`; không quy nguyên nhân cho tốc độ nếu chưa quan sát được. Điều 10, 13. |
| **K08 / lấn khi đi thẳng** | Bên lấn làn: đi đúng phần đường/làn. | Gắn với `encroach_straight`; nếu không xác định được bên nào lấn thì không tự chọn actor. Điều 10, 13. |
| **K09** Đi ngược chiều trên làn của bên khác | Bên đi ngược chiều: đi đúng chiều, đúng làn/phần đường. | Mapping trực tiếp ở mức khuyến nghị; vẫn không phải kết luận xử phạt hay lỗi pháp lý đối với người cụ thể. Điều 10. |
| **K10 / rẽ trái hoặc quay đầu** | Bên rẽ/quay đầu: quan sát, báo hiệu, chờ khoảng trống và nhường xe có quyền đi trước. | Cần xác định loại thao tác, biển báo/vạch và quyền ưu tiên. Điều 15. |
| **K11** Hai hướng cắt nhau tại giao lộ, cùng đi thẳng | Các bên tiếp cận: giảm tốc, quan sát tín hiệu và nhường theo quy tắc ưu tiên. | K11 không mã hóa đèn, biển, vòng xuyến hoặc đường ưu tiên. Không gán “cả hai bên phải nhường”; nếu thiếu ngữ cảnh ưu tiên thì Prev chỉ nên là “giảm tốc, quan sát tín hiệu”, hoặc “không đủ căn cứ” cho nhãn nhường đường. Điều 12, 22. |
| **K12 / ra từ đường nhánh** | Bên từ đường nhánh: giảm tốc, quan sát và nhường xe trên đường chính trước khi nhập. | Chỉ áp dụng khi C/S xác nhận được đường nào là nhánh/đường chính. Nếu chỉ thấy xe đi ra từ trái/phải mà không rõ phân cấp đường thì không suy quyền ưu tiên. Điều 22. |
| **K13** Quay đầu giữa đường | Bên quay đầu: chỉ quay đầu tại nơi được phép, quan sát và nhường theo tình huống. | Phải biết vị trí, biển/vạch và các bên có quyền đi trước. Không thể kết luận “quay đầu trái phép” chỉ từ việc quay đầu giữa đoạn. Điều 15. |
| **K14** Người/xe băng ngang giữa đoạn, không ở giao lộ | Bên lái xe: quan sát, giảm tốc và nhường khi người đi bộ đang qua đường. Người băng qua: dừng quan sát, chọn vị trí qua đường an toàn. | `subject` và `object` quyết định vai trò; Điều 30 có quy định nơi qua đường và cách qua đường. Không gán cùng một Prev cho người lái và người đi bộ. Điều 12, 30. |
| **K15 / băng qua** | Bên lái xe: quan sát, giảm tốc và nhường khi cần. Người đi bộ: dừng quan sát và qua đường an toàn. | Dùng nhánh `left_to_right` / `right_to_left`. Cần quan sát có vạch/đèn/lối qua đường hay không. Điều 12, 30. |
| **K15 / đi dọc lòng đường** | Người đi bộ: đi trên lề/vỉa hè nếu có; bên lái xe: quan sát và giảm tốc khi có người trên đường. | Nhánh `along_road` khác căn bản với băng qua. Nếu một nhãn Prev chỉ có một actor thì phải xác định mục tiêu của nhãn; cân nhắc tách K15 hoặc ghi rõ role. Điều 12, 30. |
| **K16** Động vật lao ra đường | Bên lái xe: quan sát, điều chỉnh tốc độ và tránh va chạm trong khả năng kiểm soát. | Không gán hành động/pháp lý cho động vật. Chỉ gán người quản lý vật nuôi nếu họ thực sự xuất hiện và hành động được quan sát. Điều 12(3)(g), 32. |
| **K17** Lùi xe vào bên khác | Bên lùi: quan sát phía sau và xung quanh; chỉ lùi khi bảo đảm an toàn. | Mapping trực tiếp nếu chủ thể lùi xác định được; cần bối cảnh vị trí/tầm nhìn để kết luận nơi lùi có bị cấm không. Điều 16. |
| **K18 / trượt, văng khỏi làn, nổ lốp** | **Mặc định: không đủ căn cứ để chọn một Prev duy nhất.** Nếu thấy rõ đường trơn/tầm nhìn xấu thì có thể khuyến nghị điều chỉnh tốc độ; nếu thấy lốp hỏng trước sự kiện thì kiểm tra/bảo dưỡng; nếu thấy thao tác mất kiểm soát thì đề xuất giữ ổn định hướng lái. | Các hành động con không mã hóa nguyên nhân. Không tự suy “đi nhanh”, “không bảo dưỡng” hay lỗi của bên khác. Đây là trường hợp cần trạng thái `unclear/insufficient_evidence` hoặc bổ sung nguyên nhân có căn cứ. Điều 12 chỉ hỗ trợ khuyến nghị tốc độ theo điều kiện. |

### Diễn giải các nghiên cứu cho thiết kế mapping

Arun và cộng sự tổng hợp 549 nghiên cứu về kỹ thuật xung đột giao thông và đánh giá an toàn thay thế.

Bài báo tổ chức lĩnh vực theo định nghĩa xung đột, phép đo, dữ liệu quan sát, ước lượng tần suất/mức độ nghiêm trọng và kiểm định quan hệ với va chạm.

Nó cho thấy xung đột có thể hỗ trợ đánh giá và ưu tiên giải pháp an toàn, nhưng không nghiên cứu một mapping hành vi tiền va chạm K → hành động phản thực tế của cá nhân.

Tarko phân tích khái niệm xung đột và liên hệ với tai nạn; ông phân biệt trạng thái/hành vi quan sát từ bên ngoài với trạng thái an toàn hoặc phản ứng của người lái có thể không quan sát được.

Do đó, C cung cấp đầu vào để đề xuất Prev, nhưng không đủ để khẳng định một hành động duy nhất chắc chắn đã ngăn sự kiện.

FHWA đề xuất chẩn đoán mô hình va chạm và yếu tố góp phần trước khi chọn biện pháp đối ứng.

Đây là căn cứ cho quy trình “C + điều kiện quan sát được → Prev ứng viên”, chứ không phải sự phê chuẩn của FHWA cho bảng K01–K18 này.

Nguồn chi tiết: Arun et al. (2021), *Accident Analysis & Prevention*, 153, 106016, [DOI 10.1016/j.aap.2021.106016](https://doi.org/10.1016/j.aap.2021.106016), nhất là phần phương pháp/khung đánh giá và thảo luận giới hạn kiểm định; Tarko (2021), *Accident Analysis & Prevention*, 158, 106187, [DOI 10.1016/j.aap.2021.106187](https://doi.org/10.1016/j.aap.2021.106187); [FHWA, Unit 4: Solving Safety Problems](https://highways.dot.gov/safety/learn-safety/road-safety-fundamentals-html-version/unit-4-solving-safety-problems).

## Chính sách gán nhãn đề xuất

Định nghĩa Prev là hành động chính mà người tham gia có thể thực hiện để tránh hoặc giảm khả năng xảy ra xung đột C.

Giữ đúng một hành động chính cho mỗi bên theo quyết định của dự án; chỉ sinh khi C và các trường ngữ cảnh đủ để chọn hành động đó.

Khi nhiều hành động có vẻ hợp lý, tác nhân không rõ, hoặc nguyên nhân thiếu bằng chứng, lưu trạng thái “không đủ căn cứ” thay vì chọn ngẫu nhiên.

Không biến Prev thành kết luận “bên này vi phạm pháp luật”.

Nếu muốn đo mức giảm hậu quả/chấn thương bên cạnh tránh va chạm, cần định nghĩa mục tiêu riêng để hành vi như đội mũ bảo hiểm không bị diễn giải nhầm thành hành động ngăn va chạm.

Đánh giá quy tắc bằng một mẫu video được chuyên gia an toàn giao thông rà soát độc lập.

Đo riêng độ đồng thuận của C gốc, tỷ lệ Prev đủ căn cứ, và độ đúng của ánh xạ C → Prev trên mẫu đã rà soát.

Không tính một Prev được sinh máy như một phán đoán độc lập của annotator.

### Mô hình suy luận đề xuất

Không dùng quy tắc một mã K ánh xạ máy móc tới một Prev.

Dùng chuỗi quyết định: `C (K + hành động + subject/object) + ngữ cảnh quan sát được từ E/S → xác định bên có khả năng hành động → chọn Prev chính → kiểm tra điều kiện → ghi nhãn hoặc abstain`.

`K` xác định dạng xung đột; hành động con xác định diễn biến; `subject/object` xác định vai trò; E/S chỉ bổ sung thuộc tính thực sự nhìn thấy như loại người tham gia, hình học đường và điều kiện mặt đường.

Đèn, biển, vạch, quyền ưu tiên hoặc nguyên nhân không nhìn thấy không được tự điền từ mã K.

Prev nên là khuyến nghị an toàn phản thực tế theo bên, không phải danh sách mọi hành động có thể có.

Khi có một hành động chính ổn định thì ghi hành động đó; khi kết quả phụ thuộc thông tin chưa có thì ghi `không đủ căn cứ` thay vì mặc định “cả hai bên”, “nhường đường” hoặc quy trách nhiệm.

Với K14–K16, actor của Prev phải được nêu rõ vì lời khuyên cho tài xế khác lời khuyên cho người đi bộ hoặc người quản lý vật nuôi.

`main_action.wear_helmet` trong Prev.v3 hiện giảm mức độ chấn thương chứ không trực tiếp ngăn xung đột.

Nếu Prev chỉ đo phòng ngừa va chạm, nên bỏ lựa chọn này khỏi construct đó hoặc tách sang nhãn giảm nhẹ hậu quả.

### Khoảng cách giữa đề xuất này và codebook hiện tại

Codebook `Prev.v3.json` hiện khai báo `inferred_from: V` và mô tả tự sinh từ V.

Đó là metadata cũ, không khớp quyết định mới bỏ V và xây Prev từ C.

Trong codebook, câu hỏi và mẫu Prev cũng cho phép hai bên, nhưng bảng mapping phía trên khuyến nghị xác định actor riêng theo tình huống thay vì mặc định cả hai.

Đây là kết quả rà soát và đề xuất nghiên cứu; codebook/ứng dụng chưa được sửa trong tác vụ này.

Trước khi triển khai cần chốt trạng thái abstain có cấu trúc và quy tắc actor, sau đó cập nhật hướng dẫn, JSON codebook, logic tự sinh, CSV và kiểm thử lưu/hiển thị.

## Giới hạn

Luật xác định nghĩa vụ của người tham gia trong các bối cảnh giao thông.

Luật không cung cấp một đáp án phản thực tế duy nhất cho từng video.

Nghiên cứu traffic conflict hỗ trợ phân tích tình huống và lựa chọn biện pháp an toàn từ chẩn đoán, nhưng không xác nhận các ánh xạ K01–K18 của dự án.

Vì thế, tuyên bố phù hợp cho luận văn là: “Prev được suy ra theo một chính sách codebook xác định từ tình huống C và các điều kiện quan sát được; chính sách được xây dựng dựa trên quy tắc giao thông và quy trình chẩn đoán an toàn, sau đó được đánh giá riêng”.
