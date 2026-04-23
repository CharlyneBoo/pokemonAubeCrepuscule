from pydantic import BaseModel
from typing import List

class PokemonStats(BaseModel):
    hp: int
    attack: int
    defense: int
    sp_atk: int
    sp_def: int
    speed: int

class PokemonInfo(BaseModel):
    id: int
    nom: str
    types: List[str]
    taille: int
    poids: int
    description: str
    habitat: str
    image: str
    stats: PokemonStats