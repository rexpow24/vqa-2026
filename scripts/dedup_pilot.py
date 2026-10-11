"""Compare approved trimmed clips with DINOv2 and write a local review report.

This is a read-only pilot. It never changes pipeline.db or any video file.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModel


MODEL_ID = "facebook/dinov2-base"
SAMPLE_COUNT = 8
PREFILTER_COUNT = 60


def sample_frames(path: Path, count: int) -> tuple[list[Image.Image], float]:
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise RuntimeError(f"Cannot open video: {path}")
    try:
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = float(capture.get(cv2.CAP_PROP_FPS))
        if frame_count <= 0 or fps <= 0:
            raise RuntimeError(f"Cannot read video timing: {path}")
        positions = np.linspace(0.08, 0.92, count)
        frames = []
        for fraction in positions:
            capture.set(cv2.CAP_PROP_POS_FRAMES, round(fraction * (frame_count - 1)))
            ok, frame = capture.read()
            if not ok:
                raise RuntimeError(f"Cannot decode sampled frame: {path}")
            frames.append(Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)))
        return frames, frame_count / fps
    finally:
        capture.release()


def file_signature(path: Path, root: Path) -> str:
    stat = path.stat()
    return f"{path.relative_to(root).as_posix()}|{stat.st_size}|{stat.st_mtime_ns}"


def perceptual_hash(frame: Image.Image) -> np.uint64:
    gray = cv2.cvtColor(np.asarray(frame), cv2.COLOR_RGB2GRAY)
    small = cv2.resize(gray, (32, 32), interpolation=cv2.INTER_AREA)
    low = cv2.dct(small.astype(np.float32))[:8, :8].flatten()
    median = float(np.median(low[1:]))
    bits = 0
    for value in low:
        bits = (bits << 1) | int(value > median)
    return np.uint64(bits)


def load_or_hash(paths: list[Path], root: Path, output: Path) -> np.ndarray:
    signatures = [file_signature(path, root) for path in paths]
    cache_path = output / "frame_hashes.npz"
    previous = {}
    old_hashes = None
    if cache_path.exists():
        with np.load(cache_path) as cached:
            if int(cached["sample_count"].item()) == SAMPLE_COUNT:
                previous = {value: index for index, value in enumerate(cached["signatures"].tolist())}
                old_hashes = cached["hashes"]
                if all(value in previous for value in signatures):
                    indices = [previous[value] for value in signatures]
                    print(f"Using cached frame hashes for {len(paths)} clips", flush=True)
                    return old_hashes[indices]
    hashes = []
    for index, path in enumerate(paths, 1):
        if signatures[index - 1] in previous and old_hashes is not None:
            hashes.append(old_hashes[previous[signatures[index - 1]]])
        else:
            frames, _ = sample_frames(path, SAMPLE_COUNT)
            hashes.append([perceptual_hash(frame) for frame in frames])
        if index % 50 == 0 or index == len(paths):
            print(f"Hashed {index}/{len(paths)} clips", flush=True)
    matrix = np.asarray(hashes, dtype=np.uint64)
    np.savez_compressed(cache_path, sample_count=SAMPLE_COUNT,
                        signatures=np.asarray(signatures), hashes=matrix)
    return matrix


def load_or_embed(paths: list[Path], root: Path, output: Path) -> tuple[np.ndarray, np.ndarray]:
    signatures = [file_signature(path, root) for path in paths]
    cache_path = output / "embeddings.npz"
    previous = {}
    old_embeddings = None
    old_durations = None
    if cache_path.exists():
        with np.load(cache_path) as cached:
            if cached["model"].item() == MODEL_ID and int(cached["sample_count"].item()) == SAMPLE_COUNT:
                previous = {value: index for index, value in enumerate(cached["signatures"].tolist())}
                old_embeddings = cached["embeddings"]
                old_durations = cached["durations"]
                if all(value in previous for value in signatures):
                    indices = [previous[value] for value in signatures]
                    print(f"Using cached embeddings for {len(paths)} clips", flush=True)
                    return old_embeddings[indices], old_durations[indices]

    missing = sum(value not in previous for value in signatures)
    device = "cuda"
    if missing:
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA is unavailable; this pilot expects the local GPU")
        print(f"Loading {MODEL_ID} on {torch.cuda.get_device_name(0)} for {missing} clip(s)", flush=True)
        processor = AutoImageProcessor.from_pretrained(MODEL_ID, cache_dir=root / "models" / "hf-cache")
        model = AutoModel.from_pretrained(MODEL_ID, cache_dir=root / "models" / "hf-cache")
        model.eval().to(device)

    embeddings = []
    durations = []
    with torch.inference_mode():
        for index, path in enumerate(paths, 1):
            if signatures[index - 1] in previous and old_embeddings is not None and old_durations is not None:
                cached_index = previous[signatures[index - 1]]
                embeddings.append(old_embeddings[cached_index])
                durations.append(float(old_durations[cached_index]))
                continue
            frames, duration = sample_frames(path, SAMPLE_COUNT)
            vectors = []
            for start in range(0, len(frames), 4):
                inputs = processor(images=frames[start:start + 4], return_tensors="pt")
                inputs = {key: value.to(device) for key, value in inputs.items()}
                cls = model(**inputs).last_hidden_state[:, 0, :]
                cls = torch.nn.functional.normalize(cls, dim=-1)
                vectors.append(cls.cpu().numpy().astype(np.float32))
            embeddings.append(np.concatenate(vectors))
            durations.append(duration)
            if index % 25 == 0 or index == len(paths):
                print(f"Embedded {index}/{len(paths)} clips", flush=True)

    matrix = np.stack(embeddings)
    duration_array = np.asarray(durations, dtype=np.float32)
    np.savez_compressed(
        cache_path,
        model=MODEL_ID,
        sample_count=SAMPLE_COUNT,
        signatures=np.asarray(signatures),
        embeddings=matrix,
        durations=duration_array,
    )
    return matrix, duration_array


def temporal_score(a: np.ndarray, b: np.ndarray) -> float:
    """Best ordered run of four corresponding frame embeddings."""
    similarity = a @ b.T
    best = -1.0
    for offset in range(-len(b) + 1, len(a)):
        diagonal = np.diagonal(similarity, offset=offset)
        if len(diagonal) < 4:
            continue
        means = np.convolve(diagonal, np.ones(4, dtype=np.float32) / 4, mode="valid")
        best = max(best, float(means.max()))
    return best


def verified_score(
    a: np.ndarray, b: np.ndarray, hash_a: np.ndarray, hash_b: np.ndarray,
) -> tuple[float, float, float]:
    """Return combined, DINO and pHash scores on the same ordered frame run."""
    dino = a @ b.T
    phash = np.asarray([
        [1.0 - (int(x) ^ int(y)).bit_count() / 64.0 for y in hash_b]
        for x in hash_a
    ], dtype=np.float32)
    combined = (dino + phash) / 2.0
    best = (-1.0, 0.0, 0.0)
    for offset in range(-len(b) + 1, len(a)):
        component_dino = np.diagonal(dino, offset=offset)
        component_hash = np.diagonal(phash, offset=offset)
        values = np.diagonal(combined, offset=offset)
        for start in range(len(values) - 3):
            score = float(values[start:start + 4].mean())
            if score > best[0]:
                best = (
                    score,
                    float(component_dino[start:start + 4].mean()),
                    float(component_hash[start:start + 4].mean()),
                )
    return best


def rank_neighbors(embeddings: np.ndarray, top_k: int) -> list[list[tuple[int, float]]]:
    means = embeddings.mean(axis=1)
    means /= np.linalg.norm(means, axis=1, keepdims=True)
    coarse = means @ means.T
    np.fill_diagonal(coarse, -np.inf)
    ranked = []
    for query in range(len(embeddings)):
        count = min(PREFILTER_COUNT, len(embeddings) - 1)
        candidates = np.argpartition(coarse[query], -count)[-count:]
        scored = [(int(i), temporal_score(embeddings[query], embeddings[i])) for i in candidates]
        scored.sort(key=lambda item: item[1], reverse=True)
        ranked.append(scored[:top_k])
    return ranked


def choose_queries(paths: list[Path], ranked: list[list[tuple[int, float]]], count: int) -> list[int]:
    """Show strong matches and ordinary matches from distinct source videos."""
    order = sorted(range(len(paths)), key=lambda i: ranked[i][0][1], reverse=True)
    percentiles = [0, 1, 2, 3, 4, 10, 25, 45, 65, 85]
    if count != 10:
        percentiles = np.linspace(0, 90, count).tolist()
    chosen = []
    sources = set()
    for percentile in percentiles:
        start = min(round(percentile / 100 * (len(order) - 1)), len(order) - 1)
        options = order[start:] + order[:start]
        match = next((i for i in options if paths[i].parent.parent.name not in sources), None)
        if match is None:
            match = next((i for i in options if i not in chosen), None)
        if match is None:
            break
        chosen.append(match)
        sources.add(paths[match].parent.parent.name)
    return chosen


def rank_full_for_queries(
    embeddings: np.ndarray, hashes: np.ndarray, chosen: list[int], top_k: int,
) -> dict[int, list[tuple[int, float, float, float]]]:
    """Score every corpus clip for the reported queries, without a shortlist."""
    result = {}
    for query in chosen:
        scored = [
            (candidate, *verified_score(
                embeddings[query], embeddings[candidate], hashes[query], hashes[candidate]
            ))
            for candidate in range(len(embeddings)) if candidate != query
        ]
        scored.sort(key=lambda item: item[1], reverse=True)
        result[query] = scored[:top_k]
    return result


def video_url(path: Path, output: Path) -> str:
    media_dir = output / "public" / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    link = media_dir / path.name
    if not link.exists():
        os.link(path, link)
    return f"media/{path.name}"


def make_report(
    paths: list[Path], durations: np.ndarray, ranked: list[list[tuple]],
    chosen: list[int], output: Path,
) -> None:
    records = []
    cards = []
    for number, query in enumerate(chosen, 1):
        matches = ranked[query]
        query_path = paths[query]
        rows = []
        match_records = []
        for place, (candidate, score, dino_score, hash_score) in enumerate(matches, 1):
            candidate_path = paths[candidate]
            key = f"{query_path.name}::{candidate_path.name}"
            match_records.append({
                "path": str(candidate_path), "score": round(score, 4),
                "dino_score": round(dino_score, 4), "phash_score": round(hash_score, 4),
            })
            rows.append(f"""
              <article class="match">
                <div class="match-head"><strong>#{place} · {score:.3f}</strong><span>{html.escape(candidate_path.parent.parent.name)} · {durations[candidate]:.1f}s</span></div>
                <div class="subscore">DINO {dino_score:.3f} · pHash {hash_score:.3f}</div>
                <video controls preload="metadata" src="{html.escape(video_url(candidate_path, output))}"></video>
                <div class="filename">{html.escape(candidate_path.name)}</div>
                <div class="choices" data-key="{html.escape(key)}">
                  <button data-value="duplicate">Trùng</button><button data-value="different">Không trùng</button><button data-value="uncertain">Chưa chắc</button>
                </div>
              </article>""")
        records.append({"query": str(query_path), "duration_s": round(float(durations[query]), 2), "matches": match_records})
        cards.append(f"""
          <section class="query" data-score="{matches[0][1]:.8f}">
            <div class="section-title"><h2>Truy vấn {number:02d}</h2><strong>Top 1: {matches[0][1]:.3f}</strong></div>
            <div class="comparison">
              <div class="source"><span>VIDEO GỐC · {html.escape(query_path.parent.parent.name)} · {durations[query]:.1f}s</span>
                <video controls preload="metadata" src="{html.escape(video_url(query_path, output))}"></video>
                <div class="filename">{html.escape(query_path.name)}</div>
              </div>
              <div class="results">{''.join(rows)}</div>
            </div>
          </section>""")

    (output / "results.json").write_text(json.dumps({
        "model": MODEL_ID,
        "sample_count": SAMPLE_COUNT,
        "corpus_size": len(paths),
        "score": "equal-weight mean of DINO cosine and pHash similarity over four ordered frames",
        "queries": records,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    document = f"""<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>DINOv2 dedup pilot</title>
<style>
:root{{color-scheme:dark;font-family:system-ui,sans-serif;background:#101317;color:#f1f4f6}}
*{{box-sizing:border-box}}body{{margin:0;padding:24px;max-width:1700px;margin:auto}}
header{{border-bottom:1px solid #313942;padding-bottom:18px;margin-bottom:24px}}
h1{{font-size:30px;margin:0 0 8px}}p{{color:#afb9c5;line-height:1.5;max-width:850px}}
.toolbar{{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin:20px 0}}
.navigation{{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:16px 0}}
.navigation strong{{color:#88d9bd}}.navigation button:disabled{{opacity:.4;cursor:default}}
input[type=range]{{width:230px;accent-color:#88d9bd}}button{{border:1px solid #47515d;border-radius:6px;background:#222a32;color:#f1f4f6;padding:7px 10px;cursor:pointer}}
button.selected{{border-color:#88d9bd;background:#1a493e}}.query{{border:1px solid #34404a;border-radius:12px;margin:24px 0;padding:18px;background:#181e24}}
.section-title,.match-head{{display:flex;justify-content:space-between;align-items:center;gap:8px}}
h2{{font-size:20px;margin:0 0 16px}}.section-title strong{{color:#88d9bd}}
.comparison{{display:grid;grid-template-columns:minmax(280px,1fr) minmax(350px,1.5fr);gap:22px}}
.source{{position:sticky;top:12px;align-self:start}}.source>span,.match-head span{{color:#aeb9c4;font-size:12px}}
video{{width:100%;background:black;border-radius:7px;margin:8px 0}}
.results{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}}
.match{{padding:12px;border:1px solid #303b45;border-radius:9px;background:#11171c}}
.match-head strong{{color:#88d9bd}}.subscore{{color:#94a7b7;font-size:12px;margin-top:3px}}.filename{{overflow-wrap:anywhere;color:#aeb9c4;font-size:11px}}
.choices{{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}}.choices button{{font-size:12px}}
@media(max-width:850px){{.comparison{{grid-template-columns:1fr}}.source{{position:static}}.results{{grid-template-columns:1fr}}}}
</style></head><body><header><h1>Pilot tìm video gần trùng</h1>
<p>DINOv2 Base · {len(paths)} trimmed clips · {len(chosen)} truy vấn · top {len(ranked[0])} mỗi truy vấn.
Chỉ đề xuất clip có điểm top 1 sau khi gộp DINO và pHash lớn hơn ngưỡng. Kéo ngưỡng để thay đổi hàng chờ.
Điểm chưa phải xác suất trùng; hãy đánh dấu các cặp trước khi chọn ngưỡng cuối.</p>
<div class="toolbar"><label>Ngưỡng top 1 (fusion): <strong id="threshold-text">0.80</strong></label>
<input id="threshold" type="range" min="0" max="1" value="0.8" step="0.01">
<span id="shown"></span><button id="export">Tải nhãn đã đánh dấu</button></div></header>
<nav class="navigation" aria-label="Điều hướng clip"><button id="previous">← Clip trước</button>
<strong id="position"></strong><span id="labeled"></span><button id="next">Clip tiếp →</button></nav>
<p id="empty" hidden></p>
{''.join(cards)}
<script>
const slider=document.querySelector('#threshold'), out=document.querySelector('#threshold-text');
const queries=[...document.querySelectorAll('.query')];
let current=0;try{{current=Number(localStorage.getItem('dedup-pilot-current')||0)}}catch(e){{}}
function eligible(){{return queries.map((el,i)=>i).filter(i=>Number(queries[i].dataset.score)>Number(slider.value))}}
function render(){{const choices=eligible();if(!choices.includes(current))current=choices[0]??0;
  queries.forEach((el,i)=>{{el.hidden=choices.length===0||i!==current;if(el.hidden)el.querySelectorAll('video').forEach(video=>video.pause())}});
  const empty=document.querySelector('#empty');empty.hidden=choices.length!==0;
  empty.textContent=`Không có clip nào có điểm top 1 fusion > ${{Number(slider.value).toFixed(2)}} trong {len(chosen)} clip thử. Giảm ngưỡng để xem thêm.`;
  document.querySelector('#position').textContent=choices.length?`Clip ${{choices.indexOf(current)+1}}/${{choices.length}}`:'';
  document.querySelector('#previous').disabled=choices.indexOf(current)<=0;
  document.querySelector('#next').disabled=choices.indexOf(current)>=choices.length-1;
  document.querySelector('#labeled').textContent=choices.length?`${{queries[current].querySelectorAll('.choices button.selected').length}}/5 kết quả đã đánh dấu`:'';
  out.textContent=Number(slider.value).toFixed(2);
  document.querySelector('#shown').textContent=choices.length+'/{len(chosen)} clip được đề xuất';
  try{{localStorage.setItem('dedup-pilot-current',String(current))}}catch(e){{}}
}}
function move(step){{const choices=eligible(),index=choices.indexOf(current)+step;if(index>=0&&index<choices.length){{current=choices[index];render();window.scrollTo(0,0)}}}}
document.querySelector('#previous').addEventListener('click',()=>move(-1));
document.querySelector('#next').addEventListener('click',()=>move(1));
slider.addEventListener('input',render);
const labels={{}};try{{Object.assign(labels,JSON.parse(localStorage.getItem('dedup-pilot-labels')||'{{}}'))}}catch(e){{}}
function paint(){{document.querySelectorAll('.choices').forEach(group=>group.querySelectorAll('button').forEach(button=>button.classList.toggle('selected',labels[group.dataset.key]===button.dataset.value)))}}
document.querySelectorAll('.choices button').forEach(button=>button.addEventListener('click',()=>{{const key=button.parentElement.dataset.key;if(labels[key]===button.dataset.value)delete labels[key];else labels[key]=button.dataset.value;try{{localStorage.setItem('dedup-pilot-labels',JSON.stringify(labels))}}catch(e){{}}paint();render()}}));paint();render();
document.querySelector('#export').addEventListener('click',()=>{{const blob=new Blob([JSON.stringify(labels,null,2)],{{type:'application/json'}});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='dedup-labels.json';link.click();URL.revokeObjectURL(link.href)}});
</script></body></html>"""
    (output / "public" / "report.html").write_text(document, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--queries", type=int, default=10)
    parser.add_argument("--top-k", type=int, default=5)
    args = parser.parse_args()
    if args.queries < 1 or args.top_k < 1:
        parser.error("--queries and --top-k must be positive")
    root = Path(__file__).resolve().parents[1]
    output = root / "artifacts" / "dedup_pilot"
    output.mkdir(parents=True, exist_ok=True)
    paths = sorted(
        path for path in (root / "work").glob("*/trimmed/*.mp4")
        if re.search(r"_t\d{2}\.mp4$", path.name)
    )
    if len(paths) < 2:
        parser.error("At least two trimmed clips are required")
    embeddings, durations = load_or_embed(paths, root, output)
    hashes = load_or_hash(paths, root, output)
    ranked = rank_neighbors(embeddings, min(args.top_k, len(paths) - 1))
    chosen = choose_queries(paths, ranked, min(args.queries, len(paths)))
    exact = rank_full_for_queries(embeddings, hashes, chosen, min(args.top_k, len(paths) - 1))
    for query in chosen:
        ranked[query] = exact[query]
    make_report(paths, durations, ranked, chosen, output)
    print(f"Report: {output / 'public' / 'report.html'}", flush=True)


if __name__ == "__main__":
    main()
