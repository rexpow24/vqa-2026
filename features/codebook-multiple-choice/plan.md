# Lộ trình chuyển sang gán nhãn theo codebook (chọn ô)

Bản nháp 2026-11-14. Trạng thái: đề xuất, chưa bắt đầu.
Guideline đích cho nhóm C: [docs/guidelines/C-nguyen-nhan.md](../../docs/guidelines/C-nguyen-nhan.md).

## 1. Điểm xuất phát

- Nhóm agreement có 60 video (3 vòng × 20), đã gán chung theo dạng câu tự do. Kappa vòng 1 là 0.37, vòng 2 là 0.54 (`csvs/tier1.csv`).
- Không tạo thêm video chung theo cách cũ được: `create_agreement_group` bị chặn ngay khi đã có assignment không phải legacy, và video thường đã được chia từ #61.
- Mỗi câu trả lời hiện là một dòng `qa_annotations`: verdict, reason_code, edited_answer, human_keyframes_s. Không có cột nào chứa ô.
- Bản mock form nhóm C và taxonomy 18 kiểu xung đột đã có, chưa có code thật.

## 2. Nguyên tắc chuyển đổi

1. **Chuyển từng nhóm, không chuyển cả 9 cùng lúc.** Pilot với S và C (2 thực thể) trước, vì S có tập lựa chọn đóng tự nhiên và C là nhóm khó nhất. Nếu C không chạy được thì phải biết sớm.
2. **Codebook có phiên bản và đóng băng trong một vòng.** Mỗi câu trả lời lưu kèm `codebook_version`. Trong một vòng không thêm lựa chọn. Câu "Khác" được gộp giữa các vòng.
3. **Không viết lại dữ liệu cũ.** Câu tự do của 60 video vẫn giữ nguyên. Phần map sang ô là dữ liệu phân tích riêng, gắn nguồn `mapped`, không ghi đè.
4. **Verdict giữ nguyên nghĩa.** AGREE vẫn nghĩa là "đồng ý với draft", tức mọi ô trùng với ô của draft. Nhờ vậy difficulty suy ra, revision log và adjudication không phải đổi nghĩa.
5. **Một tập để xây, một tập để đo.** Video đã dùng để dựng codebook thì không dùng để đo đồng thuận của codebook đó.
6. **Chưa làm retrieval hay xếp hạng gợi ý.** Chỉ thêm khi một ô có hơn khoảng 25 lựa chọn. Trước đó hiển thị hết lựa chọn, chia theo nhóm.
7. **Mọi bước gọi LLM qua API phải được duyệt trước khi chạy hàng loạt.**
   Trưởng nhóm xem ba thứ: prompt đầy đủ, một input thật lấy từ dữ liệu, và output mong muốn cho input đó.
   Chỉ chạy khi đã duyệt.
8. **Mọi phương pháp, quy tắc hay ngưỡng đưa ra đều phải có cơ sở lý luận uy tín, không tự đặt ra.**
   Cơ sở là bài báo có bình duyệt, báo cáo của cơ quan chính thức (ví dụ NHTSA) hoặc chuẩn, danh mục đã công bố (ví dụ Unfalltypen-Katalog), hoặc số liệu đo được trên chính dữ liệu của dự án.
   Mỗi đề xuất ghi kèm nguồn, và nói rõ nguồn đã được đọc ở bản gốc hay mới kiểm qua tài liệu thứ cấp.
   Không tìm được cơ sở thì nói thẳng là chưa có, và để trưởng nhóm quyết; không trình bày như một quy tắc đã có căn cứ.
   Ngoại lệ (2026-11-14): guideline của các nhóm E, N, V, O, R, Attr, Prev không cần cơ sở lý luận, vì không quan trọng bằng C; chúng dựa trên guideline gốc của dự án.

## 3. Các giai đoạn

### P0. Chốt quyết định (khoảng 2 ngày, không code)

- Hỏi mentor: câu trả lời ghép theo mẫu có hợp với mục tiêu dataset không (benchmark chấm theo ô hay open-ended VQA).
- Chốt phạm vi pilot: S (5 ô, có thể thêm ô 6 "đoạn đường") và C 2 thực thể.
- Chốt ngưỡng đạt cho từng giai đoạn (mục 4).
- Trả lời các câu hỏi còn mở trong guideline C, mục 17.

Đầu ra: guideline S và C bản v1, danh sách ngưỡng.

### P1. Dựng codebook v1 từ 60 video (khoảng 3-4 ngày, offline)

- Script đọc answers export, cho LLM map từng câu tự do của S và C vào ô của guideline. Kết quả gồm ô đã map và cờ "không map được".
- Mỗi câu trả lời khác nhau được xét theo từng ô: M (map được), T (câu không nhắc đến ô), K (có nhắc nhưng codebook không có lựa chọn phù hợp).
- Đo theo từng ô: n = M + K, độ phủ = M / n, tỉ lệ T, các cụm bị K, và danh sách phần câu nằm ngoài codebook.
- Ô có n dưới khoảng 10 ghi "chưa đủ dữ liệu", không tính đạt hay không đạt.
- Với các ô chưa đủ dữ liệu: trưởng nhóm và một người khác điền thử form ô (bảng tính là đủ) cho khoảng 10 video trong 60, ghi lại mỗi lần thiếu lựa chọn và thời gian điền.
- Sửa danh sách lựa chọn ở những chỗ phủ thấp. Chốt `codebook/<nhóm>.v1.json`: mỗi lựa chọn có ID cố định, nhãn tiếng Việt, nhóm cha (với kiểu xung đột).
- Có thể map luôn draft của 60 video sang ô, để đo xem draft sai ở ô nào.

Cổng ra: độ phủ ≥ 80% ở mỗi ô đủ dữ liệu (n ≥ 10) của S và C, và lần điền thử không còn chỗ thiếu lựa chọn chưa xử lý.
Ô chưa đủ dữ liệu được kiểm tiếp ở pilot P6 bằng tỉ lệ "Khác".
Không đạt thì quay lại sửa guideline, chưa viết code app.

Trạng thái P1:

- Nhóm S: đã chốt ngày 2026-11-14, file `codebook/S.v1.json`, giữ nguyên lựa chọn của guideline.
  Lượt map bằng gemini-3.8-flash trên 209 câu khác nhau: 5/6 ô đạt; mật độ xe 76% (n = 49), trưởng nhóm quyết giữ nguyên.
  Báo cáo: `scripts/codebook_map.py report` ra `csvs/p1/coverage_S.txt`.
- Nhóm C: prompt đang chờ review.

### P2. Mô hình dữ liệu (khoảng 3 ngày, qua `quyen:ship-feature` và conflict audit)

- Bảng `codebook_versions` (version, qgroup, nội dung JSON, ngày đóng băng). Codebook đang dùng cũng nằm trong `frontend/src/lib/codebook/` để UI đọc.
- `video_drafts.draft_slots jsonb`: ô của draft, do LLM tách ra.
- `qa_annotations.slots jsonb` và `qa_annotations.codebook_version`. `edited_answer` vẫn được ghi bằng câu đã ghép, nên `effective_answer`, export cũ và adjudication vẫn chạy.
- `video_entities`: danh sách thực thể của từng annotator trên từng video (id A/B/C, loại, nhóm màu, đặc điểm). Nhóm E đổi sang dạng khai báo này.
- Trigger `validate_qa_annotation`: với nhóm dạng ô, kiểm ID có trong codebook, đủ ô bắt buộc theo mẫu, các ràng buộc C0 ↔ kết quả né, Start < End. `reason_code` tự suy ra từ các ô khác draft.
- Trigger revision log: thêm `slots` vào phép so "nội dung có đổi không".
- Mỗi nhóm có cờ định dạng trong `qgroups.json` (`"format": "slots" | "text"`). Các nhóm chưa chuyển vẫn chạy như cũ.

Cổng ra: migration chạy trên bản sao, các `verify-*.mjs` cũ đều pass, thêm `verify-slots.mjs`. Migration production cần bạn cho phép riêng.

### P3. Tách draft thành ô (khoảng 2 ngày, offline)

- Script cho LLM tách draft S và C của các video sẽ dùng thành `draft_slots`, gắn cờ khi gặp từ cấm, rồi upload.
- Không kiểm tay (trưởng nhóm quyết 2026-11-14). Annotator sửa ô sai khi gán, vì form điền sẵn ô từ draft.

Cổng ra: mọi draft qua kiểm tra tự động của script (đủ ô, giá trị có trong codebook).

### P4. Giao diện (khoảng 4-5 ngày, qua `quyen:ship-feature`)

- Form ô cho S và C theo bản mock: thực thể từ E, C0-C4, câu ghép trực tiếp, các kiểm tra chặn gửi, ô "Khác" có giới hạn chữ và chặn từ cấm.
- Khai báo thực thể ở E dùng lại trên mọi câu của video.
- Chọn "Không đồng ý" thì các ô điền sẵn từ draft và đánh dấu ô đã đổi. Chọn "Đồng ý" thì khóa các ô.
- Màn admin xem câu "Khác" theo vòng, gộp thành lựa chọn mới cho phiên bản sau.

Cổng ra: kiểm e2e trên local với một video thật, chụp màn hình, test pass.

### P5. Export và độ đo (khoảng 2 ngày)

- `answers_export` thêm cột `codebook_version` và mỗi ô một cột.
- `scripts/iaa_slots.py`: alpha và AC1 cho từng ô, bootstrap theo video (dùng lại phần lõi của `iaa_round.py`).
  - Kiểu xung đột đo hai mức: nhóm và kiểu.
  - Chủ thể và đối tượng khớp theo (loại, nhóm màu).
  - Mốc thời gian tính khớp khi lệch không quá 0,5 s.
  - Báo tỉ lệ "Khác" và tỉ lệ giữ nguyên ô của draft.

### P6. Vòng pilot (khoảng 1 tuần)

- Cần video chung mới, vì 60 video cũ đã dùng để dựng codebook. Thêm hàm `extend_agreement_group(n)`: lấy n video chưa ai giữ, phân tầng như cũ, đánh dấu `agreement_sample` mà không đánh số lại các video đã chia.
- Ít nhất 81 video, 3-4 annotator đã qua 3 vòng, chỉ S và C dùng dạng ô. 7 nhóm còn lại vẫn là câu tự do.
  Cỡ mẫu theo bảng của Krippendorff (2019, dùng công thức Bloch & Kraemer 1989): 81 đơn vị để kiểm alpha ≥ 0.667, 139 đơn vị để kiểm alpha ≥ 0.8, với p = 0.05.
  Mỗi video là một đơn vị của mỗi ô. Bảng giả định 2 người gán và 4 lựa chọn xuất hiện đều nhau; ô lệch (ví dụ ánh sáng: 97% "ban ngày" ở P1) cần nhiều đơn vị hơn, nên con số này là mức tối thiểu.
  Pilot chỉ kết luận được ở mức 0.667; mức 0.8 cần đủ 139 video chung, có thể cộng dồn qua các vòng P7 với cùng phiên bản codebook.
- Đo theo mục 4 và hỏi annotator về thời gian và các chỗ khó.

### P7. Mở rộng sang các nhóm khác (mỗi nhóm khoảng 1 tuần)

- Thứ tự: V, O, Attr (tập lựa chọn đóng) → E (đã làm ở P4) → R, Prev → C nhiều thực thể (dây chuyền, kẹp giữa) → N chuyển sang ghép tự động từ C, O, R.
- Mỗi nhóm lặp lại P1 (codebook từ dữ liệu cũ), P3, P4, rồi vào các vòng video chung.
- Cỡ mẫu giống P6: alpha của một nhóm chỉ được kết luận khi nhóm đó có ít nhất 81 video chung gán dạng ô (mức 0.667) hoặc 139 video (mức 0.8), cùng một phiên bản codebook.
  Vòng có thể nhỏ hơn (ví dụ 20 video) để sửa guideline giữa chừng, nhưng alpha của một vòng nhỏ chỉ để tham khảo, không dùng làm cổng.
  Một video chung cho đơn vị của mọi nhóm đã chuyển sang dạng ô, nên các nhóm chuyển trước tiếp tục cộng dồn ở các vòng của nhóm sau.
  Đổi phiên bản codebook của một nhóm thì số video của nhóm đó tính lại từ 0 (nguyên tắc 2 và mục 5: không gộp các phiên bản).
- Các vòng chung tiếp tục đến khi đạt ngưỡng mục 4, sau đó mới chia video thường theo dạng ô.

### P8. Dữ liệu video thường đang gán dạng câu tự do

- Chốt một ngày chuyển. Video bắt đầu sau ngày đó gán bằng ô.
- Video đã xong trước ngày chuyển: LLM map sang ô với nguồn `mapped`, không kiểm tay. Video nào map không được thì đưa vào hàng chờ gán lại. Không bắt gán lại toàn bộ.
- Video đang làm dở vào ngày chuyển thì làm nốt theo dạng cũ.

## 4. Ngưỡng đạt

| Giai đoạn | Chỉ số | Ngưỡng |
| --- | --- | --- |
| P1 | Độ phủ codebook trên 60 video, mỗi ô có n = M + K ≥ 10 | ≥ 80% |
| P1 | Ô có n < 10 | "chưa đủ dữ liệu", kiểm bằng điền thử và ở P6 |
| P3 | Draft tách thành ô | qua kiểm tra tự động, không kiểm tay |
| P6 | Số video chung mỗi ô | ≥ 81 (kiểm alpha 0.667); ≥ 139 để kiểm 0.8 |
| P6, P7 | Alpha các ô S | ≥ 0.667 ở pilot, ≥ 0.8 khi đủ 139 video |
| P6, P7 | Alpha mắt xích chính C (kiểu xung đột + chủ thể) | ≥ 0.67 ở pilot, ≥ 0.8 trước khi chia video thường |
| P6, P7 | Tỉ lệ "Khác" | < 15% ở pilot, < 10% trước khi chia video thường |
| P6, P7 | Tỉ lệ giữ nguyên ô draft so với tỉ lệ draft sai thật | không cao hơn rõ rệt (dấu hiệu bị neo) |

Mức 0.67 là ngưỡng "kết luận tạm" theo Krippendorff. Mức 0.8 là mục tiêu ban đầu của dự án.

## 5. Rủi ro

| Rủi ro | Cách xử lý |
| --- | --- |
| Hết video chung | Thêm `extend_agreement_group` ở P6; không dùng lại 60 video cũ để đo |
| Codebook phủ kém ở C | Cổng P1 chặn trước khi viết code; xem lại cách tách ô |
| Bị neo vào draft vì ô điền sẵn | Đo tỉ lệ giữ nguyên ô; nếu cao thì thử cho một nhóm không điền sẵn |
| Câu trả lời đơn điệu, mất đa dạng ngôn ngữ | Xác nhận ở P0; vẫn lưu câu ghép, có thể sinh diễn đạt khác về sau |
| Đổi format giữa chừng nên không so được kappa | Báo cáo tách theo `codebook_version`; không gộp vòng cũ với vòng mới |
| Lỗi ở C lan sang V, Attr | Báo thêm alpha của nhóm sau chỉ trên các câu đã khớp ở C |

## 6. Thứ tự và ước lượng

| Tuần | Việc |
| --- | --- |
| 1 | P0, P1 (S và C) |
| 2 | P2, P3 |
| 3 | P4, P5 |
| 4 | P6 pilot, sửa codebook v2 |
| 5 trở đi | P7, mỗi nhóm khoảng 1 tuần; P8 khi đã đạt ngưỡng |

Nếu cổng P1 không đạt, mọi việc từ P2 trở đi lùi lại. Đó là chủ ý của lộ trình này.

## 7. Rà soát cơ sở theo nguyên tắc 8 (2026-11-14)

Cột "Đã đọc" ghi mức kiểm: "gốc" là đọc văn bản gốc, "tóm tắt" là chỉ đọc abstract hoặc tài liệu thứ cấp.

### 7.1. Đã có cơ sở

| Quy tắc | Cơ sở | Đã đọc |
| --- | --- | --- |
| Alpha ≥ 0.8 là tin được, 0.667 là kết luận tạm | Krippendorff (2004), Content Analysis | tóm tắt |
| Báo AC1 cạnh alpha khi một giá trị áp đảo | Feinstein & Cicchetti (1990); Gwet (2008) | tóm tắt |
| Khoảng tin cậy bootstrap theo video, không theo câu | Field & Welsh (2007), JRSS-B 69(3), cluster bootstrap | tóm tắt |
| Đo tỉ lệ giữ nguyên ô draft để phát hiện bị neo | Berzak et al. (2016), EMNLP: người sửa output của parser bị neo, đồng thuận bị thổi phồng | tóm tắt |
| C: chỉ ghi cặp chính khi có từ 3 bên | Najm et al. (2007), NHTSA DOT HS 810 767 | gốc |
| C: cặp chính theo xung đột dẫn tới tai nạn | Unfalltypen-Katalog (GDV/UDV) | tóm tắt |
| Dựng codebook lặp lại từ dữ liệu, có thử trước | MacQueen et al. (1998), Cultural Anthropology Methods 10(2) | tóm tắt |

Nguyên tắc 5 (video dựng codebook không dùng để đo) mới là suy luận.
Krippendorff viết rằng huấn luyện không ghi lại và thống nhất bằng thảo luận làm đồng thuận bị thổi phồng; chưa tìm thấy câu nào nói thẳng phải loại các đơn vị đã dùng để dựng codebook.

### 7.2. Chưa có cơ sở hoặc mâu thuẫn với số liệu

| Quy tắc trong plan | Tình trạng | Ghi chú |
| --- | --- | --- |
| Cổng P1: độ phủ ≥ 80%, ô cần n ≥ 10 | Chưa có nguồn | Khoảng tin cậy Wilson 95%: 8/10 là [0.49; 0.94], mật độ xe 37/49 là [0.62; 0.85]. Ở cỡ mẫu này, 76% và 80% không phân biệt được. |
| P3: kiểm tay 30 draft, ngưỡng sai < 5% | Đã bỏ 2026-11-14: trưởng nhóm quyết không kiểm tay | |
| P6: pilot 10-20 video | Đã sửa 2026-11-14: ít nhất 81 video | Bảng cỡ mẫu của Krippendorff (2019), công thức Bloch & Kraemer (1989): 2 người, 4 lựa chọn đều nhau, p = 0.05 cần 139 đơn vị cho alpha_min 0.8 và 81 cho 0.667. Nguồn: hướng dẫn ATLAS.ti trích Krippendorff, tóm tắt. |
| Tỉ lệ "Khác" < 15% ở pilot, < 10% trước khi chia | Chưa có nguồn | Tài liệu phân tích nội dung yêu cầu danh mục bao quát và thử trước, nhưng không nêu ngưỡng cho "Khác". |
| Mốc thời gian khớp khi lệch ≤ 0,5 s | Chưa có nguồn | Có chuẩn thay thế: tIoU giữa hai khoảng [start, end], như đánh giá ActivityNet (trung bình trên ngưỡng 0.5 đến 0.95). |
| Thêm retrieval khi một ô có hơn khoảng 25 lựa chọn | Chưa có nguồn | |
| Duyệt tay khoảng 50 câu đã map | Đã bỏ 2026-11-14: trưởng nhóm quyết không kiểm tay | |
| Điền thử khoảng 10 video | Chưa có nguồn | |
| P7: vòng nhỏ khoảng 20 video để sửa guideline | Chưa có nguồn | Chỉ là nhịp làm việc. Cổng alpha của P7 đã sửa 2026-11-14 theo cỡ mẫu 81 / 139 như P6. |
| Gửi 7 câu một lần gọi LLM (`scripts/codebook_map.py`) | Chưa có nguồn | Có thể đo trên dữ liệu dự án: chạy một mẫu theo lô và từng câu rồi so. Cần duyệt theo nguyên tắc 7 vì tốn API. |

Các ngưỡng ở 7.2 giữ nguyên cho đến khi trưởng nhóm quyết: tìm thêm nguồn, đổi theo số liệu, hoặc ghi rõ là quy ước nội bộ.
