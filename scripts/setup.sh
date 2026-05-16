#!/usr/bin/env bash
# Create .venv with Python 3.11+ and install Quest + phase2 test deps.
set -euo pipefail
cd "$(dirname "$0")/.."

pick_python() {
  for cmd in python3.14 python3.13 python3.12 python3.11 python3; do
    if command -v "$cmd" >/dev/null 2>&1; then
      ver=$("$cmd" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
      major=${ver%%.*}
      minor=${ver#*.}
      if [ "$major" -eq 3 ] && [ "$minor" -ge 11 ]; then
        echo "$cmd"
        return 0
      fi
    fi
  done
  return 1
}

PY=$(pick_python) || {
  echo "Need Python 3.11+. Install via Homebrew: brew install python@3.12"
  exit 1
}

echo "Using: $PY ($($PY --version))"

if [ ! -d .venv ]; then
  "$PY" -m venv .venv
fi

.venv/bin/pip install --upgrade pip
.venv/bin/pip install -e ".[phase2]"

echo ""
echo "Done. Use the venv for every command:"
echo "  source .venv/bin/activate"
echo "  python main.py"
echo "  pytest"
echo "  pytest -m live"
