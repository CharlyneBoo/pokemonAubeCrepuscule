from typing import Annotated, List
from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(max_length=72)]
    pseudo: str
    team_color: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: EmailStr
    pseudo: str
    team_color: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class UpdateTeamModel(BaseModel):
    pokemons: List[int]