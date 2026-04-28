from sqlalchemy import CHAR, Column, DateTime, String, Integer, Text, TIMESTAMP, ForeignKey, func
from sqlalchemy.orm import relationship
import uuid
from .database import Base

class User(Base):
    __tablename__ = "users"
    
    # UUID stocké comme texte
    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    first_name = Column(String(100), nullable=False)
    pseudo = Column(String(100), nullable=False)
    team_color = Column(String(50), nullable=False)
    avatar_url = Column(String(255), nullable=True)
    aura = Column(Integer, nullable=False, default=500)
    created_at = Column(DateTime, server_default=func.now())
    pokemon_team = relationship("PokemonTeam", back_populates="owner")

class PokemonTeam(Base):
    __tablename__ = "pokemon_teams"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nom = Column(String(100), nullable=False)
    
    # Clé étrangère
    user_id = Column(CHAR(36), ForeignKey("users.id"), nullable=False)
    
    # Les 6 emplacements de Pokémon (Integer = ID du pokemon, nullable=True si vide)
    pokemon_1 = Column(Integer, nullable=True)
    pokemon_2 = Column(Integer, nullable=True)
    pokemon_3 = Column(Integer, nullable=True)
    pokemon_4 = Column(Integer, nullable=True)
    pokemon_5 = Column(Integer, nullable=True)
    pokemon_6 = Column(Integer, nullable=True) 
    owner = relationship("User", back_populates="pokemon_team")