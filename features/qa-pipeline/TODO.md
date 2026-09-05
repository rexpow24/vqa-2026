# qa-pipeline V1 — progress

- [x] T1 — Server sống thật, trả lời được 1 ảnh          status: done (A1,A2,A3 ✓)
      scaffolding `vlm/scripts/check_server.py` xoá ở bước 08: nó dựng lại HTTP
      bằng tay, trùng với `vlm/client.py`, và `test_api.py` đã bao trọn việc nó làm.
- [x] T2 — keyframe_times neo theo giữa segment          status: done (C4 ✓)
- [x] T3 — approved_clips (DB read-only + sha256)        status: done (C1,C2,C3,C5 ✓)
- [x] T4 — keyframes: trích JPEG màu                     status: done (4/4 distinct, seek tái lập)
- [x] T5 — client HTTP, lỗi có tên, timeout              status: done (A10,A11 ✓)
- [x] T6 — 3 điều kiện: chứng minh model đọc ảnh         status: done (A4,A5,A6 ✓)
- [x] T7 — lần chạy thứ hai + không làm bẩn gì           status: done (A7,A8,A9,C6 ✓)
- [x] T8 — gộp tài liệu                                  status: done (A12 ✓)

## Notes

- 2026-09-05 — Baseline trước khi động vào: `python -m pytest tests -q` -> 55 passed in 9.72s.
- 2026-09-05 — Bước 01 chứng minh A8 SAI: impact nằm ở GIỮA shot, không ở đầu.
  Segment thật dài 9.2-29.0s (median 16.0). T2 sinh ra từ phát hiện này.
- 2026-09-05 — Rủi ro chưa gỡ được nếu chưa kéo model về: A4 (VRAM) và A5 (compute 7.5).
  Cả hai bắt tại T1, không phải muộn hơn.

- 2026-09-05 (T1) — Ảnh `server-cuda` chỉ log 27 dòng và KHÔNG in tên thiết bị CUDA.
  A2/A3 phải viết lại: quy kết GPU bằng thí nghiệm tắt/bật VRAM (3314 -> 532 -> 3259 MiB)
  thay vì grep log; `nvidia-smi --query-compute-apps` vô dụng trên Windows WDDM.
- 2026-09-05 (T1) — ĐO ĐƯỢC: VRAM nền 544 MiB -> 3259-3317 MiB khi nạp model
  (~2.7 GB cho model + KV cache ở ctx 4096). Còn dư ~2.8 GB. Latency: **52.5s lần đầu
  (cold), rồi 3.2s -> 0.9s khi prompt cache ấm**. Báo latency của lần chạy đơn lẻ là sai lệch;
  phải nói rõ cold hay warm.
- 2026-09-05 (T1) — Cảnh báo lúc nạp: "Qwen-VL models require at minimum 1024 image tokens
  ... try adding --image-min-tokens 1024". Nghi đe doạ D1+D8.
- 2026-09-05 (T4) — **ĐÃ ĐO, D1+D8 AN TOÀN.** Ở mặc định mỗi ảnh 768px tốn ~344 token,
  KHÔNG phải 1024: 1 ảnh=364, 2 ảnh=702, **4 ảnh=1378 token = 33% của ctx 4096**.
  Đánh đổi lộ ra: nếu sau này bật `--image-min-tokens 1024` cho câu hỏi grounding thì
  4 ảnh = 4096+ token, KHÔNG lọt ctx 4096 nữa — sẽ phải nâng ctx 8192 và tốn thêm VRAM.
  Ở mức mặc định model vẫn đọc được biển số "36B-014.35", nên chưa cần đánh đổi đó.
- 2026-09-05 (T4) — Trích frame **tái lập được**: fetch lại cùng mốc cho sha256 y hệt.
  Đó là điều kiện cần để A7 (chạy 2 lần ra kết quả giống nhau) có ý nghĩa.
- 2026-09-05 (T1) — Server bật CORS `*` và không có API key (log tự cảnh báo).
  Vô hại vì đã bind loopback, nhưng phải ghi vào phần bảo mật của tài liệu ở T8.

- 2026-09-05 (T6) — **NHÌN BẰNG MẮT MỚI THẤY:** file trong `trimmed/` vẫn còn biển số
  `37B-016.09` cháy chữ ở giữa-dưới, SẮC NÉT. Vùng `middle_bottom` (x0.30 y0.78 w0.40 h0.22)
  có trong `config.json` nhưng 30 file này được dựng TRƯỚC khi vùng đó được thêm, nên chưa
  bao giờ được blur. Vùng trên-phải và dưới-trái thì đã blur đúng.
  Hệ quả: `docs/01…TeamA.md` bước 2 ghi "Video đã lọc + đã blur mặt/biển số" là SAI hai lần —
  pipeline chỉ blur overlay của kênh, không hề blur mặt/biển số, và ngay overlay cũng còn sót.
  Không chặn V1 vì inference chạy local, nhưng phải nêu ở T8 và cân nhắc dựng lại 30 file.

## Bugs found by testing, not by reading

| Bug | Symptom | Cause |
|---|---|---|
| `clips.trimmed_path` là cột chết | query trả 0 clip trong khi 30 file thật nằm trên đĩa | migration ở `db.py:129-138` chỉ ĐỌC cột này một lần; chủ sở hữu thật là `trim_segments` |
| Reject tạo annotation mồ côi | annotation trỏ vào file `trimmed/` đã bị `unlink()`, không có gì báo | `review.discard()` xoá file nhưng không có ai giữ tham chiếu ngược -> định danh phải là `clip_id`, không phải path |
| Cột chết `trimmed_path` hỏng theo HAI kiểu khác nhau | DB thật: im lặng trả 0 dòng. DB mới `db.init()`: `sqlite3.OperationalError: no such column: c.trimmed_path` | cột chỉ tồn tại trên DB đã migrate (`db.py:129`); `CREATE TABLE` của bản mới không có nó -> cùng một lỗi, máy này im lặng còn máy kia crash |
| `temperature=0` KHÔNG đảm bảo output y hệt | bước 07 bắt `identical across runs: False`, lệch từ ký tự 92 giữa câu, chỉ ở điều kiện `blind` | prompt cache của llama.cpp: lần chạy sau ăn cache lần trước, đổi thứ tự cộng dồn float trên CUDA; đoạn sinh tự do 300 token khuếch đại sai khác, còn `real`/`grey` dừng sớm nên không lộ. Chạy 3 lần ở trạng thái ổn định thì đều giống hệt |
| `check_server.py` chết khi in câu trả lời | `UnicodeEncodeError: 'charmap' codec can't encode 'ả'` — *sau khi* server đã trả lời đúng | console Windows là cp1252; model trả lời tiếng Việt. Script nào in output của model đều phải `sys.stdout.reconfigure(encoding="utf-8")` |
