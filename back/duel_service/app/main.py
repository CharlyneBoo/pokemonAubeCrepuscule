from fastapi import FastAPI
from pydantic import BaseModel
from .logic import calculate_advantages
import random
app = FastAPI(title="Duel Logic Service")

class BattleRequest(BaseModel):
    red_pokemon: dict
    blue_pokemon: dict

class DuelService:
    def resolve_turn(self, red_pokemon: dict, blue_pokemon: dict):
        f_red, f_blue = calculate_advantages(red_pokemon, blue_pokemon)
        
        result = {
            "f_red": f_red,
            "f_blue": f_blue,
            "winner": None,
            "message": ""
        }

        if f_red > f_blue:
            result["winner"] = "red"
            result["message"] = f"{blue_pokemon.get('name')} est mis KO!"
        elif f_blue > f_red:
            result["winner"] = "blue"
            result["message"] = f"{red_pokemon.get('name')} est mis KO!"
        else:
            result["winner"] = "both"
            result["message"] = "Égalité ! Les deux Pokémon sont KO."
            
        return result


duel_logic = DuelService()

@app.post("/resolve")
async def resolve(request: BattleRequest):
    # Endpoint pour Battle Engine avec HTTP
    return duel_logic.resolve_turn(request.red_pokemon, request.blue_pokemon)

@app.get("/generate-random-teams")
def generate_random_teams():
    ids_tires = random.sample(range(1, 1000), 12)
    
    return {
        "red_team_ids": ids_tires[0:6],
        "blue_team_ids": ids_tires[6:12],
        "red_active_index": random.randint(0, 5),
        "blue_active_index": random.randint(0, 5)
    }