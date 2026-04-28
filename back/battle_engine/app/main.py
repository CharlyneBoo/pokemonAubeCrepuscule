import os
import json
import uuid
import random 
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
        self.player_presence: dict[str, dict[str, dict]] = {}
        
        # Draft
        self.draft_states: dict[str, dict] = {} 
        
        # Equipes du mode consruit 
        self.construit_teams: dict[str, dict] = {} 

    async def connect(self, websocket: WebSocket, match_id: str, mode: str):
        await websocket.accept()
        if match_id not in self.active_connections:
            self.active_connections[match_id] = []
        self.active_connections[match_id].append(websocket)
        self.player_presence.setdefault(match_id, {})

        # Dès que les 2 joueurs sont là, on peut enchainer sur le mode
        if len(self.active_connections[match_id]) == 2:
            if mode == "hasard":
                async with httpx.AsyncClient() as client:
                    reponse = await client.get("http://duel-service:8000/generate-random-teams")
                    donnees = reponse.json()
                    message_depart = {
                        "kind": "match_start", "mode": "hasard",
                        "message": "Les équipes aléatoires ont été générées ! Le match commence.",
                        "red_team_ids": donnees["red_team_ids"], "blue_team_ids": donnees["blue_team_ids"],
                        "red_active_index": donnees["red_active_index"], "blue_active_index": donnees["blue_active_index"]
                    }
                await self.broadcast_to_match(message_depart, match_id)
                
            elif mode == "draft":
                async with httpx.AsyncClient() as client:
                    reponse = await client.get("http://duel-service:8000/generate-random-teams")
                    donnees = reponse.json()
                    pool_ids = donnees["red_team_ids"] + donnees["blue_team_ids"]
                    
                    self.draft_states[match_id] = {
                        "pool": pool_ids, "red_team": [], "blue_team": [], "turn": "red"
                    }
                    await self.broadcast_draft_state(match_id)
            
    def disconnect(self, websocket: WebSocket, match_id: str):
        if match_id in self.active_connections:
            self.active_connections[match_id].remove(websocket)
            if not self.active_connections[match_id]:
                self.active_connections.pop(match_id, None)
                self.player_presence.pop(match_id, None)

    async def broadcast_to_match(self, message: dict, match_id: str):
        if match_id in self.active_connections:
            for connection in self.active_connections[match_id]:
                await connection.send_json(message)

    async def register_player(self, match_id: str, player: str, pseudo: str):
        self.player_presence.setdefault(match_id, {})
        self.player_presence[match_id][player] = {
            "player": player,
            "pseudo": pseudo,
        }
        for presence in self.player_presence[match_id].values():
            await self.broadcast_to_match(
                {
                    "kind": "opponent_info",
                    "player": presence["player"],
                    "pseudo": presence["pseudo"],
                },
                match_id,
            )

    async def broadcast_draft_state(self, match_id: str):
        state = self.draft_states[match_id]
        msg = {
            "kind": "draft_update",
            "pool": state["pool"], "red_team": state["red_team"], "blue_team": state["blue_team"],
            "turn": state["turn"], "message": f"Au tour du joueur {'Rouge' if state['turn'] == 'red' else 'Bleu'} de choisir !"
        }
        await self.broadcast_to_match(msg, match_id)

    # Gère quand un joueur clique sur un Pokémon pendant la draft
    async def draft_pick(self, match_id: str, player: str, pokemon_id: int):
        if match_id not in self.draft_states: return
        state = self.draft_states[match_id]
        
        if state["turn"] != player or pokemon_id not in state["pool"]: return
        
        state["pool"].remove(pokemon_id)
        if player == "red":
            state["red_team"].append(pokemon_id)
            state["turn"] = "blue"
        else:
            state["blue_team"].append(pokemon_id)
            state["turn"] = "red"
            
        if len(state["pool"]) == 0:
            msg = {
                "kind": "match_start", "mode": "draft",
                "message": "Draft terminée ! Que le combat commence !",
                "red_team_ids": state["red_team"], "blue_team_ids": state["blue_team"],
                "red_active_index": random.randint(0, 5), "blue_active_index": random.randint(0, 5)
            }
            await self.broadcast_to_match(msg, match_id)
            del self.draft_states[match_id] 
        else:
            await self.broadcast_draft_state(match_id)


    # Gère quand les joueurs rejoignent l'arène avec leurs équipes persos
    async def process_join_construit(self, match_id: str, player: str, team_ids: list[int]):
        if match_id not in self.construit_teams:
            self.construit_teams[match_id] = {}
        
        # On stocke l'équipe du joueur
        self.construit_teams[match_id][player] = team_ids

        # Si les deux joueurs ont envoyé leur équipe, on lance le match
        if "red" in self.construit_teams[match_id] and "blue" in self.construit_teams[match_id]:
            msg = {
                "kind": "match_start", 
                "mode": "construit",
                "message": "Les équipes personnalisées sont validées ! Le combat commence.",
                "red_team_ids": self.construit_teams[match_id]["red"],
                "blue_team_ids": self.construit_teams[match_id]["blue"],
                "red_active_index": 0, 
                "blue_active_index": 0
            }
            await self.broadcast_to_match(msg, match_id)
            del self.construit_teams[match_id]

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

            print(f" [BattleEngine] reçu choice {team} pour {key}", flush=True)

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
            data = await websocket.receive_json()
            if data.get("kind") == "hello":
                await ws_manager.register_player(
                    match_id,
                    data.get("player", "unknown"),
                    data.get("pseudo", "Joueur"),
                )
            if data.get("kind") == "forfeit":
                loser_color = data.get("player")
                winner_color = "blue" if loser_color == "red" else "red"
                
                await ws_manager.broadcast_to_match({
                    "kind": "forfeit_notice",
                    "loser": loser_color,
                    "winner": winner_color,
                    "message": f"Le joueur {loser_color} a déclaré forfait !"
                }, match_id)
            if data.get("kind") == "draft_pick":
                await ws_manager.draft_pick(match_id, data.get("player"), data.get("pokemon_id"))
            elif data.get("kind") == "join_construit":
                await ws_manager.process_join_construit(match_id, data.get("player"), data.get("team_ids"))
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
