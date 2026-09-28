"""
ClipEngine Python sidecar server.

Runs on port 5001 and provides:
  - Speaker diarization via pyannote-audio
  - Face detection + tracking via YOLOv8-face + ByteTrack (with MediaPipe fallback)

Start with:
  cd python && source venv/bin/activate && python sidecar.py

The HuggingFace token is passed by the Next.js app on every /diarize
request (it lives in the app's SQLite DB, not the environment). The
pipeline is lazy-loaded on first use and cached per token.
"""

import os
import sys
import json
import logging
import math
from pathlib import Path

import cv2
import torch
from flask import Flask, request, jsonify

# PyTorch 2.6+ defaults torch.load(weights_only=True), which rejects the
# pickle format used by pyannote 3.3 checkpoints. Two-part fix:
# 1. Monkey-patch torch.load for code paths that resolve via the module attr
# 2. Allowlist TorchVersion for code paths that imported torch.load directly
_original_torch_load = torch.load
def _torch_load_compat(*args, **kwargs):
    kwargs["weights_only"] = False
    return _original_torch_load(*args, **kwargs)
torch.load = _torch_load_compat

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

app = Flask(__name__)

# ---------------------------------------------------------------------------
# Pyannote pipeline — lazy-loaded on first /diarize request. Cached by token
# so a token change in the app forces a re-init.
# ---------------------------------------------------------------------------
_pipeline_cache = {"token": None, "pipeline": None}


def get_or_load_pipeline(hf_token: str):
    if _pipeline_cache["pipeline"] is not None and _pipeline_cache["token"] == hf_token:
        return _pipeline_cache["pipeline"]

    from pyannote.audio import Pipeline

    log.info("Loading pyannote speaker-diarization-3.1 pipeline …")
    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        use_auth_token=hf_token,
    )

    if torch.backends.mps.is_available():
        device = torch.device("mps")
        log.info("Using MPS (Apple Silicon) for diarization.")
    elif torch.cuda.is_available():
        device = torch.device("cuda")
        log.info("Using CUDA for diarization.")
    else:
        device = torch.device("cpu")
        log.info("Using CPU for diarization.")

    pipeline.to(device)
    _pipeline_cache["token"] = hf_token
    _pipeline_cache["pipeline"] = pipeline
    log.info("Diarization pipeline ready.")
    return pipeline


# ---------------------------------------------------------------------------
# Face detection — YOLO+ByteTrack primary, MediaPipe fallback
# ---------------------------------------------------------------------------

_yolo_model = None
_use_yolo = True


def _get_yolo_model():
    """Lazy-load YOLOv8n-face model. Returns None if unavailable."""
    global _yolo_model, _use_yolo
    if _yolo_model is not None:
        return _yolo_model
    if not _use_yolo:
        return None

    try:
        from ultralytics import YOLO

        # Check for a face-specific YOLO model in the known cache location.
        # yolov8n-face.pt is not auto-downloadable — users or setup.sh must
        # place it at ~/.clipengine-models/yolov8n-face.pt. If not found,
        # fall back to MediaPipe.
        models_dir = os.path.join(os.path.expanduser("~"), ".clipengine-models")
        cached_path = os.path.join(models_dir, "yolov8n-face.pt")

        if not os.path.exists(cached_path):
            log.info("YOLO face model not found at %s — using MediaPipe", cached_path)
            _use_yolo = False
            return None

        model = YOLO(cached_path)

        # Select device.
        if torch.backends.mps.is_available():
            log.info("YOLO face detection using MPS (Apple Silicon).")
        elif torch.cuda.is_available():
            log.info("YOLO face detection using CUDA.")
        else:
            log.info("YOLO face detection using CPU.")

        _yolo_model = model
        log.info("YOLOv8n-face model loaded successfully.")
        return model
    except Exception as exc:
        log.warning("Failed to load YOLO model, falling back to MediaPipe: %s", exc)
        _use_yolo = False
        return None


def _get_mediapipe_detector():
    """Fallback MediaPipe face detector."""
    import mediapipe as mp
    return mp.solutions.face_detection.FaceDetection(
        model_selection=1,
        min_detection_confidence=0.5,
    )


def _compute_orientation(landmarks):
    """Determine face orientation from 5 YOLO keypoints."""
    if not landmarks or len(landmarks) < 5:
        return "frontal"
    # YOLO keypoints: [left_eye, right_eye, nose, mouth_left, mouth_right]
    left_eye_x = landmarks[0][0]
    right_eye_x = landmarks[1][0]
    nose_x = landmarks[2][0]

    # Ratio of eye-to-nose distances. ~1.0 = frontal, >>1 or <<1 = profile.
    left_dist = abs(left_eye_x - nose_x)
    right_dist = abs(right_eye_x - nose_x)
    if left_dist < 1 or right_dist < 1:
        return "profile"
    ratio = left_dist / right_dist
    if ratio > 2.5 or ratio < 0.4:
        return "profile"
    return "frontal"


def _detect_faces_yolo(video_path, sample_rate):
    """Run face detection using YOLO+ByteTrack with persistent tracking."""
    model = _get_yolo_model()
    if model is None:
        return None  # Signal to fall back to MediaPipe.

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_interval = max(1, int(round(fps / sample_rate)))

    frames_result = []
    track_stats = {}  # trackId -> {firstSeen, lastSeen, frameCount}
    frame_index = 0

    # Device selection for YOLO inference.
    if torch.backends.mps.is_available():
        device = "mps"
    elif torch.cuda.is_available():
        device = 0
    else:
        device = "cpu"

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_index % frame_interval == 0:
            timestamp = round(frame_index / fps, 3)

            # Run YOLO tracking with ByteTrack for persistent IDs.
            results = model.track(
                frame,
                persist=True,
                tracker="bytetrack.yaml",
                conf=0.3,
                verbose=False,
                device=device,
            )

            faces = []
            if results and len(results) > 0 and results[0].boxes is not None:
                boxes = results[0].boxes
                h, w, _ = frame.shape

                for i in range(len(boxes)):
                    # Bounding box in xyxy format.
                    xyxy = boxes.xyxy[i].cpu().numpy()
                    x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
                    bw = x2 - x1
                    bh = y2 - y1

                    # Track ID (persistent across frames).
                    track_id = int(boxes.id[i].item()) if boxes.id is not None else i

                    # Confidence score.
                    conf = float(boxes.conf[i].item()) if boxes.conf is not None else 0.5

                    # Landmarks (5 keypoints if available).
                    landmarks_data = None
                    orientation = "frontal"
                    nose_x = x1 + bw // 2
                    nose_y = y1 + bh // 2

                    if hasattr(results[0], 'keypoints') and results[0].keypoints is not None:
                        kps = results[0].keypoints
                        if kps.xy is not None and len(kps.xy) > i:
                            kp = kps.xy[i].cpu().numpy()
                            if len(kp) >= 5:
                                landmarks_data = {
                                    "leftEye": [int(kp[0][0]), int(kp[0][1])],
                                    "rightEye": [int(kp[1][0]), int(kp[1][1])],
                                    "nose": [int(kp[2][0]), int(kp[2][1])],
                                    "mouthLeft": [int(kp[3][0]), int(kp[3][1])],
                                    "mouthRight": [int(kp[4][0]), int(kp[4][1])],
                                }
                                nose_x = int(kp[2][0])
                                nose_y = int(kp[2][1])
                                orientation = _compute_orientation(kp)

                    face_data = {
                        "id": track_id,
                        "trackId": track_id,
                        "x": max(0, x1),
                        "y": max(0, y1),
                        "width": bw,
                        "height": bh,
                        "confidence": round(conf, 3),
                        "noseX": nose_x,
                        "noseY": nose_y,
                        "orientation": orientation,
                    }
                    if landmarks_data:
                        face_data["landmarks"] = landmarks_data

                    faces.append(face_data)

                    # Update track stats.
                    if track_id not in track_stats:
                        track_stats[track_id] = {
                            "firstSeen": timestamp,
                            "lastSeen": timestamp,
                            "frameCount": 0,
                        }
                    track_stats[track_id]["lastSeen"] = timestamp
                    track_stats[track_id]["frameCount"] += 1

            frames_result.append({"timestamp": timestamp, "faces": faces})

        frame_index += 1

    cap.release()

    # Reset tracker state for next request.
    model.predictor = None

    return {"frames": frames_result, "tracks": track_stats}


def _detect_faces_mediapipe(video_path, sample_rate):
    """Fallback face detection using MediaPipe."""
    import mediapipe as mp
    face_det = mp.solutions.face_detection.FaceDetection(
        model_selection=1,
        min_detection_confidence=0.5,
    )

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"frames": []}

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_interval = max(1, int(round(fps / sample_rate)))

    frames_result = []
    frame_index = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_index % frame_interval == 0:
            timestamp = round(frame_index / fps, 3)
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_det.process(rgb)

            faces = []
            if results.detections:
                h, w, _ = frame.shape
                for face_id, detection in enumerate(results.detections):
                    bb = detection.location_data.relative_bounding_box
                    x = int(bb.xmin * w)
                    y = int(bb.ymin * h)
                    width = int(bb.width * w)
                    height = int(bb.height * h)
                    kps = detection.location_data.relative_keypoints
                    nose_x = int(kps[2].x * w) if len(kps) > 2 else x + width // 2
                    nose_y = int(kps[2].y * h) if len(kps) > 2 else y + height // 2

                    faces.append(
                        {
                            "id": face_id,
                            "x": max(0, x),
                            "y": max(0, y),
                            "width": width,
                            "height": height,
                            "noseX": nose_x,
                            "noseY": nose_y,
                        }
                    )

            frames_result.append({"timestamp": timestamp, "faces": faces})

        frame_index += 1

    cap.release()
    face_det.close()
    return {"frames": frames_result}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/diarize")
def diarize():
    body = request.get_json(force=True, silent=True) or {}
    audio_path = body.get("audioPath")
    hf_token = body.get("hfToken") or request.headers.get("x-hf-token") or os.environ.get("HF_TOKEN")

    if not audio_path:
        return jsonify({"error": "audioPath is required"}), 400
    if not os.path.isfile(audio_path):
        return jsonify({"error": f"File not found: {audio_path}"}), 400
    if not hf_token:
        return jsonify({"error": "hfToken is required (pass in body or x-hf-token header)"}), 400

    try:
        pipeline = get_or_load_pipeline(hf_token)
    except Exception as exc:
        log.exception("Failed to load diarization pipeline")
        return jsonify({"error": f"Failed to load pipeline: {exc}"}), 503

    try:
        log.info("Running diarization on: %s", audio_path)
        diarization = pipeline(audio_path)

        segments = []
        speakers = set()
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append(
                {
                    "start": round(turn.start, 3),
                    "end": round(turn.end, 3),
                    "speaker": speaker,
                }
            )
            speakers.add(speaker)

        speaker_list = sorted(speakers)
        log.info("Diarization complete: %d segments, %d speakers", len(segments), len(speaker_list))
        return jsonify(
            {
                "segments": segments,
                "speakers": speaker_list,
                "speakerCount": len(speaker_list),
            }
        )
    except Exception as exc:
        log.exception("Diarization failed")
        return jsonify({"error": str(exc)}), 500


@app.post("/detect-faces")
def detect_faces():
    body = request.get_json(force=True, silent=True) or {}
    video_path = body.get("videoPath")
    sample_rate = float(body.get("sampleRate", 1.0))  # frames per second to sample

    if not video_path:
        return jsonify({"error": "videoPath is required"}), 400
    if not os.path.isfile(video_path):
        return jsonify({"error": f"File not found: {video_path}"}), 400

    try:
        log.info("Running face detection on: %s (sampleRate=%.2f fps)", video_path, sample_rate)

        # Try YOLO+ByteTrack first, fall back to MediaPipe.
        result = _detect_faces_yolo(video_path, sample_rate)
        if result is None:
            log.info("YOLO unavailable, using MediaPipe fallback")
            result = _detect_faces_mediapipe(video_path, sample_rate)

        frame_count = len(result.get("frames", []))
        track_count = len(result.get("tracks", {}))
        log.info(
            "Face detection complete: %d frames sampled, %d tracks",
            frame_count,
            track_count,
        )
        return jsonify(result)
    except Exception as exc:
        log.exception("Face detection failed")
        return jsonify({"error": str(exc)}), 500


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("SIDECAR_PORT", 5001))
    log.info("Starting ClipEngine Python sidecar on port %d (pipeline loads on first request)", port)
    app.run(host="127.0.0.1", port=port, debug=False)
