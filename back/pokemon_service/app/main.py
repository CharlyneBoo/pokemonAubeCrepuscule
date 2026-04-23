from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
import asyncio
from typing import List, Optional
from app.models import PokemonInfo

app = FastAPI(title="Pokemon Service - Pokedex")

# Indispensable pour éviter l'erreur CORS quand Angular appelle FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache pour ne pas refaire appel à l'api
pokemon_cache = {}
BASE_URL = "https://pokeapi.co/api/v2"


# Fonction principale pour récupérer un seul Pokémon
async def fetch_pokemon_data(pokemon_id: str) -> dict:
    pokemon_id = str(pokemon_id).lower()
    
    #On vérifie notre dictionnaire cache
    if pokemon_id in pokemon_cache:
        return pokemon_cache[pokemon_id]

    async with httpx.AsyncClient() as client:
        #On fait les requêtes a l'api
        reponse_pokemon = await client.get(f"{BASE_URL}/pokemon/{pokemon_id}")
        
        if reponse_pokemon.status_code == 404:
            raise HTTPException(status_code=404, detail="Pokémon introuvable")
        #Important pour avoir l'habitant
        reponse_espece = await client.get(f"{BASE_URL}/pokemon-species/{pokemon_id}")

    #On extrait les données en JSON
    poke_data = reponse_pokemon.json()
    
    # Parfois l'espèce n'existe pas, on met un dico vide pour éviter que ça plante
    if reponse_espece:
        species_data = reponse_espece.json()
    else:
        species_data = {}

    # RECHERCHE DE LA DESCRIPTION EN FRANÇAIS
    description = "Description non disponible."
    if "flavor_text_entries" in species_data:
        for entry in species_data["flavor_text_entries"]:
            if entry["language"]["name"] == "fr":
                description = entry["flavor_text"].replace("\n", " ").replace("\f", " ")
                break
            
    # --- RECHERCHE DE L'HABITAT ---
    habitat_name = "Inconnu"
    if "habitat" in species_data and species_data["habitat"] is not None:
        habitat_name = species_data["habitat"]["name"]

    # --- EXTRACTION DES STATS (Boucle classique) ---
    stats_finales = {"hp": 0, "attack": 0, "defense": 0, "sp_atk": 0, "sp_def": 0, "speed": 0}
    if "stats" in poke_data:
        for s in poke_data["stats"]:
            nom_stat = s["stat"]["name"]
            valeur = s["base_stat"]
            
            if nom_stat == "hp": stats_finales["hp"] = valeur
            elif nom_stat == "attack": stats_finales["attack"] = valeur
            elif nom_stat == "defense": stats_finales["defense"] = valeur
            elif nom_stat == "special-attack": stats_finales["sp_atk"] = valeur
            elif nom_stat == "special-defense": stats_finales["sp_def"] = valeur
            elif nom_stat == "speed": stats_finales["speed"] = valeur

    # --- RECHERCHE DU NOM EN FRANÇAIS ---
    fr_name = poke_data["name"]
    if "names" in species_data:
        for n in species_data["names"]:
            if n["language"]["name"] == "fr":
                fr_name = n["name"]
                break

    # On construit l'objet final
    result = {
        "id": poke_data["id"],
        "nom": fr_name,
        "types": [t["type"]["name"] for t in poke_data["types"]],
        "taille": poke_data["height"],
        "poids": poke_data["weight"],
        "description": description,
        "habitat": habitat_name,
        "image": poke_data["sprites"]["other"]["official-artwork"]["front_default"],
        "stats": stats_finales
    }

    # On sauvegarde dans notre dictionnaire pour la prochaine fois
    pokemon_cache[pokemon_id] = result
    return result


@app.get("/dex/search", response_model=List[PokemonInfo])
async def search_pokemon( nom: str = None, pokemon_id: int = None, type1: str = None, type2: str = None,  offset: int = 0, limit: int = 100):
    
    if pokemon_id != None:
        try:
            pokemon = await fetch_pokemon_data(str(pokemon_id))
            return [pokemon] 
        except HTTPException:
            return []
        
    # CAS 1 : L'utilisateur n'a rien tapé
    if nom == None and type1 == None and type2 == None:
        waiting = []
        for i in range(offset + 1, offset + limit + 1):
            waiting.append(fetch_pokemon_data(str(i)))
        resultats = await asyncio.gather(*waiting, return_exceptions=True)
        liste_finale = []
        for r in resultats:
            if type(r) is dict: 
                liste_finale.append(r)
        return liste_finale

   # CAS 2 : Recherche avec filtres
    mon_client = httpx.AsyncClient()
    pokemons_trouves = []
    
    if type1 != None:
        reponse = await mon_client.get(f"{BASE_URL}/type/{type1.lower()}")
        if reponse.status_code == 200:
            data = reponse.json()
            for p in data["pokemon"]:
                url = p["pokemon"]["url"]
                morceaux = url.split("/")
                id_du_pokemon = int(morceaux[-2])
                pokemons_trouves.append({"id": id_du_pokemon, "name": p["pokemon"]["name"]})

    # Si y'a pas de type, on est obligé de tout télécharger
    if type1 == None and type2 == None:
        reponse = await mon_client.get(f"{BASE_URL}/pokemon?limit=1500")
        data = reponse.json()
        for p in data["results"]:
            url = p["url"]
            morceaux = url.split("/")
            id_du_pokemon = int(morceaux[-2])
            pokemons_trouves.append({"id": id_du_pokemon, "name": p["name"]})

    await mon_client.aclose()

    # Si le mec a tapé un nom
    if nom != None:
        liste_tempo = []
        mot = nom.lower()
        for p in pokemons_trouves:
            if mot in p["name"]:
                liste_tempo.append(p)
        pokemons_trouves = liste_tempo

    def tri_par_id(pokemon):
        return pokemon["id"]
        
    pokemons_trouves.sort(key=tri_par_id)
    
    # On coupe la liste pour la pagination
    pokemons_a_chercher = pokemons_trouves[offset : offset + limit]
    
    waiting = []
    for p in pokemons_a_chercher:
        waiting.append(fetch_pokemon_data(p["name"]))
        
    resultats = await asyncio.gather(*waiting, return_exceptions=True)
    
    liste_finale = []
    for r in resultats:
        if type(r) is dict:
            liste_finale.append(r)
            
    return liste_finale

@app.get("/dex/{id}", response_model=PokemonInfo)
async def get_pokemon_details(id: str):
    data = await fetch_pokemon_data(id)
    return PokemonInfo(
    id=data["id"],
    nom=data["nom"],
    types=data["types"],
    taille=data["taille"],
    poids=data["poids"],
    description=data["description"],
    habitat=data["habitat"],
    image=data["image"],
    stats=data["stats"]
)