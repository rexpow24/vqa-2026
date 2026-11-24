"""Draw the proposed E labels from boxes.json onto review stills.

Reads frames from the anonymized finished/ copies (pass --finished-dir, the
folder that holds finished/*.mp4) and writes stills/<id>.jpg next to this file.
Text goes through drawtext's textfile= so Vietnamese diacritics and the
middle dot need no filter escaping.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
FFMPEG = r"C:\ffmpeg\ffmpeg-8.1-essentials_build\bin\ffmpeg.exe"
FONT = "C:/Windows/Fonts/arial.ttf"
FONT_BOLD = "C:/Windows/Fonts/arialbd.ttf"
COLORS = {"A": "0xFFB000", "B": "0x00C8FF", "skip": "0xB0B0B0"}
DRAFT_MARK = "BẢN NHÁP - nhãn đề xuất, chờ duyệt"


def esc(path: Path | str) -> str:
    """Quote a path for an ffmpeg filter option value."""
    return "'" + str(path).replace("\\", "/").replace(":", "\\:") + "'"


def text_filter(tmp: Path, name: str, text: str, **opts) -> str:
    f = tmp / f"{name}.txt"
    f.write_text(text, encoding="utf-8")
    font = opts.pop("font", FONT_BOLD)
    parts = [f"fontfile={esc(font)}", f"textfile={esc(f)}"] + [f"{k}={v}" for k, v in opts.items()]
    return "drawtext=" + ":".join(parts)


def build_filter(still: dict, tmp: Path, final: bool = False) -> str:
    chain = ["[0:v]scale=1920:1080,setsar=1[v0]"]
    cur = "v0"
    for i, m in enumerate(still.get("privacy_masks", [])):
        chain.append(
            f"[{cur}]split[s{i}a][s{i}b];[s{i}b]crop={m['w']}:{m['h']}:{m['x']}:{m['y']},boxblur=luma_radius=15:luma_power=3:chroma_radius=7[m{i}];"
            f"[s{i}a][m{i}]overlay={m['x']}:{m['y']}[p{i}]"
        )
        cur = f"p{i}"
    draws = []
    for j, b in enumerate(still["boxes"]):
        color = COLORS[b["role"]]
        draws.append(f"drawbox=x={b['x']}:y={b['y']}:w={b['w']}:h={b['h']}:color={color}:t=5")
        above = b.get("label_pos", "above") == "above" and b["y"] >= 140
        ly = b["y"] - 50 if above else b["y"] + b["h"] + 8
        lx = min(max(b["x"] - 5, 10), 1920 - 460)
        if b.get("label_pos") == "left":
            # Right-align the label just left of the box, vertically centred on it.
            lx, ly = f"{b['x'] - 12}-text_w", b["y"] + b["h"] // 2 - 20
        draws.append(text_filter(tmp, f"{still['id']}_b{j}", b["label"], x=lx, y=ly, fontsize=34,
                                 fontcolor="black", box=1, boxcolor=color, boxborderw=8))
    draws.append(text_filter(tmp, f"{still['id']}_cap", still["caption"], x="(w-text_w)/2", y=24,
                             fontsize=40, fontcolor="white", box=1, boxcolor="black@0.72", boxborderw=14))
    if still.get("corner"):
        corner = still["corner"]
        color = COLORS["A"] if corner.startswith("A") else COLORS["skip"]
        draws.append(text_filter(tmp, f"{still['id']}_corner", corner, x=24, y=110, fontsize=34,
                                 fontcolor="black", box=1, boxcolor=color, boxborderw=10))
    if not final:
        draws.append(text_filter(tmp, f"{still['id']}_draft", DRAFT_MARK, font=FONT, x="w-text_w-20",
                                 y="h-46", fontsize=24, fontcolor="white", box=1, boxcolor="red@0.75", boxborderw=6))
    chain.append(f"[{cur}]" + ",".join(draws) + "[out]")
    return ";".join(chain)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--finished-dir", required=True, help="Folder containing the anonymized finished/ clips' parent")
    parser.add_argument("--final", action="store_true", help="Approved labels: no draft watermark, written to output/stills_final/")
    parser.add_argument("ids", nargs="*")
    args = parser.parse_args()
    data = json.loads((HERE / "boxes.json").read_text(encoding="utf-8"))
    out_dir = HERE / "output" / "stills_final" if args.final else HERE / "stills"
    out_dir.mkdir(parents=True, exist_ok=True)
    root = Path(args.finished_dir)
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        for still in data["stills"]:
            if args.ids and still["id"] not in args.ids:
                continue
            src = root / data["clips"][still["clip"]]["source"]
            out = out_dir / f"{still['id']}.jpg"
            subprocess.run([
                FFMPEG, "-hide_banner", "-loglevel", "error", "-y", "-ss", str(still["t"]), "-i", str(src),
                "-filter_complex", build_filter(still, tmp, args.final), "-map", "[out]", "-frames:v", "1", "-q:v", "3", str(out),
            ], check=True)
            print(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
