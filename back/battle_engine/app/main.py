import os
import json
import uuid
import asyncio
from datetime import datetime, timezone
import httpx
from typing import Optional, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

app = FastAPI(title="Battle Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",  
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, match_id: str, mode: str):
        await websocket.accept()
        if match_id not in self.active_connections:
            self.active_connections[match_id] = []
        self.active_connections[match_id].append(websocket)

        # Si les deux joueurs sont là, on prépare le match
        if len(self.active_connections[match_id]) == 2:
            
            if mode == "hasard":
                async with httpx.AsyncClient() as client:
                    try:
                        reponse = await client.get("http://duel-service:8000/generate-random-teams")
                        donnees_arbitre = reponse.json()
                        
                        message_depart = {
                            "kind": "match_start",
                            "mode": "hasard",
                            "message": "Les équipes aléatoires ont été générées ! Le match commence.",
                            "red_team_ids": donnees_arbitre["red_team_ids"],
                            "blue_team_ids": donnees_arbitre["blue_team_ids"],
                            "red_active_index": donnees_arbitre["red_active_index"],
                            "blue_active_index": donnees_arbitre["blue_active_index"]
                        }
                    except Exception as e:
                        print("Erreur de connexion au Service Duel:", e)
                        message_depart = {"kind": "error", "message": "L'arbitre est introuvable."}

            else:
                message_depart = {
                    "kind": "match_start",
                    "mode": mode,
                    "message": f"Le match commence en mode {mode} !"
                }
                
            # On envoie les infos aux deux joueurs via WebSocket
            await self.broadcast_to_match(message_depart, match_id)

    def disconnect(self, websocket: WebSocket, match_id: str):
        if match_id in self.active_connections:
            self.active_connections[match_id].remove(websocket)

    async def broadcast_to_match(self, message: dict, match_id: str):
        if match_id in self.active_connections:
            for connection in self.active_connections[match_id]:
                await connection.send_json(message)

ws_manager = ConnectionManager()

class PokemonActif(BaseModel):
    name: str
    types: list[str]

class PlayerAction(BaseModel):
    match_id: str
    turn: int
    team: str  
    action: str  
    target: Optional[int] = None  
    pokemon_actif: PokemonActif 
    
BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
COMMANDS_TOPIC = "battle.commands"
CHAT_GLOBAL_TOPIC = "chat.global"

producer: AIOKafkaProducer | None = None
pending: dict[tuple[str, int], dict[str, dict]] = {}

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# --- 5. FONCTIONS MÉTIER ---
async def publish_turn_result(match_id: str, turn: int, red_choice: dict, blue_choice: dict, resultat_duel: dict):
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
        "duel_result": resultat_duel,
        "message": f"Résultat tour {turn} : {resultat_duel.get('message')}"
    }

    # On envoie à Kafka
    await producer.send_and_wait(
        CHAT_GLOBAL_TOPIC,
        json.dumps(result).encode("utf-8"),
        key=match_id.encode("utf-8"),
    )
    
    await ws_manager.broadcast_to_match(result, match_id)
    print("[BattleEngine] turn_result publié:", result, flush=True)

async def consume_commands_loop():
    consumer = AIOKafkaConsumer(
        COMMANDS_TOPIC,
        bootstrap_servers=BOOTSTRAP,
        group_id="battle-engine",
        auto_offset_reset="latest",
        enable_auto_commit=True,
    )

    await consumer.start()
    print(f"[BattleEngine] consumer démarré sur {COMMANDS_TOPIC}", flush=True)

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

                print(f"[BattleEngine] Les deux joueurs ont joué.")

                duel_payload = {
                    "red_pokemon": red_choice.get("pokemon_actif"),
                    "blue_pokemon": blue_choice.get("pokemon_actif")
                }

                async with httpx.AsyncClient() as client:
                    try:
                        reponse = await client.post("http://duel-service:8000/resolve", json=duel_payload)
                        resultat_duel = reponse.json()
                    except Exception as e:
                        print("Erreur de connexion au Service Duel:", e)
                        resultat_duel = {"winner": "error"}

                await publish_turn_result(match_id, int(turn), red_choice, blue_choice, resultat_duel)

                del pending[key]

    finally:
        await consumer.stop()

# --- 6. LES ROUTES API ---

@app.post("/battle/action")
async def receive_player_action(action_data: PlayerAction):
    global producer 
    data_dict = action_data.model_dump() if hasattr(action_data, 'model_dump') else action_data.dict()

    kafka_payload = {
        "kind": "turn_choice",
        "match_id": data_dict.get("match_id"),
        "turn": data_dict.get("turn"),
        "team": data_dict.get("team"),
        "player": data_dict.get("team"), 
        "choice": data_dict.get("action"),
        "switch_to": data_dict.get("target"),
        "pokemon_actif": data_dict.get("pokemon_actif")
    }
    
    await producer.send_and_wait(
        COMMANDS_TOPIC,
        json.dumps(kafka_payload).encode("utf-8"),
        key=action_data.match_id.encode("utf-8")
    )
    
    return {"status": "success", "message": "Action déposée dans Kafka !"}


@app.websocket("/ws/battle/{match_id}/{mode}")
async def websocket_battle_endpoint(websocket: WebSocket, match_id: str, mode: str):
    await ws_manager.connect(websocket, match_id, mode)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, match_id)


@app.on_event("startup")
async def startup():
    global producer
    producer = AIOKafkaProducer(bootstrap_servers=BOOTSTRAP)
    await producer.start()
    print("[BattleEngine] producer démarré", flush=True)
    asyncio.create_task(consume_commands_loop())

@app.on_event("shutdown")
async def shutdown():
    global producer
    if producer:
        await producer.stop()