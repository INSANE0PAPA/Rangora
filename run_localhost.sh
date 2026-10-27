#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "==================================================================="
echo " RANGORA — Starting Local Development Server"
echo "==================================================================="

# 1. Ensure .env exists
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  echo "[Rangora] Created .env from .env.example (uses offline Local SQLite by default)."
fi

# 2. Ensure virtual environment exists
if [ ! -f ".venv/bin/python" ]; then
  echo "[Rangora] Creating Python virtual environment (.venv)..."
  python3 -m venv .venv
fi

# 3. Fast dependency check
if ! .venv/bin/python -c "import flask, dotenv" >/dev/null 2>&1; then
  echo "[Rangora] Installing dependencies..."
  .venv/bin/pip install -r requirements.txt
else
  echo "[Rangora] Dependencies verified."
fi

# 4. Open browser in background
(sleep 1 && (command -v xdg-open >/dev/null && xdg-open "http://127.0.0.1:5000" || command -v open >/dev/null && open "http://127.0.0.1:5000" || true)) &

echo "==================================================================="
echo " RANGORA — Launching on http://127.0.0.1:5000"
echo " Tech Stack: Python Flask + Neon PostgreSQL + Supabase Auth"
echo "==================================================================="
.venv/bin/python backend.py
