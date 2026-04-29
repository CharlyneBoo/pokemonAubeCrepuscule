from fastapi import FastAPI
from pydantic import BaseModel
from .logic import calculate_advantages
import random
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="Duel Logic Service")

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
        
        result = {
            "f_red": f_red,
            "f_blue": f_blue,
            "winner": None,
            "message": ""
        }

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
        request.turn, 
        request.red_player,     
        request.blue_player,   
        request.red_action, 
        request.blue_action, 
        request.red_pokemon, 
        request.blue_pokemon
    )

@app.get("/generate-random-teams")
def generate_random_teams():
    ids_tires = random.sample(range(1, 1000), 12)
    
    return {
        "red_team_ids": ids_tires[0:6],
        "blue_team_ids": ids_tires[6:12],
        "red_active_index": random.randint(0, 5),
        "blue_active_index": random.randint(0, 5)
    }