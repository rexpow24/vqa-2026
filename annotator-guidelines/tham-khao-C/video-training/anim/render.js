/*
 * Canvas renderer + clip composer. Studio.setup(payload) builds the shot list
 * from the per-sentence narration timing; Studio.frame(t) draws one 1920x1080
 * frame at clip time t and returns it as a JPEG data URL.
 */
(function () {
  "use strict";
  const E = window.Engine;
  const Sc = window.Scenarios;
  const { DEG, LANE, HALF_ROAD, clamp, lerp, ease } = E;
  const W = 1920, H = 1080;
  const FONT = '"Segoe UI", "Be Vietnam Pro", Arial, sans-serif';
  const C = {
    bg: "#08121d", panel: "#0f1c2b", panelEdge: "#22384d", text: "#eef3f8", muted: "#9fb3c7",
    blue: "#3d8bfd", orange: "#f59e2e", red: "#ff5468", green: "#33d08b", yellow: "#ffd24a", chip: "#1d6fd8",
  };

  // ============================================================ background
  const RES = 26, BX0 = -48, BY0 = -36, BW = 96, BH = 72;
  const bgCache = new Map();

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  }

  function background(layout, seed) {
    const key = JSON.stringify(layout) + "#" + seed;
    if (bgCache.has(key)) return bgCache.get(key);
    const cv = document.createElement("canvas");
    cv.width = BW * RES; cv.height = BH * RES;
    const g = cv.getContext("2d");
    g.scale(RES, RES);
    g.translate(-BX0, -BY0);
    const R = E.rng(seed * 7919 + 17);
    g.fillStyle = "#24282a";
    g.fillRect(BX0, BY0, BW, BH);
    if (layout.type === "cross") drawCross(g, layout, R); else drawStraight(g, layout, R);
    bgCache.set(key, cv);
    return cv;
  }

  const ROOF = ["#8b5a44", "#9c6a52", "#7b838c", "#98a1a9", "#5d7686", "#b6ad9f", "#6c5c50", "#c4bcae", "#4d6a77", "#a35d3f", "#7f7466"];
  const AWNING = ["#c0392b", "#2c7fb8", "#27ae60", "#e67e22", "#8e44ad", "#d4ac0d", "#16a085"];

  function house(g, R, x0, y0, x1, y1, facing) {
    // x0..x1 / y0..y1 is the roof footprint; `facing` is the side toward the street.
    const color = ROOF[Math.floor(R() * ROOF.length)];
    g.fillStyle = color;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const metal = R() < 0.35;
    if (metal) {
      g.strokeStyle = "rgba(255,255,255,0.10)";
      g.lineWidth = 0.08;
      const horiz = facing === "N" || facing === "S";
      for (let k = 0; k < 40; k++) {
        g.beginPath();
        if (horiz) { const x = x0 + k * 0.45; if (x > x1) break; g.moveTo(x, y0); g.lineTo(x, y1); }
        else { const y = y0 + k * 0.45; if (y > y1) break; g.moveTo(x0, y); g.lineTo(x1, y); }
        g.stroke();
      }
    }
    // parapet + shading
    g.strokeStyle = "rgba(0,0,0,0.35)";
    g.lineWidth = 0.18;
    g.strokeRect(x0 + 0.09, y0 + 0.09, x1 - x0 - 0.18, y1 - y0 - 0.18);
    g.strokeStyle = "rgba(255,255,255,0.12)";
    g.lineWidth = 0.08;
    g.strokeRect(x0 + 0.25, y0 + 0.25, x1 - x0 - 0.5, y1 - y0 - 0.5);
    // rooftop water tank (inox or blue plastic), AC units, stairwell
    const cx = lerp(x0, x1, 0.3 + R() * 0.4), cy = lerp(y0, y1, 0.3 + R() * 0.4);
    if (R() < 0.75) {
      const blue = R() < 0.35;
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.beginPath(); g.arc(cx + 0.2, cy + 0.25, 0.62, 0, 6.3); g.fill();
      const gr = g.createRadialGradient(cx - 0.2, cy - 0.2, 0.05, cx, cy, 0.62);
      gr.addColorStop(0, blue ? "#7fb2e6" : "#f4f6f8");
      gr.addColorStop(1, blue ? "#2a5f9a" : "#9aa4ad");
      g.fillStyle = gr;
      g.beginPath(); g.arc(cx, cy, 0.6, 0, 6.3); g.fill();
    }
    if (R() < 0.6) {
      g.fillStyle = "#dfe3e6";
      const ax = lerp(x0, x1, R() * 0.6 + 0.2), ay = lerp(y0, y1, R() * 0.6 + 0.2);
      g.fillRect(ax, ay, 0.8, 0.5);
      g.fillStyle = "#9aa1a7";
      g.beginPath(); g.arc(ax + 0.4, ay + 0.25, 0.17, 0, 6.3); g.fill();
    }
    if (R() < 0.4) {
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.fillRect(lerp(x0, x1, 0.55), lerp(y0, y1, 0.55), 1.3, 1.5);
    }
  }

  // Row of narrow tube houses along a vertical frontage. side: +1 (east) / -1 (west)
  function houseRowV(g, R, side, inner, yFrom, yTo, gaps = []) {
    let y = yFrom;
    while (y < yTo) {
      const w = 3.6 + R() * 2.8;
      const y1 = Math.min(y + w, yTo);
      const blocked = gaps.some(([a, b]) => y1 > a && y < b);
      if (!blocked) {
        const depth = 11 + R() * 9;
        const xa = side > 0 ? inner : -inner - depth, xb = side > 0 ? inner + depth : -inner;
        house(g, R, xa, y, xb, y1, side > 0 ? "W" : "E");
        // awning over the sidewalk (shopfront)
        if (R() < 0.7) {
          const col = AWNING[Math.floor(R() * AWNING.length)];
          const d = 0.9 + R() * 0.6;
          const ax = side > 0 ? inner - d : -inner;
          g.fillStyle = col;
          g.globalAlpha = 0.85;
          g.fillRect(ax, y + 0.15, d, y1 - y - 0.3);
          g.globalAlpha = 0.25;
          g.fillStyle = "#fff";
          for (let k = 0; y + 0.15 + k * 0.6 < y1 - 0.15; k += 2) g.fillRect(ax, y + 0.15 + k * 0.6, d, 0.3);
          g.globalAlpha = 1;
        }
      }
      y = y1 + 0.05;
    }
  }

  function houseRowH(g, R, side, inner, xFrom, xTo, gaps = []) {
    let x = xFrom;
    while (x < xTo) {
      const w = 3.6 + R() * 2.8;
      const x1 = Math.min(x + w, xTo);
      const blocked = gaps.some(([a, b]) => x1 > a && x < b);
      if (!blocked) {
        const depth = 11 + R() * 9;
        const ya = side > 0 ? inner : -inner - depth, yb = side > 0 ? inner + depth : -inner;
        house(g, R, x, ya, x1, yb, side > 0 ? "N" : "S");
        if (R() < 0.7) {
          const col = AWNING[Math.floor(R() * AWNING.length)];
          const d = 0.9 + R() * 0.6;
          const ay = side > 0 ? inner - d : -inner;
          g.fillStyle = col; g.globalAlpha = 0.85;
          g.fillRect(x + 0.15, ay, x1 - x - 0.3, d);
          g.globalAlpha = 1;
        }
      }
      x = x1 + 0.05;
    }
  }

  function backRoofs(g, R, x0, y0, x1, y1) {
    for (let x = x0; x < x1; x += 6) for (let y = y0; y < y1; y += 5.5) {
      house(g, R, x, y, Math.min(x + 5.9, x1), Math.min(y + 5.4, y1), "N");
    }
  }

  function asphalt(g, R, x0, y0, x1, y1) {
    g.fillStyle = "#3a3d42";
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const area = (x1 - x0) * (y1 - y0);
    for (let i = 0; i < area * 2.2; i++) {
      const v = R();
      g.fillStyle = v < 0.5 ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.06)";
      g.fillRect(x0 + R() * (x1 - x0), y0 + R() * (y1 - y0), 0.05 + R() * 0.07, 0.05 + R() * 0.07);
    }
    for (let i = 0; i < area / 120; i++) {
      g.fillStyle = R() < 0.5 ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.035)";
      const w = 1.5 + R() * 4, h = 1 + R() * 3;
      g.fillRect(x0 + R() * (x1 - x0 - w), y0 + R() * (y1 - y0 - h), w, h);
    }
  }

  function wheelTracksV(g, xs, y0, y1) {
    g.fillStyle = "rgba(0,0,0,0.07)";
    for (const x of xs) { g.fillRect(x - 0.85, y0, 0.5, y1 - y0); g.fillRect(x + 0.35, y0, 0.5, y1 - y0); }
  }
  function wheelTracksH(g, ys, x0, x1) {
    g.fillStyle = "rgba(0,0,0,0.07)";
    for (const y of ys) { g.fillRect(x0, y - 0.85, x1 - x0, 0.5); g.fillRect(x0, y + 0.35, x1 - x0, 0.5); }
  }

  function dashV(g, x, y0, y1, dash, gap, width, color) {
    g.fillStyle = color;
    for (let y = y0; y < y1; y += dash + gap) g.fillRect(x - width / 2, y, width, Math.min(dash, y1 - y));
  }
  function dashH(g, y, x0, x1, dash, gap, width, color) {
    g.fillStyle = color;
    for (let x = x0; x < x1; x += dash + gap) g.fillRect(x, y - width / 2, Math.min(dash, x1 - x), width);
  }

  function sidewalk(g, R, x0, y0, x1, y1) {
    g.fillStyle = "#9a958b";
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.strokeStyle = "rgba(0,0,0,0.10)";
    g.lineWidth = 0.04;
    g.beginPath();
    for (let x = Math.ceil(x0 / 0.6) * 0.6; x < x1; x += 0.6) { g.moveTo(x, y0); g.lineTo(x, y1); }
    for (let y = Math.ceil(y0 / 0.6) * 0.6; y < y1; y += 0.6) { g.moveTo(x0, y); g.lineTo(x1, y); }
    g.stroke();
    for (let i = 0; i < ((x1 - x0) * (y1 - y0)) / 6; i++) {
      g.fillStyle = R() < 0.5 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)";
      g.fillRect(x0 + R() * (x1 - x0), y0 + R() * (y1 - y0), 0.6, 0.6);
    }
  }

  function tree(g, R, x, y, r) {
    g.fillStyle = "rgba(0,0,0,0.30)";
    g.beginPath(); g.arc(x + 0.35, y + 0.45, r, 0, 6.3); g.fill();
    for (let k = 0; k < 6; k++) {
      const a = R() * 6.28, d = R() * r * 0.45, rr2 = r * (0.45 + R() * 0.35);
      const gx = x + Math.cos(a) * d, gy = y + Math.sin(a) * d;
      const gr = g.createRadialGradient(gx - rr2 * 0.3, gy - rr2 * 0.3, rr2 * 0.1, gx, gy, rr2);
      gr.addColorStop(0, "#5fa55a"); gr.addColorStop(1, "#2c5f34");
      g.fillStyle = gr;
      g.beginPath(); g.arc(gx, gy, rr2, 0, 6.3); g.fill();
    }
  }

  function parkedMotos(g, R, x, y0, y1, side) {
    // rows of motorbikes parked perpendicular to the curb, a Vietnamese sidewalk staple
    for (let y = y0; y < y1; y += 0.85 + R() * 0.25) {
      if (R() < 0.15) continue;
      g.save();
      g.translate(x + (R() - 0.5) * 0.3, y);
      g.rotate((side > 0 ? 90 : -90) * DEG + (R() - 0.5) * 0.25);
      drawMotoBody(g, BG_MOTO[Math.floor(R() * BG_MOTO.length)], false, 1, 0);
      g.restore();
    }
  }
  const BG_MOTO = ["#1b1d22", "#a8141d", "#e6e6e6", "#21407c", "#3a3f46", "#6b6f75"];

  function drawStraight(g, L, R) {
    const inner = HALF_ROAD + E.SIDEWALK;
    const gaps = L.alley ? [[L.alley.y - L.alley.w / 2, L.alley.y + L.alley.w / 2]] : [];
    backRoofs(g, R, BX0, BY0, -inner - 16, BY0 + BH);
    backRoofs(g, R, inner + 16, BY0, BX0 + BW, BY0 + BH);
    houseRowV(g, R, -1, inner, BY0, BY0 + BH);
    houseRowV(g, R, 1, inner, BY0, BY0 + BH, L.alley && L.alley.side === "R" ? gaps : []);
    sidewalk(g, R, -inner, BY0, -HALF_ROAD, BY0 + BH);
    sidewalk(g, R, HALF_ROAD, BY0, inner, BY0 + BH);
    // building shadow on the sidewalk
    g.fillStyle = "rgba(0,0,0,0.16)";
    g.fillRect(inner - 0.9, BY0, 0.9, BH);
    g.fillRect(-inner, BY0, 0.6, BH);
    if (L.alley) {
      const { y, w } = L.alley;
      const ax0 = HALF_ROAD + 0.25;
      g.fillStyle = "#56585b";
      g.fillRect(ax0, y - w / 2, BX0 + BW - ax0, w);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = R() < 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.05)";
        g.fillRect(ax0 + R() * 30, y - w / 2 + R() * w, 0.08, 0.08);
      }
      g.fillStyle = "rgba(0,0,0,0.25)";
      g.fillRect(inner, y - w / 2, 30, 0.35);
      // alley sign
      g.fillStyle = "#1f5fae";
      g.fillRect(inner + 0.3, y - w / 2 - 1.3, 2.3, 0.9);
      g.fillStyle = "#fff";
      g.font = "bold 0.6px Segoe UI";
      g.fillText("HẺM 42", inner + 0.45, y - w / 2 - 0.62);
    }
    // curbs
    g.fillStyle = "#cdc7ba";
    g.fillRect(-HALF_ROAD - 0.25, BY0, 0.25, BH);
    g.fillRect(HALF_ROAD, BY0, 0.25, BH);
    if (L.alley) {
      g.fillStyle = "#7d7f80";
      g.fillRect(HALF_ROAD, L.alley.y - L.alley.w / 2, 0.25, L.alley.w);
    }
    asphalt(g, R, -HALF_ROAD, BY0, HALF_ROAD, BY0 + BH);
    wheelTracksV(g, [LANE.N1, LANE.N2, LANE.S1, LANE.S2], BY0, BY0 + BH);
    // markings
    if (L.center === "dashed") dashV(g, 0, BY0, BY0 + BH, 3, 3, 0.15, "rgba(238,238,230,0.9)");
    else { g.fillStyle = "#e5c24a"; g.fillRect(-0.27, BY0, 0.13, BH); g.fillRect(0.14, BY0, 0.13, BH); }
    dashV(g, 3.4, BY0, BY0 + BH, 3, 5, 0.13, "rgba(238,238,230,0.85)");
    dashV(g, -3.4, BY0, BY0 + BH, 3, 5, 0.13, "rgba(238,238,230,0.85)");
    // trees, poles, parked motorbikes
    for (const side of [-1, 1]) {
      for (let y = BY0 + 3 + R() * 4; y < BY0 + BH; y += 10 + R() * 5) {
        if (L.alley && side > 0 && Math.abs(y - L.alley.y) < L.alley.w / 2 + 1.6) continue;
        tree(g, R, side * 8.1, y, 1.25 + R() * 0.3);
      }
      for (let y = BY0 + 1; y < BY0 + BH; y += 7 + R() * 9) {
        const len = 2 + R() * 3.5;
        if (L.alley && side > 0 && y + len > L.alley.y - L.alley.w / 2 - 0.5 && y < L.alley.y + L.alley.w / 2 + 0.5) continue;
        parkedMotos(g, R, side * 9.6, y, y + len, side);
      }
    }
  }

  function drawCross(g, L, R) {
    const inner = HALF_ROAD + E.SIDEWALK;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const qx0 = sx > 0 ? inner : BX0, qx1 = sx > 0 ? BX0 + BW : -inner;
      const qy0 = sy > 0 ? inner : BY0, qy1 = sy > 0 ? BY0 + BH : -inner;
      backRoofs(g, R, qx0 + (sx > 0 ? 14 : 0), qy0 + (sy > 0 ? 14 : 0), qx1 - (sx < 0 ? 14 : 0), qy1 - (sy < 0 ? 14 : 0));
    }
    for (const side of [-1, 1]) {
      houseRowV(g, R, side, inner, BY0, -inner);
      houseRowV(g, R, side, inner, inner, BY0 + BH);
      houseRowH(g, R, side, inner, BX0, -inner);
      houseRowH(g, R, side, inner, inner, BX0 + BW);
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const x0 = sx > 0 ? HALF_ROAD : -inner - 30, y0 = sy > 0 ? HALF_ROAD : -inner - 30;
      // L-shaped sidewalk with a rounded corner
      g.save();
      g.beginPath();
      g.rect(sx > 0 ? HALF_ROAD : BX0, sy > 0 ? HALF_ROAD : BY0, sx > 0 ? BX0 + BW - HALF_ROAD : -HALF_ROAD - BX0, sy > 0 ? BY0 + BH - HALF_ROAD : -HALF_ROAD - BY0);
      g.clip();
      sidewalk(g, R, sx > 0 ? HALF_ROAD : -inner, sy > 0 ? HALF_ROAD : BY0, sx > 0 ? inner : -HALF_ROAD, sy > 0 ? BY0 + BH : -HALF_ROAD);
      sidewalk(g, R, sx > 0 ? HALF_ROAD : BX0, sy > 0 ? HALF_ROAD : -inner, sx > 0 ? BX0 + BW : -HALF_ROAD, sy > 0 ? inner : -HALF_ROAD);
      g.restore();
      void x0; void y0;
    }
    asphalt(g, R, -HALF_ROAD, BY0, HALF_ROAD, BY0 + BH);
    asphalt(g, R, BX0, -HALF_ROAD, BX0 + BW, HALF_ROAD);
    // rounded corners: asphalt fillets
    // Corner square becomes asphalt except a quarter disc of sidewalk centred
    // on its outer corner, which leaves a curb radius of FILLET.
    const FILLET = 2.6;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const x0 = sx > 0 ? HALF_ROAD : -HALF_ROAD - FILLET, y0 = sy > 0 ? HALF_ROAD : -HALF_ROAD - FILLET;
      g.fillStyle = "#3a3d42";
      g.fillRect(x0, y0, FILLET, FILLET);
      const cx = sx * (HALF_ROAD + FILLET), cy = sy * (HALF_ROAD + FILLET);
      g.save();
      g.beginPath(); g.rect(x0, y0, FILLET, FILLET); g.clip();
      g.fillStyle = "#9a958b";
      g.beginPath(); g.arc(cx, cy, FILLET, 0, 6.3); g.fill();
      g.restore();
      const mid = Math.atan2(-sy, -sx);
      g.strokeStyle = "#cdc7ba"; g.lineWidth = 0.25;
      g.beginPath(); g.arc(cx, cy, FILLET - 0.12, mid - Math.PI / 4, mid + Math.PI / 4); g.stroke();
    }
    // curbs
    g.fillStyle = "#cdc7ba";
    for (const s of [-1, 1]) {
      g.fillRect(s > 0 ? HALF_ROAD : -HALF_ROAD - 0.25, BY0, 0.25, -HALF_ROAD - 2.6 - BY0);
      g.fillRect(s > 0 ? HALF_ROAD : -HALF_ROAD - 0.25, HALF_ROAD + 2.6, 0.25, BY0 + BH - HALF_ROAD - 2.6);
      g.fillRect(BX0, s > 0 ? HALF_ROAD : -HALF_ROAD - 0.25, -HALF_ROAD - 2.6 - BX0, 0.25);
      g.fillRect(HALF_ROAD + 2.6, s > 0 ? HALF_ROAD : -HALF_ROAD - 0.25, BX0 + BW - HALF_ROAD - 2.6, 0.25);
    }
    wheelTracksV(g, [LANE.N1, LANE.N2, LANE.S1, LANE.S2], BY0, -11);
    wheelTracksV(g, [LANE.N1, LANE.N2, LANE.S1, LANE.S2], 11, BY0 + BH);
    wheelTracksH(g, [LANE.E1, LANE.E2, LANE.W1, LANE.W2], BX0, -11);
    wheelTracksH(g, [LANE.E1, LANE.E2, LANE.W1, LANE.W2], 11, BX0 + BW);
    const white = "rgba(238,238,230,0.9)";
    for (const s of [-1, 1]) {
      // centre double yellow on each arm
      g.fillStyle = "#e5c24a";
      const a0 = s > 0 ? 11 : BY0, a1 = s > 0 ? BY0 + BH : -11;
      g.fillRect(-0.27, a0, 0.13, a1 - a0); g.fillRect(0.14, a0, 0.13, a1 - a0);
      const b0 = s > 0 ? 11 : BX0, b1 = s > 0 ? BX0 + BW : -11;
      g.fillRect(b0, -0.27, b1 - b0, 0.13); g.fillRect(b0, 0.14, b1 - b0, 0.13);
      dashV(g, 3.4, a0, a1, 3, 5, 0.13, white); dashV(g, -3.4, a0, a1, 3, 5, 0.13, white);
      dashH(g, 3.4, b0, b1, 3, 5, 0.13, white); dashH(g, -3.4, b0, b1, 3, 5, 0.13, white);
    }
    // stop lines on inbound halves (right-hand traffic)
    g.fillStyle = white;
    g.fillRect(0.3, 10.8, HALF_ROAD - 0.4, 0.4);     // northbound, south arm
    g.fillRect(-HALF_ROAD + 0.1, -11.2, HALF_ROAD - 0.4, 0.4); // southbound, north arm
    g.fillRect(-11.2, 0.3, 0.4, HALF_ROAD - 0.4);    // eastbound, west arm
    g.fillRect(10.8, -HALF_ROAD + 0.1, 0.4, HALF_ROAD - 0.4); // westbound, east arm
    // zebra crossings
    for (let k = -HALF_ROAD + 0.4; k < HALF_ROAD - 0.3; k += 1.0) {
      g.fillRect(k, 7.4, 0.5, 3.0); g.fillRect(k, -10.4, 0.5, 3.0);
      g.fillRect(7.4, k, 3.0, 0.5); g.fillRect(-10.4, k, 3.0, 0.5);
    }
    // lane arrows
    laneArrow(g, LANE.N1, 16, 0, "SL"); laneArrow(g, LANE.N2, 16, 0, "SR");
    laneArrow(g, LANE.S1, -16, 180, "SL"); laneArrow(g, LANE.S2, -16, 180, "SR");
    laneArrow(g, -16, LANE.E1, 90, "SL"); laneArrow(g, -16, LANE.E2, 90, "SR");
    laneArrow(g, 16, LANE.W1, -90, "SL"); laneArrow(g, 16, LANE.W2, -90, "SR");
    // traffic light poles and trees
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.arc(sx * 7.6 + 0.15, sy * 7.6 + 0.2, 0.3, 0, 6.3); g.fill();
      g.fillStyle = "#5b6168"; g.beginPath(); g.arc(sx * 7.6, sy * 7.6, 0.26, 0, 6.3); g.fill();
      g.fillStyle = "#1c1f23"; g.fillRect(sx * 7.6 - 0.25, sy * 7.6 - 0.25, 0.5, 0.5);
      for (let d = 16; d < 46; d += 11 + R() * 4) { tree(g, R, sx * 8.2, sy * d, 1.25); tree(g, R, sx * d, sy * 8.2, 1.25); }
      for (let d = 14; d < 46; d += 9 + R() * 7) parkedMotos(g, R, sx * 9.6, sy > 0 ? d : -d - 3, sy > 0 ? d + 3 : -d, sx);
    }
  }

  function laneArrow(g, x, y, rot, type) {
    g.save();
    g.translate(x, y); g.rotate(rot * DEG);
    g.fillStyle = "rgba(238,238,230,0.85)";
    g.fillRect(-0.12, -0.6, 0.24, 2.6);
    g.beginPath(); g.moveTo(0, -1.6); g.lineTo(0.45, -0.6); g.lineTo(-0.45, -0.6); g.closePath(); g.fill();
    const s = type === "SL" ? -1 : 1;
    g.beginPath(); g.moveTo(0, 0.6); g.quadraticCurveTo(0, -0.2, s * 0.7, -0.2); g.lineWidth = 0.22; g.strokeStyle = "rgba(238,238,230,0.85)"; g.stroke();
    g.beginPath(); g.moveTo(s * 1.15, -0.2); g.lineTo(s * 0.6, -0.6); g.lineTo(s * 0.6, 0.2); g.closePath(); g.fill();
    g.restore();
  }

  // ============================================================== vehicles
  function shadowOn(g, ppm, k = 1) {
    g.shadowColor = "rgba(0,0,0,0.5)";
    g.shadowBlur = 0.45 * ppm * k;
    g.shadowOffsetX = 0.2 * ppm * k;
    g.shadowOffsetY = 0.32 * ppm * k;
  }
  function shadowOff(g) { g.shadowColor = "transparent"; g.shadowBlur = 0; g.shadowOffsetX = 0; g.shadowOffsetY = 0; }

  function glow(g, x, y, r, color, alpha) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, color.replace("A", alpha));
    gr.addColorStop(1, color.replace("A", 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
  }

  function drawCar(g, L, Wd, color, o, ppm) {
    const hl = L / 2, hw = Wd / 2;
    if (o.brake) glow(g, 0, hl + 0.2, 1.4, "rgba(255,40,50,A)", 0.55);
    if (o.reverseLight) glow(g, 0, hl + 0.3, 1.6, "rgba(255,255,240,A)", 0.7);
    g.save(); shadowOn(g, ppm); rr(g, -hw, -hl, Wd, L, 0.55); g.fillStyle = color; g.fill(); g.restore();
    const gr = g.createLinearGradient(-hw, 0, hw, 0);
    gr.addColorStop(0, "rgba(0,0,0,0.32)"); gr.addColorStop(0.16, "rgba(255,255,255,0.10)");
    gr.addColorStop(0.5, "rgba(255,255,255,0.20)"); gr.addColorStop(0.84, "rgba(255,255,255,0.06)");
    gr.addColorStop(1, "rgba(0,0,0,0.32)");
    rr(g, -hw, -hl, Wd, L, 0.55); g.fillStyle = gr; g.fill();
    // hood crease
    g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = 0.05;
    g.beginPath(); g.moveTo(-hw * 0.45, -hl + 0.3); g.lineTo(-hw * 0.5, -hl * 0.45); g.moveTo(hw * 0.45, -hl + 0.3); g.lineTo(hw * 0.5, -hl * 0.45); g.stroke();
    // glass
    const glass = g.createLinearGradient(0, -hl * 0.45, 0, -hl * 0.05);
    glass.addColorStop(0, "#2d4257"); glass.addColorStop(1, "#13202d");
    g.fillStyle = glass;
    g.beginPath(); g.moveTo(-hw + 0.17, -hl * 0.4); g.quadraticCurveTo(0, -hl * 0.5, hw - 0.17, -hl * 0.4); g.lineTo(hw - 0.27, -hl * 0.06); g.lineTo(-hw + 0.27, -hl * 0.06); g.closePath(); g.fill();
    g.fillStyle = "rgba(255,255,255,0.10)";
    g.beginPath(); g.moveTo(-hw + 0.3, -hl * 0.38); g.lineTo(-hw + 0.7, -hl * 0.38); g.lineTo(-hw + 0.45, -hl * 0.1); g.lineTo(-hw + 0.32, -hl * 0.1); g.closePath(); g.fill();
    // roof
    rr(g, -hw + 0.27, -hl * 0.04, Wd - 0.54, hl * 0.6, 0.22); g.fillStyle = "rgba(255,255,255,0.07)"; g.fill();
    // rear glass
    g.fillStyle = "#1a2836";
    g.beginPath(); g.moveTo(-hw + 0.28, hl * 0.58); g.lineTo(hw - 0.28, hl * 0.58); g.lineTo(hw - 0.2, hl * 0.8); g.quadraticCurveTo(0, hl * 0.86, -hw + 0.2, hl * 0.8); g.closePath(); g.fill();
    // side windows
    g.fillStyle = "rgba(15,25,35,0.85)";
    g.fillRect(-hw + 0.05, -hl * 0.05, 0.12, hl * 0.6); g.fillRect(hw - 0.17, -hl * 0.05, 0.12, hl * 0.6);
    // mirrors
    g.fillStyle = color;
    rr(g, -hw - 0.2, -hl * 0.36, 0.24, 0.16, 0.05); g.fill();
    rr(g, hw - 0.04, -hl * 0.36, 0.24, 0.16, 0.05); g.fill();
    // lights
    g.fillStyle = "#fbf3d0";
    rr(g, -hw + 0.12, -hl + 0.04, 0.42, 0.16, 0.06); g.fill();
    rr(g, hw - 0.54, -hl + 0.04, 0.42, 0.16, 0.06); g.fill();
    g.fillStyle = o.brake ? "#ff2a3a" : "#7d1820";
    rr(g, -hw + 0.1, hl - 0.18, 0.46, 0.14, 0.05); g.fill();
    rr(g, hw - 0.56, hl - 0.18, 0.46, 0.14, 0.05); g.fill();
    if (o.reverseLight) { g.fillStyle = "#ffffff"; g.fillRect(-0.55, hl - 0.16, 0.25, 0.1); g.fillRect(0.3, hl - 0.16, 0.25, 0.1); }
    if (o.signalOn) {
      const sx = o.signal === "L" ? -hw + 0.12 : hw - 0.12;
      glow(g, sx, -hl + 0.12, 0.75, "rgba(255,170,30,A)", 0.85);
      glow(g, sx, hl - 0.12, 0.75, "rgba(255,170,30,A)", 0.85);
      g.fillStyle = "#ffc23a";
      g.beginPath(); g.arc(sx, -hl + 0.12, 0.13, 0, 6.3); g.arc(sx, hl - 0.12, 0.13, 0, 6.3); g.fill();
    }
    if (o.door > 0) {
      g.save();
      g.translate(-hw, -L * 0.12);
      g.rotate(o.door);
      g.fillStyle = color;
      rr(g, -0.07, 0, 0.14, 1.05, 0.04); g.fill();
      g.strokeStyle = "rgba(0,0,0,0.5)"; g.lineWidth = 0.04; g.stroke();
      g.restore();
    }
    rr(g, -hw, -hl, Wd, L, 0.55); g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = 0.05; g.stroke();
  }

  function drawTruck(g, L, Wd, color, o, ppm) {
    const hl = L / 2, hw = Wd / 2;
    if (o.brake) glow(g, 0, hl + 0.2, 1.5, "rgba(255,40,50,A)", 0.5);
    g.save(); shadowOn(g, ppm, 1.4); g.fillStyle = "#d9dde1"; g.fillRect(-hw, -hl + 2.0, Wd, L - 2.0); g.restore();
    g.fillStyle = color; rr(g, -hw + 0.05, -hl, Wd - 0.1, 2.0, 0.35); g.fill();
    g.fillStyle = "#1b2633"; g.fillRect(-hw + 0.25, -hl + 0.35, Wd - 0.5, 0.55);
    g.fillStyle = "#c9ced3"; g.fillRect(-hw, -hl + 2.05, Wd, L - 2.05);
    g.strokeStyle = "rgba(0,0,0,0.15)"; g.lineWidth = 0.05;
    for (let y = -hl + 2.6; y < hl; y += 0.6) { g.beginPath(); g.moveTo(-hw, y); g.lineTo(hw, y); g.stroke(); }
    g.fillStyle = o.brake ? "#ff2a3a" : "#7d1820";
    g.fillRect(-hw + 0.1, hl - 0.12, 0.4, 0.1); g.fillRect(hw - 0.5, hl - 0.12, 0.4, 0.1);
  }

  function drawMotoBody(g, color, brake, ppmK, ppm) {
    if (ppm) { g.save(); shadowOn(g, ppm, 0.7); }
    g.fillStyle = "#111";
    rr(g, -0.08, -0.95, 0.16, 0.45, 0.06); g.fill();
    rr(g, -0.09, 0.5, 0.18, 0.45, 0.06); g.fill();
    if (ppm) g.restore();
    g.fillStyle = color;
    g.beginPath(); g.ellipse(0, 0.05, 0.2, 0.68, 0, 0, 6.3); g.fill();
    g.fillStyle = "#2a2a2a"; g.beginPath(); g.ellipse(0, 0.25, 0.13, 0.32, 0, 0, 6.3); g.fill();
    g.strokeStyle = "#333"; g.lineWidth = 0.06;
    g.beginPath(); g.moveTo(-0.34, -0.55); g.lineTo(0.34, -0.55); g.stroke();
    g.fillStyle = "#fbf3d0"; g.beginPath(); g.arc(0, -0.78, 0.07, 0, 6.3); g.fill();
    g.fillStyle = brake ? "#ff2a3a" : "#7d1820"; g.fillRect(-0.07, 0.86, 0.14, 0.07);
  }

  function drawMoto(g, L, Wd, color, o, ppm) {
    if (o.brake) glow(g, 0, 0.95, 0.8, "rgba(255,40,50,A)", 0.6);
    drawMotoBody(g, color, o.brake, 1, ppm);
    // rider seen from above
    g.fillStyle = o.shirt || "#e7e4dc";
    g.beginPath(); g.ellipse(0, 0.08, 0.3, 0.17, 0, 0, 6.3); g.fill();
    g.strokeStyle = o.shirt || "#e7e4dc"; g.lineWidth = 0.1; g.lineCap = "round";
    g.beginPath(); g.moveTo(-0.24, 0.02); g.lineTo(-0.3, -0.5); g.moveTo(0.24, 0.02); g.lineTo(0.3, -0.5); g.stroke();
    const hg = g.createRadialGradient(-0.05, -0.08, 0.02, 0, -0.02, 0.17);
    hg.addColorStop(0, "#ffffff"); hg.addColorStop(0.35, o.helmet || "#f1c40f"); hg.addColorStop(1, shade(o.helmet || "#f1c40f"));
    g.fillStyle = hg; g.beginPath(); g.arc(0, -0.02, 0.165, 0, 6.3); g.fill();
    if (o.signalOn) {
      const sx = o.signal === "L" ? -0.36 : 0.36;
      glow(g, sx, -0.55, 0.45, "rgba(255,170,30,A)", 0.9);
      g.fillStyle = "#ffc23a"; g.beginPath(); g.arc(sx, -0.55, 0.07, 0, 6.3); g.fill();
    }
  }

  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    return `rgb(${r * 0.55 | 0},${gg * 0.55 | 0},${b * 0.55 | 0})`;
  }

  function drawPed(g, o) {
    const k = 1.45; // drawn larger than life so the person reads at this scale
    g.scale(k, k);
    const sw = Math.sin(o.phase) * 0.16;
    g.fillStyle = "#2f3340";
    g.beginPath(); g.ellipse(-0.1, -sw, 0.07, 0.12, 0, 0, 6.3); g.ellipse(0.1, sw, 0.07, 0.12, 0, 0, 6.3); g.fill();
    g.fillStyle = o.shirt || "#d35454";
    g.beginPath(); g.ellipse(0, 0.02, 0.25, 0.13, 0, 0, 6.3); g.fill();
    if (o.hat) {
      const hg = g.createRadialGradient(-0.05, -0.05, 0.02, 0, 0, 0.27);
      hg.addColorStop(0, "#fff4d6"); hg.addColorStop(1, "#c9ad6e");
      g.fillStyle = hg; g.beginPath(); g.arc(0, 0, 0.27, 0, 6.3); g.fill();
      g.strokeStyle = "rgba(120,90,40,0.5)"; g.lineWidth = 0.02;
      g.beginPath(); g.arc(0, 0, 0.18, 0, 6.3); g.arc(0, 0, 0.09, 0, 6.3); g.stroke();
    } else {
      g.fillStyle = "#1d1a18"; g.beginPath(); g.arc(0, 0, 0.11, 0, 6.3); g.fill();
    }
  }

  function drawDog(g, color, o) {
    const k = 1.35;
    g.scale(k, k);
    const sw = Math.sin(o.phase) * 0.12;
    g.fillStyle = shade(color);
    for (const [x, y, s] of [[-0.12, -0.25, 1], [0.12, -0.25, -1], [-0.12, 0.22, -1], [0.12, 0.22, 1]]) {
      g.beginPath(); g.ellipse(x, y + s * sw, 0.05, 0.1, 0, 0, 6.3); g.fill();
    }
    g.fillStyle = color;
    g.beginPath(); g.ellipse(0, 0, 0.17, 0.36, 0, 0, 6.3); g.fill();
    g.beginPath(); g.arc(0, -0.43, 0.13, 0, 6.3); g.fill();
    g.fillStyle = shade(color);
    g.beginPath(); g.ellipse(-0.1, -0.47, 0.05, 0.08, -0.4, 0, 6.3); g.ellipse(0.1, -0.47, 0.05, 0.08, 0.4, 0, 6.3); g.fill();
    g.strokeStyle = color; g.lineWidth = 0.06; g.lineCap = "round";
    g.beginPath(); g.moveTo(0, 0.34); g.quadraticCurveTo(Math.sin(o.phase * 2) * 0.2, 0.5, Math.sin(o.phase * 2) * 0.15, 0.6); g.stroke();
  }

  function drawPole(g, ppm) {
    g.save(); shadowOn(g, ppm, 1.2);
    g.fillStyle = "#b7b4ad"; g.beginPath(); g.arc(0, 0, 0.3, 0, 6.3); g.fill(); g.restore();
    g.fillStyle = "#8e8b84"; g.beginPath(); g.arc(0, 0, 0.18, 0, 6.3); g.fill();
  }

  function drawVehicle(g, a, st, t, ppm, extra = {}) {
    g.save();
    g.translate(st.x, st.y);
    g.rotate(st.h);
    const moving = st.v > 0.05;
    const braking = !a.parkedCar && ((st.acc < -0.8 && moving) || (a.brakeHold && !moving) || (a.hit && t > a.hit.t) || extra.brake);
    let signal = null;
    for (const s of a.signal || []) if (t >= s[0] && t <= s[1]) signal = s[2];
    const o = {
      brake: braking, signal, signalOn: signal && ((t * 2.3) % 1 + 1) % 1 < 0.55,
      reverseLight: a.reverse && moving, door: E.doorAngle(a, t),
      shirt: a.shirt, helmet: a.helmet, hat: a.hat, phase: (st.s || 0) * 5.5,
    };
    if (a.kind === "car" || a.kind === "suv") drawCar(g, a.L, a.W, a.color, o, ppm);
    else if (a.kind === "truck") drawTruck(g, a.L, a.W, a.color, o, ppm);
    else if (a.kind === "bus") drawTruck(g, a.L, a.W, a.color, o, ppm);
    else if (a.kind === "moto") drawMoto(g, a.L, a.W, a.color, o, ppm);
    else if (a.kind === "ped") drawPed(g, Object.assign(o, { shirt: a.color }));
    else if (a.kind === "dog") drawDog(g, a.color, o);
    else if (a.kind === "pole") drawPole(g, ppm);
    g.restore();
  }

  // ============================================================== panels
  const scenarioCache = new Map();
  function scenario(id) {
    if (!scenarioCache.has(id)) scenarioCache.set(id, Sc.get(id));
    return scenarioCache.get(id);
  }

  function drawPanel(g, rect, sc, t, opt) {
    const { x, y, w, h } = rect;
    g.save();
    rr(g, x, y, w, h, 18);
    g.clip();
    g.fillStyle = "#1d2124";
    g.fillRect(x, y, w, h);
    const narrow = w < 700;
    const viewH = opt.grid ? 24 : sc.viewH || 34;
    let ppm = h / viewH;
    const cam = sc.cam || { x: 0, y: -1 };
    let cx = lerp(cam.x, sc.eventPoint.x, narrow ? (w < 450 ? 0.7 : 0.45) : 0.12);
    let cy = lerp(cam.y, sc.eventPoint.y, narrow ? 0.35 : 0.15);
    if (opt.mode === "replay") {
      ppm *= 1.22;
      cx = lerp(cx, sc.eventPoint.x, 0.5); cy = lerp(cy, sc.eventPoint.y, 0.5);
    }
    // impact shake
    let sx = 0, sy = 0;
    for (const e of sc.events) {
      const d = t - e.t;
      if (e.type === "impact" && d >= 0 && d < 0.3) { sx += Math.sin(d * 95) * 6 * (1 - d / 0.3); sy += Math.cos(d * 80) * 4 * (1 - d / 0.3); }
    }
    g.translate(x + w / 2 + sx, y + h / 2 + sy);
    g.scale(ppm, ppm);
    g.translate(-cx, -cy);
    g.imageSmoothingQuality = "high";
    g.drawImage(background(sc.layout, sc.seed || 1), BX0, BY0, BW, BH);

    // ambient pedestrians on the sidewalks
    const R = E.rng((sc.seed || 1) * 31);
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1, v = 0.9 + R() * 0.6, dir = R() < 0.5 ? 1 : -1;
      const yy = ((((R() * 120 + dir * v * t) % 120) + 120) % 120) - 60;
      const xx = side * (7.4 + R() * 1.0);
      if (sc.layout.alley && side > 0 && Math.abs(yy - sc.layout.alley.y) < sc.layout.alley.w / 2) continue;
      if (sc.layout.type === "cross" && Math.abs(yy) < 11) continue;
      g.save(); g.translate(xx, yy); g.rotate(dir > 0 ? Math.PI : 0);
      drawPed(g, { phase: t * 6 + i, shirt: ["#d9d4c7", "#5579a8", "#a44", "#3e7d5a", "#c99a3c"][i % 5], hat: R() < 0.3 });
      g.restore();
    }

    // parked / queued vehicles
    for (const p of sc.parked) {
      const d = E.DIM[p.kind];
      drawVehicle(g, { kind: p.kind, L: d[0], W: d[1], color: p.color, brakeHold: p.brake, parkedCar: !p.brake, signal: [] },
        { x: p.x, y: p.y, h: (p.heading || 0) * DEG, v: 0, acc: 0, s: 0 }, t, ppm);
    }
    // skid marks
    for (const a of sc.actors) {
      if (!a.skid) continue;
      const t1 = Math.min(t, a.skid[1]);
      if (t1 <= a.skid[0]) continue;
      g.strokeStyle = "rgba(15,15,17,0.6)"; g.lineWidth = a.kind === "moto" ? 0.12 : 0.2; g.lineCap = "round";
      const offs = a.kind === "moto" ? [[0, 0.7]] : [[-a.W / 2 + 0.25, a.L / 2 - 0.85], [a.W / 2 - 0.25, a.L / 2 - 0.85]];
      for (const [lx, ly] of offs) {
        g.beginPath();
        for (let tt = a.skid[0]; tt <= t1; tt += 1 / 40) {
          const p = E.localToWorld(E.actorState(a, tt), lx, ly);
          if (tt === a.skid[0]) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]);
        }
        g.stroke();
      }
    }
    // marks under vehicles
    for (const m of sc.marks || []) drawMarkWorld(g, m, sc, t, ppm);

    // background traffic
    for (const b of sc.bgActors) {
      const st = E.bgState(b, t);
      if (Math.abs(st.x - cx) > 40 || Math.abs(st.y - cy) > 30) continue;
      drawVehicle(g, { kind: b.kind, L: b.L, W: b.W, color: b.color, shirt: b.shirt, helmet: b.helmet, signal: [] }, Object.assign(st, { acc: 0, s: st.d }), t, ppm);
    }

    // trails
    const focal = sc.actors.filter((a) => a.focal && !a.fixed);
    for (const a of focal) {
      const col = a.color;
      const span = opt.mode === "replay" ? 4 : 2.2;
      let prev = null;
      for (let k = 0; k <= 30; k++) {
        const tt = t - span + (span * k) / 30;
        const st = E.actorState(a, tt);
        if (prev) {
          g.strokeStyle = hexA(col, 0.12 + 0.6 * (k / 30));
          g.lineWidth = 0.28; g.lineCap = "round";
          g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(st.x, st.y); g.stroke();
        }
        prev = st;
      }
      if (opt.mode === "replay") {
        g.setLineDash([0.5, 0.45]);
        g.strokeStyle = hexA(col, 0.55); g.lineWidth = 0.14;
        g.beginPath();
        for (let k = 0; k <= 30; k++) {
          const st = E.actorState(a, t + (3 * k) / 30);
          if (k === 0) g.moveTo(st.x, st.y); else g.lineTo(st.x, st.y);
        }
        g.stroke(); g.setLineDash([]);
        for (let k = 6; k >= 1; k--) {
          const tt = t - k * 0.45;
          g.globalAlpha = 0.09 + 0.03 * (6 - k);
          drawVehicle(g, a, E.actorState(a, tt), tt, ppm);
          g.globalAlpha = 1;
        }
      }
    }
    // focal vehicles with a coloured halo
    for (const a of sc.actors) {
      const st = E.actorState(a, t);
      if (a.focal && a.label) {
        const gr = g.createRadialGradient(st.x, st.y, 0, st.x, st.y, Math.max(a.L, 1.6) * 0.95);
        gr.addColorStop(0, hexA(a.color, 0.45)); gr.addColorStop(1, hexA(a.color, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(st.x, st.y, Math.max(a.L, 1.6) * 0.95, 0, 6.3); g.fill();
      }
      drawVehicle(g, a, st, t, ppm);
    }
    // event effects
    sc.events.forEach((e, i) => drawEventWorld(g, e, i, sc, t, ppm));
    // screen-space overlays need the world->screen transform
    const toScreen = (wx, wy) => [x + w / 2 + sx + (wx - cx) * ppm, y + h / 2 + sy + (wy - cy) * ppm];
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (const m of sc.marks || []) drawMarkScreen(g, m, sc, t, toScreen, rect);
    sc.events.forEach((e, i) => drawEventScreen(g, e, i, sc, t, toScreen, rect, ppm));
    if (opt.mode !== "unclear") {
      for (const a of sc.actors) if (a.focal && a.label) drawBadge(g, a, E.actorState(a, t), t, toScreen, ppm, rect, opt);
    }
    if (opt.mode === "unclear") drawUnclear(g, rect, sc, toScreen, ppm);
    g.restore();

    // chrome on top of the clip region
    g.save();
    rr(g, x, y, w, h, 18); g.clip();
    drawPanelChrome(g, rect, sc, t, opt);
    g.restore();
    rr(g, x, y, w, h, 18);
    g.strokeStyle = opt.highlight ? C.orange : "rgba(255,255,255,0.14)";
    g.lineWidth = opt.highlight ? 3 : 2;
    g.stroke();
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function drawMarkWorld(g, m, sc, t) {
    if (m.type === "zone") {
      const [x0, y0, x1, y1] = m.rect;
      g.fillStyle = "rgba(255,210,74,0.08)";
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.setLineDash([0.7, 0.5]); g.strokeStyle = "rgba(255,210,74,0.9)"; g.lineWidth = 0.14;
      g.strokeRect(x0, y0, x1 - x0, y1 - y0); g.setLineDash([]);
    } else if (m.type === "line") {
      if (t < m.t0 - 0.3 || t > m.t1 + 0.6) return;
      const f = clamp(Math.min((t - m.t0 + 0.3) / 0.3, (m.t1 + 0.6 - t) / 0.6), 0, 1);
      g.strokeStyle = `rgba(255,84,104,${0.85 * f})`; g.lineWidth = 0.45; g.lineCap = "round";
      g.beginPath(); g.moveTo(m.from[0], m.from[1]); g.lineTo(m.to[0], m.to[1]); g.stroke();
    }
  }

  function pill(g, x, y, text, opts = {}) {
    const size = opts.size || 16;
    g.font = `${opts.weight || 700} ${size}px ${FONT}`;
    const tw = g.measureText(text).width;
    const pw = tw + size * 1.0, ph = size * 1.7;
    let px = opts.align === "right" ? x - pw : opts.align === "center" ? x - pw / 2 : x;
    g.fillStyle = opts.bg || "rgba(8,16,26,0.88)";
    rr(g, px, y, pw, ph, ph / 2); g.fill();
    if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = 2; g.stroke(); }
    g.fillStyle = opts.color || C.text;
    g.textBaseline = "middle";
    g.fillText(text, px + size * 0.5, y + ph / 2 + 1);
    g.textBaseline = "alphabetic";
    return { x: px, y, w: pw, h: ph };
  }

  function drawMarkScreen(g, m, sc, t, toScreen, rect) {
    if (m.type === "zone") {
      const [sx, sy] = toScreen(m.rect[0], m.rect[1]);
      const px = clamp(sx + 6, rect.x + 8, rect.x + rect.w - 60), py = clamp(sy + 6, rect.y + 56, rect.y + rect.h - 40);
      pill(g, px, py, m.label, { size: rect.w < 500 ? 12 : 15, bg: "rgba(255,210,74,0.92)", color: "#1a1505", weight: 800 });
    } else if (m.type === "line") {
      if (t < m.t0 || t > m.t1 + 0.4) return;
      const [sx, sy] = toScreen(m.from[0], (m.from[1] + m.to[1]) / 2);
      pill(g, sx - 10, sy - 16, m.label, { align: "right", size: 15, bg: "rgba(255,84,104,0.95)", weight: 800 });
    } else if (m.type === "tag") {
      if (m.t0 != null && t < m.t0) return;
      const a = sc.byId[m.actor];
      const st = E.actorState(a, t);
      const [sx, sy] = toScreen(st.x, st.y);
      pill(g, sx - 16, sy + 28, m.text, { align: "right", size: rect.w < 500 ? 12 : 15, bg: "rgba(245,158,46,0.95)", color: "#1b1102", weight: 800 });
    } else if (m.type === "arrows") {
      if (t < m.t0) return;
      const a = sc.byId[m.actor];
      const st = E.actorState(a, t);
      const [sx, sy] = toScreen(st.x, st.y);
      const dx = Math.sin(st.h), dy = -Math.cos(st.h);
      arrow(g, sx + 46, sy, sx + 46 + dx * 70, sy + dy * 70, "#ffffff", "đầu xe");
      if (st.v > 0.1) arrow(g, sx + 46, sy, sx + 46 - dx * 70, sy - dy * 70, C.red, "đang đi");
    }
  }

  function arrow(g, x1, y1, x2, y2, color, label) {
    g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 5; g.lineCap = "round";
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    const a = Math.atan2(y2 - y1, x2 - x1);
    g.beginPath(); g.moveTo(x2 + Math.cos(a) * 8, y2 + Math.sin(a) * 8);
    g.lineTo(x2 + Math.cos(a + 2.5) * 16, y2 + Math.sin(a + 2.5) * 16);
    g.lineTo(x2 + Math.cos(a - 2.5) * 16, y2 + Math.sin(a - 2.5) * 16); g.closePath(); g.fill();
    pill(g, x2 + 12, y2 - 14, label, { size: 14, color, border: color });
  }

  function drawEventWorld(g, e, i, sc, t) {
    const d = t - e.t;
    const p = e.point;
    if (sc.noConflict) return;
    if (e.type === "impact") {
      if (d >= 0 && d < 0.9) {
        const f = d / 0.9;
        g.fillStyle = `rgba(255,250,220,${0.6 * (1 - f) * (1 - f)})`;
        g.beginPath(); g.arc(p.x, p.y, 0.4 + d * 2.2, 0, 6.3); g.fill();
        g.strokeStyle = `rgba(255,200,60,${1 - f})`; g.lineWidth = 0.14;
        for (let k = 0; k < 10; k++) {
          const a = k * 0.6283 + i, r0 = 0.5 + d * 1.6, r1 = r0 + 0.6 + d * 0.8;
          g.beginPath(); g.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0); g.lineTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1); g.stroke();
        }
        const R = E.rng(17 + i);
        for (let k = 0; k < 16; k++) {
          const a = R() * 6.28, v = 2 + R() * 5;
          const dd = v * (1 - Math.exp(-d * 3)) / 3;
          g.fillStyle = `rgba(${R() < 0.5 ? "230,230,235" : "60,60,65"},${1 - f})`;
          g.fillRect(p.x + Math.cos(a) * dd, p.y + Math.sin(a) * dd, 0.12, 0.12);
        }
      }
      if (d >= 0) {
        const pulse = 1 + 0.12 * Math.sin(t * 7);
        g.strokeStyle = i === 0 ? "rgba(255,84,104,0.95)" : "rgba(159,179,199,0.9)"; g.lineWidth = 0.18;
        g.beginPath(); g.arc(p.x, p.y, 1.25 * pulse, 0, 6.3); g.stroke();
      }
    } else if (e.type === "near") {
      if (d > -0.8) {
        const r = e.gap / 2 + 1.5;
        g.setLineDash([0.6, 0.4]); g.strokeStyle = "rgba(255,170,40,0.95)"; g.lineWidth = 0.2;
        g.beginPath(); g.arc(p.x, p.y, r * (1 + 0.05 * Math.sin(t * 8)), 0, 6.3); g.stroke(); g.setLineDash([]);
      }
    }
  }

  function drawEventScreen(g, e, i, sc, t, toScreen, rect, ppm) {
    if (sc.noConflict) return;
    const d = t - e.t;
    const [sx, sy] = toScreen(e.point.x, e.point.y);
    const small = rect.w < 500;
    if (e.type === "impact" && d >= 0) {
      const text = i === 0 ? "VA CHẠM" : "VA CHẠM DÂY CHUYỀN";
      pill(g, sx, sy - 1.3 * ppm - 40, text, { size: small ? 13 : 17, align: "center", bg: i === 0 ? "rgba(255,84,104,0.96)" : "rgba(95,110,125,0.96)", weight: 900 });
    } else if (e.type === "near" && d > -0.8) {
      pill(g, sx, sy - (e.gap / 2 + 1.5) * ppm - 40, "SUÝT VA CHẠM", { align: "center", size: small ? 13 : 17, bg: "rgba(255,170,40,0.96)", color: "#1d1300", weight: 900 });
    }
  }

  function drawBadge(g, a, st, t, toScreen, ppm, rect, opt) {
    const [sx, sy] = toScreen(st.x, st.y);
    if (sx < rect.x - 20 || sx > rect.x + rect.w + 20 || sy < rect.y - 20 || sy > rect.y + rect.h + 20) return;
    const off = (Math.max(a.W, 0.9) / 2) * ppm + 26;
    const need = off + 22 + 150;
    const side = sx + need > rect.x + rect.w - 8 && sx - need > rect.x + 8 ? -1 : sx + need > rect.x + rect.w - 8 && sx - rect.x > rect.x + rect.w - sx ? -1 : 1;
    const bx = sx + side * off, by = sy - 6;
    g.strokeStyle = hexA(a.color, 0.9); g.lineWidth = 2;
    g.beginPath(); g.moveTo(sx + side * (Math.max(a.W, 0.9) / 2) * ppm, sy); g.lineTo(bx - side * 15, by); g.stroke();
    g.fillStyle = a.color;
    g.beginPath(); g.arc(bx, by, 16, 0, 6.3); g.fill();
    g.strokeStyle = "#fff"; g.lineWidth = 2.5; g.stroke();
    g.fillStyle = "#fff"; g.font = `900 19px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(a.label, bx, by + 1);
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    const after = a.hit && t > a.hit.t;
    const kmh = Math.round(Math.abs(after ? a.hit.v : st.v) * 3.6);
    const speedText = a.fixed ? (a.parkedCar ? "đang đỗ" : "đứng chờ") : after ? `chạm lúc ${kmh} km/h` : kmh === 0 ? "0 km/h · đứng yên" : `${kmh} km/h${a.reverse ? " · lùi" : ""}`;
    const tx = side > 0 ? bx + 22 : bx - 22;
    pill(g, tx, by - 14, speedText, { size: 14, align: side > 0 ? "left" : "right", weight: 700 });
    if (a.role) pill(g, tx, by + 14, a.role.toUpperCase(), { size: 13, align: side > 0 ? "left" : "right", bg: hexA(a.color, 0.95), color: "#0d0d0d", weight: 900 });
  }

  function drawUnclear(g, rect, sc, toScreen, ppm) {
    const [ex, ey] = toScreen(sc.eventPoint.x, sc.eventPoint.y);
    const ww = Math.min(rect.w * 0.5, 10 * ppm), hh = Math.min(rect.h * 0.55, 12 * ppm);
    const wx = clamp(ex - ww / 2, rect.x, rect.x + rect.w - ww), wy = clamp(ey - hh / 2, rect.y, rect.y + rect.h - hh);
    g.save();
    g.beginPath();
    g.rect(rect.x, rect.y, rect.w, rect.h);
    g.rect(wx + ww, wy, -ww, hh);
    g.fillStyle = "rgba(6,10,16,0.94)";
    g.fill("evenodd");
    g.clip("evenodd");
    g.strokeStyle = "rgba(255,255,255,0.05)"; g.lineWidth = 10;
    for (let k = -rect.h; k < rect.w; k += 34) { g.beginPath(); g.moveTo(rect.x + k, rect.y + rect.h); g.lineTo(rect.x + k + rect.h, rect.y); g.stroke(); }
    g.restore();
    g.strokeStyle = "rgba(255,255,255,0.6)"; g.setLineDash([10, 8]); g.lineWidth = 2;
    g.strokeRect(wx, wy, ww, hh); g.setLineDash([]);
    pill(g, rect.x + rect.w / 2, Math.max(rect.y + 60, wy - 54), "Ngoài khung hình: không thấy đường, hẻm hay xe xuất phát từ đâu", { align: "center", size: rect.w < 700 ? 12 : 16, weight: 600, color: C.muted });
    g.font = `900 ${rect.w < 700 ? 56 : 96}px ${FONT}`; g.fillStyle = "rgba(255,210,74,0.95)"; g.textAlign = "center";
    g.fillText("?", rect.x + rect.w / 2, Math.min(rect.y + rect.h - 70, wy + hh + (rect.w < 700 ? 64 : 100)));
    g.textAlign = "left";
    pill(g, rect.x + rect.w / 2, rect.y + rect.h - 58, "THIẾU BẰNG CHỨNG → CHỌN “KHÔNG RÕ”", { align: "center", size: rect.w < 700 ? 13 : 19, bg: "rgba(255,210,74,0.96)", color: "#1a1505", weight: 900 });
  }

  function drawPanelChrome(g, rect, sc, t, opt) {
    const { x, y, w, h } = rect;
    const small = w < 500;
    const grad = g.createLinearGradient(0, y, 0, y + 70);
    grad.addColorStop(0, "rgba(5,10,16,0.82)"); grad.addColorStop(1, "rgba(5,10,16,0)");
    g.fillStyle = grad; g.fillRect(x, y, w, 80);
    const chipText = opt.mode === "unclear" ? "KHÔNG RÕ" : sc.chip || sc.code;
    const chip = pill(g, x + 14, y + 12, chipText, { size: small ? 15 : 19, bg: opt.mode === "unclear" ? "#8a6d12" : sc.chip ? "#8a3b12" : C.chip, weight: 900 });
    // tag text, wrapped
    g.font = `700 ${small ? 14 : 18}px ${FONT}`;
    const lines = wrapText(g, sc.tag, w - (chip.w + 44) - (small ? 0 : 230));
    const tagX = small ? x + 16 : x + chip.w + 26;
    const tagY = small ? y + 58 : y + 30;
    g.fillStyle = C.text;
    lines.slice(0, 2).forEach((ln, i) => {
      g.save(); g.shadowColor = "rgba(0,0,0,0.9)"; g.shadowBlur = 6;
      g.fillText(ln, tagX, tagY + i * (small ? 18 : 23) + (small ? 0 : 6));
      g.restore();
    });
    // phase pill
    let phase, col;
    if (sc.noConflict) { phase = "KHÔNG CÓ XUNG ĐỘT"; col = "#2e7d5b"; }
    else if (t < sc.tAction) { phase = "1 · TRƯỚC XUNG ĐỘT"; col = "#2a65b8"; }
    else if (t < sc.tEvent) { phase = "2 · HÀNH ĐỘNG"; col = "#b9741a"; }
    else { phase = "3 · " + (sc.events[0] && sc.events[0].type === "near" ? "SUÝT VA CHẠM" : "XUNG ĐỘT"); col = "#b8304a"; }
    if (opt.mode !== "unclear") pill(g, x + w - 14, small ? y + 12 : y + 14, phase, { align: "right", size: small ? 12 : 15, bg: col, weight: 900, color: "#fff" });
    if (small && opt.mode !== "unclear") void 0;
    if (opt.mode === "replay") pill(g, x + w / 2, y + h - 46, "XEM LẠI CHẬM 0.5× · vệt màu = quỹ đạo đã đi, nét đứt = sắp đi", { align: "center", size: small ? 11 : 14, weight: 700, bg: "rgba(8,16,26,0.85)", color: C.muted });
    if (sc.graph && opt.mode !== "unclear" && w >= 380) drawSpark(g, rect, sc, t, opt);
  }

  function drawSpark(g, rect, sc, t, opt) {
    const a = sc.byId[sc.graph];
    const bw = Math.min(250, rect.w - 28), bh = 92;
    const bx = rect.x + 14, by = rect.y + rect.h - bh - (opt.mode === "replay" ? 58 : 14);
    g.fillStyle = "rgba(6,12,20,0.88)"; rr(g, bx, by, bw, bh, 12); g.fill();
    g.strokeStyle = hexA(a.color, 0.8); g.lineWidth = 1.5; g.stroke();
    g.font = `800 13px ${FONT}`; g.fillStyle = a.color;
    g.fillText(`TỐC ĐỘ ${a.label} (km/h)`, bx + 10, by + 19);
    const t0 = sc.tEvent - 5.5, t1 = sc.tEvent + 0.6, vmax = 40;
    const px = (tt) => bx + 10 + ((tt - t0) / (t1 - t0)) * (bw - 20);
    const py = (v) => by + bh - 12 - (v * 3.6 / vmax) * (bh - 42);
    g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(bx + 10, py(0)); g.lineTo(bx + bw - 10, py(0)); g.stroke();
    g.strokeStyle = a.color; g.lineWidth = 3;
    g.beginPath();
    for (let k = 0; k <= 60; k++) {
      const tt = t0 + ((t1 - t0) * k) / 60;
      if (tt > t || tt > sc.tEvent) break;
      const v = Math.abs(E.actorState(a, tt).v);
      if (k === 0) g.moveTo(px(tt), py(v)); else g.lineTo(px(tt), py(v));
    }
    g.stroke();
    if (t >= sc.tEvent) {
      g.strokeStyle = C.red; g.lineWidth = 2;
      g.beginPath(); g.moveTo(px(sc.tEvent), by + 28); g.lineTo(px(sc.tEvent), by + bh - 8); g.stroke();
      g.font = `800 11px ${FONT}`; g.fillStyle = C.red; g.textAlign = "right";
      g.fillText(sc.events[0] && sc.events[0].type === "near" ? "suýt chạm" : "va chạm", px(sc.tEvent) - 4, by + 36);
      g.textAlign = "left";
    } else if (t >= t0) {
      const v = Math.abs(E.actorState(a, t).v);
      g.fillStyle = "#fff"; g.beginPath(); g.arc(px(t), py(v), 4.5, 0, 6.3); g.fill();
    }
  }

  function wrapText(g, text, maxW) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";
    for (const wd of words) {
      const cand = line ? line + " " + wd : wd;
      if (g.measureText(cand).width > maxW && line) { lines.push(line); line = wd; } else line = cand;
    }
    if (line) lines.push(line);
    return lines;
  }

  // ================================================================ studio
  // Only phrases that send the annotator to "không rõ"; "không đủ" alone also appears in
  // sentences about weak cues (K02 brake lights), so it is not a trigger.
  const UNCLEAR = ["không rõ", "không thấy rõ", "bị che", "crop", "khuất"];
  let P = null;

  function buildShots(item, timing) {
    const self = item.codes || [item.id];
    const sents = timing.sentences;
    const seen = new Set();
    return sents.map((s, i) => {
      const s0 = i === 0 ? 0 : s.start - 0.2;
      const s1 = i + 1 < sents.length ? sents[i + 1].start - 0.2 : timing.duration;
      let spec = item.shots && item.shots[i] ? Object.assign({}, item.shots[i]) : null;
      if (!spec) {
        const codes = [...new Set(s.text.match(/K\d\d/g) || [])];
        const unclear = UNCLEAR.some((wd) => s.text.toLowerCase().includes(wd));
        if (item.codes) {
          const inPair = codes.filter((c) => self.includes(c));
          spec = { panels: inPair.length === 1 ? inPair : self.slice(), mode: unclear ? "unclear" : null };
        } else {
          const others = codes.filter((c) => c !== item.id);
          spec = others.length ? { panels: [item.id, ...others] } : { panels: [item.id], mode: unclear ? "unclear" : null };
        }
      }
      const key = spec.panels.join("+");
      if (!spec.mode) spec.mode = seen.has(key) ? "replay" : "play";
      seen.add(key);
      return Object.assign(spec, { s0, s1, text: s.text, index: i });
    });
  }

  function panelRects(n, area) {
    const gap = 14;
    if (n === 1) return [area];
    if (n <= 3) {
      const w = (area.w - gap * (n - 1)) / n;
      return Array.from({ length: n }, (_, i) => ({ x: area.x + i * (w + gap), y: area.y, w, h: area.h }));
    }
    const w = (area.w - gap) / 2, h = (area.h - gap) / 2;
    return [0, 1, 2, 3].map((i) => ({ x: area.x + (i % 2) * (w + gap), y: area.y + Math.floor(i / 2) * (h + gap), w, h }));
  }

  const LAYOUT = {
    header: { x: 40, y: 26, w: 1840, h: 94 },
    scene: { x: 40, y: 138, w: 1262, h: 772 },
    side: { x: 1318, y: 138, w: 562, h: 772 },
    sub: { x: 40, y: 926, w: 1840, h: 128 },
  };

  function setup(payload) {
    P = payload;
    P.shots = buildShots(P.item, P.timing);
    const cv = document.getElementById("c");
    cv.width = W; cv.height = H;
    P.g = cv.getContext("2d");
    // warm caches
    for (const s of P.shots) for (const id of s.panels) { const sc = scenario(id); background(sc.layout, sc.seed || 1); }
    return P.shots.map((s) => ({ panels: s.panels, mode: s.mode, s0: +s.s0.toFixed(2), s1: +s.s1.toFixed(2) }));
  }

  function draw(t) {
    const g = P.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#07111c"); bg.addColorStop(1, "#0b1a29");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const shot = P.shots.find((s) => t >= s.s0 && t < s.s1) || P.shots[P.shots.length - 1];
    drawHeader(g);
    const rects = panelRects(shot.panels.length, LAYOUT.scene);
    const rate = shot.mode === "replay" ? 0.5 : 1;
    const hold = shot.mode === "replay" ? 1.0 : 1.5;
    shot.panels.forEach((id, i) => {
      const sc = scenario(id);
      const st = sc.tEvent + hold - (shot.s1 - t) * rate;
      drawPanel(g, rects[i], sc, st, { mode: shot.mode, grid: shot.panels.length === 4, highlight: false });
    });
    if (shot.panels.length > 1) {
      for (let i = 1; i < Math.min(shot.panels.length, 4); i++) {
        if (shot.panels.length === 4) break;
        const r = rects[i];
        pill(g, r.x - 7, r.y + r.h / 2 - 16, "≠", { align: "center", size: 20, bg: C.orange, color: "#1b1102", weight: 900 });
      }
    }
    const fade = clamp(1 - (t - shot.s0) / 0.22, 0, 1);
    if (fade > 0 && shot.index > 0) { g.fillStyle = `rgba(7,17,28,${fade})`; g.fillRect(LAYOUT.scene.x, LAYOUT.scene.y, LAYOUT.scene.w, LAYOUT.scene.h); }
    drawSide(g, shot);
    drawSubtitle(g, shot, t);
  }

  function drawHeader(g) {
    const { x, y, w, h } = LAYOUT.header;
    g.fillStyle = C.panel; rr(g, x, y, w, h, 20); g.fill();
    g.strokeStyle = C.panelEdge; g.lineWidth = 2; g.stroke();
    const item = P.item;
    const chip = item.codes ? "SO SÁNH " + item.codes.join(" / ") : item.id.startsWith("F") ? "NỀN TẢNG " + item.id : item.id;
    const c = pill(g, x + 20, y + 18, chip, { size: 26, bg: item.codes ? "#b35a12" : C.chip, weight: 900 });
    g.font = `800 36px ${FONT}`; g.fillStyle = C.text;
    g.fillText(item.title, c.x + c.w + 24, y + 60);
    g.font = `600 16px ${FONT}`; g.fillStyle = C.muted; g.textAlign = "right";
    g.fillText("Nhóm C · Kiểu xung đột · codebook C.v4", x + w - 24, y + 56);
    g.textAlign = "left";
  }

  function sectionTitle(g, x, y, text, color) {
    g.font = `900 17px ${FONT}`; g.fillStyle = color;
    g.fillText(text, x, y);
  }

  function drawSide(g, shot) {
    const { x, y, w, h } = LAYOUT.side;
    g.fillStyle = C.panel; rr(g, x, y, w, h, 20); g.fill();
    g.strokeStyle = C.panelEdge; g.lineWidth = 2; g.stroke();
    const item = P.item, labels = P.labels;
    const pad = 28, tw = w - pad * 2;
    let cy = y + 44;
    const shown = new Set(shot.panels.map((id) => scenario(id).code));
    const codeBlock = (code, active) => {
      const c = pill(g, x + pad, cy - 20, code, { size: 17, bg: active ? C.orange : "#24405e", color: active ? "#1b1102" : "#fff", weight: 900 });
      g.font = `600 19px ${FONT}`; g.fillStyle = active ? C.text : C.muted;
      const ls = wrapText(g, labels[code] || "", tw - c.w - 14);
      ls.forEach((ln, i) => g.fillText(ln, x + pad + c.w + 14, cy + 2 + i * 25));
      cy += Math.max(42, ls.length * 25 + 18);
    };
    if (item.codes) {
      sectionTitle(g, x + pad, cy, "HAI MÃ ĐANG SO SÁNH", C.blue); cy += 38;
      for (const code of item.codes) codeBlock(code, shown.has(code) && shot.panels.length === 1);
    } else if (!item.id.startsWith("F")) {
      sectionTitle(g, x + pad, cy, "MÃ NÀY", C.blue); cy += 38;
      codeBlock(item.id, false);
    }
    cy += 10;
    g.strokeStyle = "#22384d"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + pad, cy - 16); g.lineTo(x + w - pad, cy - 16); g.stroke();
    sectionTitle(g, x + pad, cy + 14, item.codes ? "DẤU HIỆU TÁCH BIỆT" : "NHÌN VÀO ĐÂU", C.green); cy += 48;
    (item.cues || []).forEach((cue, i) => {
      g.fillStyle = "#173a2e"; g.beginPath(); g.arc(x + pad + 13, cy - 7, 13, 0, 6.3); g.fill();
      g.fillStyle = C.green; g.font = `900 15px ${FONT}`; g.textAlign = "center"; g.fillText(String(i + 1), x + pad + 13, cy - 2); g.textAlign = "left";
      g.font = `500 19px ${FONT}`; g.fillStyle = C.text;
      const ls = wrapText(g, cue, tw - 40);
      ls.forEach((ln, k) => g.fillText(ln, x + pad + 38, cy + k * 25));
      cy += ls.length * 25 + 14;
    });
    const edges = item.codes ? [] : (item.edges || []);
    if (edges.length) {
      cy += 8;
      g.strokeStyle = "#22384d"; g.beginPath(); g.moveTo(x + pad, cy - 16); g.lineTo(x + w - pad, cy - 16); g.stroke();
      sectionTitle(g, x + pad, cy + 14, "DỄ NHẦM VỚI", C.orange); cy += 48;
      for (const code of edges) {
        if (cy > y + h - 40) break;
        codeBlock(code, shown.has(code));
      }
    }
  }

  function drawSubtitle(g, shot, t) {
    const { x, y, w, h } = LAYOUT.sub;
    g.fillStyle = "#0c1824"; rr(g, x, y, w, h, 20); g.fill();
    g.strokeStyle = C.panelEdge; g.lineWidth = 2; g.stroke();
    // progress through the clip
    const prog = clamp(t / P.timing.duration, 0, 1);
    g.fillStyle = "#1c3247"; rr(g, x + 24, y + h - 14, w - 48, 5, 3); g.fill();
    g.fillStyle = C.blue; rr(g, x + 24, y + h - 14, (w - 48) * prog, 5, 3); g.fill();
    // rich text: codes highlighted
    const size = 29;
    g.font = `600 ${size}px ${FONT}`;
    const tokens = shot.text.split(/\s+/);
    const maxW = w - 64;
    const rows = [[]];
    let rowW = 0;
    for (const tk of tokens) {
      const tw = g.measureText(tk + " ").width;
      if (rowW + tw > maxW && rows[rows.length - 1].length) { rows.push([]); rowW = 0; }
      rows[rows.length - 1].push(tk); rowW += tw;
    }
    const lh = size * 1.32;
    const startY = y + (h - 14) / 2 - ((rows.length - 1) * lh) / 2 + size * 0.36;
    rows.slice(0, 3).forEach((row, r) => {
      let cx = x + 32;
      for (const tk of row) {
        const isCode = /K\d\d/.test(tk);
        g.fillStyle = isCode ? C.yellow : C.text;
        g.font = `${isCode ? 900 : 600} ${size}px ${FONT}`;
        g.fillText(tk, cx, startY + r * lh);
        cx += g.measureText(tk + " ").width;
      }
    });
  }

  function frame(t, quality = 0.92) {
    draw(t);
    return document.getElementById("c").toDataURL("image/jpeg", quality);
  }

  // Clip time at which the first panel of shot k is `lead` seconds before its event.
  function eventTime(k, lead = 0.5) {
    const shot = P.shots[k];
    const sc = scenario(shot.panels[0]);
    const rate = shot.mode === "replay" ? 0.5 : 1, hold = shot.mode === "replay" ? 1.0 : 1.5;
    return clamp(shot.s1 - (hold + lead) / rate, shot.s0, shot.s1 - 0.05);
  }

  window.Studio = { setup, draw, frame, eventTime };
})();
