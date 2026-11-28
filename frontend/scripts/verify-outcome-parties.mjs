// Run against the local app and Supabase only:
//   TEST_BASE_URL=http://localhost:3006 node scripts/verify-outcome-parties.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { loadEnv, refuseUnlessLocal } from "./lib/env.mjs";

const env = loadEnv();
refuseUnlessLocal("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
refuseUnlessLocal("TEST_BASE_URL", env.TEST_BASE_URL);
const { privilegedClient, signIn, request } = await import("./lib/session.mjs");
const privileged = privilegedClient();
const base = env.TEST_BASE_URL.replace(/\/$/, "");
const tag = `outcome-${crypto.randomUUID().slice(0, 8)}`;
const must = ({ data, error }) => { if (error) throw error; return data; };
let userId;
let videoId;

async function capturePage(url, cookie) {
  const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  if (!fs.existsSync(edge)) throw new Error("Microsoft Edge is needed to capture UI evidence.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "vqa-outcome-edge-"));
  const browser = spawn(edge, ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=0",
    `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore", windowsHide: true });
  let socket;
  try {
    const portFile = path.join(profile, "DevToolsActivePort");
    for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await new Promise((resolve) => setTimeout(resolve, 100));
    if (!fs.existsSync(portFile)) throw new Error("Edge did not expose its debugging port.");
    const port = fs.readFileSync(portFile, "utf8").split(/\r?\n/)[0];
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let id = 0;
    const pending = new Map();
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id && pending.has(message.id)) {
        const { resolve, reject } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const next = ++id;
      pending.set(next, { resolve, reject });
      socket.send(JSON.stringify({ id: next, method, params }));
    });
    await send("Page.enable");
    await send("Network.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    for (const entry of cookie.split("; ")) {
      const separator = entry.indexOf("=");
      if (separator > 0) await send("Network.setCookie", {
        name: entry.slice(0, separator), value: entry.slice(separator + 1), url,
      });
    }
    await send("Page.navigate", { url });
    let box;
    for (let i = 0; i < 100; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const result = await send("Runtime.evaluate", { expression: `(() => {
        const card = document.querySelector('[data-qgroup="O"]');
        if (!card) return null;
        const rect = card.getBoundingClientRect();
        return { x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height,
          text: card.innerText };
      })()`, returnByValue: true });
      box = result.result?.value;
      if (box?.text?.includes("Lưu")) break;
    }
    if (!box?.text?.includes("Lưu") || box.text.includes("Báo cáo các bên") || box.text.includes("Các bên")) {
      throw new Error(`Group O UI did not render as expected: ${JSON.stringify(box)}`);
    }
    const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
      clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: box.height, scale: 1 } });
    const output = path.resolve("../docs/research/group-o-without-parties-local.png");
    fs.writeFileSync(output, Buffer.from(screenshot.data, "base64"));
    console.log(`PASS Group O UI has no parties row or parties report: ${output}`);
  } finally {
    socket?.close();
    browser.kill();
    if (browser.exitCode === null) await new Promise((resolve) => browser.once("exit", resolve));
    try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); }
    catch (error) { console.warn(`Could not remove Edge's temporary profile: ${error.message}`); }
  }
}

try {
  const email = `${tag}@example.com`;
  const password = crypto.randomBytes(24).toString("base64url");
  userId = must(await privileged.auth.admin.createUser({ email, password, email_confirm: true })).user.id;
  must(await privileged.from("user_profiles").insert({ id: userId, email, name: tag, role: "annotator", enabled: true }));
  must(await privileged.from("training_completions").insert(["WELCOME-v1", "C-v1", "E-v1"]
    .map((training) => ({ annotator_id: userId, training }))));
  const user = await signIn(email, password);
  const video = must(await privileged.from("videos").insert({
    drive_file_id: tag, filename: `${tag}.mp4`, duration_s: 10, agreement_sample: false,
  }).select("id").single());
  videoId = video.id;
  const drafts = must(await privileged.from("video_drafts").insert(["E", "C", "O"].map((qgroup) => ({
    video_id: videoId, qgroup, group_name: qgroup, question: `Q ${qgroup}`, answer: `A ${qgroup}`,
    source_sha256: "0".repeat(64), source_kind: "admin_csv", prompt_version: 0,
  }))).select("id,qgroup"));
  const draft = Object.fromEntries(drafts.map((row) => [row.qgroup, row.id]));
  must(await privileged.from("video_assignments").insert({
    video_id: videoId, annotator_id: userId, status: "pending", answer_format: "slots",
  }));

  const saveO = (slots) => request(base, `/api/drafts/${draft.O}/annotation`, user.cookie, "POST", {
    verdict: "SLOTS", codebook_version: "O.v3", slots, human_keyframes_s: [],
  });
  const before = await saveO({ signs: { options: ["sign.vehicle_fell"] } });
  if (before.status !== 422 || before.data?.code !== "cause_missing") throw new Error(`Missing C: ${JSON.stringify(before)}`);
  console.log("PASS O waits for C");

  const entities = [
    { key: "A", cells: { type: { option: "type.car" }, dashcam: { option: "dashcam.yes" } } },
    { key: "B", cells: { type: { option: "type.motorbike" }, vehicle_color: { option: "vehicle_color.red" } } },
  ];
  const savedE = await request(base, `/api/videos/${videoId}/entities`, user.cookie, "PUT", {
    codebook_version: "E.v6", entities,
  });
  if (savedE.status !== 200) throw new Error(`E save: ${JSON.stringify(savedE)}`);
  console.log("PASS E saved A and B");

  const cause = { event_type: { option: "event_type.collision" }, subject: { entity: "B" },
    object: { entity: "A" }, conflict_type: { option: "conflict_type.k04" },
    action: { option: "action.k04.lane_change_left" } };
  const savedC = await request(base, `/api/drafts/${draft.C}/annotation`, user.cookie, "POST", {
    verdict: "SLOTS", codebook_version: "C.v4", slots: cause, human_keyframes_s: [2, 5],
  });
  if (savedC.status !== 200) throw new Error(`C save: ${JSON.stringify(savedC)}`);
  console.log("PASS C saved collision");

  const savedO = await saveO({ signs: { options: ["sign.vehicle_fell"] }, parties: [{ entity: "B" }] });
  const row = must(await privileged.from("qa_annotations").select("slots,edited_answer,codebook_version")
    .eq("draft_id", draft.O).eq("annotator_id", userId).single());
  if (savedO.status !== 200 || JSON.stringify(row.slots.parties) !== JSON.stringify([{ entity: "A" }, { entity: "B" }])
      || row.slots.level?.option !== "level.moderate" || row.codebook_version !== "O.v3") {
    throw new Error(`O save or persistence: ${JSON.stringify({ savedO, row })}`);
  }
  console.log("PASS O saved both A and B despite stale one-party client payload");
  console.log(`PASS O persisted sentence: ${row.edited_answer}`);
  const page = await request(base, `/annotate/${videoId}`, user.cookie);
  if (page.status !== 200 || typeof page.data !== "string") throw new Error(`Annotate page: ${page.status}`);
  console.log("PASS annotator page renders");
  if (process.env.CAPTURE_SCREENSHOT === "1") await capturePage(`${base}/annotate/${videoId}`, user.cookie);
} finally {
  if (userId) {
    const { error } = await privileged.auth.admin.deleteUser(userId);
    if (error) console.error(`Fixture user cleanup: ${error.message}`);
  }
  if (videoId) {
    const { error } = await privileged.from("videos").delete().eq("id", videoId);
    if (error) console.error(`Fixture video cleanup: ${error.message}`);
  }
}
