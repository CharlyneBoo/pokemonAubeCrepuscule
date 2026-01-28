import os
import json
import uuid
import asyncio
from datetime import datetime, timezone

from fastapi import FastAPI
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

app = FastAPI(title="Battle Engine")

BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

COMMANDS_TOPIC = "battle.commands"
CHAT_GLOBAL_TOPIC = "chat.global"

producer: AIOKafkaProducer | None = None

# Stockage en mémoire: {(match_id, turn): {"red": payload, "blue": payload}}
pending: dict[tuple[str, int], dict[str, dict]] = {}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def publish_turn_result(match_id: str, turn: int, red_choice: dict, blue_choice: dict):
    global producer
    assert producer is not None

    result = {
        "schema_version": 1,
        "event_id": str(uuid.uuid4()),
        "kind": "turn_result",
        "room": "global",
        "match_id": match_id,
        "turn": turn,
        "sent_at": now_iso(),
        "red": {
            "player": red_choice.get("player"),
            "choice": red_choice.get("choice"),
            "switch_to": red_choice.get("switch_to"),
        },
        "blue": {
            "player": blue_choice.get("player"),
            "choice": blue_choice.get("choice"),
            "switch_to": blue_choice.get("switch_to"),
        },
        "message": (
            f"Résultat tour {turn} (match {match_id}) -> "
            f"RED: {red_choice.get('choice')} / BLUE: {blue_choice.get('choice')}"
        ),
    }

    await producer.send_and_wait(
        CHAT_GLOBAL_TOPIC,
        json.dumps(result).encode("utf-8"),
        key=match_id.encode("utf-8"),
    )

    print("✅ [BattleEngine] turn_result publié:", result, flush=True)


async def consume_commands_loop():
    consumer = AIOKafkaConsumer(
        COMMANDS_TOPIC,
        bootstrap_servers=BOOTSTRAP,
        group_id="battle-engine",
        auto_offset_reset="latest",
        enable_auto_commit=True,
    )

    await consumer.start()
    print(f"✅ [BattleEngine] consumer démarré sur {COMMANDS_TOPIC}", flush=True)

    try:
        async for msg in consumer:
            payload = json.loads(msg.value.decode("utf-8"))

            if payload.get("kind") != "turn_choice":
                continue

            match_id = payload.get("match_id")
            turn = payload.get("turn")
            team = payload.get("team")

            if not match_id or turn is None or team not in ("red", "blue"):
                continue

            key = (match_id, int(turn))
            pending.setdefault(key, {})
            pending[key][team] = payload

            print(f"📩 [BattleEngine] reçu choice {team} pour {key}", flush=True)

            if "red" in pending[key] and "blue" in pending[key]:
                red_choice = pending[key]["red"]
                blue_choice = pending[key]["blue"]

                # ici plus tard: appliquer vraies règles (switch, dégâts, etc.)
                await publish_turn_result(match_id, int(turn), red_choice, blue_choice)

                # nettoyage
                del pending[key]

    finally:
        await consumer.stop()


@app.on_event("startup")
async def startup():
    global producer
    producer = AIOKafkaProducer(bootstrap_servers=BOOTSTRAP)
    await producer.start()
    print("✅ [BattleEngine] producer démarré", flush=True)

    asyncio.create_task(consume_commands_loop())


@app.on_event("shutdown")
async def shutdown():
    global producer
    if producer:
        await producer.stop()
