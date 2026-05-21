#!/usr/bin/env bash
# Build and upload quest-ai to PyPI using a token from the environment.
#
# Set one of: PYPI_TOKEN, PYPI_API_TOKEN, or TWINE_PASSWORD (pypi-... prefix).
# Optional: load repo .env if present.
#
# Usage:
#   ./scripts/publish_pypi.sh              # build + upload (skips if version on PyPI)
#   ./scripts/publish_pypi.sh --check      # build + twine check only (no token needed)
#   ./scripts/publish_pypi.sh --skip-build # upload existing dist/
set -euo pipefail
cd "$(dirname "$0")/.."

CHECK_ONLY=0
SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

VERSION="$(grep -E '^version = ' pyproject.toml | head -1 | sed 's/.*"\(.*\)".*/\1/')"
PKG="quest-ai"
PYPI_URL="https://pypi.org/project/${PKG}/${VERSION}/"

on_pypi() {
  curl -sf "https://pypi.org/pypi/${PKG}/${VERSION}/json" >/dev/null 2>&1
}

if ! [[ -d .venv ]]; then
  echo "Create .venv first: python3.12 -m venv .venv && .venv/bin/pip install -e '.[dev]'" >&2
  exit 1
fi

PY=".venv/bin/python"

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  echo "Mode: --check (build + twine check, no upload)"
elif on_pypi; then
  echo "Mode: upload — version ${VERSION} is already on PyPI"
  echo "  ${PYPI_URL}"
  echo "Nothing to upload. Bump version in pyproject.toml for the next release."
  exit 0
else
  echo "Mode: upload quest-ai ${VERSION}"
fi

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  rm -rf dist build
  "$PY" -m build
fi

if [[ ! -d dist ]] || [[ -z "$(ls -A dist 2>/dev/null)" ]]; then
  echo "No files in dist/. Run without --skip-build." >&2
  exit 1
fi

"$PY" -m twine check dist/*
echo "twine check OK."

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  if on_pypi; then
    echo "Note: ${VERSION} is already published at ${PYPI_URL}"
  fi
  exit 0
fi

if on_pypi; then
  echo "Already on PyPI — skipping upload."
  exit 0
fi

TOKEN="${PYPI_TOKEN:-${PYPI_API_TOKEN:-${TWINE_PASSWORD:-}}}"
if [[ -z "$TOKEN" ]]; then
  echo "Missing PyPI token. Set PYPI_TOKEN in .env or your shell (pypi-...)." >&2
  exit 1
fi
if [[ "$TOKEN" != pypi-* ]]; then
  echo "Token should start with pypi- (got: ${TOKEN:0:8}...)" >&2
  exit 1
fi

export TWINE_USERNAME=__token__
export TWINE_PASSWORD="$TOKEN"
export TWINE_NON_INTERACTIVE=1

echo "Uploading quest-ai ${VERSION}..."
"$PY" -m twine upload --verbose dist/*

echo "Done: ${PYPI_URL}"
