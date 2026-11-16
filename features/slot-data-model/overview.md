# P2: mô hình dữ liệu cho gán nhãn theo ô

Trạng thái: DESIRE, chờ bước 00.

## Mong muốn (lời của trưởng nhóm)

"Sau đó thực hiện P2 và tôi sẽ đánh thử 10 video xem cover đủ chưa."

## Phạm vi theo plan.md, mục P2

Nguồn: [plan.md](../codebook-multiple-choice/plan.md).

- Bảng `codebook_versions` (version, qgroup, nội dung JSON, ngày đóng băng); codebook đang dùng cũng nằm trong `frontend/src/lib/codebook/` để UI đọc.
- `video_drafts.draft_slots jsonb`: ô của draft, do LLM tách ra (P3).
- `qa_annotations.slots jsonb` và `qa_annotations.codebook_version`; `edited_answer` vẫn là câu đã ghép, nên `effective_answer`, export cũ và adjudication vẫn chạy.
- `video_entities`: danh sách thực thể của từng annotator trên từng video (A/B/C, loại, màu, đặc điểm); nhóm E đổi sang dạng khai báo này.
- Trigger `validate_qa_annotation` kiểm ID có trong codebook, đủ ô bắt buộc, các ràng buộc giữa ô, Start < End.
- Trigger revision log so cả `slots`.
- Cờ định dạng mỗi nhóm trong `qgroups.json` (`"format": "slots" | "text"`); nhóm chưa chuyển chạy như cũ.

Cổng ra theo plan: migration chạy trên bản sao, mọi `verify-*.mjs` cũ pass, thêm `verify-slots.mjs`; migration production cần cho phép riêng.

## Đầu vào đã có

- Codebook đã chốt: `codebook/{S,C,E,V,O,R,Prev}.v1.json` (2026-11-14 và 2026-11-15).
- Kết quả P1: [p1-results.md](../codebook-multiple-choice/p1-results.md).
