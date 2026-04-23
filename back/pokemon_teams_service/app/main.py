from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import random


app = FastAPI(title="Pokemon Service - Pokemon Teams")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pokemon_teams = [
    {"id": 1, "nom": "Team 1", "pokemons": [4, 7, 8, 9, 255, 257]},
    {"id": 2, "nom": "Team 2", "pokemons": [4, 4, 32, 9, 256, 257]},
    {"id": 3, "nom": "Team 3", "pokemons": [4, 7, 8, 9, 257]}
]
next_id = 4


# --- LES ROUTES (L'API) ---

@app.get("/pokemonteams")
def get_toutes_les_equipes():
    return pokemon_teams


@app.post("/pokemonteams")
def creer_equipe(nom: str):
    global next_id 
    new_team = {
        "id": next_id,
        "nom": nom,
        "pokemons": [] # L'équipe est vide au début
    }
    pokemon_teams.append(new_team)
    next_id += 1
    return new_team


@app.delete("/pokemonteams/{equipe_id}")
def supprimer_equipe(equipe_id: int):
    global pokemon_teams
    empty = []
    for eq in pokemon_teams:
        if eq["id"] != equipe_id:
            empty.append(eq)
    pokemon_teams = empty
    return {"message": "Équipe supprimée"}


class UpdateTeamModel(BaseModel):
    pokemons: List[int]

@app.put("/pokemonteams/{equipe_id}")
def modifier_equipe(equipe_id: int, data: UpdateTeamModel):
    for eq in pokemon_teams:
        if eq["id"] == equipe_id:
            eq["pokemons"] = data.pokemons
            return eq
    raise HTTPException(status_code=404, detail="Equipe non trouvée")


@app.post("/pokemonteams/{equipe_id}/complete")
def completer_equipe_avec_ia(equipe_id: int):

    for eq in pokemon_teams:
        if eq["id"] == equipe_id:
            places_libres = 6 - len(eq["pokemons"])
            
            if places_libres <= 0:
                return {"message": "L'équipe est déjà pleine !"}
                
            for i in range(places_libres):
                random_pokemon = random.randint(1, 1000)
                while random_pokemon in eq["pokemons"]:
                    random_pokemon = random.randint(1, 1000)                
                eq["pokemons"].append(random_pokemon)
                
            return eq
            
    raise HTTPException(status_code=404, detail="Equipe non trouvée")