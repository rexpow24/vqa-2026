#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

if [[ -x .venv-c-video/Scripts/python.exe ]]; then
  python_bin=.venv-c-video/Scripts/python.exe
elif [[ -x .venv/bin/python ]]; then
  python_bin=.venv/bin/python
else
  echo "Không thấy Python trong .venv-c-video hoặc .venv của project." >&2
  exit 1
fi

PYTHONIOENCODING=utf-8 exec "$python_bin" scripts/audit_no_majority.py "$@"
