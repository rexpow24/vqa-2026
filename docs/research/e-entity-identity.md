# Định danh các thực thể cùng loại trong nhóm E

## Quyết định của dự án

Mỗi phương tiện liên quan là một thực thể riêng, được gán tên A, B, C ổn định trong toàn bộ video.

Loại phương tiện và màu sắc là thuộc tính mô tả, không phải định danh của thực thể.

Vì vậy, hai xe máy được ghi là "xe máy A" và "xe máy B", kể cả khi chúng cùng loại và không dùng màu để phân biệt.

Nếu chỉ có một bên liên quan có camera hành trình, bên đó được gán A.

Các bên còn lại được gán theo vị trí ở khung hình đầu tiên tất cả các bên cùng xuất hiện và nhận diện được: trái sang phải, rồi trên xuống dưới nếu gần như cùng một cột.

Nếu không có bên nào có camera hành trình, áp dụng thứ tự vị trí này cho tất cả các bên.

Nếu có nhiều bên có camera hành trình, xếp các bên đó theo thứ tự vị trí trước; bên camera đứng đầu được gán A, rồi các bên còn lại được gán theo cùng thứ tự vị trí.

Nếu không có khung hình nào cho thấy đồng thời các bên một cách rõ ràng, gán tên theo thứ tự nhận diện được lần đầu.

Sau khi gán, giữ nguyên tên khi phương tiện đổi vị trí, cắt ngang nhau, bị che khuất hoặc xuất hiện lại.

Annotator dùng tính liên tục qua các khung hình, quỹ đạo và vai trò trong sự kiện để theo dõi danh tính.

Nếu không thể xác định chắc chắn một phương tiện xuất hiện lại có phải cùng thực thể hay không, cần đánh dấu để phân xử thay vì tự đổi hoặc đoán tên.

Các nhóm C, O, R, Attr và Prev phải dùng lại tên thực thể từ nhóm E.

## Quy ước nhóm loại xe trong E

Theo quyết định taxonomy của dự án, xe máy thường và xe máy điện cùng dùng nhãn "xe máy".

Xe đạp thường và xe đạp điện cùng dùng nhãn "xe đạp".

Xe ba gác được giữ là nhãn riêng, tương ứng với xe ba bánh chở hàng.

Sơ đồ giải thích trực quan cho annotator nằm trong [hướng dẫn E](../../annotator-guidelines/huong-dan/11-E-nhan-dien-xe.png).

Ưu tiên xe camera hành trình làm A và thứ tự trái-sang-phải, trên-xuống là quy ước vận hành của dự án, không phải quy tắc được các nghiên cứu dưới đây quy định.

## Cơ sở nghiên cứu và giới hạn áp dụng

Các bộ dữ liệu theo dõi đa đối tượng trong giao thông định danh từng thực thể bằng track identity riêng và duy trì liên kết đó qua nhiều khung hình.

BDD100K xây dựng tập theo dõi đa đối tượng từ video giao thông, ghi nhận track identities và mô tả các tình huống che khuất, rời khỏi khung hình rồi xuất hiện lại.

Điều này hỗ trợ nguyên tắc tách danh tính của từng xe khỏi lớp đối tượng như ô tô hoặc xe máy, và giữ liên kết theo thời gian.

MOTChallenge xem identity switch là một dạng lỗi đánh giá theo dõi, đồng thời thảo luận rằng che khuất, cắt khung hình và các đối tượng giống nhau có thể tạo ra nhập nhằng ngay cả với người quan sát.

Các nguồn này hỗ trợ nguyên tắc ID ổn định theo thời gian, nhưng không xác nhận rằng người gán nhãn độc lập luôn thống nhất thứ tự A/B chỉ bằng vị trí.

Vì vậy, bộ quy tắc vị trí khởi tạo và bước phân xử trong dự án là các biện pháp vận hành nhằm làm cho quyết định có thể lặp lại; chúng cần được kiểm tra bằng dữ liệu đồng thuận của chính dự án.

## Tài liệu tham khảo

Yu, F., Chen, H., Wang, X., Xian, W., Chen, Y., Liu, F., Madhavan, V., & Darrell, T. (2020).
BDD100K: A Diverse Driving Dataset for Heterogeneous Multitask Learning.
In *Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)*, 2636–2645.
[Bản bài báo tại CVF Open Access](https://openaccess.thecvf.com/content_CVPR_2020/papers/Yu_BDD100K_A_Diverse_Driving_Dataset_for_Heterogeneous_Multitask_Learning_CVPR_2020_paper.pdf).

Dendorfer, P., Osep, A., Milan, A., Schindler, K., Cremers, D., Reid, I., Roth, S., & Leal-Taixé, L. (2021).
MOTChallenge: A Benchmark for Single-Camera Multiple Target Tracking.
*International Journal of Computer Vision, 129*, 845–881.
[https://doi.org/10.1007/s11263-020-01393-0](https://doi.org/10.1007/s11263-020-01393-0).
