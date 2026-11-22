"""Render the Group C learning series from the current codebook and local VieNeu-TTS."""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "output"
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
FFMPEG = Path(r"C:\ffmpeg\ffmpeg-8.1-essentials_build\bin\ffmpeg.exe")

COLORS = {
    "bg": "#071321", "panel": "#101f30", "panel2": "#14283b", "road": "#354355",
    "lane": "#d7e1ea", "blue": "#58a6ff", "orange": "#ffb84d", "red": "#ff667a",
    "green": "#38d996", "text": "#f2f6fa", "muted": "#adc0d3", "ink": "#122033",
}


def wrap(text: str, limit: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if len(candidate) > limit and line:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def text_block(x: int, y: int, text: str, limit: int, *, size=28, color=None, weight=500, line=1.35) -> str:
    color = color or COLORS["text"]
    rows = wrap(text, limit)
    spans = "".join(
        f'<tspan x="{x}" dy="{0 if i == 0 else size * line:.1f}">{html.escape(row)}</tspan>'
        for i, row in enumerate(rows)
    )
    return f'<text x="{x}" y="{y}" fill="{color}" font-size="{size}" font-weight="{weight}">{spans}</text>'


def car(x: int, y: int, label: str, color: str, angle=0, scale=1.0) -> str:
    return (
        f'<g transform="translate({x} {y}) rotate({angle}) scale({scale})">'
        f'<rect x="-42" y="-68" width="84" height="136" rx="19" fill="{color}" stroke="#f7fbff" stroke-width="5"/>'
        '<rect x="-30" y="-38" width="60" height="42" rx="8" fill="#dcedfb" opacity=".92"/>'
        '<rect x="-28" y="18" width="56" height="27" rx="7" fill="#152334" opacity=".88"/>'
        f'<text x="0" y="9" text-anchor="middle" font-size="30" font-weight="900" fill="{COLORS["ink"]}">{label}</text>'
        '</g>'
    )


def arrow(x1: int, y1: int, x2: int, y2: int, color=None, width=9, dashed=False) -> str:
    color = color or COLORS["orange"]
    dash = ' stroke-dasharray="18 14"' if dashed else ""
    return (
        f'<defs><marker id="arr" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto">'
        f'<path d="M0,0 L12,6 L0,12 z" fill="{color}"/></marker></defs>'
        f'<path d="M{x1},{y1} L{x2},{y2}" fill="none" stroke="{color}" stroke-width="{width}"'
        f'{dash} marker-end="url(#arr)" stroke-linecap="round"/>'
    )


def road(scene: str) -> str:
    c = COLORS
    if scene in {"following", "same_direction", "curb", "oncoming", "oncoming_turn", "reverse", "single_vehicle"}:
        base = f'<rect x="100" y="245" width="1000" height="455" rx="24" fill="{c["road"]}"/>'
        base += f'<path d="M600 255 V690" stroke="{c["lane"]}" stroke-width="7" stroke-dasharray="28 24" opacity=".75"/>'
        if scene in {"oncoming", "oncoming_turn"}:
            base += f'<path d="M600 255 V690" stroke="{c["orange"]}" stroke-width="5" opacity=".8"/>'
        if scene == "following":
            base += car(405, 370, "B", c["blue"])
            base += car(405, 600, "A", c["orange"])
            base += arrow(405, 535, 405, 455, c["green"])
        elif scene == "same_direction":
            base += car(385, 575, "A", c["orange"])
            base += car(760, 390, "B", c["blue"])
            base += arrow(430, 545, 650, 405, c["green"])
        elif scene == "curb":
            base += f'<rect x="100" y="245" width="110" height="455" fill="#7b8998" opacity=".7"/>'
            base += car(360, 420, "A", c["orange"])
            base += car(620, 565, "B", c["blue"])
            base += arrow(360, 430, 480, 440, c["red"])
        elif scene == "oncoming":
            base += car(395, 385, "A", c["orange"])
            base += car(805, 570, "B", c["blue"], 180)
            base += arrow(395, 445, 520, 510, c["red"])
        elif scene == "oncoming_turn":
            base += car(405, 585, "A", c["orange"])
            base += car(820, 405, "B", c["blue"], 180)
            base += '<path d="M410 520 C410 440 520 405 560 445" fill="none" stroke="#ff667a" stroke-width="10" marker-end="url(#arr)"/>'
            base += arrow(820, 465, 820, 535, c["blue"])
        elif scene == "reverse":
            base += car(410, 430, "A", c["orange"], 180)
            base += car(700, 580, "B", c["blue"])
            base += arrow(410, 515, 410, 445, c["red"])
        else:
            base += car(405, 440, "A", c["orange"], -25)
            base += arrow(410, 510, 470, 400, c["red"], dashed=True)
            base += '<path d="M320 560 Q460 650 520 565" fill="none" stroke="#ff667a" stroke-width="8" stroke-dasharray="16 14"/>'
        return base

    if scene in {"intersection", "intersection_access", "intersection_midblock", "access", "access_midblock", "turn_midblock", "midblock_turn", "midblock_cross", "wrongway_crossing"}:
        base = f'<rect x="100" y="245" width="1000" height="455" rx="24" fill="{c["road"]}"/>'
        if scene in {"intersection", "intersection_midblock", "intersection_access"}:
            base += f'<rect x="385" y="245" width="430" height="455" fill="{c["road"]}"/>'
            base += f'<rect x="100" y="365" width="1000" height="215" fill="{c["road"]}"/>'
            base += f'<path d="M600 250 V360 M600 590 V695 M110 470 H380 M820 470 H1090" stroke="{c["lane"]}" stroke-width="7" stroke-dasharray="23 20"/>'
            base += car(385, 465, "A", c["orange"], 90)
            base += car(815, 465, "B", c["blue"], -90)
            base += arrow(435, 465, 725, 465, c["green"])
            if scene == "intersection_access":
                base += f'<rect x="100" y="600" width="290" height="95" fill="{c["road"]}"/>'
                base += f'<path d="M115 648 H360" stroke="{c["lane"]}" stroke-width="6" stroke-dasharray="18 16"/>'
                base += car(330, 650, "A", c["orange"], 90, .58)
                base += arrow(360, 650, 480, 520, c["red"], 7)
        elif scene in {"access", "access_midblock"}:
            base += f'<rect x="100" y="400" width="470" height="180" fill="{c["road"]}"/>'
            base += f'<path d="M600 250 V400 M600 580 V695 M115 490 H560 M790 490 H1085" stroke="{c["lane"]}" stroke-width="7" stroke-dasharray="23 20"/>'
            base += car(350, 490, "A", c["orange"], 90)
            base += car(800, 560, "B", c["blue"])
            base += arrow(400, 490, 610, 490, c["red"])
        elif scene in {"turn_midblock", "midblock_turn"}:
            base += f'<path d="M600 250 V695" stroke="{c["lane"]}" stroke-width="7" stroke-dasharray="28 22"/>'
            base += car(400, 580, "A", c["orange"])
            base += car(815, 375, "B", c["blue"], 180)
            base += '<path d="M400 515 C400 425 540 400 580 465" fill="none" stroke="#ff667a" stroke-width="10" marker-end="url(#arr)"/>'
            base += arrow(815, 450, 815, 540, c["blue"])
        elif scene == "wrongway_crossing":
            base += f'<path d="M600 250 V695" stroke="{c["orange"]}" stroke-width="6"/>'
            base += car(400, 385, "A", c["orange"])
            base += car(800, 575, "B", c["blue"], 180)
            base += arrow(400, 420, 400, 560, c["red"])
        else:
            base += f'<path d="M600 250 V695" stroke="{c["lane"]}" stroke-width="7" stroke-dasharray="28 22"/>'
            base += car(265, 460, "A", c["orange"], 90)
            base += car(820, 550, "B", c["blue"])
            base += arrow(325, 460, 890, 460, c["red"])
        return base

    if scene in {"pedestrian", "animal"}:
        base = f'<rect x="100" y="245" width="1000" height="455" rx="24" fill="{c["road"]}"/>'
        base += f'<path d="M600 250 V695" stroke="{c["lane"]}" stroke-width="7" stroke-dasharray="28 22"/>'
        base += car(785, 535, "A", c["blue"])
        if scene == "pedestrian":
            base += '<circle cx="340" cy="430" r="28" fill="#f7fbff"/><path d="M340 463 V540 M340 485 L295 515 M340 485 L385 515 M340 540 L300 585 M340 540 L380 585" stroke="#f7fbff" stroke-width="15" stroke-linecap="round"/>'
            base += arrow(390, 470, 680, 470, c["orange"])
        else:
            base += '<ellipse cx="340" cy="470" rx="70" ry="43" fill="#ffb84d" stroke="#fff" stroke-width="5"/><circle cx="410" cy="445" r="24" fill="#ffb84d" stroke="#fff" stroke-width="5"/><path d="M300 500 l-20 34 M355 500 l20 34" stroke="#ffb84d" stroke-width="12" stroke-linecap="round"/>'
            base += arrow(430, 470, 680, 470, c["red"])
        return base
    return f'<rect x="100" y="245" width="1000" height="455" rx="24" fill="{c["road"]}"/>'


def comparison_road(pair_id: str) -> str:
    """Draw both situations side by side so the visual contrast is explicit."""
    c = COLORS
    left_x, right_x, y, width, height = 100, 610, 245, 490, 455
    out = []
    titles = {
        "K08-K09": ("K08 • LẤN QUA TIM ĐƯỜNG", "K09 • ĐI NGƯỢC CHIỀU SẴN"),
        "K11-K12": ("K11 • HAI LUỒNG QUA NÚT GIAO", "K12 • TỪ ĐƯỜNG NHÁNH NHẬP VÀO"),
        "K12-K14": ("K12 • CÓ LỐI NỐI VÀO ĐƯỜNG", "K14 • BĂNG NGANG GIỮA ĐOẠN"),
        "K10-K14": ("K10 • RẼ CẮT LUỒNG ĐỐI DIỆN", "K14 • BĂNG NGANG, KHÔNG Ở NÚT GIAO"),
        "K11-K14": ("K11 • CÓ NÚT GIAO", "K14 • KHÔNG CÓ NÚT GIAO"),
        "K09-K14": ("K09 • XE ĐI DỌC NGƯỢC CHIỀU", "K14 • XE ĐI NGANG QUA ĐƯỜNG"),
    }
    left_title, right_title = titles[pair_id]

    def tile(x: int, title_text: str) -> str:
        return (
            f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="20" fill="{c["road"]}" stroke="#607287" stroke-width="3"/>'
            f'<rect x="{x+12}" y="{y+12}" width="{width-24}" height="50" rx="12" fill="#192a3d"/>'
            f'<text x="{x+width/2}" y="{y+46}" text-anchor="middle" fill="{c["text"]}" font-size="20" font-weight="850">{html.escape(title_text)}</text>'
        )

    out.extend([tile(left_x, left_title), tile(right_x, right_title)])
    # All tiles contain the same two-way road base. The markings and paths show
    # whether the focal movement changes lane, turns, enters from a side access,
    # or travels laterally across a midblock segment.
    for x in (left_x, right_x):
        out.append(f'<path d="M{x+245} {y+78} V{y+440}" stroke="{c["lane"]}" stroke-width="5" stroke-dasharray="19 16"/>')

    if pair_id == "K08-K09":
        out.append(car(left_x+150, y+210, "A", c["orange"]))
        out.append(car(left_x+330, y+335, "B", c["blue"], 180))
        out.append(arrow(left_x+155, y+255, left_x+300, y+300, c["red"], 7))
        out.append(car(right_x+330, y+190, "A", c["orange"], 180))
        out.append(car(right_x+160, y+350, "B", c["blue"]))
        out.append(arrow(right_x+330, y+245, right_x+330, y+305, c["red"], 7))
    elif pair_id in {"K11-K12", "K12-K14", "K11-K14"}:
        # Left tile depicts a true intersection for K11; otherwise it depicts a
        # side access for K12. Right tile depicts an access or a midblock crossing.
        if pair_id in {"K11-K12", "K11-K14"}:
            out.append(f'<rect x="{left_x+145}" y="{y+65}" width="200" height="390" fill="{c["road"]}"/>')
            out.append(f'<rect x="{left_x+5}" y="{y+190}" width="480" height="150" fill="{c["road"]}"/>')
            out.append(f'<path d="M{left_x+245} {y+70} V{y+180} M{left_x+245} {y+350} V{y+440} M{left_x+10} {y+265} H{left_x+135} M{left_x+355} {y+265} H{left_x+480}" stroke="{c["lane"]}" stroke-width="5" stroke-dasharray="15 13"/>')
            out.append(car(left_x+145, y+265, "A", c["orange"], 90, .72))
            out.append(car(left_x+365, y+265, "B", c["blue"], -90, .72))
            out.append(arrow(left_x+180, y+265, left_x+320, y+265, c["green"], 6))
        else:
            out.append(f'<rect x="{left_x+5}" y="{y+245}" width="220" height="105" fill="{c["road"]}"/>')
            out.append(f'<path d="M{left_x+110} {y+265} H{left_x+220}" stroke="{c["lane"]}" stroke-width="5" stroke-dasharray="15 13"/>')
            out.append(car(left_x+145, y+300, "A", c["orange"], 90, .65))
            out.append(arrow(left_x+180, y+300, left_x+265, y+300, c["red"], 6))
        if pair_id in {"K11-K12", "K12-K14"}:
            # A side road joins the main road in the K12 tile.
            out.append(f'<rect x="{right_x+8}" y="{y+285}" width="210" height="150" fill="{c["road"]}"/>')
            out.append(f'<path d="M{right_x+20} {y+355} H{right_x+220}" stroke="{c["lane"]}" stroke-width="5" stroke-dasharray="15 13"/>')
            out.append(car(right_x+150, y+350, "A", c["orange"], 90, .65))
            out.append(arrow(right_x+185, y+350, right_x+275, y+305, c["red"], 6))
            out.append(car(right_x+335, y+385, "B", c["blue"], 0, .68))
        else:
            # K14 has no intersecting road; show a vehicle crossing the main road.
            out.append(car(right_x+115, y+300, "A", c["orange"], 90, .7))
            out.append(arrow(right_x+150, y+300, right_x+360, y+300, c["red"], 7))
            out.append(car(right_x+375, y+385, "B", c["blue"], 0, .68))
    elif pair_id == "K10-K14":
        out.append(car(left_x+150, y+360, "A", c["orange"]))
        out.append(car(left_x+340, y+180, "B", c["blue"], 180))
        out.append('<path d="M250 590 C250 520 340 505 365 550" fill="none" stroke="#ff667a" stroke-width="8" marker-end="url(#arr)"/>')
        out.append(arrow(left_x+340, y+230, left_x+340, y+290, c["blue"], 6))
        # On K14, cross traffic enters laterally at midblock with no side-road mouth.
        out.append(car(right_x+100, y+300, "A", c["orange"], 90, .7))
        out.append(arrow(right_x+135, y+300, right_x+365, y+300, c["red"], 7))
        out.append(car(right_x+375, y+380, "B", c["blue"], 0, .68))
    else:  # K09-K14
        out.append(car(left_x+335, y+180, "A", c["orange"], 180))
        out.append(car(left_x+155, y+365, "B", c["blue"], 0, .72))
        out.append(arrow(left_x+335, y+235, left_x+335, y+300, c["red"], 6))
        out.append(car(right_x+105, y+300, "A", c["orange"], 90, .7))
        out.append(car(right_x+375, y+390, "B", c["blue"], 0, .68))
        out.append(arrow(right_x+140, y+300, right_x+355, y+300, c["red"], 7))
    return "".join(out)


def slide_svg(item: dict, code_labels: dict[str, str]) -> str:
    is_pair = "codes" in item
    title = item["title"]
    episode_id = item["id"]
    if is_pair:
        codes = item["codes"]
        title_chip = "SO SÁNH " + " / ".join(codes)
        line1 = f'{codes[0]}: {code_labels[codes[0]]}'
        line2 = f'{codes[1]}: {code_labels[codes[1]]}'
        side_heading = "DẤU HIỆU TÁCH BIỆT"
        side_text = f"{line1}. {line2}."
        edge_text = " ".join(re.split(r"(?<=[.!?])\s+", item["narration"])[:2])
        scene = item.get("scene", "intersection")
        chip_width = 335
        chip_center = 88 + chip_width / 2
        title_x = 455
    else:
        code = item["id"]
        title_chip = code
        side_heading = "QUY TẮC GÁN NHÃN"
        side_text = re.split(r"(?<=[.!?])\s+", item["narration"], maxsplit=1)[0]
        edge_text = "GẦN GIỐNG: " + item["edge"]
        scene = item.get("scene", "same_direction")
        chip_width = 235
        chip_center = 88 + chip_width / 2
        title_x = 354

    body = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" font-family="Arial, Segoe UI, sans-serif">',
        '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#071321"/><stop offset="1" stop-color="#0b1b2a"/></linearGradient></defs>',
        '<rect width="1920" height="1080" fill="url(#bg)"/>',
        '<rect x="64" y="46" width="1792" height="106" rx="24" fill="#101f30" stroke="#243a50" stroke-width="2"/>',
        f'<rect x="88" y="66" width="{chip_width}" height="66" rx="16" fill="#1671c7"/>',
        f'<text x="{chip_center}" y="111" text-anchor="middle" fill="#ffffff" font-size="30" font-weight="900">{html.escape(title_chip)}</text>',
        f'<text x="{title_x}" y="112" fill="{COLORS["text"]}" font-size="40" font-weight="800">{html.escape(title)}</text>',
        '<rect x="64" y="180" width="1085" height="790" rx="28" fill="#101f30" stroke="#243a50" stroke-width="2"/>',
        '<rect x="1180" y="180" width="676" height="790" rx="28" fill="#101f30" stroke="#243a50" stroke-width="2"/>',
        f'<text x="105" y="232" fill="{COLORS["muted"]}" font-size="24" font-weight="700" letter-spacing="2">SƠ ĐỒ TÌNH HUỐNG • NHÌN TỪ TRÊN XUỐNG</text>',
        comparison_road(item["id"]) if is_pair else road(scene),
        f'<text x="1220" y="242" fill="{COLORS["blue"]}" font-size="25" font-weight="800" letter-spacing="2">{side_heading}</text>',
    ]
    if is_pair:
        body.append(text_block(1220, 300, line1 + ".", 35, size=24, color=COLORS["text"], weight=650, line=1.35))
        body.append(text_block(1220, 390, line2 + ".", 35, size=24, color=COLORS["text"], weight=650, line=1.35))
        body.append('<line x1="1220" y1="525" x2="1810" y2="525" stroke="#294158" stroke-width="2"/>')
        body.append(f'<text x="1220" y="574" fill="{COLORS["orange"]}" font-size="25" font-weight="800">CÁCH PHÂN BIỆT</text>')
        body.append(text_block(1220, 630, edge_text, 35, size=25, color=COLORS["text"], weight=500, line=1.4))
    else:
        body.append(text_block(1220, 304, side_text, 36, size=27, color=COLORS["text"], weight=520, line=1.4))
        body.append('<line x1="1220" y1="515" x2="1810" y2="515" stroke="#294158" stroke-width="2"/>')
        body.append(f'<text x="1220" y="568" fill="{COLORS["orange"]}" font-size="25" font-weight="800">PHÂN BIỆT / EDGE CASE</text>')
        body.append(text_block(1220, 628, edge_text, 36, size=26, color=COLORS["text"], weight=500, line=1.45))
    body.extend([
        '<rect x="100" y="735" width="1000" height="190" rx="20" fill="#0b1724" stroke="#294158" stroke-width="2"/>',
        '<text x="135" y="782" fill="#38d996" font-size="24" font-weight="800">THEO DÕI QUỸ ĐẠO QUA NHIỀU KHUNG HÌNH</text>',
        '<g><circle cx="185" cy="843" r="23" fill="#58a6ff"/><text x="185" y="852" text-anchor="middle" fill="#122033" font-size="22" font-weight="900">1</text><text x="225" y="852" fill="#f2f6fa" font-size="25">Trước xung đột</text></g>',
        '<path d="M485 843 H575" stroke="#adc0d3" stroke-width="4" marker-end="url(#arr)"/>',
        '<g><circle cx="635" cy="843" r="23" fill="#ffb84d"/><text x="635" y="852" text-anchor="middle" fill="#122033" font-size="22" font-weight="900">2</text><text x="675" y="852" fill="#f2f6fa" font-size="25">Hành động</text></g>',
        '<path d="M830 843 H900" stroke="#adc0d3" stroke-width="4" marker-end="url(#arr)"/>',
        '<g><circle cx="955" cy="843" r="23" fill="#ff667a"/><text x="955" y="852" text-anchor="middle" fill="#122033" font-size="22" font-weight="900">3</text><text x="992" y="852" fill="#f2f6fa" font-size="25">Điểm xung đột</text></g>',
        '<rect x="64" y="994" width="1792" height="54" rx="16" fill="#19354b"/>',
        '<text x="94" y="1030" fill="#c8d8e8" font-size="22" font-weight="650">Chỉ mô tả chuyển động nhìn thấy. Nếu thiếu bối cảnh hoặc quỹ đạo, chọn “không rõ”.</text>',
        '<text x="1820" y="1030" text-anchor="end" fill="#8299af" font-size="18">C.v4 • VQA Clip Pipeline</text>',
        '</svg>',
    ])
    return "\n".join(body)


def make_audio(text: str, destination: Path, tts) -> None:
    import numpy as np
    import soundfile as sf

    result = tts.infer(text, voice="Hải Đăng")
    if isinstance(result, tuple):
        audio, sample_rate = result[0], result[1]
    elif isinstance(result, dict):
        audio = result.get("audio") or result.get("wav")
        sample_rate = result.get("sample_rate", 48000)
    else:
        audio, sample_rate = result, 48000
    audio = np.asarray(audio)
    if audio.ndim == 2 and audio.shape[0] < audio.shape[1]:
        audio = audio.T
    sf.write(destination, audio, int(sample_rate))


def render_video(still: Path, audio: Path, output: Path) -> None:
    probe = shutil.which("ffprobe") or str(FFMPEG.with_name("ffprobe.exe"))
    info = subprocess.check_output([probe, "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(audio)], text=True)
    seconds = float(info.strip()) + 1.8
    command = [
        str(FFMPEG), "-y", "-hide_banner", "-loglevel", "error", "-loop", "1", "-framerate", "30", "-i", str(still),
        "-i", str(audio), "-filter_complex",
        "[0:v]scale=1920:1080,zoompan=z='min(zoom+0.00006,1.025)':d=1:s=1920x1080:fps=30,format=yuv420p[v];[1:a]apad=pad_dur=1.8[a]",
        "-map", "[v]", "-map", "[a]", "-t", f"{seconds:.3f}", "-c:v", "libx264", "-preset", "medium", "-crf", "22",
        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(output),
    ]
    subprocess.run(command, check=True)


def make_playlist(content: dict) -> Path:
    items = content.get("foundations", []) + content["episodes"] + content["comparisons"]
    video_dir = OUTPUT / "videos"
    missing = [item["id"] for item in items if not (video_dir / f'{item["id"]}.mp4').exists()]
    if missing:
        raise FileNotFoundError(f"Missing video clips: {', '.join(missing)}")
    playlist = OUTPUT / "playlist.txt"
    playlist.write_text("\n".join(f"file 'videos/{item['id']}.mp4'" for item in items), encoding="utf-8")
    master = video_dir / "C-training-full.mp4"
    subprocess.run([
        str(FFMPEG), "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0",
        "-i", str(playlist), "-c", "copy", "-movflags", "+faststart", str(master),
    ], check=True)
    return master


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--slides-only", action="store_true")
    parser.add_argument("--no-tts", action="store_true")
    parser.add_argument("--playlist-only", action="store_true")
    parser.add_argument("--limit", type=int, help="Render only the first N items for preview")
    args = parser.parse_args()

    content = json.loads((HERE / "narration.vi.json").read_text(encoding="utf-8"))
    codebook = json.loads((ROOT / "codebook" / "C.v4.json").read_text(encoding="utf-8"))
    code_labels = {item["code"]: item["label"] for item in codebook["cells"][3]["options"] if "code" in item}
    items = content.get("foundations", []) + content["episodes"] + content["comparisons"]
    if args.playlist_only:
        print(f"Playlist ready: {make_playlist(content)}", flush=True)
        return 0
    if args.limit:
        items = items[:args.limit]

    slides = OUTPUT / "stills"
    audio_dir = OUTPUT / "audio"
    videos = OUTPUT / "videos"
    for folder in (slides, audio_dir, videos):
        folder.mkdir(parents=True, exist_ok=True)

    for index, item in enumerate(items, 1):
        key = item["id"]
        svg = slides / f"{key}.svg"
        png = slides / f"{key}.png"
        svg.write_text(slide_svg(item, code_labels), encoding="utf-8")
        if not png.exists() or png.stat().st_mtime < svg.stat().st_mtime:
            subprocess.run([
                str(CHROME), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-sandbox",
                "--window-size=1920,1080", f"--screenshot={png}", svg.resolve().as_uri(),
            ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"[{index}/{len(items)}] visual ready: {key}", flush=True)
        if args.slides_only:
            continue
        audio = audio_dir / f"{key}.wav"
        video = videos / f"{key}.mp4"
        if not args.no_tts and not audio.exists():
            from vieneu import Vieneu
            if "_tts" not in globals():
                globals()["_tts"] = Vieneu(mode="v3turbo", device="cpu")
            print(f"  synthesizing Hải Đăng voice", flush=True)
            make_audio(item["narration"], audio, globals()["_tts"])
        if not audio.exists():
            print(f"  no audio present, skipped video: {key}", flush=True)
            continue
        if not video.exists() or video.stat().st_mtime < max(png.stat().st_mtime, audio.stat().st_mtime):
            render_video(png, audio, video)
        print(f"  video ready: {video}", flush=True)
    if not args.limit and not args.slides_only:
        print(f"Full training video ready: {make_playlist(content)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
