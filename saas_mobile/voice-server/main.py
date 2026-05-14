"""
Autopilot Voice Preflight Server — FastAPI

Runs on port 8000. Receives voice audio chunks from the Expo app
(via WebSocket) and sends back mock AI responses for preflight testing.

Test user: sanyog@gmail.com
Expo dev server: port 8081
"""

import asyncio
import base64
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("voice-server")

# ─── In-memory session store ────────────────────────────────────────────────
active_sessions: dict[str, WebSocket] = {}

# ─── Pydantic models ────────────────────────────────────────────────────────

class AuthSessionRequest(BaseModel):
    user_jwt: str
    api_key: Optional[str] = ""

class AuthSessionResponse(BaseModel):
    cassandra_token: str
    expires_at: int

class PreflightReport(BaseModel):
    status: str
    server_time: float
    active_ws_sessions: int
    version: str = "1.0.0-preflight"

# ─── Lifespan ───────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Voice preflight server starting on port 8000")
    yield
    logger.info("🛑 Voice preflight server shutting down")

app = FastAPI(
    title="Autopilot Voice Preflight Server",
    description="FastAPI backend for Expo voice integration preflight tests",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── CORS ───────────────────────────────────────────────────────────────────
# Allow Expo dev server on port 8081 and any local origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://localhost:19000",
        "http://10.0.2.2:8081",   # Android emulator
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Helpers ────────────────────────────────────────────────────────────────

def decode_jwt_payload(jwt: str) -> dict:
    """Decode JWT payload without verifying signature (for testing)."""
    try:
        parts = jwt.split(".")
        if len(parts) != 3:
            return {}
        payload = parts[1]
        # Pad base64
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += "=" * padding
        decoded = base64.urlsafe_b64decode(payload)
        return json.loads(decoded)
    except Exception:
        return {}

# ─── Routes ─────────────────────────────────────────────────────────────────

@app.get("/health", response_model=PreflightReport)
async def health_check():
    return PreflightReport(
        status="ok",
        server_time=time.time(),
        active_ws_sessions=len(active_sessions),
    )


@app.post("/auth/session", response_model=AuthSessionResponse)
async def auth_session(req: AuthSessionRequest):
    """
    Mock token exchange. Accepts any Supabase JWT and returns a test token.
    For sanyog@gmail.com, embeds the email in the token payload.
    """
    payload = decode_jwt_payload(req.user_jwt)
    email = payload.get("email", "unknown")
    sub = payload.get("sub", str(uuid.uuid4()))

    # Build a test cassandra token
    token_payload = {
        "sub": sub,
        "email": email,
        "test": True,
        "jti": str(uuid.uuid4()),
    }
    cassandra_token = base64.urlsafe_b64encode(
        json.dumps(token_payload).encode()
    ).decode().rstrip("=")

    expires_at = int(time.time()) + 3600  # 1 hour

    logger.info(f"🔑 Auth session created for {email} (sub={sub[:8]}...)")
    return AuthSessionResponse(
        cassandra_token=f"preflight-{cassandra_token}",
        expires_at=expires_at,
    )


@app.get("/preflight")
async def preflight():
    """Quick preflight endpoint for smoke tests."""
    return {
        "status": "ready",
        "timestamp": time.time(),
        "ws_endpoint": "/ws/audio/{org_id}",
        "auth_endpoint": "/auth/session",
        "test_user": "sanyog@gmail.com",
    }


# ─── WebSocket Voice Endpoint ───────────────────────────────────────────────

@app.websocket("/ws/audio/{org_id}")
async def websocket_audio(websocket: WebSocket, org_id: str):
    await websocket.accept()
    session_id = str(uuid.uuid4())[:8]
    active_sessions[session_id] = websocket

    logger.info(f"🔌 WS connected | org={org_id} | session={session_id} | total={len(active_sessions)}")

    authenticated = False
    chunk_count = 0
    last_activity = time.time()

    try:
        while True:
            # Use a timeout to detect stale connections
            try:
                message = await asyncio.wait_for(
                    websocket.receive(),
                    timeout=25.0,
                )
            except asyncio.TimeoutError:
                logger.warning(f"⏱ WS timeout | session={session_id}")
                break

            # Handle ASGI message dict from websocket.receive()
            if isinstance(message, dict):
                if message.get("type") == "websocket.receive":
                    if "bytes" in message and message["bytes"] is not None:
                        raw = message["bytes"]
                        logger.debug(f"📦 Binary frame received ({len(raw)} bytes) | session={session_id}")
                        continue
                    elif "text" in message and message["text"] is not None:
                        raw_text = message["text"]
                    else:
                        continue
                else:
                    continue
            elif isinstance(message, bytes):
                logger.debug(f"📦 Binary frame received ({len(message)} bytes) | session={session_id}")
                continue
            elif isinstance(message, str):
                raw_text = message
            else:
                logger.warning(f"⚠️ Unknown message type {type(message)} | session={session_id}")
                continue

            # Parse JSON text
            try:
                data = json.loads(raw_text)
            except json.JSONDecodeError:
                logger.warning(f"⚠️ Invalid JSON | session={session_id}")
                await websocket.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = data.get("type")
            last_activity = time.time()

            # ── Ping ──────────────────────────────────────────────────────
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            # ── Session Start ─────────────────────────────────────────────
            if msg_type == "session_start":
                cassandra_token = data.get("cassandra_token", "")
                room_id = data.get("room_id")

                # In preflight mode, accept ANY token that starts with "preflight-"
                # or just any token for maximum compatibility during testing
                authenticated = True
                logger.info(
                    f"✅ Session acknowledged | org={org_id} | room={room_id} | "
                    f"token_prefix={cassandra_token[:20]}... | session={session_id}"
                )
                await websocket.send_json({"type": "session_acknowledged"})
                continue

            # ── Audio Chunk ───────────────────────────────────────────────
            if msg_type == "audio_chunk":
                if not authenticated:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Session not authenticated. Send session_start first.",
                    })
                    continue

                chunk_count += 1
                seq = data.get("seq", chunk_count)
                data_len = len(data.get("data", ""))
                logger.info(
                    f"🎤 Audio chunk #{seq} | {data_len} bytes base64 | "
                    f"session={session_id}"
                )

                # After 3 chunks, simulate a response
                if chunk_count == 3:
                    # 1. Send transcript segment
                    await websocket.send_json({
                        "type": "segment",
                        "text": "Preflight test query",
                        "speaker_id": "user",
                    })

                    # 2. Send AI response text
                    response_text = (
                        f"Preflight test successful. Voice pipeline is wired from "
                        f"Expo app to FastAPI server. Received {chunk_count} audio chunks "
                        f"from session {session_id}."
                    )
                    await websocket.send_json({
                        "type": "voice_response",
                        "text": response_text,
                        "response": response_text,
                    })

                    # 3. Send a tiny synthetic "audio" payload (1x1 silent MP3 frame)
                    # This is a minimal valid-ish MP3 header so expo-av doesn't crash
                    synthetic_mp3 = base64.b64encode(
                        bytes([
                            0xFF, 0xFB, 0x90, 0x00,  # MPEG-1 Layer-3 frame sync
                            0x00, 0x00, 0x00, 0x00,
                            0x00, 0x00, 0x00, 0x00,
                        ])
                    ).decode()
                    await websocket.send_json({
                        "type": "audio_chunk",
                        "data": synthetic_mp3,
                        "format": "mp3",
                        "session_id": session_id,
                    })

                    logger.info(f"📤 Sent mock AI response | session={session_id}")
                continue

            # ── Unknown ───────────────────────────────────────────────────
            logger.warning(f"❓ Unknown message type '{msg_type}' | session={session_id}")

    except WebSocketDisconnect:
        logger.info(f"👋 WS disconnected | session={session_id}")
    except Exception as e:
        logger.error(f"💥 WS error | session={session_id} | {e}")
    finally:
        active_sessions.pop(session_id, None)
        logger.info(f"🧹 Session cleaned | session={session_id} | remaining={len(active_sessions)}")


# ─── Main entrypoint ────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        reload=False,
    )
