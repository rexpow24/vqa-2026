// Sanity check for every scenario: prints the simulated events and flags
// geometry problems (event off-screen, background traffic driving through a
// focal vehicle, a focal vehicle driving through a parked one).
// Usage: node anim/check.js [scenarioId ...]
"use strict";
const E = require("./engine.js");
const Sc = require("./scenarios.js");

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Sc.ids;
let problems = 0;
for (const id of ids) {
  const sc = Sc.get(id);
  const ev = sc.events.map((e) => `${e.type}@${e.t.toFixed(2)}s (${e.point.x.toFixed(1)},${e.point.y.toFixed(1)}) ${e.a}-${e.b}${e.gap ? " gap " + e.gap.toFixed(2) : ""}`);
  const issues = [];
  if (!sc.events.length) issues.push("no event");
  const p = sc.eventPoint;
  if (Math.abs(p.y - ((sc.cam && sc.cam.y) || 0)) > 14 || Math.abs(p.x) > 20) issues.push("event near view edge");
  if (sc.near && sc.events[0] && sc.events[0].type === "impact" && !sc.allowImpact) issues.push("expected near-miss but collided");
  const solid = sc.actors.filter((a) => a.focal || a.solid);
  const t0 = sc.tEvent - 7, t1 = sc.tEvent + 2;
  const seen = new Set();
  for (let t = t0; t <= t1; t += 0.05) {
    const polys = solid.map((a) => ({ a, P: E.polysOf(a, t) }));
    for (const b of sc.bgActors) {
      const st = E.bgState(b, t);
      if (Math.abs(st.x) > 40 || Math.abs(st.y) > 30) continue;
      const bp = [E.bgPoly(b, st)];
      for (const { a, P } of polys) {
        if (E.anyOverlap(bp, P)) {
          const k = `bg ${b.lane}/${b.kind} x ${a.id}`;
          if (!seen.has(k)) { seen.add(k); issues.push(`${k} @${t.toFixed(2)}s (${st.x.toFixed(1)},${st.y.toFixed(1)})`); }
        }
      }
      for (const q of sc.parked) {
        const dims = E.DIM[q.kind];
        const qp = [E.bodyPoly({ L: dims[0], W: dims[1] }, { x: q.x, y: q.y, h: (q.heading || 0) * E.DEG })];
        if (E.anyOverlap(bp, qp)) {
          const k = `bg ${b.lane}/${b.kind} x parked(${q.x},${q.y})`;
          if (!seen.has(k)) { seen.add(k); issues.push(k); }
        }
      }
    }
    for (const { a, P } of polys) {
      for (const q of sc.parked) {
        const dims = E.DIM[q.kind];
        const qp = [E.bodyPoly({ L: dims[0], W: dims[1] }, { x: q.x, y: q.y, h: (q.heading || 0) * E.DEG })];
        if (E.anyOverlap(P, qp)) {
          const k = `${a.id} x parked(${q.x},${q.y})`;
          if (!seen.has(k)) { seen.add(k); issues.push(`${k} @${t.toFixed(2)}s`); }
        }
      }
    }
  }
  problems += issues.length;
  console.log(`${id.padEnd(9)} tAction ${sc.tAction.toFixed(2)}  ${ev.join("; ")}`);
  for (const i of issues) console.log(`   ! ${i}`);
}
console.log(problems ? `${problems} issue(s)` : "all scenarios clean");
process.exitCode = problems ? 1 : 0;
