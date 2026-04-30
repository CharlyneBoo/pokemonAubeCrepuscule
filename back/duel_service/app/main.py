import os
import json
import asyncio
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from contextlib import asynccontextmanager
from aiokafka import AIOKafkaConsumer
from sqlalchemy.orm import Session
import random

from .database import Base, engine, get_db, SessionLocal
from .models import MatchHistory
from .logic import calculate_advantages

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

# Boucle de fond écoutant Kafka
async def consume_history_loop():
    consumer = AIOKafkaConsumer(
        "match.history",
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id="duel-history-saver",
        auto_offset_reset="latest"
    )
    await consumer.start()
    
    try:
        async for msg in consumer:
            data = json.loads(msg.value.decode("utf-8"))
            if data.get("kind") == "match_finished":
                db = SessionLocal()
                try:
                    new_history = MatchHistory(
                        match_uuid=data.get("match_uuid", "inconnu"),
                        player_red_id=data.get("player_red", "inconnu"),
                        player_blue_id=data.get("player_blue", "inconnu"),
                        winner_id=data.get("winner"),
                        game_mode=data.get("game_mode", "inconnu"),
                        match_logs=data.get("match_logs", [])
                    )
                    db.add(new_history)
                    db.commit()
                finally:
                    db.close()
    except Exception as e:
        print(f"Erreur Consumer Historique (Duel Service) : {e}")
    finally:
        await consumer.stop()

# Gestionnaire du cycle de vie de l'API 
# Au démarrage, il crée la table SQL de l'historique et lance Kafka.
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Création de la table historique si elle n'existe pas
    Base.metadata.create_all(bind=engine)
    # Lancement du consumer Kafka
    asyncio.create_task(consume_history_loop())
    yield

app = FastAPI(title="Duel Logic Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",  
    allow_methods=["*"],
    allow_headers=["*"],
)

class BattleRequest(BaseModel):
    turn: int = 0
    red_player: str = "Joueur Rouge" 
    blue_player: str = "Joueur Bleu" 
    red_action: str = "inconnue"
    blue_action: str = "inconnue"
    red_pokemon: dict
    blue_pokemon: dict

class DuelService:
   def resolve_turn(self, turn: int, red_player: str, blue_player: str, red_action: str, blue_action: str, red_pokemon: dict, blue_pokemon: dict):
        f_red, f_blue = calculate_advantages(red_pokemon, blue_pokemon)
        red_name = red_pokemon.get('name', 'Pokémon Rouge')
        blue_name = blue_pokemon.get('name', 'Pokémon Bleu')
        
        result = {"f_red": f_red, "f_blue": f_blue, "winner": None, "message": ""}

        message = f" --- DÉBUT DU TOUR {turn} ---\n"
        message += f"🔴 {red_player} a fait : {red_action.upper()}\n"
        message += f"🔵 {blue_player} a fait : {blue_action.upper()}\n"
        message += f"⚔️ {red_name} (Points {f_red}) VS {blue_name} (Points {f_blue})\n"

        if f_red > f_blue:
            result["winner"] = "red"
            message += f"🏆 {red_name} l'emporte ! {blue_name} est mis KO !"
        elif f_blue > f_red:
            result["winner"] = "blue"
            message += f"🏆 {blue_name} l'emporte ! {red_name} est mis KO !"
        else:
            result["winner"] = "both"
            message += "🤝 Égalité ! Les deux Pokémon sont ko."
            
        result["message"] = message
        return result

duel_logic = DuelService()

@app.post("/resolve")
async def resolve(request: BattleRequest):
    return duel_logic.resolve_turn(
        request.turn, request.red_player, request.blue_player,   
        request.red_action, request.blue_action, 
        request.red_pokemon, request.blue_pokemon
    )

@app.get("/generate-random-teams")
def generate_random_teams():
    ids_tires = random.sample(range(1, 1025), 12)
    return {
        "red_team_ids": ids_tires[0:6], "blue_team_ids": ids_tires[6:12],
        "red_active_index": random.randint(0, 5), "blue_active_index": random.randint(0, 5)
    }


@app.get("/history/{pseudo}")
def get_history(pseudo: str, db: Session = Depends(get_db)):
    history = db.query(MatchHistory).filter(
        (MatchHistory.player_red_id == pseudo) | 
        (MatchHistory.player_blue_id == pseudo)
    ).order_by(MatchHistory.created_at.desc()).all()
    return history