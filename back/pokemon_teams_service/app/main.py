from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import random
import os
import json
from contextlib import asynccontextmanager
from aiokafka import AIOKafkaProducer

from sqlalchemy.orm import Session
from .database import engine, Base, get_db
from .models import PokemonTeam
from .schema import UpdateTeamModel


KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
producer: AIOKafkaProducer = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global producer
    try:
        producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS)
        await producer.start()
        print("[Team Service] Kafka Producer démarré avec succès !")
    except Exception as e:
        print(f"[Team Service] Erreur Kafka : {e}")
        producer = None
    yield
    if producer:
        await producer.stop()

app = FastAPI(title="Pokemon Service - Pokemon Teams", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#Transforme les format de la bdd en format pour le frontend
def new_format(db_team: PokemonTeam):
    # On récupère les 6 champs
    all_slots = [db_team.pokemon_1, db_team.pokemon_2, db_team.pokemon_3, db_team.pokemon_4, db_team.pokemon_5, db_team.pokemon_6]
    # On ne garde que ceux qui ne sont pas vides (None)
    pokemons_list = []
    for p in all_slots:
        if p != None: 
            pokemons_list.append(p)    
    return {
        "id": db_team.id,
        "nom": db_team.nom,
        "user_id": db_team.user_id,
        "pokemons": pokemons_list
    }

def update_team_slots(db_team: PokemonTeam, pokemons_list: list[int]):
    """Prend la liste d'Angular et remplit les 6 colonnes de la DB"""
    db_team.pokemon_1 = pokemons_list[0] if len(pokemons_list) > 0 else None
    db_team.pokemon_2 = pokemons_list[1] if len(pokemons_list) > 1 else None
    db_team.pokemon_3 = pokemons_list[2] if len(pokemons_list) > 2 else None
    db_team.pokemon_4 = pokemons_list[3] if len(pokemons_list) > 3 else None
    db_team.pokemon_5 = pokemons_list[4] if len(pokemons_list) > 4 else None
    db_team.pokemon_6 = pokemons_list[5] if len(pokemons_list) > 5 else None



@app.get("/pokemonteams/user/{user_id}")
def get_user_team(user_id: str, db: Session = Depends(get_db)):
    teams = db.query(PokemonTeam).filter(PokemonTeam.user_id == user_id).all()
    return [new_format(t) for t in teams]


@app.post("/pokemonteams")
async def create_team(nom: str, user_id: str, db: Session = Depends(get_db)):
    new_team = PokemonTeam(nom=nom, user_id=user_id)
    db.add(new_team)
    db.commit()
    db.refresh(new_team)
    
    if producer:
        await producer.send_and_wait("system.logs", json.dumps({
            "service": "TeamService",
            "message": f"Nouvelle équipe créée : '{nom}' (par User ID: {user_id})"
        }).encode("utf-8"))
        
    return new_format(new_team)


@app.delete("/pokemonteams/{equipe_id}")
async def delete_team(equipe_id: int, db: Session = Depends(get_db)):
    db_team = db.query(PokemonTeam).filter(PokemonTeam.id == equipe_id).first()
    if not db_team:
        raise HTTPException(status_code=404, detail="Equipe non trouvée")
    
    nom_equipe = db_team.nom # On sauvegarde le nom avant de supprimer pour le log
    
    db.delete(db_team)
    db.commit()
    
    if producer:
        await producer.send_and_wait("system.logs", json.dumps({
            "service": "TeamService",
            "message": f"L'équipe '{nom_equipe}' (ID {equipe_id}) a été supprimée"
        }).encode("utf-8"))
        
    return


@app.put("/pokemonteams/{equipe_id}")
async def add_to_team(equipe_id: int, data: UpdateTeamModel, db: Session = Depends(get_db)):
    db_team = db.query(PokemonTeam).filter(PokemonTeam.id == equipe_id).first()
    if not db_team:
        raise HTTPException(status_code=404, detail="Equipe non trouvée")
        
    if len(data.pokemons) > 6:
        raise HTTPException(status_code=400, detail="Une équipe ne peut avoir que 6 Pokémons max.")
    update_team_slots(db_team, data.pokemons)

    db.commit()
    db.refresh(db_team)
    
    if producer:
        await producer.send_and_wait("system.logs", json.dumps({
            "service": "TeamService",
            "message": f"L'équipe '{db_team.nom}' (ID {equipe_id}) a été modifiée"
        }).encode("utf-8"))
        
    return new_format(db_team)


@app.post("/pokemonteams/{equipe_id}/complete")
async def complete(equipe_id: int, db: Session = Depends(get_db)):
    db_team = db.query(PokemonTeam).filter(PokemonTeam.id == equipe_id).first()
    if not db_team:
        raise HTTPException(status_code=404, detail="Equipe non trouvée")
        
    current_pokemons = new_format(db_team)["pokemons"]
    places_libres = 6 - len(current_pokemons)
    
    if places_libres <= 0:
        return {"message": "L'équipe est déjà pleine !"}
        
    for i in range(places_libres):
        random_pokemon = random.randint(1, 1000)
        while random_pokemon in current_pokemons:
            random_pokemon = random.randint(1, 1000)
        current_pokemons.append(random_pokemon)
        
    update_team_slots(db_team, current_pokemons)
    db.commit()
    db.refresh(db_team)
    
    if producer:
        await producer.send_and_wait("system.logs", json.dumps({
            "service": "TeamService",
            "message": f"L'équipe '{db_team.nom}' (ID {equipe_id}) a été complétée automatiquement"
        }).encode("utf-8"))
    
    return new_format(db_team)