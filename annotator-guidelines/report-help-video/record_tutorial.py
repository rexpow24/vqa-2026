"""Record the real local report, peer-help, and admin flows with Playwright."""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import Page, sync_playwright
from playwright.sync_api import TimeoutError as PlaywrightTimeout

HERE = Path(__file__).resolve().parent
OUT = HERE / "output"
FIXTURE = json.loads((OUT / "fixture.json").read_text(encoding="utf-8"))
BASE = "http://localhost:3006"
SOURCE = HERE.parent / "welcome-video" / "output" / "source" / "near-miss-masked.mp4"
VIEWPORT = {"width": 1600, "height": 900}


def serve_demo_video(route) -> None:
    data = SOURCE.read_bytes()
    match = re.match(r"bytes=(\d*)-(\d*)", route.request.headers.get("range", ""))
    headers = {"Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "no-store"}
    if match:
        start = int(match.group(1) or 0)
        end = min(int(match.group(2) or len(data) - 1), len(data) - 1)
        headers["Content-Range"] = f"bytes {start}-{end}/{len(data)}"
        route.fulfill(status=206, body=data[start:end + 1], headers=headers)
    else:
        route.fulfill(status=200, body=data, headers=headers)


def context(browser, storage=None, record=False):
    options = {"viewport": VIEWPORT, "device_scale_factor": 1}
    if storage:
        options["storage_state"] = str(storage)
    if record:
        raw = OUT / "raw"
        raw.mkdir(parents=True, exist_ok=True)
        options["record_video_dir"] = str(raw)
        options["record_video_size"] = VIEWPORT
    ctx = browser.new_context(**options)
    ctx.route("**/api/videos/*/stream", serve_demo_video)
    ctx.add_init_script("document.addEventListener('DOMContentLoaded',()=>{let s=document.createElement('style');s.textContent='nextjs-portal{display:none!important}';document.head.append(s)})")
    return ctx


def log_in(browser, who: str) -> Path:
    ctx = context(browser)
    page = ctx.new_page()
    user = FIXTURE["users"][who]
    page.goto(BASE + "/login", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(400)
    page.locator("input[type=email]").fill(user["email"])
    page.locator("input[autocomplete=current-password]").fill(user["password"])
    if page.locator("input[type=email]").input_value() != user["email"]:
        page.locator("input[type=email]").fill(user["email"])
    page.get_by_role("button", name="Đăng nhập").click()
    try:
        page.wait_for_url(re.compile(r"/(annotate|huong-dan|admin)(/.*)?$"), timeout=30000)
    except PlaywrightTimeout:
        page.screenshot(path=str(OUT / f"debug-login-{who}.png"))
        print(f"Login failed for {who}: url={page.url}, alerts={page.get_by_role('alert').all_text_contents()}", flush=True)
        raise
    if who != "admin":
        response = page.request.post(BASE + "/api/trainings/WELCOME-v1/complete")
        if not response.ok:
            raise RuntimeError(f"Welcome completion for {who}: {response.status}")
    state = OUT / f"{who}.storage.json"
    ctx.storage_state(path=str(state))
    ctx.close()
    return state


def wait_until(start: float, seconds: float) -> None:
    remaining = seconds - (time.perf_counter() - start)
    if remaining > 0:
        time.sleep(remaining)


def title(page: Page, text: str) -> None:
    page.evaluate("""text => {
      document.getElementById('tutorial-title')?.remove();
      const el = document.createElement('div'); el.id = 'tutorial-title';
      Object.assign(el.style, {position:'fixed',top:'15px',left:'15px',zIndex:'2147483646',
        background:'#0b1018',color:'#fff',padding:'12px 18px',font:'bold 20px Arial',
        border:'2px solid #f59e0b',borderRadius:'8px',pointerEvents:'none'});
      el.textContent = text; document.body.append(el);
    }""", text)


def point(page: Page, locator) -> None:
    locator.scroll_into_view_if_needed()
    box = locator.bounding_box()
    if not box:
        return
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(x, y, steps=12)
    page.evaluate("""([x,y]) => {
      document.getElementById('tutorial-pointer')?.remove();
      const el=document.createElement('div');el.id='tutorial-pointer';
      Object.assign(el.style,{position:'fixed',left:(x-8)+'px',top:(y-8)+'px',zIndex:'2147483647',
        width:'16px',height:'16px',borderRadius:'50%',background:'#f59e0b',border:'2px solid white',
        boxShadow:'0 0 6px black',pointerEvents:'none'});document.body.append(el);
    }""", [x, y])
    page.wait_for_timeout(250)


def click(page: Page, locator) -> None:
    point(page, locator)
    locator.click()


def audio_duration(*ids: str) -> float:
    return sum(json.loads((OUT / "audio" / f"{item}.timing.json").read_text(encoding="utf-8"))["duration"] for item in ids)


def record(browser, name: str, state: Path, run) -> dict:
    ctx = context(browser, state, record=True)
    page = ctx.new_page()
    video = page.video
    started = time.perf_counter()
    run(page, started)
    duration = time.perf_counter() - started
    page.screenshot(path=str(OUT / f"evidence-{name}.png"), full_page=True)
    ctx.close()
    raw = OUT / "raw" / f"{name}.webm"
    Path(video.path()).replace(raw)
    print(f"{name}: recorded {duration:.2f}s", flush=True)
    return {"name": name, "path": str(raw), "duration": round(duration, 3)}


def prepare_saved_answer(browser, state: Path) -> None:
    ctx = context(browser, state)
    page = ctx.new_page()
    page.goto(BASE + "/annotate/" + FIXTURE["video"]["id"], wait_until="domcontentloaded")
    card = page.locator('article[data-qgroup="S"]')
    card.locator('[data-field="Thời tiết"]').wait_for(timeout=30000)
    for field, option in [
        ("Thời tiết", "tạnh ráo"), ("Ánh sáng", "ban ngày"),
        ("Loại đường", "hai chiều không có dải phân cách"),
        ("Mặt đường", "khô"), ("Đoạn đường", "thẳng"),
    ]:
        card.locator(f'[data-field="{field}"]').get_by_role("button", name=option, exact=True).click()
    card.get_by_role("button", name="Lưu", exact=True).click()
    card.get_by_text("✓ Đã lưu").wait_for(timeout=30000)
    page.screenshot(path=str(OUT / "evidence-saved-answer.png"))
    ctx.close()


def reporter_take(page: Page, started: float) -> None:
    page.goto(BASE + "/annotate/" + FIXTURE["video"]["id"], wait_until="domcontentloaded")
    card = page.locator('article[data-qgroup="S"]')
    field = card.locator('[data-field="Thời tiết"]')
    button = field.get_by_role("button", name="Xin hỗ trợ phân xử ô này")
    button.wait_for(timeout=30000)
    title(page, "1. Báo cáo đúng ô còn phân vân")
    wait_until(started, 1.2)
    click(page, button)
    wait_until(started, 4.2)
    field.get_by_role("textbox").fill("Cần xem lại thời tiết trong video.")
    page.screenshot(path=str(OUT / "evidence-report-form.png"))
    wait_until(started, audio_duration("01-report"))
    title(page, "2. Đáp án của ô này được che")
    wait_until(started, audio_duration("01-report") + 4.0)
    click(page, field.get_by_role("button", name="Gửi xin phân xử"))
    field.get_by_role("button", name="Đã xin hỗ trợ").wait_for(timeout=30000)
    page.screenshot(path=str(OUT / "evidence-report-sent.png"))
    wait_until(started, audio_duration("01-report", "02-privacy") - 3.0)
    page.goto(BASE + "/resolve", wait_until="domcontentloaded")
    page.get_by_text("Người tạo báo cáo không được biểu quyết").wait_for(timeout=30000)
    title(page, "Người báo cáo không tự biểu quyết")
    wait_until(started, audio_duration("01-report", "02-privacy") + 1.0)


def peer_take(page: Page, started: float) -> None:
    page.goto(BASE + "/resolve", wait_until="domcontentloaded")
    page.get_by_role("heading", name="Cần annotator hỗ trợ").wait_for(timeout=30000)
    page.get_by_text(FIXTURE["video"]["filename"]).wait_for(timeout=30000)
    title(page, "3. Cần hỗ trợ: xem video và ngữ cảnh")
    wait_until(started, 2.0)
    page.locator("video").first.evaluate("v => {v.currentTime=1;v.pause()}")
    wait_until(started, 6.0)
    click(page, page.get_by_text("Xem câu trả lời hiện tại (đã che ô cần phân xử)"))
    page.screenshot(path=str(OUT / "evidence-peer-masked.png"), full_page=True)
    wait_until(started, audio_duration("03-queue"))
    title(page, "4. Chọn đáp án độc lập")
    select = page.get_by_label(re.compile("Bạn chọn đáp án nào"))
    point(page, select)
    select.select_option(label="tạnh ráo")
    wait_until(started, audio_duration("03-queue") + 3.0)
    click(page, page.get_by_role("button", name="Gửi lựa chọn"))
    page.get_by_text("Đã gửi lựa chọn cho video").wait_for(timeout=30000)
    page.screenshot(path=str(OUT / "evidence-peer-voted.png"))
    wait_until(started, audio_duration("03-queue", "04-vote") + 1.0)


def second_peer_vote(browser, state: Path) -> None:
    ctx = context(browser, state)
    page = ctx.new_page()
    page.goto(BASE + "/resolve", wait_until="domcontentloaded")
    page.get_by_text(FIXTURE["video"]["filename"]).wait_for(timeout=30000)
    page.get_by_label(re.compile("Bạn chọn đáp án nào")).select_option(label="tạnh ráo")
    page.get_by_role("button", name="Gửi lựa chọn").click()
    page.get_by_text("Đã gửi lựa chọn cho video").wait_for(timeout=30000)
    ctx.close()


def admin_take(page: Page, started: float) -> None:
    page.goto(BASE + "/admin/reports", wait_until="domcontentloaded")
    case = page.locator("article").filter(has_text=FIXTURE["video"]["filename"]).first
    case.wait_for(timeout=30000)
    title(page, "5. Admin xem các ý kiến và chốt")
    point(page, case.get_by_text("Ý kiến annotator"))
    page.screenshot(path=str(OUT / "evidence-admin-votes.png"), full_page=True)
    wait_until(started, 8.5)
    case.get_by_label("Đáp án cuối cùng do admin chốt").fill("tạnh ráo")
    wait_until(started, 11.0)
    click(page, case.get_by_role("button", name="Chốt đáp án"))
    page.get_by_text("Đã chốt đáp án cho video").wait_for(timeout=30000)
    click(page, page.get_by_role("button", name=re.compile("Admin đã chốt")))
    case = page.locator("article").filter(has_text=FIXTURE["video"]["filename"]).first
    case.get_by_text("Đáp án admin:", exact=False).wait_for(timeout=30000)
    page.screenshot(path=str(OUT / "evidence-admin-final.png"), full_page=True)
    wait_until(started, audio_duration("05-admin") + 1.0)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chrome", headless=True,
                                             args=["--window-size=1600,900", "--force-device-scale-factor=1"])
        if "--admin-only" in sys.argv:
            takes = [record(browser, "admin", OUT / "admin.storage.json", admin_take)]
            browser.close()
            (OUT / "admin-take.json").write_text(json.dumps(takes, ensure_ascii=False, indent=2), encoding="utf-8")
            print("Admin walkthrough recorded", flush=True)
            sys.exit(0)
        states = {key: log_in(browser, key) for key in FIXTURE["users"]}
        prepare_saved_answer(browser, states["reporter"])
        takes = [record(browser, "reporter", states["reporter"], reporter_take)]
        takes.append(record(browser, "peer", states["peerOne"], peer_take))
        second_peer_vote(browser, states["peerTwo"])
        takes.append(record(browser, "admin", states["admin"], admin_take))
        browser.close()
    (OUT / "takes.json").write_text(json.dumps(takes, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Tutorial walkthrough recorded", flush=True)
