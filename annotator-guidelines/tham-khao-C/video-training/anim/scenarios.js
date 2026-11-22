/*
 * Scenario library: one animated situation per conflict code plus the variants
 * the narration contrasts them with. Each entry is a factory because
 * Engine.prepare() mutates the object (it resolves impacts by simulation).
 *
 * Impact times are NOT hand-written: prepare() finds the first overlap of the
 * vehicles' footprints, so geometry and timing stay consistent. check.js prints
 * every event so a change here can be verified before rendering.
 */
(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./engine.js") : root.Engine);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Scenarios = api;
})(typeof self !== "undefined" ? self : this, function (E) {
  "use strict";
  const { route } = E;
  const A_COL = "#f59e2e";
  const B_COL = "#3d8bfd";
  const NEUTRAL = "#8d99a6";

  const straight = (extra = {}) => Object.assign({ type: "straight", center: "double" }, extra);
  const cross = (extra = {}) => Object.assign({ type: "cross" }, extra);

  // Typical life on the other side of a straight road.
  const southFlow = (phase = 0) => [
    { lane: "S1", kinds: ["car", "moto", "moto", "car", "moto"], n: 5, v: 8, phase },
    { lane: "S2", kinds: ["moto", "moto", "moto", "car", "moto", "moto"], n: 7, v: 6.5, phase: phase + 9 },
  ];

  const S = {};

  // ---------------------------------------------------------------- K01–K03
  S.K01 = () => ({
    code: "K01", tag: "B đã đứng yên từ đầu", layout: straight(), graph: "B", seed: 11,
    actors: [
      { id: "B", label: "B", focal: true, kind: "car", color: B_COL, lane: "N2", at: -8, speed: [[0, 0]], brakeHold: true },
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, lane: "N2", at: 41.4, speed: [[0, 9]] },
    ],
    bg: [...southFlow(), { lane: "N1", kinds: ["moto", "moto", "car", "moto"], n: 5, v: 6.5, phase: 12 }],
  });

  S.K02 = () => ({
    code: "K02", tag: "B đang chạy rồi phanh, giảm tốc", layout: straight(), graph: "B", seed: 12, tAction: 2.6,
    actors: [
      { id: "B", label: "B", focal: true, kind: "car", color: B_COL, lane: "N2", at: 14, speed: [[0, 7], [2.6, 7], [4.0, 0]], brakeHold: true },
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, lane: "N2", at: 34.9, speed: [[0, 9]] },
    ],
    bg: [...southFlow(5), { lane: "N1", kinds: ["moto", "car", "moto", "moto"], n: 5, v: 6.5, phase: 3 }],
  });

  S.K02_near = () => Object.assign(S.K02(), {
    chip: "SUÝT VA CHẠM", tag: "A kịp phanh, không chạm", near: ["A", "B"], graph: "A",
    actors: [
      { id: "B", label: "B", focal: true, kind: "car", color: B_COL, lane: "N2", at: 14, speed: [[0, 7], [2.6, 7], [4.0, 0]], brakeHold: true },
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, lane: "N2", at: 34.9, speed: [[0, 9], [3.7, 9], [4.7, 0]], brakeHold: true, skid: [3.75, 4.7] },
    ],
  });

  S.K03 = () => ({
    code: "K03", tag: "B vẫn lăn bánh chậm, không phanh", layout: straight(), graph: "B", seed: 13,
    actors: [
      { id: "B", label: "B", focal: true, kind: "car", color: B_COL, lane: "N2", at: 4, speed: [[0, 2.5]] },
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, lane: "N2", at: 40.9, speed: [[0, 9]] },
    ],
    bg: [...southFlow(11), { lane: "N1", kinds: ["moto", "moto", "car"], n: 5, v: 6, phase: 20 }],
  });

  // Chain collision used by F03: only the first pair is coded.
  S.CHAIN = () => ({
    code: "F03", chip: "CẶP CHÍNH", tag: "Chỉ ghi cặp của sự kiện đầu tiên", layout: straight(), seed: 31,
    actors: [
      { id: "B", label: "B", focal: true, kind: "car", color: B_COL, lane: "N2", at: -8, speed: [[0, 0]], brakeHold: true, role: "cặp chính" },
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, lane: "N2", at: 41.4, speed: [[0, 9]], role: "cặp chính" },
      { id: "C", label: "C", focal: true, kind: "car", color: NEUTRAL, lane: "N2", at: 50.4, speed: [[0, 9]], role: "dây chuyền: bỏ qua" },
    ],
    bg: southFlow(2),
  });

  // ---------------------------------------------------------------- K04–K06
  S.K04 = () => ({
    code: "K04", tag: "A dịch sang làn bên cạnh (xi-nhan phải)", layout: straight(), seed: 14, tAction: 2.2,
    actors: [
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, path: route(1.7, 17).to(1.7, 6).c(1.7, 1, 5.1, 1, 5.1, -4).to(5.1, -80).done(), speed: [[0, 5]], signal: [[1.0, 5, "R"]] },
      { id: "B", label: "B", focal: true, kind: "moto", color: B_COL, lane: "N2", at: 36, speed: [[0, 9]] },
    ],
    bg: southFlow(4),
  });

  S.K05 = () => ({
    code: "K05", tag: "A luồn giữa hai xe, vượt lên rồi tạt đầu B", layout: straight(), seed: 15, tAction: 1.0,
    actors: [
      { id: "A", label: "A", focal: true, kind: "moto", color: A_COL, path: route(5.1, 24).to(5.1, 18).c(5.1, 14, 3.4, 14, 3.4, 10).to(3.4, -1).c(3.4, -4, 5.1, -4, 5.1, -7).to(5.1, -80).done(), speed: [[0, 10]] },
      { id: "B", label: "B", focal: true, kind: "car", color: B_COL, lane: "N2", at: 8, speed: [[0, 4], [2.6, 4], [3.3, 1]], brakeHold: true },
      { id: "C", kind: "car", solid: true, color: "#e8e4da", lane: "N1", at: 6, speed: [[0, 4]] },
    ],
    bg: southFlow(8),
  });

  S.K06 = () => ({
    code: "K06", tag: "A rẽ phải, cắt qua B đi thẳng cùng chiều", layout: cross(), seed: 16, cam: { x: 0, y: 2 }, tAction: 1.9,
    actors: [
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, path: route(1.7, 22).to(1.7, 11).q(1.7, 5.1, 12, 5.1).to(80, 5.1).done(), speed: [[0, 6], [1.8, 4.2]], signal: [[0, 8, "R"]] },
      { id: "B", label: "B", focal: true, kind: "moto", color: B_COL, lane: "N2", at: 32.9, speed: [[0, 8]] },
    ],
    bg: [{ lane: "S1", kinds: ["moto", "car", "moto"], n: 4, v: 7 }, { lane: "S2", kinds: ["moto", "moto"], n: 5, v: 6, phase: 11 }],
    parked: queues(["W", "E"]),
  });

  // ---------------------------------------------------------------- K07
  S.K07 = () => ({
    code: "K07", tag: "A đang đỗ sát lề, mở cửa ra làn xe chạy", layout: straight(), seed: 17, tAction: 3.0,
    actors: [
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, static: true, x: 5.65, y: -3, heading: 0, door: { t: 3.0 }, parkedCar: true },
      { id: "B", label: "B", focal: true, kind: "moto", color: B_COL, path: route(3.9, 25.45).to(3.9, -80).done(), speed: [[0, 8]] },
    ],
    parked: [
      { kind: "car", x: 5.65, y: -11, heading: 0, color: "#c9ced4" },
      { kind: "car", x: 5.65, y: 6.5, heading: 0, color: "#2a2e35" },
      { kind: "car", x: 5.65, y: 13, heading: 0, color: "#e8e4da" },
    ],
    bg: [...southFlow(6), { lane: "N1", kinds: ["moto", "car", "moto"], n: 5, v: 6.5, phase: 30 }],
  });

  // ---------------------------------------------------------------- K08–K09
  S.K08 = () => ({
    code: "K08", tag: "A rời làn mình, vượt vạch giữa sang làn ngược chiều", layout: straight(), seed: 18, tAction: 2.0,
    actors: [
      { id: "T", kind: "truck", solid: true, color: "#6d7f8f", lane: "N1", at: 4, speed: [[0, 4]] },
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, path: route(1.7, 18).to(1.7, 6).c(1.7, 2, -1.7, 2, -1.7, -2).to(-1.7, -80).done(), speed: [[0, 6]], signal: [[0.6, 3.2, "L"]] },
      { id: "B", label: "B", focal: true, kind: "car", color: B_COL, lane: "S1", at: -46.6, speed: [[0, 8]] },
    ],
    marks: [{ type: "line", from: [0, 9], to: [0, -5], label: "VẠCH GIỮA ĐƯỜNG", t0: 1.6, t1: 4.0 }],
    bg: [{ lane: "N2", kinds: ["moto", "moto", "car"], n: 5, v: 5, phase: 40 }, { lane: "S2", kinds: ["moto", "moto", "car", "moto"], n: 6, v: 6.5 }],
  });

  S.K09 = () => ({
    code: "K09", tag: "A đi ngược chiều trên làn của B ngay từ khung đầu", layout: straight(), seed: 19,
    actors: [
      { id: "A", label: "A", focal: true, kind: "moto", color: A_COL, path: route(5.6, -30).to(5.6, 80).done(), speed: [[0, 6]] },
      { id: "B", label: "B", focal: true, kind: "car", color: B_COL, lane: "N2", at: 30, speed: [[0, 8]] },
    ],
    marks: [{ type: "tag", actor: "A", text: "ngược chiều từ đầu" }],
    bg: [...southFlow(3), { lane: "N1", kinds: ["moto", "car", "moto", "moto"], n: 5, v: 7, phase: 8 }],
  });

  // ---------------------------------------------------------------- K10
  S.K10 = () => ({
    code: "K10", tag: "A rẽ trái tại nút giao, cắt đầu B đang ngược chiều", layout: cross(), seed: 20, cam: { x: 0, y: 0 },
    actors: [
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, path: route(1.7, 24).to(1.7, 8).q(1.7, -1.7, -10, -1.7).to(-80, -1.7).done(), speed: [[0, 6], [2.4, 4.5]], signal: [[0, 9, "L"]] },
      { id: "B", label: "B", focal: true, kind: "moto", color: B_COL, lane: "S1", at: -45.4, speed: [[0, 9]] },
    ],
    bg: [{ lane: "N2", kinds: ["moto", "moto", "car"], n: 5, v: 6 }],
    parked: queues(["W", "E"]),
  });

  S.F01 = () => {
    const sc = S.K10();
    sc.code = "F01"; sc.chip = "CHỦ THỂ / ĐỐI TƯỢNG"; sc.tag = "Ai đổi chuyển động trước? Ai bị chạm đầu tiên?";
    sc.actors[0].role = "chủ thể"; sc.actors[1].role = "đối tượng";
    sc.actors.push({ id: "C", label: "C", focal: true, kind: "car", color: NEUTRAL, static: true, x: -13, y: 5.1, heading: 90, brakeHold: true, role: "chỉ đứng gần: không ghi" });
    sc.parked = queues(["E"]);
    return sc;
  };

  S.K10U = () => ({
    code: "K10", tag: "A quay đầu, cắt đầu B đang đi NGƯỢC chiều", layout: straight({ center: "dashed" }), seed: 21,
    actors: [
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, path: route(1.7, 14).to(1.7, 2).c(1.7, -6, -5.1, -6, -5.1, 2).to(-5.1, 80).done(), speed: [[0, 5], [1.8, 3.5]], signal: [[0, 9, "L"]] },
      { id: "B", label: "B", focal: true, kind: "car", color: B_COL, lane: "S1", at: -36, speed: [[0, 8]] },
    ],
    bg: [{ lane: "N2", kinds: ["moto", "moto", "car"], n: 5, v: 6 }],
  });

  // ---------------------------------------------------------------- K11–K14
  S.K11 = () => ({
    code: "K11", tag: "Hai đường cắt nhau; A và B đều đi thẳng", layout: cross(), seed: 22, cam: { x: 0, y: 0 },
    actors: [
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, lane: "E1", at: -33, speed: [[0, 8]] },
      { id: "B", label: "B", focal: true, kind: "moto", color: B_COL, lane: "N2", at: 40, speed: [[0, 8]] },
    ],
    marks: [{ type: "zone", rect: [-6.8, -6.8, 6.8, 6.8], label: "NÚT GIAO" }],
    parked: queues(["E", "N"]),
  });

  S.K12 = () => ({
    code: "K12", tag: "A đi ra từ miệng hẻm, nhập vào đường chính", layout: straight({ alley: { side: "R", y: -2, w: 4.6 } }), seed: 23, tAction: 1.6,
    actors: [
      { id: "A", label: "A", focal: true, kind: "moto", color: A_COL, path: route(17, -2.6).to(9, -2.6).q(5.1, -2.6, 5.1, -8).to(5.1, -80).done(), speed: [[0, 3.5], [2.0, 3], [3.5, 5]] },
      { id: "B", label: "B", focal: true, kind: "car", color: B_COL, lane: "N2", at: 22.5, speed: [[0, 8]] },
    ],
    marks: [{ type: "zone", rect: [6.8, -4.3, 12.5, 0.3], label: "MIỆNG HẺM" }],
    bg: [...southFlow(14), { lane: "N1", kinds: ["moto", "moto", "car"], n: 5, v: 6.5, phase: 25 }],
  });

  S.K13 = () => ({
    code: "K13", tag: "A quay đầu giữa đoạn; B đi CÙNG chiều phía sau", layout: straight({ center: "dashed" }), seed: 24,
    actors: [
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, path: route(5.1, 14).to(5.1, 2).c(5.1, -7, -5.1, -7, -5.1, 2).to(-5.1, 80).done(), speed: [[0, 5], [1.8, 3.5]], signal: [[0, 9, "L"]] },
      { id: "B", label: "B", focal: true, kind: "car", color: B_COL, lane: "N1", at: 33.4, speed: [[0, 8]] },
    ],
    bg: [{ lane: "S1", kinds: ["moto", "car"], n: 2, v: 7, phase: 70 }],
  });

  S.K14 = () => ({
    code: "K14", tag: "A băng ngang giữa đoạn, không có nút giao hay hẻm", layout: straight(), seed: 25, tAction: 0.5,
    actors: [
      { id: "A", label: "A", focal: true, kind: "moto", color: A_COL, path: route(-10, -1).to(12, -3.4).done(), speed: [[0, 3.2]] },
      { id: "B", label: "B", focal: true, kind: "car", color: B_COL, lane: "N2", at: 37.7, speed: [[0, 8]] },
    ],
    marks: [{ type: "zone", rect: [-10.8, -9, 10.8, 5], label: "GIỮA ĐOẠN: HAI BÊN LÀ NHÀ, KHÔNG CÓ ĐƯỜNG CẮT" }],
    bg: [{ lane: "S1", kinds: ["moto", "car", "moto"], n: 3, v: 8, phase: 30 }, { lane: "N1", kinds: ["moto", "moto", "car"], n: 5, v: 6.5, phase: 45 }],
  });

  // ---------------------------------------------------------------- K15–K16
  S.K15 = () => ({
    code: "K15", tag: "A là NGƯỜI ĐI BỘ băng qua lòng đường", layout: straight(), seed: 26, near: ["A", "B"], tAction: 0.3,
    actors: [
      { id: "A", label: "A", focal: true, kind: "ped", color: A_COL, hat: true, path: route(9, -5).to(-9, -6).done(), speed: [[0, 1.4]] },
      { id: "B", label: "B", focal: true, kind: "moto", color: B_COL, lane: "N2", at: 16.4, speed: [[0, 8], [1.9, 8], [2.9, 0]], brakeHold: true, skid: [1.95, 2.9] },
    ],
    bg: [{ lane: "S2", kinds: ["moto", "moto", "car"], n: 4, v: 6.5, phase: 70 }],
  });

  S.K16 = () => ({
    code: "K16", tag: "Con chó lao từ vỉa hè ra đường", layout: straight(), seed: 27, near: ["A", "B"], tAction: 3.0,
    actors: [
      { id: "A", label: "A", focal: true, kind: "dog", color: "#b07a3c", path: route(9.3, -6).to(-3, -7.2).done(), speed: [[0, 0], [3.0, 0], [3.35, 5.5], [4.5, 5.5], [4.9, 0]] },
      { id: "B", label: "B", focal: true, kind: "moto", color: B_COL, lane: "N2", at: 25.15, speed: [[0, 8], [3.15, 8], [4.05, 0]], brakeHold: true, skid: [3.2, 4.05], yaw: [[3.1, 0], [3.5, -9], [4.05, -4]] },
    ],
    bg: [...southFlow(17)],
  });

  S.K16_no = () => ({
    code: "K16?", chip: "KHÔNG GÁN K16", tag: "Chó chỉ đi dọc vỉa hè, không lao ra", layout: straight(), seed: 28, noConflict: true, near: ["A", "B"],
    actors: [
      { id: "A", label: "A", focal: true, kind: "dog", color: "#b07a3c", path: route(8.9, -14).to(8.9, 40).done(), speed: [[0, 1.1]] },
      { id: "B", label: "B", focal: true, kind: "moto", color: B_COL, lane: "N2", at: 25.15, speed: [[0, 8]] },
    ],
    bg: [...southFlow(17)],
  });

  // ---------------------------------------------------------------- K17–K18
  S.K17 = () => ({
    code: "K17", tag: "A lùi: đầu xe hướng lên nhưng xe đi xuống", layout: straight(), seed: 29, tAction: 2.0,
    actors: [
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, path: route(5.1, -4).to(5.1, 80).done(), reverse: true, speed: [[0, 0], [2.0, 0], [2.7, 2.2]], brakeHold: true },
      { id: "B", label: "B", focal: true, kind: "moto", color: B_COL, lane: "N2", at: 10, speed: [[0, 4], [1.2, 4], [2.2, 0]], brakeHold: true },
    ],
    marks: [{ type: "arrows", actor: "A", t0: 2.1 }],
    bg: [...southFlow(21), { lane: "N1", kinds: ["moto", "car", "moto"], n: 4, v: 6, phase: 4 }],
  });

  S.K18 = () => ({
    code: "K18", tag: "A tự trượt, văng khỏi làn; không xe nào tác động", layout: straight(), seed: 30, tAction: 2.0,
    actors: [
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, path: route(1.7, 30).to(1.7, 8).c(1.7, 2, 6.2, -2, 7.4, -8).to(8.6, -16).done(), speed: [[0, 10], [2.0, 10], [3.3, 6.5]], yaw: [[2.0, 0], [2.45, 16], [2.85, -9], [3.25, 30], [3.7, 55]], skid: [2.0, 6] },
      { id: "P", kind: "pole", solid: true, x: 7.5, y: -9.5 },
    ],
    bg: [...southFlow(9)],
  });

  S.K18X = () => ({
    code: "K04", chip: "KHÔNG PHẢI K18", tag: "B chuyển làn trước, A phanh rồi mới trượt", layout: straight(), seed: 32, near: ["A", "B"], tAction: 1.0,
    actors: [
      { id: "A", label: "A", focal: true, kind: "car", color: A_COL, lane: "N1", at: 22, speed: [[0, 10], [2.4, 10], [3.6, 2.5]], brakeHold: true, yaw: [[2.4, 0], [2.9, 13], [3.35, -8], [3.8, 0]], skid: [2.4, 3.8] },
      { id: "B", label: "B", focal: true, kind: "car", color: B_COL, path: route(5.1, 2).to(5.1, -4).c(5.1, -8, 1.7, -8, 1.7, -12).to(1.7, -80).done(), speed: [[0, 5]], signal: [[0, 3, "L"]] },
    ],
    bg: [...southFlow(9)],
  });

  // Waiting queues at a red light on the named approaches of a cross layout.
  function queues(sides) {
    const out = [];
    const cols = ["#eef0f2", "#2a2e35", "#c9ced4", "#8c2230", "#24426b"];
    let k = 0;
    for (const side of sides) {
      for (let i = 0; i < 3; i++) {
        const d = 12.5 + i * 5.6;
        const pick = (kind) => ({ kind, color: cols[k++ % cols.length] });
        if (side === "W") out.push(Object.assign(pick(i === 1 ? "moto" : "car"), { x: -d, y: 1.7, heading: 90 }), Object.assign(pick("moto"), { x: -d + 1, y: 5.0, heading: 90 }));
        if (side === "E") out.push(Object.assign(pick(i === 1 ? "moto" : "car"), { x: d, y: -1.7, heading: -90 }), Object.assign(pick("moto"), { x: d - 1, y: -5.0, heading: -90 }));
        if (side === "S") out.push(Object.assign(pick(i === 2 ? "moto" : "car"), { x: 1.7, y: d, heading: 0 }));
        if (side === "N") out.push(Object.assign(pick("car"), { x: -1.7, y: -d, heading: 180 }));
      }
    }
    return out.map((p) => Object.assign(p, { brake: true }));
  }

  function get(id) {
    if (!S[id]) throw new Error("Unknown scenario " + id);
    const sc = S[id]();
    sc.id = id;
    return E.prepare(sc);
  }

  return { get, ids: Object.keys(S) };
});
