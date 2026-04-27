from typing import Annotated, List, Optional
from pydantic import BaseModel, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr
    password: Annotated[str, Field(max_length=72)]
    name: str
    first_name: str
    pseudo: str
    team_color: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    first_name: str
    pseudo: str
    team_color: str
    avatar_url: Optional[str] = None  
    aura: int
                
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class UpdateTeamModel(BaseModel):
    pokemons: List[int]

class UserUpdate(BaseModel):
    pseudo: Optional[str] = None
    team_color: Optional[str] = None
    avatar_url: Optional[str] = None