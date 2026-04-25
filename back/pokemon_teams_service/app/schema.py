from typing import List
from pydantic import BaseModel

class UpdateTeamModel(BaseModel):
    pokemons: List[int]