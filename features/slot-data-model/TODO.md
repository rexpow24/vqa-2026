# P2 slot data model - progress

- [ ] T1 - Codebook là nguồn seed, bản sao trong frontend            status: A2 verified (tests/test_codebook_copies.py 14 pass); A3 chờ trưởng nhóm cho commit 6 file
- [x] T2 - Script trỏ sang local, verify-slots chặn host lạ           status: done (A39 thoát 2, 0 kết nối mạng; hai lần chạy local thoát 0)
- [x] T3 - `codebook_versions` 7 dòng, chỉ đọc                        status: done (A1 8 mục, A4 pass; `db reset` có P2 không lỗi)
- [x] T4 - Tracer: Lead lưu câu S dạng ô qua route                    status: done (A8 qua HTTP; A5: 3 phân công có sẵn đều `text` sau khi áp P2 bằng psql)
- [x] T5 - Chỉ admin đổi `answer_format`                              status: done (A6, A7 phần câu; annotator cập nhật `status` vẫn qua)
- [x] T6 - Thực thể E qua `PUT`, dòng E là bản chụp                   status: done (A15, A16, A17, A7 phần thực thể; chạy hai lần liền pass)
- [x] T7 - Database từ chối ô sai, route trả 422 có `code`            status: done (16 ca A10 bị từ chối đúng `hint`, A11 3 ca 422, A12, A18)
- [x] T8 - Thực thể đang bị trỏ tới không xóa, sửa được               status: done (A19 hai ca 409, A20; cleanup xóa người dùng có câu trỏ thực thể qua cascade không lỗi)
- [x] T9 - Hai tab cùng người không tạo thực thể mồ côi               status: done (A21 cả hai thứ tự, tự động trong verify-slots qua hai phiên psql)
- [x] T10 - "Khác" ghi chữ ở E và Prev                                status: done (A47 5 mục; hành vi đã có từ T4, T7, chứng minh bằng đột biến `labelOf`)
- [x] T11 - Prev "không rõ"                                           status: done (A48 4 mục; RED: route 422 `unsupported_group`, database từ chối sai lý do)
- [x] T12 - C "cả hai bên"                                            status: done (A49 11 mục; RED: database báo `unknown_cell parties`, compose `unsupported_group`)
- [x] T13 - Keyframe C, V dạng ô                                      status: done (A22 4 mục; nhánh keyframe đã chạy trước nhánh ô từ T4, chứng minh bằng đột biến bỏ kiểm cho `SLOTS`)
- [x] T14 - R ghép từ C, lưu C ghép lại R                             status: done (A9, A50, A51 6 mục; RED: route trả 422 `unsupported_group` cho mọi câu R)
- [x] T15 - Revision mang ô                                           status: done (A13, A14; RED: đổi chỉ ô không thêm revision, 8 vẫn 8)
- [x] T16 - Trang cũ, phân công chữ không vượt định dạng              status: done (A23-A26 8 mục, A44; RED: phân công chữ lưu được `slots`, route nhánh chữ trả 200)
- [x] T17 - Lead hoàn thành phân công `slots`                         status: done (A27, A28; RED: `effective_answer` trả "Không trả lời được", `complete` 422 vì luật DISAGREE)
- [x] T18 - Phân công `slots` ngoài độ khó và thống nhất              status: done (A29, A30 4 mục; RED: `video_difficulty` 3 người 2.67, 8 câu `conflict`, nhãn `conflict`, video có trong `adjudication_export`)
- [x] T19 - Export có `answer_format`                                 status: done (A31 2 mục; RED: RPC không có cột, header CSV không có `answer_format`)
- [x] T20 - Script IAA bỏ dòng `slots`                                status: done (A32, A33 4 test; RED: % đồng ý cặp 0.667 thành 0.259 khi thêm dòng `slots`, `SLOTS` hiện trong bảng của `iaa_questions.py` và `iaa_tier1.py`)
- [x] T21 - `annotator-report.mjs` hiểu `SLOTS`                       status: done (A34; RED: thoát 1, 7 dòng "answer rewritten under SLOTS" và "completed but missing from annotator_difficulty")
- [x] T22 - Gỡ phân công mang theo thực thể                           status: done (A35, A36, A37, A38; RED: thực thể còn lại mồ côi sau cả hai hàm gỡ, phân công chỉ có thực thể bị gỡ khi không xóa việc)
- [x] T23 - `verify-*.mjs` cũ chạy trên local                         status: done (A40: 5 script chạy và pass trên local trước và sau P2, 3 script bỏ qua kèm lý do, xem ghi chú T23)
- [x] T24 - Hồi quy toàn bộ                                           status: done (A40-A43, A45, A46; số liệu ở ghi chú T24; A3 vẫn chờ trưởng nhóm qua T1)

## Notes

- 2026-11-16, bước 03: architecture.md và acceptance.md sửa theo Open 1, 3, 4, 6 của spec đã quyết; thêm A47-A51.
- 2026-11-16, bước 03: luật "C `subject.both` thì `speed`, `evader`, `evasion`, `evasion_result` phải trống" là suy ra từ mẫu "Cả A và B", chưa ai xác nhận; trưởng nhóm xác nhận khi xem acceptance (A49).
  Trưởng nhóm đã xác nhận ngày 2026-11-16: bỏ trống.
- 2026-11-16, bước 03: kết quả kiểm `pg_safeupdate` trên local (A43) ghi ở đây khi chạy T3.
  Kết quả T3: `show session_preload_libraries` của role `postgres` là `supautils`, nhưng role `authenticator` (role PostgREST dùng) có `session_preload_libraries=supautils, safeupdate`.
  Vậy mọi lệnh qua API trên local chạy với `safeupdate` như production; `psql -U postgres` thì không, nên một `update` thiếu `where` chỉ lộ khi chạy qua API hoặc RPC.
- 2026-11-16, T3: 6 file codebook chưa commit (C, E, O, Prev, R, V) có dòng kết thúc CRLF, `S.v1.json` (đã commit) là LF, và máy này đặt `core.autocrlf=true`.
  `sha256` trong `codebook_versions` là của byte trên đĩa lúc seed (CRLF với 6 file).
  Khi commit, git lưu LF; một bản checkout trên máy khác (Linux, hay `autocrlf=false`) sẽ có byte LF, khác `sha256` đã seed, và A1 fail ở đó dù nội dung JSON không đổi.
  Cần trưởng nhóm quyết cùng lúc cho commit (A3): chuẩn hóa 6 file về LF và thêm `.gitattributes` (`codebook/*.json -text` hoặc `eol=lf`), rồi sinh lại seed; chưa làm vì T1 coi file là chỉ đọc.

- 2026-11-16, T4: `compose.test.ts` import `./compose.ts` và `compose.ts` import `./index.ts` có đuôi `.ts`, vì Node chạy TypeScript trực tiếp cần đuôi; nên `frontend/tsconfig.json` thêm `allowImportingTsExtensions: true` (hợp lệ vì đã có `noEmit`).
  `index.ts` import JSON bằng `with { type: "json" }` để Node nạp được; Turbopack và `tsc` đều nhận.
  Node chạy TypeScript ở chế độ chỉ bỏ kiểu, nên `compose.ts` không dùng parameter property (`constructor(readonly code ...)`).
- 2026-11-16, T4: dev server cho phần HTTP chạy bằng Bash với biến môi trường local đặt sẵn, không qua `preview_start`: `preview_start` không mang biến của shell, nên Next.js sẽ đọc `frontend/.env.local` và trỏ vào production.

- 2026-11-16, T6: mỗi lần database từ chối ô mang mã máy đọc ở `HINT` của lỗi (`unknown_option`, `missing_cell`, `missing_text`...); PostgREST trả `hint`, route trả nó làm `code`.
- 2026-11-16, T6: câu E nối các bên bằng dấu phẩy, viết thường chữ đầu mọi bên trừ bên đầu ("Xe ô tô (có camera hành trình), xe máy màu đen.", theo ví dụ trong P1); chữ cái thêm ngay sau màu khi hai bên trùng loại và màu ("xe máy màu trắng A do người mặc áo đen điều khiển").
  Vế "chở [6] người" chỉ có khi từ 2 người; `riders.three_plus` ghép thành "chở 3 trở lên người" vì chỉ dùng nhãn của codebook, cần trưởng nhóm xem lại câu này.
  Đã sửa trước T9 thành "chở 3 người trở lên" (quyết định của trưởng nhóm).
- 2026-11-16, T7: architecture.md không nói hình dạng ô `parties` của O (`from_entities`, không có lựa chọn, "tự điền từ cặp chủ thể và đối tượng của C").
  Một `{"entity": K}` không chứa được hai bên, nên P2 lưu nó là mảng 1 hoặc 2 tham chiếu `[{"entity": "B"}, {"entity": "A"}]`, khóa khác nhau, đã khai báo ở E; `jsonb_path_exists` vẫn tìm thấy mọi `entity`.
  Cần trưởng nhóm xác nhận; nếu đổi thì sửa `validate_slot_cells` và `composeOutcome`.
- 2026-11-16, T7: tên một bên trong câu của C, V, O, Prev là phần lõi của câu E cho bên đó (loại và màu, ví dụ "xe máy màu đỏ"; người đi bộ kèm màu áo), cộng chữ cái khi hai bên trùng lõi; theo câu ghép trong `trial-new-groups.md`.
  Ô "không rõ" hoặc trống bỏ vế của nó; C `subject.unclear` vì vậy cho câu không có chủ thể ("Chuyển sang làn bên trái, ..."), và câu không còn vế nào là "Không thể xác định.".
  Mẫu C không nói câu khi `subject.unclear`; cần trưởng nhóm xem lại.
- 2026-11-16, T7: luật ô được tách thành `validate_slot_cells` (một object phẳng, luật 1-7) và `validate_slots` (hình dạng theo nhóm: `parties` của Prev, luật điều kiện V và R).
  C `subject.both` và Prev `party.unclear` chưa ghép được câu (route trả 422 `unsupported_group`) cho tới T11, T12.
- 2026-11-16, T8: 409 `entity_referenced` của `PUT /api/videos/[id]/entities` trả thêm `entity` và `groups` (lấy từ `DETAIL` JSON của `guard_referenced_entity`); dòng E cũng có thể trỏ bên khác qua bản chụp nên nhóm E bị loại khỏi phép tìm.
- 2026-11-16, sau T8: verify-slots 48 mục PASS, chạy hai lần liền thoát 0; `python -m pytest tests -q` (bỏ 3 file cần cv2) 183 pass; `tsc --noEmit` và eslint các file đã sửa sạch.
- 2026-11-16, trước T9: 6 file codebook và bản sao của chúng chuyển về LF; `.gitattributes` ép `eol=lf` cho `codebook/*.json` và `frontend/src/lib/codebook/*.json`, nên byte trên đĩa không còn phụ thuộc `core.autocrlf`.
  `sha256` seed trong migration được sinh lại từ byte LF; `tests/test_codebook_copies.py` kiểm cả ba điều (không có CR, `git check-attr eol` là `lf`, sha256 seed bằng sha256 file).
- 2026-11-16, trước T9: câu E với `riders.three_plus` nay là "chở 3 người trở lên" (số trước "người", phần còn lại của nhãn sau); "chở 2 người" không đổi.
- 2026-11-16, T9: A21 chạy tự động trong verify-slots thay cho cờ `--keep` và hai phiên psql gõ tay: script mở hai tiến trình `docker exec -i supabase_db_localdb psql` làm Lead, kiểm phiên sau treo bằng `pg_stat_activity` (`wait_event_type = 'Lock'`), rồi commit phiên trước.
  Trước khi có khóa, cả hai thứ tự đều không chờ và để lại câu C trỏ tới B trong khi chỉ còn A (thực thể mồ côi).
  Khóa: `validate_qa_annotation` đọc lại phân công `for update` khi `answer_format = 'slots'`; `save_video_entities` khóa phân công trước mọi kiểm tra.
- 2026-11-16, T10: A47 pass ngay lần chạy đầu vì `labelOf` (T4) và luật 6 của `validate_slot_cells` (T7) đã làm đúng việc; thay `labelOf` bằng nhãn trần thì hai mục route của A47 fail (câu ra "khác"), nên các mục chạm đúng hành vi.
- 2026-11-16, T11: RED cho thấy một lỗi T7 không lộ: phép đếm bên khác nhau của Prev dùng `party->>'entity'`, nên mọi bên là lựa chọn (`party.unclear`, `party.both`) đều bị từ chối với lý do sai "each party is a different entity".
  Nay `party.both` bị từ chối với lý do riêng, `party.unclear` phải là mục duy nhất và không có ô hành động (hint `conditional_cell`), phép đếm so cả giá trị `party`.
- 2026-11-16, T12: luật 9 (`per_party_when`) đọc cờ của codebook: ô `action` nằm trong từng mục của `parties` khi `subject` là `subject.both`, ô cha `conflict_type` ở ngoài và được ghép vào từng mục khi kiểm, nên luật 5 so mỗi bên với cùng một kiểu xung đột.
  Lỗi trả về: `per_party` (có `action` ở ngoài, hoặc có `parties` khi không phải `subject.both`), `parties` (không đúng 2 mục khác khóa), `conditional_cell` (`object`, `speed`, `evader`, `evasion`, `evasion_result`).
  Câu: "[A] [hành động của A], đồng thời [B] [hành động của B], đi vào đường đi của nhau, dẫn đến [nhãn của event_type]."; A, B theo thứ tự khóa ở E.
  Giả định chưa ai xác nhận: `event_type.unclear` cùng `subject.both` bỏ vế "dẫn đến ...", theo luật chung ô "không rõ" bỏ vế của nó; mẫu "Cả A và B" không nói ca này.
- 2026-11-16, T14: route đọc câu C dạng ô của chính người gọi khi lưu R (không có thì 422 `cause_missing`, kể cả R `has_aftermath.no`), và khi lưu C thì ghép lại câu R đã có rồi gửi cả hai dòng cho `save_slot_answers` trong một lần gọi.
  Câu R theo đúng 4 mẫu của `R.v1.json`; "Các bên [1]." chỉ là "Các bên [1]." (mẫu không có vế người xung quanh), và chỉ dùng khi C có cả chủ thể và đối tượng.
  Giả định: R có ô `object` mà C không có đối tượng (ví dụ K18) thì bỏ vế đối tượng, không từ chối; codebook ghi "bỏ khi C không có đối tượng" là việc của form P4.
- 2026-11-16, T16: nhánh chữ của `validate_qa_annotation` từ chối `SLOTS` (hint `text_group`) và `slots` hay `codebook_version` khác null (hint `unexpected_slots`); route nhánh chữ trả 422 `unexpected_slots` khi body có `slots` hoặc `codebook_version`.
  RED cho thấy hai lần từ chối trước đó chỉ là tình cờ: `SLOTS` mang câu trên dòng chữ bị chặn bởi "Only a disagreement can carry an edited answer", còn `SLOTS` không mang câu thì lưu được; nên mục A24, A25 kiểm cả `hint`.
  A44: `Verdict` vẫn 3 giá trị, `VERDICT_LABEL` vẫn 3 khóa; `npm run build` và `npm run lint` thoát 0.
- 2026-11-16, sau T16: verify-slots 90 mục PASS, chạy hai lần liền thoát 0, `video_entities` còn 0 dòng; `python -m pytest tests -q` (bỏ 3 file cần cv2) 217 pass, 1 fail là `test_app_run` đo thời gian (3.49s so với 1.0s, app Streamlit đã đóng băng, không file nào của P2 chạm tới); compose 20 test pass; `tsc --noEmit` sạch.

- 2026-11-16, sau T16: bốn giả định ghép câu dưới đây là mặc định đã nhận, trưởng nhóm xem lại sau lần đánh thử.
  (1) C `subject.both` cùng `event_type.unclear` bỏ vế "dẫn đến ..." (T12).
  (2) R "Các bên [1]." chỉ là "Các bên [1].", và chỉ dùng khi C có cả chủ thể và đối tượng (T14).
  (3) R có ô `object` mà C không có đối tượng thì bỏ vế đối tượng, không từ chối (T14).
  (4) R trước khi có câu C bị từ chối (422 `cause_missing`), kể cả `has_aftermath.no` (T14).
  Hình dạng `parties` của O (T7) và A3 (cho commit 6 codebook, T1) vẫn chờ trưởng nhóm quyết.
- 2026-11-16, T17: `effective_answer` có nhánh `SLOTS` tường minh (câu ghép đã chuẩn hóa); luật hoàn thành của `validate_assignment` là `(verdict in ('DISAGREE','SLOTS')) = (edited_answer is null)` thì từ chối.
  A28 kiểm qua route `label` (Lead chọn `near-miss`, khác X, Y) và route `complete`; phân công thành `completed`, vẫn `slots`.
- 2026-11-16, T18: `annotator_difficulty`, `final_answers` (CTE `done`), `final_video_labels` (CTE `labels`) tạo lại bằng `create or replace view`, chỉ thêm `answer_format = 'text'`; quyền giữ nguyên vì cột không đổi.
- 2026-11-16, T19: `answers_export` trả `coalesce(a.answer_format, 'text')`, nên một câu mà phân công đã bị gỡ (vẫn có thể còn câu khi gỡ không xóa việc trước P2) đọc là `text`, giống cách `validate_qa_annotation` coi câu không có phân công.
- 2026-11-16, T20: hàm dùng chung `text_rows(df)` ở `scripts/iaa_round.py`; `iaa_questions.py` và `iaa_tier1.py` import nó.
  `iaa_round.py` in thêm một dòng "Bỏ N dòng của phân công dạng ô" khi N > 0, đếm riêng với dòng chưa completed.
  Chạy lại ba script trên `csvs/answers-agreement-202611151418.csv` (export cũ, không có cột): 540 câu, 7 người, % đồng ý cặp 0.723, Fleiss 0.461, alpha 0.461, AC1 0.628, như trước.
- 2026-11-16, T21: phân công `slots` không bị báo "missing from annotator_difficulty" nữa, mà bị báo nếu lại có dòng độ khó; dòng `SLOTS` phải mang câu ghép (báo "SLOTS without a composed sentence" nếu thiếu).
- 2026-11-16, T22: hai hàm gỡ việc giữ chữ ký và kết quả trả về (không thêm khóa đếm thực thể).
- 2026-11-16, T23: chạy bằng `run-old-verify.mjs` trong scratchpad: tạo một admin local dùng một lần (mật khẩu sinh ngẫu nhiên, không in ra, xóa sau khi chạy) vì local không có admin của `frontend/.admin-credentials`; `adminCredentials()` trong `env.mjs` nhận `TEST_ADMIN_EMAIL` và `TEST_ADMIN_PASSWORD` từ biến tiến trình khi có cả hai.
  `verify-assignments` lập kế hoạch nhóm 60 video, nên runner gieo 60 video có nhãn tham chiếu và 9 draft (production có 1496) rồi xóa sau; thiếu chúng thì script dừng ở "Only 12 labelled videos are available", cả trước P2.
  Năm script chạy và pass: `verify-adjudication` (39 mục), `verify-assignments` (65 mục, có phần HTTP), `verify-difficulty` (17), `verify-labeling` (chỉ HTTP), `verify-revisions` (10).
  Trước P2 (bỏ bản sao P2, `db reset`, 16 migration): bốn script có nửa database chạy không HTTP và pass; `verify-labeling` chỉ có phần HTTP, mà code route hiện tại đã cần schema P2, nên không chạy ở mốc này.
  Bỏ qua, kèm lý do: `verify-deployment` (URL Vercel production viết cứng, stream Drive, đọc `.env.local` và `.admin-credentials` trực tiếp); `verify-video-import` (mọi dòng import đều thăm dò Google Drive từ route); `verify-password-policy` (kiểm cấu hình Auth của project hosted, đọc thẳng `.env.local` nên luôn trỏ production; `config.toml` local bật signup và đòi mật khẩu từ 6 ký tự, nên không phản ánh production).
  Năm script đã chạy được thêm chặn host không phải local (`refuseUnlessLocal`, chuyển từ verify-slots vào `env.mjs` để dùng chung); thử với `NEXT_PUBLIC_SUPABASE_URL=https://example.invalid`, với `TEST_BASE_URL=https://example.invalid`, và không có biến tiến trình (chỉ còn `.env.local`): cả sáu script thoát 2, 0 kết nối mạng.
  Hệ quả cần trưởng nhóm quyết: Decision Log ("Deploying the hosted frontend") dặn chạy `verify-*.mjs` với `TEST_BASE_URL` production sau khi deploy; chặn này làm năm script đó không chạy được trên production nữa.
- 2026-11-16, T24: `db reset` từ đầu (16 bản sao + P2) không lỗi; verify-slots 102 mục PASS, chạy hai lần liền thoát 0, `video_entities` còn 0; năm script cũ pass lại; `python -m pytest tests -q` (bỏ 3 file cần cv2) 221 pass, 1 fail là `test_app_run` đo thời gian (3.23s so với 1.0s, đã ghi từ sau T16); `tsc --noEmit`, `npm run lint`, `npm run build` thoát 0; compose 20 test pass.
  `pg_safeupdate`: role `authenticator` vẫn nạp `safeupdate`; 12 câu `update`/`delete` trong migration P2 đều có `where`, và các hàm gỡ việc mới đã chạy qua RPC trong verify-slots.
  `.env` và `frontend/.env.local` bị gitignore nên `git diff` không thấy chúng; thời điểm sửa cuối là 2026-11-14 và 2026-10-31, trước P2.

## Bugs found by testing, not by reading

| Bug | Symptom | Cause |
|---|---|---|
| `validate_slots(version, ...)` không chạy được | `PUT` entities trả 422 `column reference "version" is ambiguous` | Tham số tên `version` trùng cột `codebook_versions.version` trong câu `select`; sửa bằng `validate_slots.version`. |
| Mọi câu C `subject.both` bị database từ chối | `operator is not unique: unknown - unknown` | `p.value->'party' - 'entity'`: `-` ưu tiên cao hơn `->`, nên Postgres đọc thành `p.value->('party' - 'entity')`; sửa bằng ngoặc. |
| Hàm plpgsql không tạo được | `db reset` lỗi `syntax error at end of input` ở `validate_slot_cells` | `if case when ... end then`: plpgsql đọc `end` của biểu thức `case` như kết thúc khối `if`; viết lại bằng `and`/`or`. |
| Dev server cổng 3006 chạy sai chế độ | `verify-assignments` phần HTTP: "the list renders numbered pages failed: 200"; `/annotate?page=2` trả 200 với trang "This page could not be found." | Server được khởi động bằng `npx next dev -p 3006` không có `PLATFORM_MODE=hosted` (cấu hình `frontend-hosted` của `.claude/launch.json` có), nên `/annotate` gọi `notFound()`; các route API không kiểm chế độ nên verify-slots vẫn pass. Khởi động lại với `PLATFORM_MODE=hosted`. |
