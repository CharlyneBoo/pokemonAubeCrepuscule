import asyncio
import json
import os
from datetime import datetime, timezone

from aiokafka import AIOKafkaConsumer
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .database import Base, SessionLocal, engine
from .models import ChatMessage

BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
JOURNAL_TOPIC = "chat.global"
CHAT_CONSUMER_GROUP = "chat-service"

app = FastAPI(title="Chat Service")


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    # Accepte une nouvelle connexion WebSocket
    async def connect(self, websocket: WebSocket, match_id: str):
        await websocket.accept()
        self.active_connections.setdefault(match_id, []).append(websocket)

    # Retire une connexion WebSocket
    def disconnect(self, websocket: WebSocket, match_id: str):
        if match_id not in self.active_connections:
            return
        self.active_connections[match_id] = [
            connection for connection in self.active_connections[match_id] if connection is not websocket
        ]
        if not self.active_connections[match_id]:
            self.active_connections.pop(match_id, None)

    # Diffuse un message JSON à tous les utilisateurs 
    async def broadcast(self, match_id: str, payload: dict):
        if match_id not in self.active_connections:
            return
        stale_connections = []
        for connection in self.active_connections[match_id]:
            try:
                await connection.send_json(payload)
            except Exception:
                stale_connections.append(connection)
        for connection in stale_connections:
            self.disconnect(connection, match_id)


manager = ConnectionManager()


# Transforme un objet ChatMessage en propre pour le frontend
def serialize_entry(entry: ChatMessage) -> dict:
    created_at = entry.created_at
    if isinstance(created_at, datetime):
        timestamp = created_at.astimezone(timezone.utc).isoformat()
    else:
        timestamp = datetime.now(timezone.utc).isoformat()
    return {
        "channel": entry.channel,
        "user": entry.author,
        "player": entry.player,
        "text": entry.content,
        "sent_at": timestamp,
    }


# Crée un nouveau message et le sauvegarde dans la bDD
def save_message(match_id: str, channel: str, author: str, content: str, player: str | None = None) -> dict:
    db = SessionLocal()
    try:
        entry = ChatMessage(
            match_id=match_id,
            channel=channel,
            author=author,
            player=player,
            content=content,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return serialize_entry(entry)
    finally:
        db.close()

# Récupère les 100 derniers messages d'un salon depuis la bDD
def load_history(match_id: str, limit: int = 100) -> list[dict]:
    db = SessionLocal()
    try:
        rows = (
            db.query(ChatMessage)
            .filter(ChatMessage.match_id == match_id)
            .order_by(ChatMessage.id.desc())
            .limit(limit)
            .all()
        )
        rows.reverse()
        return [serialize_entry(row) for row in rows]
    finally:
        db.close()


def clear_history(match_id: str):
    db = SessionLocal()
    try:
        db.query(ChatMessage).filter(ChatMessage.match_id == match_id).delete()
        db.commit()
    finally:
        db.close()


async def consume_journal_loop():
    delay = 1
    while True:
        consumer = AIOKafkaConsumer(
            JOURNAL_TOPIC,
            bootstrap_servers=BOOTSTRAP,
            group_id=CHAT_CONSUMER_GROUP,
            auto_offset_reset="latest",
            enable_auto_commit=True,
        )
        try:
            await consumer.start()
            delay = 1
            async for message in consumer:
                payload = json.loads(message.value.decode("utf-8"))
                kind = payload.get("kind")
                if kind == "chat_reset":
                    match_id = payload.get("match_id")
                    if match_id:
                        clear_history(match_id)
                        await manager.broadcast(match_id, {"kind": "chat_cleared"})
                    continue

                if kind not in ("turn_result", "chat_system"):
                    continue

                match_id = payload.get("match_id")
                content = payload.get("message")
                if not match_id or not content:
                    continue

                entry = save_message(
                    match_id=match_id,
                    channel="journal",
                    author=payload.get("author", "Pablob"),
                    content=content,
                    player=payload.get("player"),
                )
                await manager.broadcast(match_id, {"kind": "journal_message", "entry": entry})
        except Exception as exc:
            print(f"[ChatService] Kafka error: {type(exc).__name__}: {exc} -> retry in {delay}s", flush=True)
            await asyncio.sleep(delay)
            delay = min(10, delay * 2)
        finally:
            try:
                await consumer.stop()
            except Exception:
                pass


@app.on_event("startup")
async def startup():
    Base.metadata.create_all(bind=engine)
    asyncio.create_task(consume_journal_loop())
    print("[ChatService] startup complete", flush=True)


@app.websocket("/ws/chat/{match_id}")
async def websocket_chat_endpoint(websocket: WebSocket, match_id: str):
    await manager.connect(websocket, match_id)
    await websocket.send_json({"kind": "chat_history", "entries": load_history(match_id)})

    try:
        while True:
            payload = await websocket.receive_json()
            if payload.get("kind") != "player_message":
                continue

            content = (payload.get("message") or "").strip()
            if not content:
                continue

            entry = save_message(
                match_id=match_id,
                channel="chat",
                author=payload.get("pseudo", "Joueur"),
                player=payload.get("player"),
                content=content,
            )
            await manager.broadcast(match_id, {"kind": "chat_message", "entry": entry})
    except WebSocketDisconnect:
        manager.disconnect(websocket, match_id)
