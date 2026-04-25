from sqlalchemy import Column, Integer, String, CHAR
from .database import Base

class PokemonTeam(Base):
    __tablename__ = "pokemon_teams"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nom = Column(String(100), nullable=False)
    
    user_id = Column(CHAR(36), index=True, nullable=False)
    
    pokemon_1 = Column(Integer, nullable=True)
    pokemon_2 = Column(Integer, nullable=True)
    pokemon_3 = Column(Integer, nullable=True)
    pokemon_4 = Column(Integer, nullable=True)
    pokemon_5 = Column(Integer, nullable=True)
    pokemon_6 = Column(Integer, nullable=True)