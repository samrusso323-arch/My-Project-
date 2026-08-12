#!/bin/bash
# Double-click this file to start Speed Map Builder (macOS/Linux).
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 isn't installed. Get it from https://www.python.org/downloads/ then double-click this file again."
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

echo "Setting up (first run only takes a minute)..."
python3 -m pip install --quiet -r requirements.txt

echo "Starting Speed Map Builder..."
( sleep 1.5 && (open http://localhost:5000 2>/dev/null || xdg-open http://localhost:5000 2>/dev/null) ) &

echo ""
echo "Speed Map Builder is running. Your browser should open automatically."
echo "If not, go to: http://localhost:5000"
echo ""
echo "Leave this window open while you use the app. Close it (or press Ctrl+C) to stop."
echo ""

python3 app.py
