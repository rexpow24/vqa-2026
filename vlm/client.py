"""Talking to the llama.cpp server.

The only module that knows about HTTP, base64 and the OpenAI schema. Errors are
named rather than raised as whatever the socket layer produced: a failed sample
has to be readable in a log six weeks from now (overview.md §18).
"""

from __future__ import annotations

import base64
import json
import socket
import time
import urllib.error
import urllib.request
from typing import NamedTuple

BASE = "http://127.0.0.1:8080"


class VLMError(RuntimeError):
    """Any failure worth recording against a sample."""


class ServerDown(VLMError):
    """Nothing is listening, or it closed the connection."""


class Timeout(VLMError):
    """The server took longer than we were prepared to wait."""


class Answer(NamedTuple):
    text: str
    latency_ms: int
    prompt_tokens: int | None
    completion_tokens: int | None


def health(base: str = BASE, timeout: float = 5.0) -> bool:
    try:
        with urllib.request.urlopen(f"{base}/health", timeout=timeout) as r:
            return r.status == 200
    except (urllib.error.URLError, OSError) as e:
        reason = getattr(e, "reason", e)
        raise ServerDown(f"no VLM server at {base} ({reason}). "
                         f"Start it with: docker compose -f docker/docker-compose.yml up -d")


def ask(question: str, images: list[bytes], *, base: str = BASE,
        model: str = "qwen3-vl-2b", temperature: float = 0.0,
        max_tokens: int = 300, timeout: float = 180.0) -> Answer:
    """One chat completion. `images` may be empty -- that is the blind condition."""
    for i, b in enumerate(images, 1):
        if not b:
            raise VLMError(f"image {i} of {len(images)} is empty (0 bytes)")
        if not b.startswith(b"\xff\xd8\xff"):
            raise VLMError(f"image {i} of {len(images)} is not JPEG data")

    content = [{"type": "image_url",
                "image_url": {"url": "data:image/jpeg;base64,"
                                     + base64.b64encode(b).decode()}}
               for b in images]
    content.append({"type": "text", "text": question})

    req = urllib.request.Request(
        f"{base}/v1/chat/completions",
        data=json.dumps({"model": model, "temperature": temperature,
                         "max_tokens": max_tokens,
                         "messages": [{"role": "user", "content": content}]}).encode(),
        headers={"Content-Type": "application/json"})

    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            out = json.loads(r.read())
    except socket.timeout:
        raise Timeout(f"no reply within {timeout:g}s ({len(images)} image(s))")
    except urllib.error.HTTPError as e:
        raise VLMError(f"HTTP {e.code} from the server: "
                       f"{e.read().decode(errors='replace')[:200]}")
    except (urllib.error.URLError, OSError) as e:
        reason = getattr(e, "reason", e)
        if isinstance(reason, socket.timeout):
            raise Timeout(f"no reply within {timeout:g}s ({len(images)} image(s))")
        raise ServerDown(f"lost the VLM server at {base} ({reason})")
    latency_ms = int((time.perf_counter() - t0) * 1000)

    try:
        text = out["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError):
        raise VLMError(f"unexpected reply shape: {json.dumps(out)[:200]}")
    if not text.strip():
        raise VLMError("the server replied but the answer was empty")

    usage = out.get("usage") or {}
    return Answer(text.strip(), latency_ms,
                  usage.get("prompt_tokens"), usage.get("completion_tokens"))
