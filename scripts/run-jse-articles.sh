#!/usr/bin/env bash
# One-shot runner for fetch-jse-trading-articles.py
# Creates a local venv, installs dependencies, then runs the script.
# Usage: bash run-jse-articles.sh [any extra flags]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv-jse"
PYTHON="$VENV_DIR/bin/python"
PIP="$VENV_DIR/bin/pip"

# Create venv if it doesn't exist yet
if [ ! -f "$PYTHON" ]; then
    echo "[SETUP] Creating virtual environment at $VENV_DIR ..."
    python3 -m venv "$VENV_DIR"
    echo "[SETUP] Installing dependencies ..."
    "$PIP" install --quiet requests beautifulsoup4 lxml
    echo "[SETUP] Done."
fi

echo "[RUN] Starting JSE article fetcher ..."
"$PYTHON" "$SCRIPT_DIR/fetch-jse-trading-articles.py" "$@"
