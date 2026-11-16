# Tasks P2: dữ liệu cho gán nhãn theo ô

Bước 03, 2026-11-16.
Đầu vào: [spec.md](spec.md), [architecture.md](architecture.md), [acceptance.md](acceptance.md) (A1-A51).
Sổ theo dõi ở [TODO.md](TODO.md); sơ đồ ở [diagrams/](diagrams/).

## Cách chạy chung

Mọi task chạy trên Supabase local, không bao giờ trên production.

- Workdir local: `C:/Users/Admin/AppData/Local/Temp/claude/6cfe3fe087aab76d/b3d6cc70-9e30-4971-99e7-fa26932a37e5/scratchpad/localdb`, container `supabase_db_localdb`, API cổng 54321, database cổng 54322.
- Áp migration: chép `supabase/migrations/20261116100000_slot_data_model.sql` của repo vào `<workdir>/supabase/migrations/` với cùng tên, rồi `supabase db reset` trong workdir.
  Migration P2 là một file; mỗi task thêm phần của mình vào file đó, chép lại và reset.
  Không bao giờ sửa bản trong workdir mà không sửa bản trong repo.
- Biến môi trường của stack local lấy bằng `supabase status -o env` trong workdir, đặt vào tiến trình (không in ra, không ghi vào `.env.local`).
- Dev server cho phần HTTP: cấu hình `frontend-hosted` của `.claude/launch.json` (cổng 3006, `PLATFORM_MODE=hosted`), khởi động với cùng biến môi trường local; `TEST_BASE_URL=http://localhost:3006`.
- "verify-slots" là `node frontend/scripts/verify-slots.mjs`; mỗi mục in `PASS`/`FAIL` kèm số tiêu chí.
- `compose.ts` là hàm thuần nên test riêng bằng `node --test frontend/src/lib/codebook/compose.test.ts` (Node 24 chạy TypeScript trực tiếp); vì vậy `compose.ts` và `index.ts` chỉ dùng import tương đối, không dùng alias `@/`.

## Bảng task

| id | Slice | Touches | Test chứng minh | Covers | Depends on |
|----|-------|---------|-----------------|--------|------------|
| T1 | Codebook là nguồn seed: 7 file JSON có đủ quyết định 2026-11-16 và có bản sao trong `frontend/`. Không commit; commit 6 file (C, E, O, Prev, R, V) là điều kiện trước cần trưởng nhóm cho phép. | `codebook/*.v1.json` (chỉ đọc), `frontend/src/lib/codebook/<nhóm>.v1.json` (bản sao), `tests/test_codebook_copies.py` | Bản sao giống byte với `codebook/`, và file có `free_text` trên `type.other`, `main_action.other`, `extra_action.other`, `behavior.other`, có `party.unclear`, có `per_party_when: "subject.both"` trên ô `action` của C. A3 chạy khi trưởng nhóm đã cho commit. | A2, A3 | - |
| T2 | Script trỏ được sang local, và verify-slots không bao giờ chạy trên host khác. | `frontend/scripts/lib/env.mjs` (`loadEnv()` cho biến tiến trình đè file), `frontend/scripts/verify-slots.mjs` (khung, chặn host, fixture không cần cột mới, cleanup trong `finally`) | `NEXT_PUBLIC_SUPABASE_URL=https://example.invalid` làm verify-slots thoát khác 0 trước request đầu tiên; `TEST_BASE_URL` không phải localhost cũng vậy; trên local, fixture được tạo và xóa sạch, chạy hai lần liền đều thoát 0. | A39, A38 (khung), A41 (khung) | - |
| T3 | `codebook_versions` có 7 dòng bằng file và chỉ đọc. | migration: bảng, seed 7 dòng (literal sinh bằng lệnh ghi trong comment đầu file, không gõ tay), `grant select`; verify-slots mục codebook | Database có đúng 7 dòng, `content` bằng `JSON.parse` của file, `sha256` bằng sha256 byte; T `insert`, `update`, `delete` qua REST đều bị từ chối. Kiểm `session_preload_libraries` có `safeupdate` không, ghi kết quả vào TODO.md. | A1, A4, A43, A42 (lần reset đầu) | T1, T2 |
| T4 | Tracer: Lead lưu một câu S dạng ô qua route. | migration: `video_assignments.answer_format`, `qa_annotations.slots`, `codebook_version`, check verdict thêm `SLOTS`, nhánh dạng ô tối thiểu của `validate_qa_annotation` (bước 3-5), `save_slot_answers`; `frontend/src/lib/codebook/index.ts`; `compose.ts` (S); `compose.test.ts`; `frontend/src/lib/types.ts` (`StoredVerdict`); `api/drafts/[id]/annotation/route.ts` nhánh `SLOTS` | Lead `POST` câu S với 6 ô: dòng `SLOTS`, `reason_code` null, `slots` như gửi, `codebook_version = 'S.v1'`, `edited_answer` bằng `compose("S", slots)`. Phân công có sẵn nhận `text` (cách kiểm ở mục A5 dưới). | A8, A5 | T3 |
| T5 | Chỉ admin đổi được định dạng, và chỉ khi chưa có việc. | migration: `set_answer_format`, luật `answer_format` trong `validate_assignment` (chỉ khi cột đổi, nên route cập nhật `status` vẫn qua) | T đổi `answer_format` của mình qua REST bị từ chối, giá trị vẫn `text`; T gọi `set_answer_format` bị từ chối; Lead gọi thì đổi phân công chưa có việc và báo lại phân công đã có câu. | A6, A7 (phần câu) | T4 |
| T6 | Thực thể E: lưu qua `PUT`, dòng E là bản chụp. | migration: `video_entities`, RLS, `validate_slots` luật 1, 2, 4, 6, trigger `validate_video_entity`, `save_video_entities`, nhánh E của `validate_qa_annotation`; `compose.ts` (E); route mới `api/videos/[id]/entities/route.ts` | `PUT` A, B, C: 3 dòng `video_entities`, dòng E `SLOTS` có `slots.entities` theo thứ tự khóa và câu E bằng `compose("E", …)`; dòng E gửi thẳng qua REST với `slots` tùy ý được lưu là bản chụp; `insert`, `update`, `delete` thẳng trên `video_entities` bị từ chối; `set_answer_format` bỏ qua phân công chỉ có thực thể. | A15, A16, A17, A7 (phần thực thể) | T4 |
| T7 | Database từ chối ô sai ở C, V, O, R, Prev, S; route trả 422 có `code`. | migration: `validate_slots` luật 3, 5, 7, 8 và luật điều kiện (Open 2); `compose.ts` (C thường, V, O, Prev); route đổi thông báo trigger thành 422 `code` | Mỗi ca của A10 qua REST bằng phiên Lead bị từ chối, số dòng và nội dung cũ không đổi; 3 ca đại diện qua route trả 422 có `code`; C `conflict_type.unclear` không `action` và O `level.unclear` không `sign` lưu được; C trỏ B, A lưu được. | A10, A11, A12, A18 | T6 |
| T8 | Thực thể đang bị trỏ tới không xóa, sửa được. | migration: `guard_referenced_entity` (tìm bằng `jsonb_path_exists`, cho cascade qua); route entities đổi lỗi thành 409 `entity_referenced` | `PUT` bỏ B hoặc đổi màu B khi C trỏ B: 409, nêu B và nhóm C, `video_entities` và dòng E không đổi; bỏ C (không ai trỏ): còn 2 dòng, câu E ghép lại, một revision mới cho dòng E. | A19, A20 | T7 |
| T9 | Hai tab cùng người không tạo thực thể mồ côi. | migration: `select … for update` dòng phân công trong `validate_qa_annotation` (dòng ô) và `save_video_entities` | Kịch bản A21 dưới đây, cả hai thứ tự: phiên sau bị chặn chờ, rồi bị từ chối khi phiên trước commit. | A21 | T8 |
| T10 | "Khác" ghi chữ ở E và Prev (Open 1). | `compose.ts` (chữ thay nhãn "khác"); verify-slots | A47 chạy đủ: `content` có cờ, `type.other` kèm "xe lu" lưu được và câu E có "xe lu", thiếu `text` thì 422; Prev `main_action.other` kèm chữ lưu được, `extra_action.other` thiếu chữ bị database từ chối. | A47 | T7 |
| T11 | Prev "không rõ" (Open 3). | migration: luật điều kiện `party.unclear`; `compose.ts` (Prev "Không thể xác định.") | `{"parties": [{"party": {"option": "party.unclear"}}]}` lưu được với câu "Không thể xác định."; kèm `main_action`, kèm mục thứ hai, hoặc `party.both` lưu nguyên đều bị database từ chối. | A48 | T7 |
| T12 | C "cả hai bên" (Open 4). | migration: luật 9 `per_party_when`, luật điều kiện C `subject.both`; `compose.ts` (mẫu "Cả A và B"); route bước 3 kiểm đủ 2 mục | C `subject.both` với A, B trong `parties` lưu được, câu theo mẫu "Cả A và B"; 8 ca sai của A49 bị database từ chối; route trả 422 cho ca 1 mục; `PUT` bỏ B khi B chỉ được trỏ từ `parties` trả 409. | A49 | T8 |
| T13 | Keyframe của C, V dạng ô giữ luật start/end. | migration: nhánh keyframe của `validate_qa_annotation` áp cho dòng `SLOTS` | C dạng ô không keyframe bị từ chối "Mark exactly two evidence frames"; V `[2.0, 5.5]` lưu được; S gửi keyframe thì lưu `'{}'`. | A22 | T7 |
| T14 | R ghép từ C, và lưu C ghép lại R trong cùng giao dịch (Open 6). | `compose.ts` (R, kể cả `subject.both`, `subject.unclear`, "Các bên [1]."); route đọc C khi lưu R, từ chối R khi chưa có C, gửi 2 dòng cho `save_slot_answers` khi lưu C | R `has_aftermath.no` lưu được với câu trùng draft; C `parties` [B, A] cho R có A ở chỗ chủ thể; hai bên cùng hành vi cho "Các bên dừng lại."; lưu lại C `subject.unclear` đổi câu R thành "Không thể xác định." trong cùng lần gọi, một revision mới. | A9, A50, A51 | T12 |
| T15 | Revision mang ô. | migration: `qa_annotation_revisions.slots`, `codebook_version`, phép so nội dung | R `bystanders.unclear` thành `bystanders.nobody_stopped`: câu không đổi, đúng 1 revision mới mang `slots` mới; lưu lại y nguyên: không thêm revision. | A13, A14 | T14 |
| T16 | Trang cũ và phân công chữ không vượt định dạng; form chữ không đổi. | migration: nhánh dòng chữ của `validate_qa_annotation` (bước 6); route nhánh chữ từ chối `slots`, `codebook_version` | Upsert kiểu cũ lên câu S dạng ô bị từ chối, dòng giữ nguyên; trên phân công `text`, `SLOTS` bị từ chối và câu chữ vẫn lưu được; N, Attr của phân công `slots` chỉ nhận chữ; AGREE mang câu vẫn bị từ chối; `Verdict` vẫn 3 giá trị, build và lint pass. | A23, A24, A25, A26, A44 | T4 |
| T17 | Lead hoàn thành một phân công `slots`. | migration: `effective_answer` nhánh `SLOTS`, luật hoàn thành của `validate_assignment` | `effective_answer('SLOTS', '  Trời  nắng. ', 'x')` trả "Trời nắng."; Lead lưu đủ 7 nhóm ô, N và Attr chữ, event label, gọi `complete`: phân công `completed`. | A27, A28 | T14, T16, T10, T11, T13 |
| T18 | Phân công `slots` đứng ngoài độ khó và thống nhất đáp án. | migration: `annotator_difficulty`, `final_answers`, `final_video_labels` lọc `answer_format = 'text'` | Sau T17: `video_difficulty` vẫn 2 người, 0.00, `easy`; không có dòng độ khó của Lead; `final_answers` vẫn 9 `consensus`; `final_video_labels` vẫn `consensus`; `adjudication_export()` không có video fixture. | A29, A30 | T17 |
| T19 | Export có `answer_format`. | migration: drop rồi tạo lại `answers_export`, `grant` lại; `api/admin/answers/export/route.ts` `HEADER` | `answers_export(true, null, null)` có cột, Lead `slots`, X, Y `text`; CSV có header `answer_format` ngay sau `batch`. | A31 | T17 |
| T20 | Script IAA bỏ dòng `slots`. | `scripts/iaa_round.py`, `scripts/iaa_questions.py`, `scripts/iaa_tier1.py`; `tests/test_iaa_round.py`, `tests/test_iaa_questions.py`, `tests/test_iaa_tier1.py` (mới) | CSV có thêm dòng `slots` cho cùng Fleiss, alpha, AC1 như CSV không có; CSV cũ không cột vẫn chạy và cùng số; hai script kia không in dòng `SLOTS`. | A32, A33 | - |
| T21 | `annotator-report.mjs` hiểu `SLOTS`. | `frontend/scripts/annotator-report.mjs` | Chạy cho Lead fixture trước cleanup: không có "answer rewritten under SLOTS", không có lệch độ khó. | A34 | T17 |
| T22 | Gỡ phân công mang theo thực thể. | migration: `unassign_agreement_group`, `unassign_range` (`create or replace`, giữ chữ ký): xóa câu, rồi thực thể, rồi event label, rồi phân công; "chưa bắt đầu" thêm không có thực thể | Gỡ vòng kèm xóa việc của Lead: 0 dòng thực thể; gỡ range kèm xóa việc trên video thường có C trỏ thực thể: xóa hết, không bị chặn; phân công chỉ có thực thể, gỡ không xóa việc: còn nguyên; cleanup xóa người dùng fixture không lỗi và `video_entities` còn 0 dòng. | A35, A36, A37, A38 | T8 |
| T23 | Các `verify-*.mjs` cũ chạy trên local. | không sửa script nào ngoài `env.mjs` (T2); ghi lại phần cần dịch vụ ngoài | Chạy 8 script với biến local và `TEST_BASE_URL` local, trước và sau migration P2; phần cần Drive, Vercel bỏ qua kèm lý do ghi trong TODO.md. | A40 | T2 |
| T24 | Hồi quy toàn bộ trước khi gọi là xong. | không có code mới | `supabase db reset` từ đầu không lỗi; verify-slots pass hai lần liền; `python -m pytest tests -q` pass; build và lint pass; các `verify-*.mjs` cũ pass lại; `git diff --stat` không có `.env`, `frontend/.env.local`; kiểm `pg_safeupdate` lại với file migration cuối. | A40, A41, A42, A43, A45, A46 | T1-T23 |

## Ghi chú theo task

### T1, điều kiện trước

`git status` lúc bước 03: 6 file `codebook/C, E, O, Prev, R, V .v1.json` còn `??`, chỉ `S.v1.json` đã vào git.
Task này không commit.
A3 chỉ pass sau khi trưởng nhóm cho commit 6 file đó; tới lúc ấy T1 ở trạng thái "chờ cho phép" trong TODO.md, và T3 dùng file trên đĩa làm nguồn seed (sha256 trong database cố định byte đã seed, nên một lần sửa file sau đó lộ ra ở A1).

### T4, cách kiểm A5

A5 cần migration áp lên dữ liệu đã có, nên không dùng `supabase db reset` có sẵn P2:

1. Bỏ bản sao P2 khỏi `<workdir>/supabase/migrations/`, `supabase db reset` (16 migration cũ).
2. Tạo vài dòng `video_assignments` bằng `psql` với role `postgres`.
3. Áp P2 bằng `psql -p 54322 -f`.
4. `select answer_format, count(*) from video_assignments group by 1`: chỉ `text`.
5. Chép P2 vào lại workdir và reset để trở về trạng thái chuẩn.

### T5, fixture

Luật mới của `validate_assignment` chặn mọi lần đổi `answer_format` không phải của admin, kể cả service role (không có `auth.uid()`).
Fixture của verify-slots vì vậy chèn phân công của Lead với `answer_format = 'slots'` ngay lúc `insert`, hoặc gọi `set_answer_format` bằng phiên Lead.

### T9, kịch bản A21

Chạy với hai tiến trình `docker exec -i supabase_db_localdb psql -U postgres`, fixture là fixture của verify-slots giữ lại bằng cờ `--keep` (in `video_id`, id của Lead, id draft C), rồi `--cleanup` sau khi xong.
Mỗi phiên mở đầu bằng:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<lead>","role":"authenticated"}', true);
```

Thứ tự 1:

1. Phiên 1: `select public.save_slot_answers('[<dòng C trỏ subject tới B>]');`, chưa commit.
2. Phiên 2: `select public.save_video_entities('<video>', 'E.v1', '[<A>, <C>]', '<câu E>');` phải treo; phiên thứ ba thấy `wait_event_type = 'Lock'` trong `pg_stat_activity`.
3. Phiên 1: `commit;`.
4. Phiên 2 trả lỗi `entity_referenced` nêu B và nhóm C; `video_entities` vẫn có B.

Thứ tự 2 (ngược lại): phiên 1 bỏ B chưa commit, phiên 2 lưu C trỏ B phải treo, phiên 1 commit, phiên 2 bị từ chối vì B chưa khai báo.

Hai thứ tự cùng pass mới tick A21; nếu `--keep` thành ra phức tạp hơn một tham số, ghi lại lý do trong TODO.md và dựng fixture bằng SQL.

## Phủ acceptance

| Tiêu chí | Task |
|---|---|
| A1, A4 | T3 |
| A2 | T1 |
| A3 | T1 (chờ trưởng nhóm cho commit) |
| A5, A8 | T4 |
| A6 | T5 |
| A7 | T5, T6 |
| A9, A50, A51 | T14 |
| A10, A11, A12, A18 | T7 |
| A13, A14 | T15 |
| A15, A16, A17 | T6 |
| A19, A20 | T8 |
| A21 | T9 |
| A22 | T13 |
| A23, A24, A25, A26, A44 | T16 |
| A27, A28 | T17 |
| A29, A30 | T18 |
| A31 | T19 |
| A32, A33 | T20 |
| A34 | T21 |
| A35, A36, A37 | T22 |
| A38 | T22 (T2 dựng khung) |
| A39 | T2 |
| A40 | T23, T24 |
| A41 | T24 (T2 dựng khung) |
| A42 | T24 (T3 reset lần đầu) |
| A43 | T3, T24 |
| A45, A46 | T24 |
| A47 | T10 |
| A48 | T11 |
| A49 | T12 |

Không có tiêu chí nào thiếu task.
A3 là tiêu chí duy nhất phụ thuộc một quyết định ngoài code: nếu trưởng nhóm không cho commit, A3 fail và P2 không ship (spec, Phạm vi: commit 6 codebook trước khi seed).
