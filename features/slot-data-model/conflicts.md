# Kiểm xung đột P2: dữ liệu cho gán nhãn theo ô

Bước 01, 2026-11-16.
Đầu vào: [requirements.md](requirements.md), [overview.md](overview.md), Decision Log trong `CLAUDE.md`.

## Cách kiểm

Không chạy gì ghi lên production.
Production chỉ được đọc bằng `select` qua `privilegedClient()` (script đọc nằm trong scratchpad, không in email hay khóa).
Mọi phép thử ghi chạy trên một cụm PostgreSQL 17 dùng xong bỏ, trong scratchpad, cổng 55432: một shim nhỏ thay Supabase (`auth.uid()` đọc `request.jwt.claim.sub`, role `anon`/`authenticated`), rồi áp đủ 16 migration theo thứ tự phụ thuộc, không lỗi.
Seed: một video agreement (9 draft, draft R là "Không thể xác định."), hai annotator X, Y đã AGREE cả 9 câu và hoàn thành, một admin "Lead", một video thường do X giữ.
Các phép thử ghi chạy với `set local role authenticated` và uid của Lead, nên RLS có hiệu lực như qua API.

## Hiện trạng production (đọc, 2026-11-16)

- 60 video agreement (seq 1-60), mỗi video có đúng 7 annotator, cả 420 phân công đều `completed`, đều `batch = 'agreement'`.
- Không có phân công thường nào; `answer_adjudications` có 0 dòng.
- `qa_annotations`: 1514 AGREE, 2157 DISAGREE, 109 NOT_ANSWERABLE.
- `final_answers` trên nhóm agreement: 479 câu `conflict`, 61 câu `consensus`.
- Độ khó suy ra của 60 video: 31 high, 24 medium, 5 easy.
- Có 2 admin và 10 annotator; trưởng nhóm chưa giữ video agreement nào.

## Conflicts

| # | Mới vs. đã có | Cái gì vỡ | Kiểm bằng cách nào |
|---|---|---|---|
| 1 | Dòng dạng ô không AGREE (A4) vs ràng buộc `verdict` và luật "chỉ DISAGREE mang câu sửa, và phải mang" (`20261107000010_answer_adjudication.sql`) | Hôm nay chỉ có một hình dạng lưu được: DISAGREE + `reason_code` + câu ghép. Verdict mới bị chặn ở cả trigger lẫn check constraint; AGREE mang câu ghép bị trigger từ chối; DISAGREE không lý do bị từ chối. | `probe1.sql` P2a-P2d: `SLOTS` + câu → "Only a disagreement can carry an edited answer"; `SLOTS` không câu → vi phạm `qa_annotations_verdict_check`; AGREE + câu → cùng lỗi; DISAGREE không lý do → "Disagreement needs a reason"; DISAGREE/`khác` + ghi chú → lưu được. |
| 2 | Dùng DISAGREE cho dòng dạng ô vs câu ghép trùng draft | Câu ghép hằng số trùng nguyên văn draft thì trigger từ chối, nên form không lưu được câu đúng. Có ca thật: video agreement #39, nhóm R, draft là "Không thể xác định.", cũng là mẫu câu R "Không có đoạn sau". | Đọc 540 draft agreement trên production: 1 draft trùng mẫu câu (`(39, 'R')`). `probe1.sql` P2e: DISAGREE với câu đó → "A disagreement needs the corrected answer". |
| 3 | Dòng của trưởng nhóm vs độ khó suy ra (`annotator_difficulty`, `video_difficulty`) | Mọi dòng không AGREE bị đếm là lỗi của Gemini, nên trưởng nhóm luôn ra 9 lỗi, "high", và kéo trung bình của video lên. Với một verdict mới, view vẫn đếm nó vì lọc `verdict <> 'AGREE'`. | `probe2.sql`: video trước 2 người, 0.00 easy; sau khi Lead hoàn thành, 3 người, 3.00 medium, Lead 9 high. `probe3.sql` P5: verdict `SLOTS` vẫn cho `model_errors = 9`. Trên số liệu production: thêm 7 hoặc 9 lỗi vào mỗi video agreement làm 2 hoặc 3 trong 60 video đổi mức. |
| 4 | Dòng của trưởng nhóm vs `final_answers` và thống nhất đáp án | Một người thứ tám đã hoàn thành làm mọi câu `consensus` thành `conflict`, rồi đi vào CSV "Thống nhất đáp án" của admin. Trên production đó là tới 61 câu consensus của nhóm agreement nếu 10 video trúng các câu đó. | `probe2.sql`: 9 `consensus` → 9 `conflict`; `adjudication_export()` trả 9 dòng. |
| 5 | Dòng của trưởng nhóm vs `answers_export` và `scripts/iaa_round.py` | Export phạm vi agreement gồm luôn trưởng nhóm, `batch = 'agreement'`, và bộ lọc mặc định của `iaa_round.py` (chỉ `completed`) không loại được. Đồng thuận vòng 1 đã tính sẽ bị đổi khi tính lại. | Thêm 90 dòng giả lập của trưởng nhóm (seq 1-10, DISAGREE) vào export thật `csvs/answers-agreement-202611151418.csv`, tính bằng chính hàm của `iaa_round.py`: seq 1-10, Fleiss 0.411 → 0.311, AC1 0.595 → 0.555, pairwise 0.698 → 0.663; cả 60 video, Fleiss 0.461 → 0.445. |
| 6 | Verdict mới vs các chỗ đọc verdict | `effective_answer()` rơi vào nhánh `else` và trả "Không trả lời được" thay cho câu ghép, không báo lỗi. Luật hoàn thành của `validate_assignment` chặn mọi dòng mang câu sửa mà không phải DISAGREE, nên trưởng nhóm không bấm hoàn thành được. Route lưu và `iaa_round.py` đều có danh sách `VERDICTS` cố định. | `probe1.sql` P2g: `effective_answer('SLOTS', 'Trời nắng, ban ngày.', ...)` → "Không trả lời được". `probe3.sql` P5 (nới constraint trong transaction rồi rollback): hoàn thành → "An edited answer needs the verdict Sai, and Sai needs an edited answer". `route.ts` dòng 6, `iaa_round.py` dòng 53. |
| 7 | Cờ bật form ô (A2) vs nơi đặt cờ | `qgroups.json` là cờ toàn cục, bật là đổi form của mọi người (trái AC6). `video_assignments.batch` có sẵn nhưng `assign_agreement_group` ghi cứng `'agreement'` và `assignment_overview` dùng `batch <> 'legacy'`, nên mượn `batch` làm cờ sẽ đè hoặc bị đè. | `probe1.sql` P1c: phân công của Lead qua `assign_agreement_group` mang `batch = 'agreement'`, giống hệt X, Y. Đọc `20261109000013_training_rounds.sql` dòng 110 và 159. |
| 8 | Form ô vs route lưu cũ (người ghi thứ hai) | Route hiện tại upsert không nêu cột `slots`, nên một trang cũ còn mở, hay auto-save của form chữ, ghi đè `verdict` và `edited_answer` mà giữ `slots` cũ: dòng nói hai điều khác nhau. | `probe4.sql` P6: thêm cột `slots` (giả lập), lưu ô "mưa", rồi upsert kiểu route cũ → `slots = weather.rain`, `edited_answer = 'Trời nắng, ban đêm.'`. |
| 9 | `slots` mới vs log revision | Phép so "nội dung có đổi không" không có `slots`, nên sửa ô mà câu ghép giữ nguyên thì không sinh revision (trái AC4). | `probe3.sql` P4: thêm cột `slots`, chỉ đổi `slots` → số revision 9 → 9. |
| 10 | Kiểm "bên có trong E" (AC2) vs E sửa sau | Kiểm chỉ đặt trên `qa_annotations` thì xóa thực thể B ở E sau khi C đã chọn B để lại dòng C trỏ vào bên không còn. Ngoài ra `unassign_agreement_group` và `unassign_range` với "xóa cả câu đã làm" chỉ xóa `qa_annotations` và `video_labels`, nên `video_entities` sẽ mồ côi. | `probe5.sql` P7: trigger kiểm trên `qa_annotations`, xóa B khỏi bảng thực thể giả lập → dòng C còn `subject = B`, `still_declared = f`. Đọc các lệnh `delete from` trong `20261110000014_unassign_rounds.sql`, `20261111000015_unassign_range_work.sql`. |
| 11 | Nhóm V dạng ô vs luật keyframe | Trigger đòi đúng 2 keyframe start < end cho C, V, Attr với mọi verdict, nhưng `codebook/V.v1.json` không có ô start/end (chỉ C có `keyframes`). Form V thiếu start/end thì không lưu được. | `probe1.sql` P2f: dòng V không keyframe → "Mark exactly two evidence frames: start before end". |
| 12 | Cổng ra "chạy trên bản sao, mọi `verify-*.mjs` cũ pass" (A7, AC6) vs hạ tầng hiện có | Không có bản sao Supabase: `.env` và `frontend/.env.local` chỉ trỏ một project; không có `supabase/config.toml`; Docker daemon không chạy. Cả 8 `verify-*.mjs` tạo người dùng thật bằng `auth.admin` trên project trong env, tức production. | Đếm project ref trong hai file env (không in giá trị): 1. `docker info` → không kết nối được daemon. `grep auth.admin` trên `frontend/scripts/verify-*.mjs`: cả 8 file. |
| 13 | `codebook_versions` khớp file (AC1) vs file chưa được commit | 6 trong 7 codebook "đã đóng băng" (C, E, O, Prev, R, V) chưa nằm trong git, nên file có thể đổi mà không để lại dấu, và AC1 so với một thứ không cố định. | `git status --short codebook`: 6 file `??`; chỉ S có commit (`f86bb4e`). |

### Probe sạch

- Giao 10 video agreement cho trưởng nhóm (A1): sạch. `assign_agreement_group` nhận thêm người vào video agreement đã có 2 người hoàn thành; RLS cho Lead ghi `qa_annotations` sau khi có phân công (`probe1.sql` P1a, `probe2.sql`). Video thường đã có chủ thì bị chặn như mong đợi (P1b).
- "Trained" suy ra: Lead thành `trained = true` (`probe3.sql` P3), nhưng màn chia video loại admin khỏi danh sách (`assignment-panel.tsx` dòng 55), nên sạch nếu trưởng nhóm dùng tài khoản admin. Nếu dùng tài khoản annotator thì tài khoản đó sẽ được chọn sẵn khi chia video thường.
- Khóa thống nhất đáp án: sạch, production chưa có quyết định nào.
- Guideline Prev đang sửa dở khớp `codebook/Prev.v1.json` (13 lựa chọn hành động chính, cùng thứ tự).
- Tạo lại nhóm agreement: đã bị khóa từ trước vì có phân công agreement, phân công mới của trưởng nhóm không đổi điều đó.

## Verdict: PASS

Mọi xung đột đều có cách sửa nằm trong yêu cầu đã chốt.
A4 đã để bước này chọn quy ước verdict, nên chọn một giá trị mới không mở lại quyết định nào của trưởng nhóm.
Có một điểm cần trưởng nhóm biết trước khi spec: luật "chỉ DISAGREE mang câu sửa" trong Decision Log (Answer adjudication, 2026-11-07) được mở rộng thành "chỉ DISAGREE và SLOTS mang câu sửa, và phải mang".
Lý do của luật cũ vẫn giữ nguyên: AGREE không bao giờ được mang câu do người viết lại.
Nếu trưởng nhóm coi đây là đảo quyết định chứ không phải mở rộng, kết quả thành BLOCK và quyết định cần mở lại là A4.

## Recommended approach

Giữ A1: giao 10 video agreement cho tài khoản admin của trưởng nhóm bằng `assign_agreement_group`.
Thêm `video_assignments.answer_format text not null default 'text' check (answer_format in ('text','slots'))`; admin đặt `'slots'` cho 10 phân công đó, mọi dòng cũ giữ `'text'`, nên annotator khác không đổi gì (xung đột 7).
Dòng dạng ô là dòng có phân công `'slots'` và nhóm thuộc S, E, C, V, O, R, Prev; N và Attr của cùng phân công vẫn chạy dạng chữ như cũ.
Dòng dạng ô mang verdict mới `SLOTS`, `reason_code` rỗng, `slots` và `codebook_version` bắt buộc, `edited_answer` là câu ghép và được phép trùng draft (xung đột 1, 2).
`validate_qa_annotation` tra `answer_format` của phân công: dòng dạng ô phải là `SLOTS` có `slots`, dòng dạng chữ phải có `slots` rỗng, nên một lần ghi kiểu cũ không thể đè dòng dạng ô (xung đột 8).
Sửa cùng lúc mọi chỗ đọc verdict: check constraint, `effective_answer` (`SLOTS` → câu ghép đã chuẩn hóa), luật hoàn thành trong `validate_assignment`, `VERDICTS` của route lưu (xung đột 6).
Loại phân công `'slots'` khỏi `final_answers` (CTE `done`) và `annotator_difficulty`, nên thống nhất đáp án và độ khó đi theo; thêm cột `answer_format` vào `answers_export` (đổi kiểu trả về, phải `drop function` rồi tạo lại, và sửa danh sách cột của `/api/admin/answers/export`), và `iaa_round.py` mặc định bỏ dòng khác `'text'` (xung đột 3, 4, 5).
Log revision thêm `slots` và `codebook_version` vào bảng log và vào phép so (xung đột 9).
`video_entities` là chủ duy nhất của danh sách thực thể; dòng E chỉ giữ câu ghép sinh lại mỗi lần lưu thực thể; xóa hay đổi thực thể đang được nhóm khác trỏ tới bị database từ chối; hai hàm gỡ có "xóa cả câu đã làm" xóa luôn `video_entities` (xung đột 10).
Form V vẫn có start/end, giữ nguyên danh sách keyframe ở `qgroups.json` và trigger (xung đột 11).
Commit 6 codebook còn lại trước khi seed `codebook_versions`; `verify-slots.mjs` so nội dung bảng, `codebook/` và bản trong `frontend/src/lib/codebook/` (xung đột 13).
Cổng "bản sao" cần một Supabase không phải production: Supabase local qua Docker và Supabase CLI, hoặc một project miễn phí thứ hai do trưởng nhóm tạo; cụm PostgreSQL dùng xong bỏ của bước này chạy được phần SQL nhưng không chạy được `verify-*.mjs`, vì chúng cần Auth và REST (xung đột 12).

**Trade-off:** Thêm một giá trị verdict và một cột phân công nghĩa là sửa khoảng 8 chỗ đọc verdict trong cùng một migration, và luật trong Decision Log phải ghi lại ở bước 08.
Prev không tự điền bên từ Attr trong lần đánh thử, vì Attr vẫn dạng chữ; trưởng nhóm tự chọn bên.

**Not doing:**
- DISAGREE + `khác` cho dòng dạng ô: làm sai nghĩa verdict, hỏng ở video #39 R, thổi phồng độ khó.
- Cờ `format` toàn cục trong `qgroups.json`: đổi form của mọi người, trái AC6.
- Mượn `video_assignments.batch` làm cờ: bị `assign_agreement_group` ghi cứng và có người đọc khác.
- `verdict` nullable cho dòng dạng ô: vẫn phải sửa đúng các chỗ như verdict mới, mà `null` thì lọt qua lặng lẽ hơn.
- Chọn 10 video thường thay vì agreement: trưởng nhóm thành người gán duy nhất của video đó, và mất 7 bản chữ để so độ phủ.
- Để trưởng nhóm không bấm hoàn thành để né các view: dựa vào thói quen của người dùng chứ không phải luật của database.
