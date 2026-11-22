/*
 * Deterministic top-down traffic animation engine for the Group C training clips.
 *
 * Everything is a pure function of scenario time t (seconds), so a frame can be
 * rendered in any order and replays / slow motion are free. World units are
 * metres; y grows downward on screen, so northbound traffic moves toward -y.
 * Vietnam drives on the RIGHT: northbound lanes sit at x > 0, southbound at x < 0,
 * eastbound at y > 0, westbound at y < 0.
 *
 * Loaded by page.html in Chrome (rendering) and by check.js in Node (simulation only).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEG = Math.PI / 180;
  const LANE = { N1: 1.7, N2: 5.1, S1: -1.7, S2: -5.1, E1: 1.7, E2: 5.1, W1: -1.7, W2: -5.1 };
  const HALF_ROAD = 6.8;
  const SIDEWALK = 4.0;
  const DIM = {
    car: [4.4, 1.8], suv: [4.7, 1.95], moto: [1.9, 0.72], truck: [7.2, 2.4], bus: [10.5, 2.5],
    ped: [0.5, 0.55], dog: [0.95, 0.42], pole: [0.55, 0.55],
  };
  const IMPACT_TAU = 0.13;

  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, f) => a + (b - a) * f;
  const ease = (f) => (f <= 0 ? 0 : f >= 1 ? 1 : f * f * (3 - 2 * f));

  // ------------------------------------------------------------------ paths
  function makePath(points) {
    const pts = [];
    let acc = 0;
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i];
      if (pts.length) {
        const p = pts[pts.length - 1];
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < 1e-6) continue;
        acc += d;
      }
      pts.push({ x, y, s: acc });
    }
    return { pts, len: acc };
  }

  function route(x, y) {
    const pts = [[x, y]];
    const last = () => pts[pts.length - 1];
    const api = {
      to(x2, y2) { pts.push([x2, y2]); return api; },
      q(cx, cy, x2, y2, n = 30) {
        const [x0, y0] = last();
        for (let i = 1; i <= n; i++) {
          const t = i / n, u = 1 - t;
          pts.push([u * u * x0 + 2 * u * t * cx + t * t * x2, u * u * y0 + 2 * u * t * cy + t * t * y2]);
        }
        return api;
      },
      c(c1x, c1y, c2x, c2y, x2, y2, n = 40) {
        const [x0, y0] = last();
        for (let i = 1; i <= n; i++) {
          const t = i / n, u = 1 - t;
          pts.push([
            u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x2,
            u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y2,
          ]);
        }
        return api;
      },
      done() { return makePath(pts); },
    };
    return api;
  }

  function pathAt(path, s) {
    const P = path.pts;
    if (s <= 0) {
      const a = P[0], b = P[1], d = b.s - a.s;
      return { x: a.x + ((b.x - a.x) / d) * s, y: a.y + ((b.y - a.y) / d) * s };
    }
    if (s >= path.len) {
      const a = P[P.length - 2], b = P[P.length - 1], d = b.s - a.s, e = s - path.len;
      return { x: b.x + ((b.x - a.x) / d) * e, y: b.y + ((b.y - a.y) / d) * e };
    }
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (P[m].s <= s) lo = m; else hi = m;
    }
    const a = P[lo], b = P[hi], f = (s - a.s) / (b.s - a.s);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  function pathHeading(path, s) {
    const a = pathAt(path, s - 0.6), b = pathAt(path, s + 0.6);
    return Math.atan2(b.x - a.x, -(b.y - a.y));
  }

  // Straight lane paths that start far off-screen; `at` is the position at t = 0.
  function lanePath(lane, at) {
    const dir = lane[0];
    const off = LANE[lane];
    const far = 80;
    if (dir === "N") return { path: route(off, far).to(off, -far).done(), s0: far - at };
    if (dir === "S") return { path: route(off, -far).to(off, far).done(), s0: at + far };
    if (dir === "E") return { path: route(-far, off).to(far, off).done(), s0: at + far };
    return { path: route(far, off).to(-far, off).done(), s0: far - at };
  }

  // -------------------------------------------------------------- profiles
  function buildProfile(keys) {
    const dt = 1 / 240, T = 24, n = Math.ceil(T / dt) + 1;
    const vAt = (t) => {
      if (t <= keys[0][0]) return keys[0][1];
      for (let i = 1; i < keys.length; i++) {
        if (t <= keys[i][0]) {
          const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
          return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
        }
      }
      return keys[keys.length - 1][1];
    };
    const S = new Float64Array(n);
    for (let i = 1; i < n; i++) {
      const t = i * dt;
      S[i] = S[i - 1] + 0.5 * (vAt(t - dt) + vAt(t)) * dt;
    }
    return { dt, T, S, vAt };
  }

  function profS(p, t) {
    if (t <= 0) return p.vAt(0) * t;
    if (t >= p.T) return p.S[p.S.length - 1] + p.vAt(p.T) * (t - p.T);
    const f = t / p.dt, i = Math.floor(f), r = f - i;
    return p.S[i] * (1 - r) + p.S[i + 1] * r;
  }

  function keyInterp(keys, t) {
    if (!keys || !keys.length) return 0;
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
        return lerp(v0, v1, ease((t - t0) / (t1 - t0)));
      }
    }
    return keys[keys.length - 1][1];
  }

  // ---------------------------------------------------------------- actors
  function makeActor(spec) {
    const a = Object.assign({ kind: "car", color: "#cfd6de", s0: 0, reverse: false, focal: false }, spec);
    [a.L, a.W] = spec.dims || DIM[a.kind];
    if (a.kind === "pole" || spec.static) {
      a.fixed = { x: spec.x, y: spec.y, h: (spec.heading || 0) * DEG };
    } else {
      if (spec.lane) {
        const lp = lanePath(spec.lane, spec.at);
        a.path = lp.path;
        a.s0 = lp.s0;
      }
      a.prof = buildProfile(spec.speed || [[0, 0]]);
    }
    a.hit = null;
    return a;
  }

  function rawS(a, t) { return a.s0 + profS(a.prof, t); }

  function actorState(a, t) {
    if (a.fixed) return { x: a.fixed.x, y: a.fixed.y, h: a.fixed.h, v: 0, acc: 0, s: 0 };
    let s, v, acc;
    if (a.hit && t > a.hit.t) {
      const e = Math.exp(-(t - a.hit.t) / IMPACT_TAU);
      s = a.hit.s + a.hit.v * IMPACT_TAU * (1 - e);
      v = a.hit.v * e;
      acc = -99;
    } else {
      s = rawS(a, t);
      v = a.prof.vAt(t);
      acc = (a.prof.vAt(t + 0.05) - a.prof.vAt(t - 0.05)) / 0.1;
    }
    const p = pathAt(a.path, s);
    let h = pathHeading(a.path, s) + (a.reverse ? Math.PI : 0) + keyInterp(a.yaw, t) * DEG;
    if (a.hit && t > a.hit.t) h += a.hit.jolt * ease((t - a.hit.t) / 0.35);
    return { x: p.x, y: p.y, h, v, acc, s };
  }

  function localToWorld(st, lx, ly) {
    const c = Math.cos(st.h), s = Math.sin(st.h);
    return [st.x + lx * c - ly * s, st.y + lx * s + ly * c];
  }

  function bodyPoly(a, st) {
    const hw = a.W / 2, hl = a.L / 2;
    return [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([x, y]) => localToWorld(st, x, y));
  }

  function doorAngle(a, t) {
    if (!a.door) return 0;
    return ease((t - a.door.t) / 0.4) * 64 * DEG;
  }

  function doorPoly(a, st, t) {
    const ang = doorAngle(a, t);
    if (ang < 4 * DEG) return null;
    const hx = -a.W / 2, hy = -a.L * 0.12, len = 1.05;
    const dx = -Math.sin(ang), dy = Math.cos(ang);
    const nx = -dy * 0.06, ny = dx * 0.06;
    return [
      [hx + nx, hy + ny], [hx + dx * len + nx, hy + dy * len + ny],
      [hx + dx * len - nx, hy + dy * len - ny], [hx - nx, hy - ny],
    ].map(([x, y]) => localToWorld(st, x, y));
  }

  function polysOf(a, t) {
    const st = actorState(a, t);
    const out = [bodyPoly(a, st)];
    const d = doorPoly(a, st, t);
    if (d) out.push(d);
    return out;
  }

  function polyOverlap(P, Q) {
    for (const poly of [P, Q]) {
      for (let i = 0; i < poly.length; i++) {
        const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
        const nx = y2 - y1, ny = x1 - x2;
        let minP = Infinity, maxP = -Infinity, minQ = Infinity, maxQ = -Infinity;
        for (const [x, y] of P) { const d = x * nx + y * ny; minP = Math.min(minP, d); maxP = Math.max(maxP, d); }
        for (const [x, y] of Q) { const d = x * nx + y * ny; minQ = Math.min(minQ, d); maxQ = Math.max(maxQ, d); }
        if (maxP < minQ || maxQ < minP) return false;
      }
    }
    return true;
  }

  function anyOverlap(A, B) {
    for (const p of A) for (const q of B) if (polyOverlap(p, q)) return true;
    return false;
  }

  function pointInPoly(pt, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function contactPoint(A, B) {
    const pts = [];
    for (const p of A) for (const q of B) {
      for (const c of p) if (pointInPoly(c, q)) pts.push(c);
      for (const c of q) if (pointInPoly(c, p)) pts.push(c);
    }
    if (!pts.length) {
      const ca = A[0].reduce((m, c) => [m[0] + c[0] / 4, m[1] + c[1] / 4], [0, 0]);
      const cb = B[0].reduce((m, c) => [m[0] + c[0] / 4, m[1] + c[1] / 4], [0, 0]);
      return { x: (ca[0] + cb[0]) / 2, y: (ca[1] + cb[1]) / 2 };
    }
    const m = pts.reduce((acc, c) => [acc[0] + c[0], acc[1] + c[1]], [0, 0]);
    return { x: m[0] / pts.length, y: m[1] / pts.length };
  }

  // ------------------------------------------------------------- scenarios
  function prepare(sc) {
    if (sc.prepared) return sc;
    sc.actors = sc.actors.map(makeActor);
    sc.byId = Object.fromEntries(sc.actors.map((a) => [a.id, a]));
    sc.parked = sc.parked || [];
    sc.events = [];
    const solid = sc.actors.filter((a) => a.focal || a.solid);
    const pairs = [];
    for (let i = 0; i < solid.length; i++)
      for (let j = i + 1; j < solid.length; j++)
        if (!(solid[i].fixed && solid[j].fixed)) pairs.push([solid[i], solid[j]]);
    const done = new Set();
    const dt = 1 / 240;
    for (let iter = 0; iter < 4; iter++) {
      let found = null;
      for (let t = 0; t <= (sc.simEnd || 11) && !found; t += dt) {
        for (const [p, q] of pairs) {
          const key = p.id + "|" + q.id;
          if (done.has(key)) continue;
          const P = polysOf(p, t), Q = polysOf(q, t);
          if (anyOverlap(P, Q)) { found = { t, p, q, P, Q, key }; break; }
        }
      }
      if (!found) break;
      const { t, p, q, P, Q, key } = found;
      done.add(key);
      const point = contactPoint(P, Q);
      for (const [a, other] of [[p, q], [q, p]]) {
        if (a.fixed || a.hit || a.noStop) continue;
        const st = actorState(a, t), so = actorState(other, t);
        const c = Math.cos(st.h), s = Math.sin(st.h);
        const lx = (so.x - st.x) * c + (so.y - st.y) * s;
        const rel = Math.hypot(st.v, so.v);
        a.hit = { t, s: rawS(a, t), v: st.v, jolt: -Math.sign(lx || 1) * Math.min(9, 2 + rel) * DEG };
      }
      sc.events.push({ type: "impact", t, point, a: p.id, b: q.id });
    }
    if (!sc.events.length && sc.near) {
      const [ia, ib] = sc.near;
      const A = sc.byId[ia], B = sc.byId[ib];
      let best = { d: Infinity };
      for (let t = 0; t <= 11; t += 1 / 60) {
        const sa = actorState(A, t), sb = actorState(B, t);
        const d = Math.hypot(sa.x - sb.x, sa.y - sb.y);
        if (d < best.d) best = { d, t, point: { x: (sa.x + sb.x) / 2, y: (sa.y + sb.y) / 2 } };
      }
      sc.events.push({ type: "near", t: best.t, point: best.point, a: ia, b: ib, gap: best.d });
    }
    const first = sc.events[0];
    sc.tEvent = first ? first.t : sc.tEventDefault || 5;
    sc.eventPoint = first ? first.point : { x: 0, y: 0 };
    if (sc.tAction == null) sc.tAction = sc.tEvent - 1.6;
    sc.bgActors = buildBackground(sc);
    sc.prepared = true;
    return sc;
  }

  // Background traffic: wraps around a 120 m loop so it is always present.
  function buildBackground(sc) {
    const R = rng(sc.seed || 7);
    const list = [];
    const carColors = ["#eef0f2", "#c9ced4", "#2a2e35", "#8c2230", "#5c6875", "#d9d2c3", "#24426b", "#e8e4da"];
    const motoColors = ["#1b1d22", "#a8141d", "#e6e6e6", "#21407c", "#3a3f46"];
    const shirt = ["#e7e4dc", "#3b5f8a", "#a83a3a", "#2f6d4f", "#d9a441", "#6b4c8a", "#ececec", "#24323f"];
    const helmet = ["#f1c40f", "#e74c3c", "#f4f4f4", "#2f86d6", "#27ae60", "#ff8a4c", "#9b59b6", "#1f1f1f"];
    for (const spec of sc.bg || []) {
      const n = spec.n || 3;
      const kinds = spec.kinds || ["moto", "moto", "car"];
      for (let i = 0; i < n; i++) {
        const kind = kinds[i % kinds.length];
        list.push({
          kind, lane: spec.lane, v: spec.v || 7,
          offset: (spec.phase || 0) + i * (spec.gap || 120 / n) + (R() - 0.5) * 3,
          jitter: kind === "moto" ? (R() - 0.5) * 1.6 : (R() - 0.5) * 0.3,
          sway: R() * 6.28,
          color: kind === "moto" ? motoColors[Math.floor(R() * motoColors.length)] : carColors[Math.floor(R() * carColors.length)],
          shirt: shirt[Math.floor(R() * shirt.length)],
          helmet: helmet[Math.floor(R() * helmet.length)],
          L: DIM[kind][0], W: DIM[kind][1],
          window: spec.window || [-60, 60],
        });
      }
    }
    return list;
  }

  function bgState(b, t) {
    const span = 120;
    let d = (((b.offset + b.v * t) % span) + span) % span - 60; // -60..60 along travel
    const lat = LANE[b.lane] + b.jitter + (b.kind === "moto" ? Math.sin(t * 0.9 + b.sway) * 0.18 : 0);
    const dir = b.lane[0];
    if (dir === "N") return { x: lat, y: -d, h: 0, v: b.v, d };
    if (dir === "S") return { x: lat, y: d, h: Math.PI, v: b.v, d };
    if (dir === "E") return { x: d, y: lat, h: Math.PI / 2, v: b.v, d };
    return { x: -d, y: lat, h: -Math.PI / 2, v: b.v, d };
  }

  function bgPoly(b, st) { return bodyPoly(b, st); }

  return {
    DEG, LANE, HALF_ROAD, SIDEWALK, DIM, rng, clamp, lerp, ease,
    route, makePath, pathAt, pathHeading, lanePath, buildProfile, keyInterp,
    makeActor, actorState, bodyPoly, doorAngle, doorPoly, polysOf, polyOverlap, anyOverlap,
    prepare, bgState, bgPoly, localToWorld,
  };
});
