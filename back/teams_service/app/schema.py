from pydantic import BaseModel
from typing import Optional

class TeamCreate(BaseModel):
    name: str
    user_id: str  # UUID de l'utilisateur

class TeamRead(BaseModel):
    id: str
    name: str
    user_id: str

class Config:
    from_attributes = True
