import asyncio
import json
import os
from datetime import datetime, timezone

from aiokafka import AIOKafkaConsumer
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from sqlalchemy import inspect, text

from .database import Base, SessionLocal, engine
from .models import ChatMessage

BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
JOURNAL_TOPIC = "chat.global"
CHAT_CONSUMER_GROUP = "chat-service"
HOME_CHAT_ROOM = "home_global"

app = FastAPI(title="Chat Service")


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[dict]] = {}

    async def connect(
        self,
        websocket: WebSocket,
        match_id: str,
        player: str | None = None,
        team_chat_only: bool = False,
    ):
        await websocket.accept()
        self.active_connections.setdefault(match_id, []).append({
            "socket": websocket,
            "player": normalize_team_color(player),
            "team_chat_only": team_chat_only,
        })

    def update_preferences(
        self,
        websocket: WebSocket,
        match_id: str,
        player: str | None,
        team_chat_only: bool,
    ):
        for connection in self.active_connections.get(match_id, []):
            if connection["socket"] is websocket:
                connection["player"] = normalize_team_color(player)
                connection["team_chat_only"] = team_chat_only
                return

    def disconnect(self, websocket: WebSocket, match_id: str):
        if match_id not in self.active_connections:
            return
        self.active_connections[match_id] = [
            connection for connection in self.active_connections[match_id]
            if connection["socket"] is not websocket
        ]
        if not self.active_connections[match_id]:
            self.active_connections.pop(match_id, None)

    async def broadcast(self, match_id: str, payload: dict):
        if match_id not in self.active_connections:
            return
        stale_connections = []
        for connection in self.active_connections[match_id]:
            try:
                await connection["socket"].send_json(payload)
            except Exception:
                stale_connections.append(connection)
        for connection in stale_connections:
            self.disconnect(connection["socket"], match_id)

    async def broadcast_chat_entry(self, match_id: str, entry: dict):
        if match_id not in self.active_connections:
            return
        stale_connections = []
        for connection in self.active_connections[match_id]:
            try:
                if can_receive_entry(
                    match_id,
                    entry,
                    connection.get("player"),
                    connection.get("team_chat_only") is True,
                ):
                    await connection["socket"].send_json({"kind": "chat_message", "entry": entry})
            except Exception:
                stale_connections.append(connection)
        for connection in stale_connections:
            self.disconnect(connection["socket"], match_id)


manager = ConnectionManager()


def normalize_team_color(team_color: str | None) -> str | None:
    if team_color == "rouge":
        return "red"
    if team_color == "bleu":
        return "blue"
    return team_color


def is_truthy(value) -> bool:
    return value is True or str(value).lower() == "true"


def can_receive_entry(
    match_id: str,
    entry: dict,
    viewer_player: str | None,
    viewer_team_chat_only: bool,
) -> bool:
    if match_id != HOME_CHAT_ROOM or entry.get("channel") != "chat":
        return True

    entry_player = normalize_team_color(entry.get("player"))
    visible_to_team = normalize_team_color(entry.get("visible_to_team"))

    if visible_to_team and visible_to_team != viewer_player:
        return False

    if viewer_team_chat_only and entry_player != viewer_player:
        return False

    return True


def filter_history(
    match_id: str,
    entries: list[dict],
    viewer_player: str | None,
    viewer_team_chat_only: bool,
) -> list[dict]:
    return [
        entry for entry in entries
        if can_receive_entry(match_id, entry, viewer_player, viewer_team_chat_only)
    ]


def ensure_chat_schema():
    inspector = inspect(engine)
    chat_columns = {column["name"] for column in inspector.get_columns("chat_messages")}
    if "visible_to_team" not in chat_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE chat_messages ADD COLUMN visible_to_team VARCHAR(20) NULL"))


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
        "visible_to_team": entry.visible_to_team,
        "text": entry.content,
        "sent_at": timestamp,
    }


def save_message(
    match_id: str,
    channel: str,
    author: str,
    content: str,
    player: str | None = None,
    visible_to_team: str | None = None,
) -> dict:
    db = SessionLocal()
    try:
        entry = ChatMessage(
            match_id=match_id,
            channel=channel,
            author=author,
            player=normalize_team_color(player),
            visible_to_team=normalize_team_color(visible_to_team),
            content=content,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return serialize_entry(entry)
    finally:
        db.close()


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
    ensure_chat_schema()
    asyncio.create_task(consume_journal_loop())
    print("[ChatService] startup complete", flush=True)


@app.websocket("/ws/chat/{match_id}")
async def websocket_chat_endpoint(websocket: WebSocket, match_id: str):
    player = normalize_team_color(websocket.query_params.get("player"))
    team_chat_only = is_truthy(websocket.query_params.get("team_chat_only"))

    await manager.connect(websocket, match_id, player, team_chat_only)
    entries = filter_history(match_id, load_history(match_id), player, team_chat_only)
    await websocket.send_json({"kind": "chat_history", "entries": entries})

    try:
        while True:
            payload = await websocket.receive_json()
            if payload.get("kind") != "player_message":
                continue

            content = (payload.get("message") or "").strip()
            if not content:
                continue

            player = normalize_team_color(payload.get("player"))
            team_chat_only = is_truthy(payload.get("team_chat_only"))
            manager.update_preferences(websocket, match_id, player, team_chat_only)

            entry = save_message(
                match_id=match_id,
                channel="chat",
                author=payload.get("pseudo", "Joueur"),
                player=player,
                content=content,
                visible_to_team=player if match_id == HOME_CHAT_ROOM and team_chat_only else None,
            )
            await manager.broadcast_chat_entry(match_id, entry)
    except WebSocketDisconnect:
        manager.disconnect(websocket, match_id)