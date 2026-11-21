# Architecture P2: dữ liệu cho gán nhãn theo ô

Bước 02, 2026-11-16; sửa ở bước 03 cùng ngày theo Open 1, 3, 4, 6 của spec đã quyết.
Cái gì và vì sao ở [spec.md](spec.md); hợp đồng kiểm ở [acceptance.md](acceptance.md).

## Hình dạng

Một migration, ba module TypeScript, hai route, sửa các chỗ đọc verdict.
Database là người phán xử cuối cùng về hình dạng dữ liệu; route là người ghi duy nhất của câu ghép.

| Chỗ | Thay đổi | Đường ranh |
|---|---|---|
| `supabase/migrations/20261116100000_slot_data_model.sql` | Toàn bộ schema, seed, trigger, view, RPC của P2 trong một file, để mọi chỗ đọc verdict đổi cùng lúc. | Tiền tố là timestamp đầy đủ 14 số, không trùng ngày với file nào (xem Môi trường test). |
| `codebook/<nhóm>.v1.json` | Commit 6 file còn `??` (C, E, O, Prev, R, V), khi trưởng nhóm cho phép; Open 1, 3, 4 của spec đã quyết 2026-11-16 và đã ghi vào file (`free_text` của E, Prev; `party.unclear` của Prev; `per_party_when` của C). | File nguồn, đóng băng. |
| `frontend/src/lib/codebook/<nhóm>.v1.json` | Bản sao byte-giống-byte của 7 file; Vercel chỉ upload `frontend/`, nên app không đọc được `codebook/` ở gốc repo. | Test so byte. |
| `frontend/src/lib/codebook/index.ts` | `getCodebook(version)`, `currentVersion(qgroup)`, `isSlotGroup(qgroup)` (nhóm có file codebook là nhóm dạng ô). | Không có danh sách nhóm thứ hai. |
| `frontend/src/lib/codebook/compose.ts` | `compose(qgroup, slots, context) → string`, ghép câu theo mẫu của từng nhóm; `context` gồm thực thể của annotator và, cho R, ô của câu C. | Hàm thuần, không I/O; route và form P4 cùng gọi. |
| `frontend/src/app/api/drafts/[id]/annotation/route.ts` | Nhánh `SLOTS`: đọc định dạng phân công, ghép câu, gọi RPC `save_slot_answers`; nhánh chữ giữ nguyên, thêm từ chối `slots` trên phân công chữ. | Danh sách verdict của nhánh chữ không đổi. |
| `frontend/src/app/api/videos/[id]/entities/route.ts` (mới) | `PUT`: ghép câu E, gọi RPC `save_video_entities`. | Người ghi duy nhất của thực thể từ phía app. |
| `frontend/src/app/api/admin/answers/export/route.ts` | `HEADER` thêm `answer_format`. | |
| `frontend/src/lib/types.ts` | Thêm `StoredVerdict = Verdict \| "SLOTS"` cho dòng đọc từ database; `Verdict` (3 giá trị của form chữ) giữ nguyên, vì `HostedLabeling.tsx` dựng nút từ `Record<Verdict, …>` và một giá trị thứ tư sẽ thành nút thứ tư trên form chữ. | |
| `frontend/scripts/annotator-report.mjs` | `SHORT` thêm `SLOTS`; kiểm "câu viết lại dưới verdict khác DISAGREE" và kiểm độ khó bỏ qua phân công `slots`. | |
| `frontend/scripts/lib/env.mjs`, `session.mjs` | `loadEnv()` cho biến môi trường của tiến trình đè lên file env, để trỏ script sang Supabase local mà không sửa `.env.local`. | |
| `frontend/scripts/verify-slots.mjs` (mới) | Kiểm toàn bộ acceptance của P2; từ chối chạy nếu host Supabase không phải `127.0.0.1` hay `localhost`. | |
| `scripts/iaa_round.py`, `scripts/iaa_questions.py`, `scripts/iaa_tier1.py` | Mặc định bỏ dòng có `answer_format` khác `text`; CSV cũ không có cột thì coi mọi dòng là `text`. | |
| `tests/test_iaa_round.py`, `tests/test_codebook_copies.py` (mới) | Pin bộ lọc mới; so `codebook/` với bản sao trong `frontend/`. | |

## Dữ liệu

Mỗi trường có đúng một người ghi.

### Bảng mới `codebook_versions`

| Cột | Kiểu | Mặc định | Người ghi |
|---|---|---|---|
| `id` | `text primary key`, dạng `'<nhóm>.v<số>'`, ví dụ `'C.v1'` | | migration |
| `qgroup` | `text not null`, check trong `S, E, C, V, O, R, Prev` | | migration |
| `version` | `integer not null`, `unique (qgroup, version)` | | migration |
| `content` | `jsonb not null`, nội dung file | | migration |
| `sha256` | `text not null`, sha256 của byte file | | migration |
| `frozen_on` | `date not null`, lấy từ `frozen_on` của file | | migration |

Migration chèn 7 dòng; `content` là literal JSON sinh từ file, `sha256` tính trên byte file.
`authenticated` chỉ có `select`; không ai `insert`, `update`, `delete` qua API.
Phiên bản sau (v2) đến bằng một migration mới, không sửa dòng cũ.

### `video_assignments.answer_format`

`text not null default 'text' check (answer_format in ('text','slots'))`.
Người ghi: admin qua RPC `set_answer_format(annotator uuid, seq_from integer, seq_to integer, format text)`, security definer, kiểm `is_admin()`.
`validate_assignment` từ chối đổi `answer_format` khi người gọi không phải admin (policy `assignments_update` hiện cho annotator sửa dòng phân công của mình, nên thiếu luật này thì annotator tự đổi được), và khi phân công đã có `qa_annotations` hoặc `video_entities`.
Mọi dòng hiện có nhận `'text'` từ mặc định.

### `qa_annotations`

| Cột | Kiểu | Mặc định | Người ghi |
|---|---|---|---|
| `verdict` | check mở rộng thành `('AGREE','NOT_ANSWERABLE','DISAGREE','SLOTS')` | | route (chữ) hoặc RPC `save_slot_answers` / `save_video_entities` (ô) |
| `slots` | `jsonb`, null với dòng chữ | `null` | RPC; riêng dòng E do trigger ghi đè bằng bản chụp từ `video_entities` |
| `codebook_version` | `text references codebook_versions(id)`, null với dòng chữ | `null` | RPC |
| `edited_answer` | như cũ; với `SLOTS` là câu ghép | | route qua `compose.ts`; client không được gửi |
| `reason_code`, `reason_note` | như cũ; null với `SLOTS` | | route |
| `human_keyframes_s` | như cũ; C, V dạng ô vẫn đúng 2 mốc start < end | | route |

Dòng dạng ô là dòng có verdict `SLOTS`.
Nó chỉ hợp lệ khi phân công của (video, annotator) có `answer_format = 'slots'` và nhóm có codebook; N và Attr của cùng phân công là dòng chữ.

### `qa_annotation_revisions`

Thêm `slots jsonb` và `codebook_version text`, cùng người ghi như cũ (chỉ trigger).
Bộ so "nội dung có đổi không" thêm hai cột này.
Dòng revision cũ có hai cột null.

### Bảng mới `video_entities`

| Cột | Kiểu | Mặc định | Người ghi |
|---|---|---|---|
| `video_id` | `uuid references videos on delete cascade` | | RPC `save_video_entities` |
| `annotator_id` | `uuid references user_profiles on delete cascade` | | RPC |
| `entity_key` | `text`, check `~ '^[A-Z]$'` | | RPC |
| `cells` | `jsonb not null`, ô của E cho bên này | | RPC |
| `codebook_version` | `text not null references codebook_versions(id)`, phải là phiên bản của nhóm E | | RPC |
| `updated_at` | `timestamptz not null` | `now()` | trigger |

Khóa chính `(video_id, annotator_id, entity_key)`.
RLS: `select` cho chính annotator và admin; không có quyền `insert`, `update`, `delete` cho `authenticated`, nên mọi lần ghi phải qua RPC (security definer, tự kiểm `is_active_user()`, chủ sở hữu, `has_assignment`, `answer_format = 'slots'`).
Hai hàm gỡ việc (security definer) cũng xóa được.

### Hình dạng `slots`

Mỗi giá trị ô là một object:

- `{"option": "<id lựa chọn>"}`;
- `{"entity": "<khóa thực thể>"}`, chỉ với ô có `from_entities`;
- `{"option": "<id>", "entity": "<khóa>"}`, chỉ với lựa chọn có `from_entities` riêng (C `evasion_result.hit_other`);
- thêm `"text": "<chữ>"` chỉ với lựa chọn có `free_text: true`, và với lựa chọn đó thì bắt buộc.

Ô không áp dụng thì không có khóa.
Mọi tham chiếu tới thực thể, ở bất kỳ độ sâu nào, đều có dạng `{"entity": K}`, nên một truy vấn `jsonb_path_exists(slots, '$.** ? (@.entity == $k)')` tìm được mọi chỗ trỏ tới K.

Theo nhóm:

- S, V, O, R: object phẳng, khóa là `id` của ô trong codebook.
  Riêng ô `parties` của O (`from_entities`, không có lựa chọn, tự điền từ cặp của C) là mảng 1 hoặc 2 tham chiếu `[{"entity": K1}, {"entity": K2}]`, khóa khác nhau (thêm ở T7, chờ trưởng nhóm xác nhận).
- C: object phẳng như trên, trừ khi `subject` là `{"option": "subject.both"}` (Open 4 của spec): khi đó không có `action` và `object` ở mức ngoài, mà có `"parties": [{"party": {"entity": K1}, "action": {...}}, {"party": {"entity": K2}, "action": {...}}]`, đúng 2 mục, khóa thực thể khác nhau, cả hai `action` thuộc cùng `conflict_type` ở mức ngoài.
- Prev: `{"parties": [{"party": {"entity": K}, "main_action": {...}, "extra_action": {...}}]}`, 1 hoặc 2 mục, khóa thực thể khác nhau; `party.both` của codebook không được lưu mà mở thành 2 mục (Open 5 của spec).
  `party.unclear` (Open 3 của spec) lưu là đúng một mục `{"party": {"option": "party.unclear"}}`, không có ô hành động.
- `parties` và `party` là khóa cấu trúc của hai nhóm có ô theo từng bên (`per_party` của Prev, `per_party_when` của C); với C, `party` không phải `id` ô nhưng chỉ nhận `{"entity": K}`.
- E (dòng `qa_annotations`): `{"entities": [{"key": "A", "cells": {...}}, ...]}` theo thứ tự khóa; trigger ghi đè bằng bản chụp `video_entities`, client gửi gì cũng không giữ.
- `video_entities.cells`: object phẳng theo ô của E, cùng quy tắc giá trị.

Keyframe không bao giờ nằm trong `slots`; chúng ở `human_keyframes_s` như hôm nay.

### Luật kiểm ô (`validate_slots`)

Một hàm plpgsql `public.validate_slots(version text, slots jsonb, video uuid, annotator uuid)` đọc `codebook_versions.content` và áp các luật sau; gọi từ `validate_qa_annotation` (dòng `SLOTS` không phải E) và từ trigger `validate_video_entity` (ô của một thực thể, với codebook E).

Luật lấy từ cờ máy đọc của codebook:

1. Mọi khóa là `id` của một ô; khóa lạ bị từ chối.
2. `option` phải thuộc đúng ô đó.
3. `entity` chỉ ở ô hay lựa chọn có `from_entities`, và khóa phải có trong `video_entities` của cùng (video, annotator).
4. Ô `required: true` phải có, trừ các luật điều kiện bên dưới.
5. Ô có `parent_cell`: lựa chọn phải có `parent` bằng lựa chọn đang chọn ở ô cha (C `action` dưới `conflict_type`, O `sign` dưới `level`).
6. `text` chỉ với lựa chọn `free_text: true`, khi đó bắt buộc, sau khi trim không rỗng, tối đa 200 ký tự (Open 7).
7. `must_differ_from`: Prev `extra_action` không được trùng hậu tố với `main_action` của cùng bên.
8. `per_party`: ô nằm trong từng mục của `parties`.
9. `per_party_when: X`: khi ô chứa lựa chọn X đang chọn X, ô nằm trong từng mục của `parties` và không có ở mức ngoài; khi khác thì ngược lại, và không có `parties`.
   Luật 5 áp cho từng mục, so với ô cha ở mức ngoài, nên hai bên cùng một kiểu xung đột.

Luật điều kiện, mỗi luật ghi nguồn trong comment của migration (Open 2 của spec):

- Ô con theo `parent_cell` chỉ bắt buộc khi lựa chọn cha có con; cha là "không rõ" thì ô con phải trống.
- V: `violator` và `behavior` bắt buộc khi `result.yes`, phải trống khi khác (`when: "khi có"`).
- R: `has_aftermath.no` thì không có ô nào khác (mẫu "Không có đoạn sau" là "Không thể xác định.").
- Prev: `party.unclear` thì mục đó không có `main_action`, `extra_action`, và là mục duy nhất (Open 3 đã quyết).
- C: `subject.both` thì đúng 2 mục trong `parties`, khóa khác nhau, và không có `object` (mẫu "Cả A và B" lấy cặp từ hai mục, không có ô đối tượng; Open 4 đã quyết).
  Mẫu đó cũng không có vế tốc độ hay né, nên `speed`, `evader`, `evasion`, `evasion_result` phải trống; trưởng nhóm đã xác nhận ngày 2026-11-16.

### Luật ghép câu (`compose.ts`)

Chỉ dùng mẫu trong `templates` của codebook, tức mẫu của guideline; không có mẫu nào khác.

- Lựa chọn `free_text` (V `behavior.other`, E `type.other`, Prev `main_action.other`, `extra_action.other`) ghép bằng chữ đã ghi, thay cho nhãn "khác" (Open 1 đã quyết).
- E: bên theo thứ tự khóa A, B, C; không khai báo bên nào thì "Không thể xác định.".
- C `subject.both`: mẫu "Cả A và B"; A, B là hai mục của `parties` sắp theo thứ tự khóa ở E, mỗi bên với `action` của mình; vế cuối theo `event_type` (Open 4 đã quyết).
- Prev `party.unclear`: "Không thể xác định." (Open 3 đã quyết).
- R: `has_aftermath.no` thì "Không thể xác định.".
  Chủ thể và đối tượng của R lấy từ câu C cùng người cùng video (`context`): C có `subject` là thực thể thì chủ thể là thực thể đó, đối tượng là `object` của C.
  C `subject.both` thì chủ thể là bên đứng trước theo thứ tự khóa ở E, đối tượng là bên sau, bất kể thứ tự hai mục trong `parties` của C (Open 6 đã quyết).
  `subject` và `object` của R cùng hành vi (cùng hậu tố, khác `unclear`) thì dùng mẫu "Các bên [1]." (mẫu "Hai bên cùng hành vi" của guideline R, áp cho mọi cặp; Open 6 xác nhận cho cả `subject.both`).
  C `subject.unclear` thì câu R là "Không thể xác định.", ô của R vẫn lưu như đã chọn (Open 6 đã quyết).

Không kiểm ở database: điều kiện `when` bằng lời của E, ràng buộc giữa các nhóm (Non-goals của spec).

### `validate_qa_annotation` (viết lại cả hàm, giữ nguyên các nhánh cũ)

Thứ tự kiểm:

1. Chủ sở hữu không đổi, câu đã thống nhất bị khóa: như cũ.
2. Keyframe: như cũ (`20261112000016_keyframes_start_end.sql`), áp cho cả dòng `SLOTS`.
3. Tra `answer_format` của phân công (video, annotator), khóa dòng phân công bằng `for update` (xem Luồng, tranh chấp); không có phân công thì coi là `text`.
4. Dòng là dạng ô khi `answer_format = 'slots'` và nhóm có dòng trong `codebook_versions`.
5. Dòng dạng ô: verdict phải là `SLOTS`; `reason_code`, `reason_note` phải null; `codebook_version` phải thuộc đúng nhóm của draft; `slots` phải có; `edited_answer` sau chuẩn hóa không rỗng và được phép trùng draft; với E thì ghi đè `slots` bằng bản chụp; với nhóm khác thì gọi `validate_slots`.
6. Dòng chữ: verdict không được là `SLOTS`; `slots` và `codebook_version` phải null; phần còn lại như cũ.

### Các chỗ đọc verdict

| Chỗ | Thay đổi |
|---|---|
| Check constraint của `qa_annotations.verdict` | Thêm `'SLOTS'`. |
| `effective_answer(verdict, edited, draft)` | `when 'SLOTS' then normalize_answer(edited_answer)`. |
| `validate_assignment`, luật hoàn thành | `(verdict in ('DISAGREE','SLOTS')) = (edited_answer is not null)` thay cho `(verdict = 'DISAGREE') = (edited_answer is null)`; thêm luật `answer_format` ở trên. |
| Route lưu | Nhánh chữ giữ `VERDICTS` 3 giá trị; nhánh ô chỉ nhận `SLOTS`. |
| `annotator_difficulty` | Thêm `and a.answer_format = 'text'`; `video_difficulty` đi theo. |
| `final_answers` | CTE `done` thêm `and answer_format = 'text'`; `adjudication_export`, `adjudication_summary`, `import_adjudications` đi theo. |
| `final_video_labels` | CTE `labels` thêm `and a.answer_format = 'text'`. |
| `answers_export` | `drop function` rồi tạo lại, thêm cột `answer_format` ngay sau `batch`; `grant` lại như cũ. |
| `scripts/iaa_round.py` và hai script cùng họ | Lọc `answer_format == 'text'` trước mọi phép tính; `VERDICTS` giữ 3 giá trị. |
| `annotator-report.mjs` | Như bảng Hình dạng. |

### RPC mới

- `save_slot_answers(rows jsonb)`, security invoker (RLS hiện có của `qa_annotations` áp dụng): upsert 1 hoặc 2 dòng `SLOTS` trong một giao dịch; route dùng nó để lưu C cùng câu R ghép lại.
- `save_video_entities(target_video uuid, version text, entities jsonb, e_answer text)`, security definer: khóa dòng phân công, xóa thực thể không còn trong danh sách, upsert phần còn lại, rồi upsert dòng E (`SLOTS`, câu `e_answer`, `slots` do trigger chụp lại), tất cả trong một giao dịch.
- `set_answer_format(annotator, seq_from, seq_to, format)`, security definer, chỉ admin; trả `{changed, already, skipped_started}`: số phân công đã đổi, số đã sẵn định dạng đó, và số bị bỏ qua vì đã có câu hoặc thực thể.

### Trigger mới trên `video_entities`

- `validate_video_entity` (before insert or update): `validate_slots` với codebook E; `codebook_version` phải thuộc nhóm E.
- `guard_referenced_entity` (before update or delete): nếu (video, annotator) có dòng `qa_annotations` khác nhóm E trỏ tới `old.entity_key` thì từ chối, liệt kê các nhóm; với update chỉ khi `entity_key` hoặc `cells` đổi.
  Cascade từ video hay người dùng bị xóa thì cho qua, cùng mẫu với `guard_adjudicated_delete`: video hoặc user không còn thì không kiểm.

### Hàm gỡ việc

`unassign_agreement_group` và `unassign_range`: khi `delete_work`, xóa `qa_annotations` trước, rồi `video_entities`, rồi `video_labels`, rồi phân công; xóa câu trước nên `guard_referenced_entity` không chặn.
Định nghĩa "chưa bắt đầu" (gỡ không xóa việc) thêm điều kiện không có `video_entities`.
Cả hai được tạo lại bằng `create or replace`, giữ chữ ký.

## Luồng

### Admin bật form ô

1. Admin giao 10 video agreement bằng `assign_agreement_group` như hôm nay (A1).
2. Admin gọi `set_answer_format(lead, seq_from, seq_to, 'slots')`.
   Phân công đã có câu hay thực thể bị bỏ qua và được báo lại; không phải admin thì lỗi.
3. Thứ tự triển khai: chỉ đặt `'slots'` sau khi P4 ship; trước đó form chữ mở một phân công `slots` thì mọi lần lưu bị database từ chối và route trả 422, không mất dữ liệu.

### Lưu thực thể (E)

1. Form gửi `PUT /api/videos/{id}/entities` với `codebook_version` và danh sách `{key, cells}`.
2. Route kiểm đăng nhập, ghép câu E bằng `compose("E", …)` (bên theo thứ tự A, B, C; không khai báo bên nào thì "Không thể xác định.").
3. Route gọi `save_video_entities`.
4. Nhánh lỗi:
   - không có phân công, phân công không phải `slots`, người dùng bị khóa: 403;
   - ô sai codebook: 422, `code` theo luật vi phạm;
   - xóa hay sửa bên đang bị trỏ tới: 409, `code: "entity_referenced"`, kèm khóa và các nhóm; không gì thay đổi vì cả RPC là một giao dịch;
   - câu E đã được thống nhất: 409 như hôm nay (không xảy ra vì phân công `slots` bị loại khỏi thống nhất, nhưng nhánh vẫn còn).
5. Thành công: trả danh sách thực thể, câu E, `slots` đã chụp.

### Lưu một câu dạng ô (S, C, V, O, R, Prev)

1. Form gửi `POST /api/drafts/{id}/annotation` với `{verdict: "SLOTS", codebook_version, slots, human_keyframes_s}`.
2. Route đọc draft, phân công của người gọi, thực thể của người gọi trên video; với R thì đọc thêm câu C.
3. Nhánh lỗi trước khi ghi:
   - phân công không phải `slots`, hoặc nhóm là N, Attr: 422 "nhóm này trả lời bằng chữ";
   - client gửi `edited_answer`, `reason_code` hoặc `reason_note`: 422 (dấu hiệu trang cũ);
   - R khi chưa có câu C: 422 "lưu nhóm C trước";
   - C với `subject.both` mà không đủ hai mục trong `slots.parties`, mỗi mục có `action` thuộc cùng kiểu xung đột: 422 (Open 4 đã quyết: mỗi bên một ô);
   - C, V thiếu 2 mốc start < end: 422 như hôm nay.
4. Route ghép câu bằng `compose`; nếu là C và đã có câu R thì ghép lại câu R với cặp chủ thể, đối tượng mới, theo mục Luật ghép câu (kể cả `subject.both` và `subject.unclear`).
5. Route gọi `save_slot_answers` với 1 hoặc 2 dòng; trigger kiểm từng dòng; một dòng sai thì cả hai không được ghi.
6. Lỗi database được đổi thành 422 với `code` máy đọc được (theo tiền tố thông báo của trigger) hoặc 409 cho câu đã thống nhất.
7. Thành công: cập nhật phân công sang `in_progress` như hôm nay; trả dòng đã lưu.

### Lưu một câu chữ (N, Attr trong phân công `slots`, và mọi câu của phân công `text`)

Không đổi, trừ: body có `slots` hoặc `codebook_version` thì 422; trigger từ chối `SLOTS` trên dòng chữ và dòng chữ trên dòng dạng ô.
Một trang cũ còn mở trên video `slots` gửi upsert kiểu cũ thì bị từ chối ở bước 6 của `validate_qa_annotation`, dòng ô giữ nguyên.

### Hoàn thành

Route `complete` hiện có; `validate_assignment` đòi 9 câu, event label, và luật verdict mới.
Phân công `slots` hoàn thành không đổi `final_answers`, `final_video_labels`, độ khó, CSV thống nhất của video đó.

### Gỡ phân công

Như mục Hàm gỡ việc; thực thể đi cùng câu.

### Tranh chấp

Hai tab cùng người: một tab xóa B, tab kia lưu C trỏ tới B.
Không khóa thì mỗi giao dịch kiểm trên ảnh chụp riêng và cả hai cùng qua (write skew).
Cả `validate_qa_annotation` (dòng ô) và `save_video_entities` đều `select … for update` dòng phân công của (video, annotator) trước khi kiểm, nên hai lần ghi của cùng người trên cùng video chạy lần lượt.
Người khác nhau không chạm thực thể của nhau, nên không chờ nhau.

## Vì sao hình dạng này

**Xung đột 1 (verdict và luật câu viết lại).**
Verdict `SLOTS` riêng, check constraint và trigger cùng nhận nó; nhánh `SLOTS` không đòi lý do và đòi câu.
Luật cũ của AGREE và NOT_ANSWERABLE giữ nguyên chữ, nên AGREE vẫn không mang được câu viết lại.

**Xung đột 2 (câu ghép trùng draft, video #39 nhóm R).**
Nhánh `SLOTS` bỏ phép so với draft; chỉ DISAGREE còn đòi câu khác draft.
Acceptance có một ca dựng lại đúng #39 R.

**Xung đột 3 (độ khó suy ra).**
`annotator_difficulty` lọc `answer_format = 'text'` ở mức phân công, nên cả 9 câu của trưởng nhóm, kể cả N và Attr dạng chữ, đứng ngoài; `video_difficulty` đọc từ view này nên đi theo.

**Xung đột 4 (`final_answers` và thống nhất đáp án).**
CTE `done` lọc `answer_format = 'text'`, nên người thứ tám không biến `consensus` thành `conflict`; `adjudication_export` đọc `final_answers` nên đi theo.
Cùng lý do, `final_video_labels` cũng lọc: event label của trưởng nhóm biến một video đồng thuận nhãn thành `conflict` trong cùng CSV đó.
Phần event label là suy ra từ quyết định 4, conflicts.md chưa thử; acceptance có ca riêng.

**Xung đột 5 (`answers_export` và `iaa_round.py`).**
Export thêm `answer_format`; ba script IAA mặc định chỉ giữ `text`, và CSV cũ thiếu cột thì coi là `text`, nên số đã tính ở vòng 1 không đổi khi tính lại.

**Xung đột 6 (các chỗ đọc verdict).**
Bảng "Các chỗ đọc verdict" liệt kê đủ và tất cả nằm trong một migration cộng một commit code; `effective_answer` có nhánh `SLOTS` tường minh thay vì rơi vào `else`.
`StoredVerdict` tách khỏi `Verdict` để form chữ không mọc nút thứ tư.

**Xung đột 7 (nơi đặt cờ).**
Cột riêng `answer_format` ở phân công; `batch` và `qgroups.json` không đổi nghĩa.
Thêm một điểm conflicts.md chưa nêu: policy `assignments_update` cho annotator sửa dòng phân công của mình, nên `validate_assignment` chặn mọi lần đổi `answer_format` không phải của admin.

**Xung đột 8 (route cũ là người ghi thứ hai).**
Trigger quyết dạng dòng theo phân công, không theo dữ liệu client gửi: dòng của phân công `slots` thuộc nhóm có codebook chỉ nhận `SLOTS` kèm `slots`, nên upsert kiểu cũ bị từ chối thay vì để lại `slots` cũ cạnh câu mới.
Câu ghép do route sinh từ `slots`, client không gửi câu, nên ô và câu không thể nói hai điều khác nhau qua API.

**Xung đột 9 (log revision).**
`slots` và `codebook_version` vào bảng log và vào phép so; ca R `bystanders.unclear` → `bystanders.nobody_stopped` đổi ô mà không đổi câu (cả hai đều bỏ vế người xung quanh), là ca acceptance dùng.

**Xung đột 10 (thực thể sửa sau, thực thể mồ côi).**
`video_entities` là chủ duy nhất, chỉ ghi qua RPC; dòng E chỉ là bản chụp do trigger ghi.
`guard_referenced_entity` chặn xóa, sửa bên đang bị trỏ tới; khóa dòng phân công chặn write skew; hai hàm gỡ việc xóa thực thể sau câu.

**Xung đột 11 (keyframe của V).**
Nhánh keyframe của trigger không đổi và áp cho cả `SLOTS`; keyframe không vào `slots`; form P4 phải có start/end cho C và V.

**Xung đột 12 (không có bản sao).**
Supabase local (mục Môi trường test); `loadEnv()` cho biến môi trường đè file; `verify-slots.mjs` từ chối host không phải local.

**Xung đột 13 (codebook chưa commit).**
Commit 6 file trước khi sinh migration; `sha256` trong bảng cố định byte đã seed; test so ba bản (`codebook/`, `frontend/src/lib/codebook/`, database).

## Môi trường test

- Supabase local đã chạy: Docker và Supabase CLI 3.1.0, workdir `C:/Users/Admin/AppData/Local/Temp/claude/6cfe3fe087aab76d/b3d6cc70-9e30-4971-99e7-fa26932a37e5/scratchpad/localdb`, container `supabase_db_localdb`, API cổng 54321, database cổng 54322; đủ 16 migration của repo đã áp.
- Phát hiện: migration của repo **không** chạy lại được theo thứ tự tên file.
  Hai cặp cùng ngày phải đảo: `20261003000001_team_video_labeling.sql` trước `20261003000002_qa_labeling.sql`, và `20261102000006_videos_agreement_sample.sql` trước `20261102000007_annotator_queue_agreement.sql`.
  Bản sao trong workdir được đặt tên `YYYYMMDD0000NN_<tên>.sql` theo thứ tự phụ thuộc; file trong repo không đổi tên (Non-goals).
- Vì vậy migration P2 dùng tiền tố timestamp đầy đủ 14 số, duy nhất: `20261116100000_slot_data_model.sql`.
  Nó sắp sau mọi bản sao trong workdir và sau mọi file trong repo; runner production (`scripts/apply-team-labeling-migration.mjs`) nhận tên file bất kỳ khớp `^[A-Za-z0-9_-]+\.sql$`.
- Script: chạy với `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` của stack local trong biến môi trường; dev server Next.js cũng nhận chúng từ biến môi trường của tiến trình, vốn đè lên `.env.local`.
- `pg_safeupdate`: production nạp nó (Decision Log, Training rounds); local phải được kiểm có nạp hay không, nếu không thì một `update` thiếu `where` qua được local mà hỏng trên production.
- Migration production, deploy, và mọi lần chạy script trên production cần trưởng nhóm cho phép riêng từng lần.

## Đã loại

- **Thêm `video_drafts.draft_slots` ngay:** rẻ về lưu trữ nhưng là cột không có người ghi và không có luật kiểm; hình dạng của nó nên do P3 quyết cùng script ghi nó.
- **Database ghép câu bằng SQL:** form P4 cần cùng hàm để xem trước, nên sẽ có hai bản cài đặt của cùng mẫu câu ở hai ngôn ngữ.
- **Client ghép câu và gửi lên:** hai người ghi cho cùng một sự thật (ô và câu); một client cũ hoặc lỗi sẽ lưu câu không khớp ô.
- **Dòng E giữ danh sách thực thể làm nguồn:** các nhóm khác phải trỏ vào bên trong một ô JSON của một dòng khác; khóa ngoại và chặn xóa không làm được.
- **Cho sửa thực thể đang bị trỏ tới rồi ghép lại mọi câu trỏ tới nó:** thân thiện hơn nhưng conflicts.md đã chốt từ chối; ghép lại hàng loạt trong một giao dịch là cơ chế lớn hơn cái lần đánh thử cần.
- **Danh sách nhóm dạng ô thứ hai (trong `qgroups.json` hay trong trigger):** nhóm có codebook là nhóm dạng ô, cả ở database (`codebook_versions`) lẫn ở app (`frontend/src/lib/codebook/`).
- **Kiểm ràng buộc giữa các nhóm trong trigger:** phụ thuộc thứ tự lưu, chặn oan khi annotator sửa C sau O; để form P4.
- **Cờ `format` trong `qgroups.json`, mượn `batch`, `verdict` nullable, DISAGREE + "khác":** đã loại ở conflicts.md, mục "Not doing".
- **Đổi tên 16 migration trong repo theo định dạng của Supabase CLI:** chạm vào lịch sử đã áp trên production mà không cần cho P2.
