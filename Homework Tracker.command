#!/bin/bash
# Serves Homework Tracker over http://localhost and opens it in the browser.
# Opening index.html directly (file://) breaks the service worker, so a local
# server is required.
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8123}"

if command -v node >/dev/null 2>&1; then
  ( sleep 1; open "http://localhost:$PORT/" ) &
  exec node scripts/serve.mjs "$PORT"
elif command -v python3 >/dev/null 2>&1; then
  ( sleep 1; open "http://localhost:$PORT/" ) &
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
else
  echo "Homework Tracker needs Node.js or Python 3 to run locally."
  read -r -p "Press return to close..."
  exit 1
fi
