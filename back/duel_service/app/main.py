from fastapi import FastAPI
from pydantic import BaseModel
from .logic import calculate_advantages

app = FastAPI(title="Duel Logic Service")

# Modèle de données pour la requête
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