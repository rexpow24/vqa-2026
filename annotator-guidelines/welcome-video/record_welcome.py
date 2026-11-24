"""Record the real local app with Playwright, paced by the narration WAVs."""

from __future__ import annotations

import json
import re
import time
from pathlib import Path

from playwright.sync_api import Locator, Page, sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
SHOTLIST = json.loads((HERE / "shotlist.json").read_text(encoding="utf-8"))
FIXTURE = json.loads((OUT / "fixture.json").read_text(encoding="utf-8"))
BASE = SHOTLIST["base_url"]
VIDEO = 'video[src^="/api/videos/"]'


def target(page: Page, spec: dict) -> Locator:
    within = spec.get("within")
    if within == "party_fieldset_E:A":
        root = page.locator('article[data-qgroup="E"] fieldset').nth(0)
    elif within == "party_fieldset_E:B":
        root = page.locator('article[data-qgroup="E"] fieldset').nth(1)
    else:
        root = page.locator(within) if within else page
    if "field" in spec:
        root = root.locator(f'[data-field="{spec["field"]}"]')
    if "chip" in spec:
        return root.get_by_role("button").filter(has_text=spec["chip"]).first
    if "chip_starts_with" in spec:
        return root.get_by_role("button").filter(has_text=re.compile(rf"^{re.escape(spec['chip_starts_with'])}\s*[· ]")).first
    if "button_starts_with" in spec:
        return root.get_by_role("button").filter(has_text=re.compile(rf"^{re.escape(spec['button_starts_with'])}")).first
    if "css" in spec:
        return root.locator(spec["css"])
    if "role" in spec:
        kw = {"name": spec["name"]} if "name" in spec else {}
        if spec.get("exact"):
            kw["exact"] = True
        found = root.get_by_role(spec["role"], **kw)
        return found.filter(has_text=spec["hasText"]).first if "hasText" in spec else found.first
    if "text_starts_with" in spec:
        return root.get_by_text(re.compile(rf"^{re.escape(spec['text_starts_with'])}")).first
    if "text" in spec:
        return root.get_by_text(spec["text"], exact=False).first
    if "field" in spec:
        return root
    raise ValueError(f"Unknown target {spec}")


def cursor(page: Page, locator: Locator) -> None:
    locator.scroll_into_view_if_needed(timeout=15000)
    box = locator.bounding_box(timeout=15000)
    if box:
        x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        page.mouse.move(x, y, steps=10)
        page.evaluate("""([x,y]) => {
            let dot = document.getElementById('demo-pointer');
            if (!dot) { dot = document.createElement('div'); dot.id = 'demo-pointer';
              Object.assign(dot.style, {position:'fixed',zIndex:'2147483647',width:'13px',height:'13px',
                borderRadius:'50%',background:'#ffb000',border:'2px solid white',pointerEvents:'none',
                boxShadow:'0 0 8px #000'}); document.body.append(dot); }
            dot.style.left=(x-7)+'px'; dot.style.top=(y-7)+'px';
        }""", [x, y])
        page.wait_for_timeout(250)


def highlight(page: Page, locator: Locator) -> None:
    cursor(page, locator)
    box = locator.bounding_box()
    if box:
        page.evaluate("""b => {
          document.getElementById('demo-highlight')?.remove();
          const el=document.createElement('div'); el.id='demo-highlight';
          Object.assign(el.style,{position:'fixed',zIndex:'2147483646',pointerEvents:'none',
            border:'3px solid #ffb000',borderRadius:'8px',background:'rgba(255,176,0,.08)',
            left:(b.x-5)+'px',top:(b.y-5)+'px',width:(b.width+10)+'px',height:(b.height+10)+'px'});
          document.body.append(el); setTimeout(()=>el.remove(),3500);
        }""", box)


def overlay_card(page: Page, text: str) -> None:
    page.evaluate("""text => {
      document.getElementById('demo-title')?.remove();
      const el=document.createElement('div'); el.id='demo-title';
      Object.assign(el.style,{position:'fixed',inset:'0',zIndex:'2147483645',display:'grid',
        placeItems:'center',background:'#0b1018',color:'#fff',font:'bold 34px Arial',
        textAlign:'center',whiteSpace:'pre-line',lineHeight:'1.8',padding:'80px'});
      el.textContent=text; document.body.append(el);
    }""", text)


def click_field(page: Page, group: str, label: str, chip: str) -> None:
    root = page.locator(f'article[data-qgroup="{group}"] [data-field="{label}"]')
    button = root.get_by_role("button").filter(has_text=chip).first
    cursor(page, button)
    button.click()
    page.wait_for_timeout(230)


def execute(page: Page, step: dict) -> None:
    action = step["action"]
    spec = step.get("target")
    if action == "goto":
        page.goto(BASE + step["url"], wait_until="domcontentloaded")
        page.wait_for_timeout(350)
    elif action == "reload":
        page.reload(wait_until="domcontentloaded")
    elif action == "overlay_card":
        overlay_card(page, step["text"])
    elif action == "fill":
        value = {"$EMAIL": FIXTURE["email"], "$PASSWORD": FIXTURE["password"]}.get(step["value"], step["value"])
        page.locator(spec["css"]).fill(value)
    elif action == "click":
        page.locator("#demo-title").evaluate_all("els => els.forEach(el => el.remove())")
        loc = target(page, spec)
        cursor(page, loc)
        loc.click(timeout=15000)
        page.wait_for_timeout(250)
    elif action == "highlight":
        highlight(page, target(page, spec))
    elif action == "scroll_into_view":
        target(page, spec).scroll_into_view_if_needed(timeout=15000)
        page.wait_for_timeout(300)
    elif action == "wait_for":
        target(page, spec).wait_for(state=step.get("state", "visible"), timeout=15000)
    elif action == "wait_for_url":
        page.wait_for_url("**" + step["url"], timeout=30000)
    elif action == "click_blank":
        page.mouse.click(993, 500)
    elif action == "press":
        for _ in range(step.get("repeat", 1)):
            page.keyboard.press(step["key"])
            page.wait_for_timeout(step.get("interval_ms", 250))
    elif action == "seek":
        page.locator(VIDEO).evaluate("(v,t) => {v.pause(); v.currentTime=t}", step["time_s"])
        page.wait_for_timeout(400)
    elif action == "play_until":
        page.locator(VIDEO).evaluate("v => v.play()")
        page.wait_for_function("([sel,t]) => document.querySelector(sel)?.currentTime >= t", arg=[VIDEO, step["time_s"]], timeout=10000)
        page.locator(VIDEO).evaluate("v => v.pause()")
    elif action == "fill_card_S":
        values = SHOTLIST["demo_values_to_confirm"]["S"]
        labels = {"weather":"Thời tiết","light":"Ánh sáng","road_type":"Loại đường",
                  "surface":"Mặt đường","density":"Mật độ xe","segment":"Đoạn đường",
                  "surface_material":"Chất liệu mặt đường"}
        for key, value in values.items():
            click_field(page, "S", labels[key], value)
        target(page, {"within":'article[data-qgroup="S"]',"role":"button","name":"Lưu","exact":True}).click()
        page.locator('article[data-qgroup="S"]').get_by_text("✓ Đã lưu").wait_for(timeout=15000)
    elif action == "fill_card_Attr":
        card = page.locator('article[data-qgroup="Attr"]')
        button = card.get_by_role("button").filter(has_text=re.compile(r"^B\s*[· ]")).first
        cursor(page, button)
        button.click()
        page.locator(VIDEO).evaluate("(v,t) => {v.pause();v.currentTime=t}", SHOTLIST["demo_values_to_confirm"]["Attr"]["impact_mark_s"])
        card.get_by_role("button").filter(has_text=re.compile("^Đặt mốc va chạm")).first.click()
        card.get_by_role("button", name="Lưu", exact=True).click()
        card.get_by_text("✓ Đã lưu").wait_for(timeout=15000)
    elif action == "api_post":
        response = page.context.request.post(BASE + step["path"])
        if response.status != 200:
            raise RuntimeError(f"POST {step['path']}: {response.status} {response.text()[:200]}")
    elif action in {"cut", "cut_after_ms", "highlight_video_region"}:
        pass
    else:
        raise ValueError(f"Unsupported action {action}")


def run_scene(page: Page, scene: dict, take_start: float) -> dict:
    timing = json.loads((OUT / "audio" / f"{scene['id']}.timing.json").read_text(encoding="utf-8"))
    started = time.perf_counter()
    print(f"{scene['id']} start", flush=True)
    for step in scene["steps"]:
        if step["action"] in {"cut", "api_post", "reload"}:
            continue
        sentence = step["at_sentence"]
        due = timing["duration"] if sentence == "end" else timing["sentences"][sentence]["start"]
        wait = due - (time.perf_counter() - started)
        if wait > 0:
            page.wait_for_timeout(wait * 1000)
        try:
            execute(page, step)
        except Exception as exc:
            page.screenshot(path=str(OUT / f"error-{scene['id']}.png"))
            raise RuntimeError(f"{scene['id']} {step['action']} {step.get('target', '')}: {exc}") from exc
    wait = timing["duration"] - (time.perf_counter() - started)
    if wait > 0:
        page.wait_for_timeout(wait * 1000)
    end = time.perf_counter()
    page.screenshot(path=str(OUT / f"evidence-{scene['id']}.png"))
    result = {"id": scene["id"], "take_start": round(started - take_start, 3),
              "take_end": round(end - take_start, 3), "duration": round(end - started, 3)}
    print(f"{scene['id']} done {result['duration']}s", flush=True)
    return result


def video_route(route) -> None:
    url = route.request.url
    near = FIXTURE["videos"]["near_miss"] in url
    source = OUT / "source" / ("near-miss-masked.mp4" if near else "next-k18.mp4")
    data = source.read_bytes()
    match = re.match(r"bytes=(\d*)-(\d*)", route.request.headers.get("range", ""))
    headers = {"Content-Type":"video/mp4","Accept-Ranges":"bytes","Cache-Control":"no-store"}
    if match:
        start = int(match.group(1) or 0)
        end = min(int(match.group(2) or len(data)-1), len(data)-1)
        headers["Content-Range"] = f"bytes {start}-{end}/{len(data)}"
        route.fulfill(status=206, body=data[start:end+1], headers=headers)
    else:
        route.fulfill(status=200, body=data, headers=headers)


def record_take(browser, scenes: list[dict], number: int, state: Path | None) -> tuple[Path, list[dict], Path]:
    raw = OUT / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    context = browser.new_context(viewport=SHOTLIST["viewport"], device_scale_factor=1,
                                  storage_state=str(state) if state else None,
                                  record_video_dir=str(raw), record_video_size=SHOTLIST["viewport"])
    context.route("**/api/videos/*/stream", video_route)
    context.add_init_script("document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent='nextjs-portal{display:none!important}';document.head.append(s)})")
    page = context.new_page()
    video = page.video
    take_start = time.perf_counter()
    if number == 2:
        page.goto(BASE + "/annotate/" + FIXTURE["videos"]["near_miss"])
        page.locator('article[data-qgroup="E"] [data-field="Loại"]').first.wait_for(timeout=30000)
        take_start = time.perf_counter()
    entries = []
    for scene in scenes:
        entries.append(run_scene(page, scene, take_start))
    saved = OUT / f"state-take-{number}.json"
    context.storage_state(path=str(saved))
    if number == 1:
        for name in ("E-v1", "C-v1"):
            execute(page, {"action":"api_post", "path":f"/api/trainings/{name}/complete"})
    context.close()
    file = Path(video.path())
    final = raw / f"take-{number}.webm"
    file.replace(final)
    return final, entries, saved


def complete_welcome_off_camera(browser) -> None:
    context = browser.new_context()
    page = context.new_page()
    page.goto(BASE + "/login")
    page.locator("input[type=email]").fill(FIXTURE["email"])
    page.locator("input[autocomplete=current-password]").fill(FIXTURE["password"])
    page.get_by_role("button", name="Đăng nhập").click()
    page.wait_for_url(re.compile(r"/(annotate|huong-dan)$"), timeout=30000)
    execute(page, {"action":"api_post", "path":"/api/trainings/WELCOME-v1/complete"})
    context.close()


if __name__ == "__main__":
    import sys

    scenes = SHOTLIST["scenes"]
    resume = "--resume-take-2" in sys.argv
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True)
        if not resume:
            complete_welcome_off_camera(browser)
        if resume:
            durations = [21.22, 18.428, 25.442, 21.384]
            cursor_time = 0.0
            entries = []
            for item, duration in zip(scenes[:4], durations):
                entries.append({"id": item["id"], "take_start": round(cursor_time, 3),
                                "take_end": round(cursor_time + duration, 3), "duration": duration})
                cursor_time += duration + 0.55
            takes = [{"path": str(OUT / "raw" / "take-1.webm"), "scenes": entries}]
            state = OUT / "state-take-1.json"
            plan = [(2, scenes[4:13]), (3, scenes[13:])]
        else:
            takes = []
            state = None
            plan = list(enumerate((scenes[:4], scenes[4:13], scenes[13:]), 1))
        for number, selected in plan:
            path, entries, state = record_take(browser, selected, number, state)
            takes.append({"path":str(path), "scenes":entries})
            (OUT / "timing").mkdir(exist_ok=True)
            (OUT / "timing" / "takes.json").write_text(json.dumps(takes, ensure_ascii=False, indent=2), encoding="utf-8")
        browser.close()
    print("recording complete", flush=True)
