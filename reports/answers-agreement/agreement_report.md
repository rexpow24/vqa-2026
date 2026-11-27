# Báo cáo độ đồng thuận

- Nguồn: `C:\Users\Admin\orca\workspaces\VQA-VN-Traffic-2026\main\csvs\answers-agreement.csv`
- Bản ghi: 795; hoàn thành: 792; loại chưa hoàn thành: 3.
- Bootstrap: 1,000 lần theo video; CI percentile 95%; seed=0.
- Ghép danh tính thực thể: Ghép thực thể theo danh tính E: 16 chữ được đổi, 12 không phân biệt được (giữ nguyên), 3 không có bên tương ứng..
- Roster nhóm: S: Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh (5 người); E: Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh (5 người); C: Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh (5 người); O: Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh (5 người); R: Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh (5 người); Attr: Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh (5 người); Prev: Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh (5 người); N: Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh (5 người)

## Cách 1: alpha riêng từng ô nhãn

Đơn vị là một ô trong một câu trả lời; các ô nhiều lựa chọn được xem là một tập. Mỗi tổ hợp bốn annotator được tính riêng. CI lấy mẫu lại video.

| Nhóm | Codebook | Tổ hợp 4 người | Ô | Đơn vị | Video | Alpha | CI 95% |
|---|---|---|---|---:|---:|---:|---:|
| Attr | Attr.v1 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | parties | 19 | 19 | 0.509 | [0.253, 0.747] |
| Attr | Attr.v1 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | parties | 19 | 19 | 0.529 | [0.267, 0.778] |
| Attr | Attr.v1 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | parties | 20 | 20 | 0.470 | [0.251, 0.691] |
| Attr | Attr.v1 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | parties | 19 | 19 | 0.553 | [0.333, 0.760] |
| Attr | Attr.v1 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | parties | 19 | 19 | 0.487 | [0.251, 0.716] |
| C | C.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | action | 15 | 15 | 0.311 | [0.200, 0.375] |
| C | C.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | action | 16 | 16 | 0.322 | [0.190, 0.424] |
| C | C.v4 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | action | 17 | 17 | 0.308 | [0.211, 0.366] |
| C | C.v4 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | action | 15 | 15 | 0.413 | [0.271, 0.527] |
| C | C.v4 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | action | 17 | 17 | 0.362 | [0.219, 0.475] |
| C | C.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | conflict_type | 19 | 19 | 0.339 | [0.222, 0.420] |
| C | C.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | conflict_type | 19 | 19 | 0.367 | [0.241, 0.457] |
| C | C.v4 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | conflict_type | 20 | 20 | 0.318 | [0.211, 0.400] |
| C | C.v4 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | conflict_type | 19 | 19 | 0.383 | [0.233, 0.510] |
| C | C.v4 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | conflict_type | 19 | 19 | 0.371 | [0.217, 0.503] |
| C | C.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | event_type | 19 | 19 | 0.874 | [0.609, 1.000] |
| C | C.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | event_type | 19 | 19 | 0.815 | [0.482, 1.000] |
| C | C.v4 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | event_type | 20 | 20 | 0.871 | [0.614, 1.000] |
| C | C.v4 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | event_type | 19 | 19 | 0.800 | [0.481, 1.000] |
| C | C.v4 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | event_type | 19 | 19 | 0.800 | [0.481, 1.000] |
| C | C.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | subject | 19 | 19 | 0.687 | [0.414, 0.887] |
| C | C.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | subject | 19 | 19 | 0.731 | [0.431, 0.931] |
| C | C.v4 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | subject | 20 | 20 | 0.632 | [0.392, 0.844] |
| C | C.v4 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | subject | 19 | 19 | 0.737 | [0.485, 0.897] |
| C | C.v4 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | subject | 19 | 19 | 0.692 | [0.440, 0.885] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | cells.dashcam.[A] | 8 | 8 | 1.000 | [1.000, 1.000] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | cells.dashcam.[A] | 8 | 8 | 1.000 | [1.000, 1.000] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | cells.dashcam.[A] | 9 | 9 | 1.000 | [1.000, 1.000] |
| E | E.v6 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | cells.dashcam.[A] | 8 | 8 | 1.000 | [1.000, 1.000] |
| E | E.v6 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | cells.dashcam.[A] | 8 | 8 | 1.000 | [1.000, 1.000] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | cells.dashcam.[B] | 4 | 4 | n/a | [n/a, n/a] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | cells.dashcam.[B] | 4 | 4 | n/a | [n/a, n/a] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | cells.dashcam.[B] | 4 | 4 | n/a | [n/a, n/a] |
| E | E.v6 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | cells.dashcam.[B] | 4 | 4 | n/a | [n/a, n/a] |
| E | E.v6 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | cells.dashcam.[B] | 4 | 4 | n/a | [n/a, n/a] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | cells.type.[A] | 19 | 19 | 0.821 | [0.608, 0.960] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | cells.type.[A] | 19 | 19 | 0.810 | [0.597, 0.956] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | cells.type.[A] | 20 | 20 | 0.815 | [0.616, 0.958] |
| E | E.v6 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | cells.type.[A] | 19 | 19 | 0.833 | [0.636, 0.961] |
| E | E.v6 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | cells.type.[A] | 19 | 19 | 0.851 | [0.635, 1.000] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | cells.type.[B] | 17 | 17 | 0.858 | [0.679, 1.000] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | cells.type.[B] | 18 | 18 | 0.869 | [0.701, 1.000] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | cells.type.[B] | 17 | 17 | 0.916 | [0.784, 1.000] |
| E | E.v6 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | cells.type.[B] | 17 | 17 | 0.873 | [0.710, 1.000] |
| E | E.v6 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | cells.type.[B] | 17 | 17 | 0.899 | [0.750, 1.000] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | cells.vehicle_color.[A] | 14 | 14 | 0.768 | [0.519, 0.949] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | cells.vehicle_color.[A] | 14 | 14 | 0.737 | [0.517, 0.893] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | cells.vehicle_color.[A] | 14 | 14 | 0.718 | [0.461, 0.895] |
| E | E.v6 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | cells.vehicle_color.[A] | 14 | 14 | 0.765 | [0.517, 0.940] |
| E | E.v6 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | cells.vehicle_color.[A] | 14 | 14 | 0.755 | [0.547, 0.900] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | cells.vehicle_color.[B] | 16 | 16 | 0.568 | [0.367, 0.746] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | cells.vehicle_color.[B] | 17 | 17 | 0.474 | [0.263, 0.658] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | cells.vehicle_color.[B] | 16 | 16 | 0.538 | [0.341, 0.696] |
| E | E.v6 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | cells.vehicle_color.[B] | 16 | 16 | 0.522 | [0.311, 0.700] |
| E | E.v6 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | cells.vehicle_color.[B] | 16 | 16 | 0.515 | [0.325, 0.686] |
| N | verdict | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | verdict | 19 | 19 | n/a | [n/a, n/a] |
| N | verdict | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | verdict | 19 | 19 | n/a | [n/a, n/a] |
| N | verdict | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | verdict | 20 | 20 | n/a | [n/a, n/a] |
| N | verdict | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | verdict | 19 | 19 | n/a | [n/a, n/a] |
| N | verdict | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | verdict | 19 | 19 | n/a | [n/a, n/a] |
| O | O.v2 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | level | 19 | 19 | 0.623 | [0.398, 0.786] |
| O | O.v2 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | level | 19 | 19 | 0.552 | [0.326, 0.717] |
| O | O.v2 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | level | 20 | 20 | 0.615 | [0.427, 0.751] |
| O | O.v2 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | level | 19 | 19 | 0.660 | [0.475, 0.825] |
| O | O.v2 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | level | 19 | 19 | 0.634 | [0.424, 0.814] |
| Prev | Prev.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | parties.main_action.[A] | 5 | 5 | 0.583 | [0.162, 0.855] |
| Prev | Prev.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | parties.main_action.[A] | 5 | 5 | 0.583 | [0.162, 0.855] |
| Prev | Prev.v4 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | parties.main_action.[A] | 5 | 5 | 0.586 | [0.148, 0.855] |
| Prev | Prev.v4 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | parties.main_action.[A] | 5 | 5 | 0.667 | [0.208, 1.000] |
| Prev | Prev.v4 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | parties.main_action.[A] | 5 | 5 | 0.586 | [0.148, 0.855] |
| Prev | Prev.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | parties.main_action.[B] | 6 | 6 | 0.716 | [-0.045, 1.000] |
| Prev | Prev.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | parties.main_action.[B] | 7 | 7 | 0.727 | [-0.038, 1.000] |
| Prev | Prev.v4 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | parties.main_action.[B] | 6 | 6 | 0.844 | [0.596, 1.000] |
| Prev | Prev.v4 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | parties.main_action.[B] | 7 | 7 | 0.602 | [0.100, 0.881] |
| Prev | Prev.v4 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | parties.main_action.[B] | 7 | 7 | 0.715 | [0.100, 1.000] |
| R | R.v2 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | bystanders | 11 | 11 | 0.467 | [-0.049, 0.776] |
| R | R.v2 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | bystanders | 11 | 11 | 0.253 | [-0.075, 0.467] |
| R | R.v2 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | bystanders | 11 | 11 | 0.469 | [0.044, 0.789] |
| R | R.v2 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | bystanders | 12 | 12 | 0.316 | [0.069, 0.505] |
| R | R.v2 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | bystanders | 12 | 12 | 0.272 | [0.021, 0.450] |
| R | R.v2 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | has_aftermath | 19 | 19 | 0.554 | [0.219, 0.800] |
| R | R.v2 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | has_aftermath | 19 | 19 | 0.608 | [0.129, 0.874] |
| R | R.v2 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | has_aftermath | 20 | 20 | 0.511 | [0.174, 0.760] |
| R | R.v2 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | has_aftermath | 19 | 19 | 0.583 | [0.120, 0.856] |
| R | R.v2 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | has_aftermath | 19 | 19 | 0.608 | [0.295, 0.848] |
| R | R.v2 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | subject | 11 | 11 | 0.499 | [0.200, 0.734] |
| R | R.v2 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | subject | 11 | 11 | 0.534 | [0.260, 0.755] |
| R | R.v2 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | subject | 11 | 11 | 0.473 | [0.168, 0.738] |
| R | R.v2 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | subject | 12 | 12 | 0.532 | [0.286, 0.739] |
| R | R.v2 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | subject | 12 | 12 | 0.385 | [0.141, 0.596] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | density | 19 | 19 | 0.132 | [-0.089, 0.365] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | density | 19 | 19 | 0.262 | [-0.002, 0.525] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | density | 20 | 20 | 0.209 | [0.003, 0.427] |
| S | S.v3 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | density | 19 | 19 | 0.221 | [0.014, 0.418] |
| S | S.v3 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | density | 19 | 19 | 0.192 | [-0.051, 0.435] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | light | 19 | 19 | 0.926 | [0.650, 1.000] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | light | 19 | 19 | 0.926 | [0.650, 1.000] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | light | 20 | 20 | 0.927 | [0.650, 1.000] |
| S | S.v3 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | light | 19 | 19 | 0.926 | [0.650, 1.000] |
| S | S.v3 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | light | 19 | 19 | 1.000 | [1.000, 1.000] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | road_type | 19 | 19 | 0.530 | [0.313, 0.712] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | road_type | 19 | 19 | 0.537 | [0.319, 0.718] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | road_type | 20 | 20 | 0.558 | [0.323, 0.770] |
| S | S.v3 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | road_type | 19 | 19 | 0.554 | [0.345, 0.734] |
| S | S.v3 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | road_type | 19 | 19 | 0.671 | [0.438, 0.864] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | segment | 19 | 19 | 0.283 | [0.104, 0.415] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | segment | 19 | 19 | 0.371 | [0.165, 0.543] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | segment | 20 | 20 | 0.355 | [0.153, 0.540] |
| S | S.v3 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | segment | 19 | 19 | 0.439 | [0.218, 0.585] |
| S | S.v3 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | segment | 19 | 19 | 0.444 | [0.248, 0.574] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | surface | 19 | 19 | 0.400 | [-0.065, 0.676] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | surface | 19 | 19 | 0.484 | [-0.057, 0.750] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | surface | 20 | 20 | 0.488 | [-0.039, 0.771] |
| S | S.v3 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | surface | 19 | 19 | 0.400 | [-0.065, 0.676] |
| S | S.v3 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | surface | 19 | 19 | 0.773 | [0.609, 1.000] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | surface_material | 19 | 19 | 0.068 | [-0.042, 0.147] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | surface_material | 19 | 19 | 0.068 | [-0.042, 0.147] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | surface_material | 20 | 20 | 0.042 | [-0.053, 0.132] |
| S | S.v3 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | surface_material | 19 | 19 | -0.042 | [-0.103, 0.000] |
| S | S.v3 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | surface_material | 19 | 19 | -0.007 | [-0.045, 0.000] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | weather | 19 | 19 | 0.479 | [0.243, 0.644] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | weather | 19 | 19 | 0.454 | [0.213, 0.629] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | weather | 20 | 20 | 0.509 | [0.247, 0.697] |
| S | S.v3 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | weather | 19 | 19 | 0.490 | [0.246, 0.653] |
| S | S.v3 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | weather | 19 | 19 | 0.821 | [0.615, 1.000] |

## Cách 2: alpha trên toàn bộ nhãn của nhóm

Mỗi câu trả lời cấu trúc được giữ nguyên thành một nhãn danh nghĩa; áp dụng quy tắc ô optional và điều kiện codebook. Mỗi dòng là một tổ hợp 4 annotator.

| Nhóm | Codebook | Tổ hợp 4 người | Đơn vị | Video | Alpha | CI 95% |
|---|---|---|---:|---:|---:|---:|
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | 19 | 19 | 0.132 | [0.050, 0.186] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | 19 | 19 | 0.191 | [0.099, 0.251] |
| S | S.v3 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | 20 | 20 | 0.193 | [0.111, 0.247] |
| S | S.v3 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | 0.180 | [0.089, 0.238] |
| S | S.v3 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | 0.276 | [0.151, 0.368] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | 19 | 19 | 0.602 | [0.445, 0.735] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | 19 | 19 | 0.558 | [0.416, 0.692] |
| E | E.v6 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | 20 | 20 | 0.538 | [0.392, 0.658] |
| E | E.v6 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | 0.566 | [0.417, 0.700] |
| E | E.v6 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | 0.549 | [0.413, 0.674] |
| C | C.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | 19 | 19 | 0.254 | [0.162, 0.313] |
| C | C.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | 19 | 19 | 0.263 | [0.157, 0.322] |
| C | C.v4 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | 20 | 20 | 0.250 | [0.152, 0.316] |
| C | C.v4 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | 0.324 | [0.186, 0.444] |
| C | C.v4 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | 0.307 | [0.196, 0.392] |
| O | O.v2 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | 19 | 19 | 0.551 | [0.360, 0.690] |
| O | O.v2 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | 19 | 19 | 0.460 | [0.280, 0.610] |
| O | O.v2 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | 20 | 20 | 0.541 | [0.380, 0.674] |
| O | O.v2 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | 0.533 | [0.331, 0.713] |
| O | O.v2 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | 0.486 | [0.296, 0.656] |
| R | R.v2 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | 19 | 19 | 0.397 | [0.227, 0.542] |
| R | R.v2 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | 19 | 19 | 0.376 | [0.192, 0.524] |
| R | R.v2 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | 20 | 20 | 0.382 | [0.235, 0.516] |
| R | R.v2 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | 0.377 | [0.218, 0.513] |
| R | R.v2 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | 0.317 | [0.162, 0.449] |
| Attr | Attr.v1 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | 19 | 19 | 0.509 | [0.254, 0.747] |
| Attr | Attr.v1 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | 19 | 19 | 0.529 | [0.267, 0.778] |
| Attr | Attr.v1 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | 20 | 20 | 0.470 | [0.251, 0.691] |
| Attr | Attr.v1 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | 0.554 | [0.335, 0.760] |
| Attr | Attr.v1 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | 0.488 | [0.251, 0.716] |
| Prev | Prev.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | 19 | 19 | 0.496 | [0.296, 0.661] |
| Prev | Prev.v4 | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | 19 | 19 | 0.545 | [0.355, 0.711] |
| Prev | Prev.v4 | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | 20 | 20 | 0.520 | [0.333, 0.683] |
| Prev | Prev.v4 | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | 0.556 | [0.352, 0.733] |
| Prev | Prev.v4 | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | 0.552 | [0.361, 0.721] |
| N | verdict | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Tuấn Hùng | 19 | 19 | n/a | [n/a, n/a] |
| N | verdict | Huỳnh Trung, Nhật Trường, Tuyết Hạnh, Đức Mạnh | 19 | 19 | n/a | [n/a, n/a] |
| N | verdict | Huỳnh Trung, Nhật Trường, Tuấn Hùng, Đức Mạnh | 20 | 20 | n/a | [n/a, n/a] |
| N | verdict | Huỳnh Trung, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | n/a | [n/a, n/a] |
| N | verdict | Nhật Trường, Tuyết Hạnh, Tuấn Hùng, Đức Mạnh | 19 | 19 | n/a | [n/a, n/a] |

## Diễn giải dữ liệu

Mỗi tổ hợp gồm bốn trong số năm annotator của file; tổ hợp chỉ tính một video khi có đủ cả bốn câu trả lời. Vì vậy số video trên mỗi dòng thể hiện mức bao phủ đầy đủ của tổ hợp đó.
Alpha không xác định khi không có bất đồng kỳ vọng (mọi đơn vị chỉ có cùng một nhãn). Cận CI không xác định khi có dưới 3 video.
