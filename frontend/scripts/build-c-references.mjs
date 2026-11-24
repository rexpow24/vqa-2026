// Builds frontend/src/lib/references/C.json, the group C hints and reference
// videos the slot form shows when an annotator picks a conflict type
// (features/c-reference-hints).
//
//   cd frontend && node scripts/build-c-references.mjs
//
// Content comes from the C training narration (per-K cues and the K codes its
// "edge" line names) plus the K pairs annotators confused most in round #21-#40.
// Videos are the rendered clips on the shared Drive folder below, which is
// shared "anyone with the link", so the app streams them like dataset videos.

import fs from "node:fs";
import path from "node:path";
import { FRONTEND_DIR, REPO_ROOT } from "./lib/env.mjs";

const NARRATION = path.join(REPO_ROOT, "annotator-guidelines", "tham-khao-C", "video-training", "narration.vi.json");
const OUTPUT = path.join(FRONTEND_DIR, "src", "lib", "references", "C.json");

// Drive folder 1ybYUK9k00qBVikEFq2ATwlZbd5eZyUGq, listed 2026-11-24.
const DRIVE = {
  K01: "1Ds4-cvHLxBNMRk6W5fmPBwRZtPM0CcA5", K02: "1vMNruepI1_EG3bUKsBwg6HBe0wbOgG3F",
  K03: "1odXIzNEH1PNnLHxVVSAs39fZSnAjCQnm", K04: "1ZKzzuH8z6icC2X0R89FU77uf6W3mLyYq",
  K05: "1obNZoWylzyyuLBxbCeqcHZ8145apoKqf", K06: "1scjRGYwUpV8Da3L0T7HQt_xb7o4NqQUf",
  K07: "1Kfrfutdx7KKckMlqdczaIb0jKQHQJAgv", K08: "1jdZ-fwjtTAjMu-zVUQwL9Tw7-s7xKSRa",
  K09: "1XbBNVndHhM1_Q6wlE0ztqLSmXrqvzs5E", K10: "1OWizD5mc5daeUN9H6Ozo9tP06Pj-q6w4",
  K11: "1Wyw8mw4rzSGIRNUU-jyiOhU68u2A651p", K12: "17vlSqDdDSUwlo7y9tcu3xEgjFqa0HMxT",
  K13: "1TvtwwzpH3XhdIYgSrPZZOmoK-IjaQetr", K14: "1ZpoA-_JPkGF60VyGMq3vb-b-N_kdYTBd",
  K15: "1W9EtLemN4g9a8IRR3ndmOGXla8arcFK8", K16: "1lPhNZj_UX83Zib57fPf_0JlDiLeH0CaW",
  K17: "1c6DhIMSqRCoABOLzaVVSTLVzg1JTOWKN", K18: "1ZspuxQvz2GNqOKxasAC3eIn_fLZng15W",
  "K08-K09": "1cSrf4nINIUPtfVti-MFSwMUfPqKylX0x", "K09-K14": "1zVpqbBbrLylyJInDvoYpnk81h4ongvaM",
  "K10-K14": "1hcaqAHRBFquIq2Bqxq2ANnsi9Oeyl521", "K11-K12": "1Yn5mJ6qKFYj9QN8YYrIfeGbi5IQ0y3AQ",
  "K11-K14": "15x9qXQUREhP9KM3lnPu9hzNqlnUMnJn1", "K12-K14": "1294pBwbHxSAYa2qeMaQGyeAS9zeZ_l4T",
  // The full C training video, mandatory before labelling C (features/c-training-gate).
  "C-training-full": "11g4B8N8AJ4DYoDi5b0NSBVstfslywYeq",
};

// Annotator pairs that chose these two K on the same video, round #21-#40 (C.v4, 6 annotators, 20 videos).
const MEASURED = [["K08", "K09"], ["K11", "K12"], ["K12", "K14"], ["K10", "K14"], ["K11", "K14"], ["K09", "K14"],
  ["K04", "K12"], ["K14", "K15"], ["K01", "K02"], ["K02", "K03"], ["K03", "K05"], ["K08", "K18"]];

const narration = JSON.parse(fs.readFileSync(NARRATION, "utf8"));
const episodes = Object.fromEntries(narration.episodes.map((item) => [item.id, item]));
const comparisons = Object.fromEntries(narration.comparisons.map((item) => [item.id, item]));
const pairId = (a, b) => [a, b].sort().join("-");

const out = {};
for (const code of Object.keys(episodes).filter((id) => /^K\d\d$/.test(id)).sort()) {
  const episode = episodes[code];
  if (!DRIVE[code]) throw new Error(`No Drive video for ${code}`);
  // "xem K01 đến K17" is a range, not two confusable types.
  const edge = (episode.edge ?? "").replace(/K\d\d đến K\d\d/g, "");
  const named = [...edge.matchAll(/K\d\d/g)].map((match) => match[0]);
  const measured = MEASURED.filter((pair) => pair.includes(code)).map((pair) => pair.find((other) => other !== code));
  const confusable = [...new Set([...measured, ...named])].filter((other) => other !== code && episodes[other]);
  out[code] = {
    title: episode.title,
    cues: episode.cues ?? [],
    edge: episode.edge ?? "",
    video: DRIVE[code],
    confusable: confusable.map((other) => {
      const pair = pairId(code, other);
      return { code: other, title: episodes[other].title, measured: measured.includes(other),
        pair: DRIVE[pair] ? { id: pair, title: comparisons[pair]?.title ?? pair, cues: comparisons[pair]?.cues ?? [] } : null };
    }),
  };
}
const videos = Object.fromEntries(Object.entries(DRIVE));
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify({ source: "scripts/build-c-references.mjs", types: out, videos }, null, 2)}\n`);
console.log(`Wrote ${Object.keys(out).length} conflict types to ${path.relative(FRONTEND_DIR, OUTPUT)}`);
