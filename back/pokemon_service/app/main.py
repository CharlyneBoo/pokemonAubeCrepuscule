from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx
import asyncio
from typing import List, Optional
from app.models import PokemonInfo

app = FastAPI(title="Pokemon Service - Pokedex",root_path="/api/pokemon")

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
            
    #  RECHERCHE DE L'HABITAT 
    habitat_name = "Inconnu"
    if "habitat" in species_data and species_data["habitat"] is not None:
        habitat_name = species_data["habitat"]["name"]

    # EXTRACTION DES STATS 
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

    #  RECHERCHE DU NOM EN FRANÇAIS 
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
    
    # Recherche par ID exacte
    if pokemon_id != None:
        try:
            pokemon = await fetch_pokemon_data(str(pokemon_id))
            return [pokemon] 
        except HTTPException:
            return []
        
    # CAS 1 : L'utilisateur n'a absolument rien tapé
    if nom == None and type1 == None and type2 == None:
        waiting = []
        for i in range(offset + 1, offset + limit + 1):
            waiting.append(fetch_pokemon_data(str(i)))
        resultats = await asyncio.gather(*waiting, return_exceptions=True)
        liste_finale = [r for r in resultats if type(r) is dict]
        return liste_finale

    # CAS 2 : Recherche avec filtres (Types ou Noms)
    mon_client = httpx.AsyncClient()
    pokemons_trouves = []

    # Fonction locale pour récupérer une liste de Pokémon par type (en anglais direct)
    async def get_by_type(t: str):
        type_anglais = t.lower()
        reponse = await mon_client.get(f"{BASE_URL}/type/{type_anglais}")
        res = []
        if reponse.status_code == 200:
            for p in reponse.json()["pokemon"]:
                id_pkmn = int(p["pokemon"]["url"].split("/")[-2])
                res.append({"id": id_pkmn, "name": p["pokemon"]["name"]})
        return res

    # GESTION DES TYPES AVEC INTERSECTION (ET)
    if type1 != None or type2 != None:
        list_t1 = []
        list_t2 = []

        # On lance les requêtes en parallèle si on a deux types
        taches = []
        if type1: taches.append(get_by_type(type1))
        if type2: taches.append(get_by_type(type2))

        resultats_types = await asyncio.gather(*taches)

        if type1 and type2:
            list_t1 = resultats_types[0]
            list_t2 = resultats_types[1]
            # INTERSECTION : On garde uniquement les IDs qui sont dans la liste 1 ET dans la liste 2
            ids_t2 = {p["id"] for p in list_t2}
            pokemons_trouves = [p for p in list_t1 if p["id"] in ids_t2]
        else:
            # Un seul type a été renseigné
            pokemons_trouves = resultats_types[0]

    else:
        # Aucun type renseigné, on récupère le grand annuaire pour ensuite filtrer par nom
        reponse = await mon_client.get(f"{BASE_URL}/pokemon?limit=1500")
        if reponse.status_code == 200:
            for p in reponse.json()["results"]:
                id_pkmn = int(p["url"].split("/")[-2])
                pokemons_trouves.append({"id": id_pkmn, "name": p["name"]})

    await mon_client.aclose()

    # FILTRE PAR NOM
    if nom != None:
        mot = nom.lower()
        pokemons_trouves = [p for p in pokemons_trouves if mot in p["name"]]

    # Tri par ID pour garder l'ordre officiel
    pokemons_trouves.sort(key=lambda x: x["id"])
    
    # PAGINATION : On coupe la liste pour ne charger que ce qu'on demande
    pokemons_a_chercher = pokemons_trouves[offset : offset + limit]
    
    waiting = [fetch_pokemon_data(p["name"]) for p in pokemons_a_chercher]
    resultats = await asyncio.gather(*waiting, return_exceptions=True)
    
    liste_finale = [r for r in resultats if type(r) is dict]
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