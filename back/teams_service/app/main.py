import os
import json
import uuid
import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer

from . import models, schema
from .database import Base, engine, get_db

app = FastAPI(title="Teams Service")

BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

ROOM_TO_TOPIC = {
    "global": "chat.global",
    "red": "chat.red",
    "blue": "chat.blue",
}

CHAT_GROUP_ID = "teams-chat-demo"
BATTLE_COMMANDS_TOPIC = "battle.commands"

producer: AIOKafkaProducer | None = None


class ChatIn(BaseModel):
    author: str
    message: str
    team: str | None = None


class TurnPromptIn(BaseModel):
    match_id: str
    team: str
    prompt: str


class TurnChoiceIn(BaseModel):
    match_id: str
    turn: int
    team: str
    player: str
    choice: str
    switch_to: int | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_event(
    room: str,
    author: str,
    message: str,
    team: str | None,
    kind: str,
    extra: dict | None = None,
):
    payload = {
        "schema_version": 1,
        "event_id": str(uuid.uuid4()),
        "kind": kind,
        "room": room,
        "author": author,
        "team": team,
        "message": message,
        "sent_at": _now_iso(),
    }
    if extra:
        payload.update(extra)
    return payload


async def _send_to_room(room: str, payload: dict, key: str | None = None):
    global producer
    if producer is None:
        raise RuntimeError("Kafka producer not started")

    if room not in ROOM_TO_TOPIC:
        raise ValueError("Invalid room")

    topic = ROOM_TO_TOPIC[room]
    k = (key or room).encode("utf-8")
    await producer.send_and_wait(topic, json.dumps(payload).encode("utf-8"), key=k)


@app.on_event("startup")
def startup_db():
    Base.metadata.create_all(bind=engine)


@app.on_event("startup")
async def startup_kafka():
    global producer
    producer = AIOKafkaProducer(bootstrap_servers=BOOTSTRAP)
    await producer.start()
    asyncio.create_task(_delayed_start_consumer())
    print("✅ startup_kafka: producer OK, consumer task scheduled")



async def _delayed_start_consumer():
    await asyncio.sleep(5)
    await chat_consume_loop()


@app.on_event("shutdown")
async def shutdown_kafka():
    global producer
    if producer:
        await producer.stop()


async def chat_consume_loop():
    topics = list(ROOM_TO_TOPIC.values()) + [BATTLE_COMMANDS_TOPIC]

    delay = 1
    max_delay = 10

    while True:
        consumer = AIOKafkaConsumer(
            *topics,
            bootstrap_servers=BOOTSTRAP,
            group_id=None,
            enable_auto_commit=False,
            auto_offset_reset="latest",
        )

        try:
            await consumer.start()
            print("✅ Consumer Kafka started")

            delay = 1
            async for msg in consumer:
                event = json.loads(msg.value.decode("utf-8"))
                print(f"✅ [Kafka {msg.topic}] reçu:", event)

        except Exception as e:
            print(f"⚠️ Kafka consumer error: {type(e).__name__}: {e} -> retry dans {delay}s")
            await asyncio.sleep(delay)
            delay = min(max_delay, delay * 2)

        finally:
            try:
                await consumer.stop()
            except Exception:
                pass
            
@app.post("/chat/{room}")
async def post_chat(room: str, body: ChatIn):
    if room not in ROOM_TO_TOPIC:
        raise HTTPException(status_code=400, detail="room must be global|red|blue")

    payload = _make_event(
        room=room,
        author=body.author,
        message=body.message,
        team=body.team,
        kind="chat",
    )

    await _send_to_room(room, payload, key=room)
    return {"ok": True, "sent": payload}


@app.post("/turn/prompt")
async def post_turn_prompt(body: TurnPromptIn):
    if body.team not in ("red", "blue"):
        raise HTTPException(status_code=400, detail="team must be red|blue")

    room = body.team
    payload = _make_event(
        room=room,
        author="system",
        message=body.prompt,
        team=body.team,
        kind="turn_prompt",
        extra={"match_id": body.match_id},
    )

    await _send_to_room(room, payload, key=body.match_id)
    return {"ok": True, "sent": payload}


@app.post("/turn/choice")
async def post_turn_choice(body: TurnChoiceIn):
    if body.team not in ("red", "blue"):
        raise HTTPException(status_code=400, detail="team must be red|blue")

    c = body.choice.upper()
    if c not in ("STAY", "SWITCH"):
        raise HTTPException(status_code=400, detail="choice must be STAY|SWITCH")

    if c == "SWITCH" and body.switch_to is None:
        raise HTTPException(status_code=400, detail="switch_to required when choice=SWITCH")

    global producer
    if producer is None:
        raise HTTPException(status_code=500, detail="Kafka producer not started")

    payload = {
        "schema_version": 1,
        "event_id": str(uuid.uuid4()),
        "kind": "turn_choice",
        "match_id": body.match_id,
        "turn": body.turn,
        "team": body.team,
        "player": body.player,
        "choice": c,
        "switch_to": body.switch_to,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }

    await producer.send_and_wait(
        BATTLE_COMMANDS_TOPIC,
        json.dumps(payload).encode("utf-8"),
        key=body.match_id.encode("utf-8"),
    )

    return {"ok": True, "sent": payload}


@app.get("/teams", response_model=list[schema.TeamRead])
def get_teams(db: Session = Depends(get_db)):
    return db.query(models.Team).all()


@app.post("/teams", response_model=schema.TeamRead)
def create_team(team: schema.TeamCreate, db: Session = Depends(get_db)):
    db_team = models.Team(name=team.name, user_id=team.user_id)
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team
