# Spec P2: dữ liệu cho gán nhãn theo ô

Bước 02, 2026-11-16.
Đầu vào: [overview.md](overview.md), [requirements.md](requirements.md) (quyết định 1-4, giả định A1-A7, AC1-AC7), [conflicts.md](conflicts.md) (13 xung đột, PASS sau quyết định 4), [plan.md](../codebook-multiple-choice/plan.md) mục P2 và P4, `codebook/<nhóm>.v1.json`, Decision Log trong `CLAUDE.md`.
Cơ chế ở [architecture.md](architecture.md), hợp đồng kiểm ở [acceptance.md](acceptance.md).

## Vấn đề

Trưởng nhóm muốn tự đánh thử 10 video bằng form chọn ô trong app để biết codebook v1 đã phủ đủ chưa ("tôi sẽ đánh thử 10 video xem cover đủ chưa").
Hôm nay mỗi câu trả lời chỉ lưu được dạng chữ: verdict so với draft Gemini, lý do, câu viết lại.
Không có chỗ nào lưu ô đã chọn, phiên bản codebook, hay danh sách thực thể A/B/C dùng chung giữa các nhóm.
P2 là phần dữ liệu: sau P2, form P4 phải lưu được đủ 7 nhóm dạng ô mà không làm đổi gì với các annotator đang gán chữ, và không làm bẩn số liệu đồng thuận, độ khó, thống nhất đáp án của 60 video agreement.

## Hành vi sau khi ship

- Mỗi codebook v1 (S, E, C, V, O, R, Prev) có một dòng trong database, nội dung trùng file `codebook/<nhóm>.v1.json`, và không ai sửa được dòng đó qua API.
- Mỗi phân công có một định dạng trả lời: `text` (mặc định, mọi phân công hiện có) hoặc `slots`.
- Chỉ admin đổi được định dạng, và chỉ khi phân công chưa có câu trả lời hay thực thể nào.
- Trong phân công `slots`, 7 nhóm S, E, C, V, O, R, Prev lưu dạng ô với verdict `SLOTS`; N và Attr vẫn lưu dạng chữ như cũ (AGREE, DISAGREE, NOT_ANSWERABLE so với draft).
- Một câu `SLOTS` mang ô đã chọn, phiên bản codebook, và câu ghép theo mẫu của guideline; không mang lý do; câu ghép được phép trùng nguyên văn draft.
- Câu ghép do server sinh ra từ ô, annotator không gõ câu cho nhóm dạng ô.
- Database từ chối một câu dạng ô có ID không có trong codebook, thiếu ô bắt buộc, sai ràng buộc cha con (hành động không thuộc kiểu xung đột, dấu hiệu không thuộc mức độ), trỏ tới bên chưa khai báo ở E, hoặc ghi chữ "khác" sai chỗ.
- Database từ chối ghi kiểu chữ lên một câu dạng ô và ghi kiểu ô lên một câu dạng chữ, nên một trang cũ còn mở không đè được dữ liệu ô.
- Thực thể A, B, C của mỗi annotator trên mỗi video nằm ở một bảng riêng; câu E là câu ghép sinh lại mỗi lần lưu danh sách thực thể.
- Xóa hay sửa một thực thể đang được nhóm khác trỏ tới bị database từ chối, kèm tên các nhóm đang trỏ tới.
- Nhóm C và V dạng ô vẫn bắt buộc đúng 2 keyframe start < end như hôm nay.
- Sửa ô sinh một dòng revision; lưu lại y nguyên thì không.
- Phân công `slots` không tính vào độ khó suy ra, `final_answers`, `final_video_labels`, CSV thống nhất đáp án, và bị `scripts/iaa_round.py` bỏ qua theo mặc định.
- `answers_export` và CSV `/api/admin/answers/export` có thêm cột `answer_format`.
- Gỡ phân công kèm "xóa cả câu đã làm" xóa luôn thực thể của người đó trên các video bị gỡ.
- Annotator khác không thấy gì đổi: cùng form, cùng dữ liệu, cùng route.

## Phạm vi

- Bảng `codebook_versions`, seed 7 dòng từ 7 file JSON, bản sao `frontend/src/lib/codebook/` cho UI và route.
- Commit 6 codebook còn chưa vào git (C, E, O, Prev, R, V) trước khi seed.
- `video_assignments.answer_format` và RPC admin `set_answer_format`.
- `qa_annotations.slots`, `qa_annotations.codebook_version`, verdict `SLOTS`.
- Bảng `video_entities` và RPC `save_video_entities`.
- Kiểm ô trong database: `validate_slots` gọi từ `validate_qa_annotation` và từ trigger của `video_entities`.
- Cập nhật cùng lúc mọi chỗ đọc verdict: check constraint, `validate_qa_annotation`, `effective_answer`, `validate_assignment`, route lưu, `frontend/src/lib/types.ts`, `annotator-report.mjs`, `scripts/iaa_round.py`, `scripts/iaa_questions.py`, `scripts/iaa_tier1.py`.
- Loại phân công `slots` khỏi `annotator_difficulty`, `final_answers`, `final_video_labels`; `answers_export` thêm `answer_format` (drop rồi tạo lại) và route export thêm cột.
- Log revision lưu và so cả `slots` và `codebook_version`.
- `unassign_agreement_group` và `unassign_range` xóa `video_entities` khi xóa việc đã làm, và coi phân công có thực thể là đã bắt đầu.
- Module ghép câu `frontend/src/lib/codebook/compose.ts`, dùng bởi route (nguồn duy nhất của câu ghép) và bởi form P4 (xem trước).
- Route `POST /api/drafts/[id]/annotation` nhận dạng ô; route mới `PUT /api/videos/[id]/entities`.
- Môi trường test local: script `verify-*.mjs` chạy được trên Supabase local, `verify-slots.mjs` mới từ chối chạy trên host không phải local.

## Những gì P2 phải giao cho form P4

Form P4 là feature riêng.
P2 giao đúng những thứ sau, không hơn:

- Đọc định dạng: `video_assignments.answer_format` của chính annotator (RLS hiện có đã cho đọc phân công của mình).
- Đọc codebook: `frontend/src/lib/codebook/index.ts` trả codebook theo nhóm và phiên bản, và `isSlotGroup(qgroup)` (nhóm có codebook là nhóm dạng ô).
- Xem trước câu: `compose(qgroup, slots, context)` trong `frontend/src/lib/codebook/compose.ts`, cùng hàm route dùng khi lưu.
- Đọc câu đã lưu: `qa_annotations` có thêm `slots`, `codebook_version`; `edited_answer` là câu ghép.
- Đọc thực thể: `select` trên `video_entities` của chính mình.
- Lưu một câu dạng ô: `POST /api/drafts/[id]/annotation` với `{ verdict: "SLOTS", codebook_version, slots, human_keyframes_s }`; trả dòng đã lưu kèm câu ghép.
- Lưu thực thể: `PUT /api/videos/[id]/entities` với `{ codebook_version, entities: [{ key, cells }] }`; trả danh sách đã lưu và câu E.
- Lỗi: 422 cho dữ liệu sai (thông báo tiếng Việt, kèm `code` máy đọc được), 409 cho thực thể đang được trỏ tới (kèm danh sách nhóm), 409 cho câu đã được thống nhất như hôm nay.
- Hoàn thành video: route `complete` hiện có chạy được với phân công `slots` khi đủ 9 câu và event label.

Những kiểm tra giữa các nhóm (ví dụ O "không va chạm" khi C là "va chạm") là việc của form P4, không phải của database ở P2 (xem Non-goals).

## Non-goals

- P3, tách draft thành ô và `video_drafts.draft_slots`: quyết định 3, form bắt đầu trống; cột chưa có người ghi nên chưa thêm (architecture.md, Rejected).
- P5, export theo từng ô và alpha theo ô: lần đánh thử chỉ cần lưu được; `answers_export` chỉ thêm `answer_format`.
- Màn admin gộp câu "khác": thuộc vòng sau, chưa có dữ liệu để gộp.
- Form P4 và màn chọn ô: feature riêng; P2 chỉ giao hợp đồng ở mục trên.
- Màn admin đặt `answer_format`: 10 phân công, một RPC là đủ.
- Chuyển annotator khác sang form ô: ngoài phạm vi theo requirements.md.
- Ràng buộc giữa các nhóm trong database (O với C, C0 với kết quả né, O.parties bằng cặp của C): mỗi ràng buộc đọc hai dòng khác nhau, sai thứ tự lưu thì chặn oan; để form chặn trước khi gửi.
- Điều kiện "khi nào điền" viết bằng lời trong codebook E (cỡ chỉ với xe khách, xe tải; camera chỉ với ô tô...): database chỉ kiểm cái codebook nói được bằng cờ máy đọc; form ẩn ô không áp dụng.
- So ô với draft và suy `reason_code` (plan P2): quyết định 4 bỏ so sánh với draft cho lần đánh thử.
- Cờ `"format"` trong `qgroups.json` (plan P2): cờ toàn cục đổi form của mọi người, trái AC6 (xung đột 7).
- Migration production và deploy: cần trưởng nhóm cho phép riêng từng lần (A7); P2 xong khi pass trên local.
- Đổi tên các migration cũ trong repo cho Supabase CLI: chỉ bản sao trong workdir local được đổi tên.

## Quyết định

Các dòng đã chốt, kèm cái giá đã chấp nhận.
Không mở lại dòng nào ở đây.

| # | Quyết định | Giá đã chấp nhận |
|---|---|---|
| Q1 | Trưởng nhóm đánh thử 10 video bằng form trong app, không dùng bảng tính (quyết định 1). | P2 và P4 phải xong trước lần đánh thử. |
| Q2 | Form gồm 7 nhóm S, E, C, V, O, R, Prev; N và Attr vẫn chữ (quyết định 2). | Rộng hơn pilot S và C của plan; P2 phải kiểm đủ 7 codebook. |
| Q3 | Form bắt đầu trống, không điền sẵn từ draft; không làm P3 (quyết định 3). | Không đo được tỉ lệ giữ nguyên ô draft ở lần đánh thử. |
| Q4 | Verdict mới `SLOTS` cho câu dạng ô; luật "chỉ DISAGREE mang câu viết lại" mở rộng thành "DISAGREE và SLOTS mang câu, và phải mang"; AGREE không bao giờ mang câu viết lại (quyết định 4). | Khoảng 8 chỗ đọc verdict đổi trong một migration; Decision Log phải ghi lại ở bước 08. |
| Q5 | Câu `SLOTS` không tính vào độ khó, kappa, đồng thuận, thống nhất đáp án (quyết định 4). | Câu của trưởng nhóm không so được với 7 người kia bằng các công cụ hiện có. |
| Q6 | 10 video lấy trong 60 video agreement, giao cho tài khoản admin của trưởng nhóm bằng `assign_agreement_group` (A1, conflicts.md). | Video đã dùng để dựng codebook lại dùng để thử codebook; chấp nhận vì đây là thử độ phủ, không phải đo đồng thuận. |
| Q7 | Cờ bật form ở mức phân công: `video_assignments.answer_format`, không phải `qgroups.json` hay `batch` (A2, xung đột 7). | Thêm một cột và một luật bất biến cho phân công. |
| Q8 | Mỗi câu vẫn là một dòng `qa_annotations` mỗi annotator; `edited_answer` là câu ghép (A3). | Câu ghép là dữ liệu suy ra, phải giữ khớp với ô; server là người ghi duy nhất. |
| Q9 | "Khác" cho phép ghi chữ ngắn (A5). | Danh sách lựa chọn nào được ghi chữ còn mâu thuẫn với codebook, xem Open 1. |
| Q10 | Video có từ 3 bên: các nhóm chọn bên từ danh sách E của chính annotator trên video đó (A6). | Thực thể không ghép giữa annotator ở P2. |
| Q11 | `video_entities` là chủ duy nhất của danh sách thực thể; xóa hay sửa thực thể đang bị trỏ tới bị từ chối (xung đột 10). | Muốn sửa bên B đang dùng thì phải bỏ chọn B ở các nhóm khác trước. |
| Q12 | V dạng ô vẫn có start/end; danh sách keyframe C, V, Attr giữ nguyên (xung đột 11). | Codebook V không có ô mốc; mốc nằm ở `human_keyframes_s` như cũ. |
| Q13 | Migration chạy trên Supabase local trước; mọi `verify-*.mjs` chạy trên local, không bao giờ trên production; migration production và deploy cần cho phép riêng từng lần (A7, xung đột 12). | Cần môi trường local và cách trỏ script sang local. |
| Q14 | `draft_slots` hoãn, không thêm cột ở P2 (quyết định 3, brief bước 02). | P3 sẽ cần một migration riêng. |

## Open

Những điểm chưa ai quyết.
Mỗi điểm ghi mặc định P2 sẽ dùng nếu không ai đổi, và lúc nào cần quyết.

1. **Lựa chọn "khác" nào được ghi chữ.**
   A5 nói V hành vi, Prev hành động, E loại; codebook chỉ đánh `free_text: true` cho `behavior.other` của V, còn `main_action.other`, `extra_action.other` (Prev) và `type.other` (E) thì không, và guideline E, Prev không nhắc ghi chữ.
   Database đọc cờ trong codebook, nên nếu giữ file như hiện tại thì Prev và E "khác" không ghi được chữ.
   Đã quyết (trưởng nhóm, 2026-11-16): cả 3 lựa chọn "khác" đó được ghi chữ; đã thêm `"free_text": true` vào `codebook/E.v1.json` và `codebook/Prev.v1.json` (vẫn là v1 vì chưa vào git).
2. **Ô "bắt buộc" khi mẫu câu có nhánh tắt.**
   Codebook đánh `required: true` cho ô mà một số nhánh mẫu câu không dùng: R `subject`, `bystanders` khi `has_aftermath.no` ("Không thể xác định."); C `action` khi `conflict_type.unclear` (không có hành động con); O `sign` khi `level.unclear`.
   Mặc định của P2 (architecture.md, luật điều kiện): ô con theo `parent_cell` chỉ bắt buộc khi lựa chọn cha có con; R với `has_aftermath.no` không mang ô nào khác; V `violator` và `behavior` bắt buộc khi `result.yes` và phải trống khi khác.
   Trưởng nhóm xác nhận khi xem acceptance.
3. **Prev không có cách nói "không xác định".**
   Mẫu câu Prev có trường hợp "C và Attr đều không rõ" → "Không thể xác định.", nhưng ô `party` bắt buộc và không có lựa chọn "không rõ".
   Đã quyết (trưởng nhóm, 2026-11-16): thêm `party.unclear` ("không rõ") vào `codebook/Prev.v1.json` và vào bảng ô của guideline Prev; chọn nó thì câu ghép là "Không thể xác định." và các ô hành động để trống.
4. **C "cả hai bên".**
   Mẫu "Cả A và B" cần hành động của A và của B, nhưng codebook C chỉ có một ô `action`, không có `per_party`.
   Đã quyết (trưởng nhóm, 2026-11-16): khi `subject.both`, mỗi bên một ô hành động, cùng kiểu xung đột; codebook C ghi `"per_party_when": "subject.both"` trên ô `action`.
   Dữ liệu lưu như Prev: `slots.parties` có hai mục, mỗi mục trỏ một thực thể đã khai báo và có `action` riêng; câu ghép theo mẫu "Cả A và B".
   Thay cho luật 422 trước đó; architecture.md và acceptance.md theo quyết định này ở bước 03.
5. **Prev "cả hai bên" lưu thế nào.**
   Mặc định của P2: `party.both` không được lưu; nó được mở thành hai mục trong `slots.parties`, mỗi mục trỏ một thực thể đã khai báo, có hành động riêng (architecture.md, Data).
   Trưởng nhóm xác nhận.
6. **R lấy chủ thể và đối tượng từ C.**
   R không có ô thực thể; câu R đọc cặp chủ thể, đối tượng của câu C cùng người cùng video.
   Mặc định của P2: lưu R khi chưa có C thì bị từ chối; lưu C thì câu R (nếu có) được ghép lại trong cùng giao dịch.
   Đã quyết (trưởng nhóm, 2026-11-16): C là `subject.both` thì chủ thể của R là bên A, đối tượng là bên B theo thứ tự khai báo ở E, hai bên cùng hành vi thì dùng mẫu "Các bên [1]."; C là `subject.unclear` thì câu R là "Không thể xác định.".
   Chỉ dùng mẫu câu có sẵn trong guideline R.
7. **Độ dài chữ "khác".**
   Guideline chỉ nói "ghi ngắn".
   Mặc định: tối đa 200 ký tự, là giới hạn kỹ thuật chống dán nhầm cả đoạn, không phải quy tắc gán nhãn; form P4 có thể chặn ngắn hơn.
8. **10 video nào.**
   A1 nói trong 60 video agreement; chưa chọn số thứ tự cụ thể.
   Cần quyết trước lần đánh thử, không chặn P2.
9. **Export ô cho trưởng nhóm xem sau lần đánh thử.**
   P5 ngoài phạm vi, nên CSV chưa có cột `slots`, `codebook_version`.
   Mặc định: trưởng nhóm xem trên form; nếu cần đọc hàng loạt thì thêm hai cột thô vào `answers_export` (việc nhỏ, cùng lần drop và tạo lại hàm).
10. **Kiểm tra sau deploy.**
    Decision Log ("Deploying the hosted frontend") bảo chạy `verify-*.mjs` với `TEST_BASE_URL` production sau deploy, mà các script tạo người dùng thật trên Supabase trong env, tức production; Q13 nói không bao giờ chạy trên production.
    Mặc định: P2 không deploy; khi trưởng nhóm cho phép deploy, chỉ chạy kiểm chỉ đọc (một `POST` không đăng nhập vào route mới phải trả 401 JSON), còn có chạy `verify-*.mjs` trên production hay không thì hỏi lúc đó.

## Sơ đồ

Luồng có nhiều tác nhân (annotator, route, RPC, trigger) và phân công có trạng thái định dạng, nên sơ đồ luồng và sơ đồ trạng thái thuộc bước 03, cạnh tasks.
