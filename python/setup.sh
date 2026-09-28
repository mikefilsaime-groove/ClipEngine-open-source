#!/bin/bash
set -e

# The venv lives OUTSIDE the project tree at ~/.clipengine-venv.
# Why: Turbopack refuses to traverse absolute-path symlinks into system
# Python installs and the venv also contains 1GB+ of binaries we don't
# want in the Next.js module graph. Keeping it out of the repo tree
# avoids build breakage entirely.

VENV_DIR="$HOME/.clipengine-venv"

if [ ! -d "$VENV_DIR" ]; then
  echo "Creating Python virtual environment at $VENV_DIR ..."
  python3 -m venv "$VENV_DIR"
fi

echo "Activating venv and installing dependencies..."
source "$VENV_DIR/bin/activate"
pip install -r "$(dirname "$0")/requirements.txt"

# Optional: YOLO face detection model for improved tracking.
# The yolov8n-face.pt model must be manually placed at ~/.clipengine-models/
# It's not auto-downloadable from ultralytics. If absent, ClipEngine uses
# MediaPipe for face detection (which works well for podcasts).
MODELS_DIR="$HOME/.clipengine-models"
mkdir -p "$MODELS_DIR"
if [ -f "$MODELS_DIR/yolov8n-face.pt" ]; then
  echo "YOLO face model found at $MODELS_DIR/yolov8n-face.pt"
else
  echo "NOTE: For enhanced face tracking, place yolov8n-face.pt at:"
  echo "  $MODELS_DIR/yolov8n-face.pt"
  echo "  (MediaPipe will be used as fallback — works great for podcasts)"
fi

echo ""
echo "Setup complete! To run the sidecar:"
echo "  source ~/.clipengine-venv/bin/activate && python python/sidecar.py"
echo ""
echo "NOTE: pyannote-audio requires a HuggingFace token — set it inside"
echo "the ClipEngine app at Settings → API Keys. No environment export"
echo "is needed; the sidecar gets the token from each /diarize request."
