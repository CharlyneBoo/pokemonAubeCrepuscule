from sqlalchemy import CHAR, Column, DateTime, String, Integer, Text, TIMESTAMP, ForeignKey, func
from sqlalchemy.orm import relationship
import uuid
from .database import Base

class Team(Base):
    __tablename__ = "teams"

    id = Column(CHAR(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(CHAR(36), nullable=False)
    name = Column(Text, nullable=False)
    pokemon_1_id = Column(Integer)
    pokemon_2_id = Column(Integer)
    pokemon_3_id = Column(Integer)
    pokemon_4_id = Column(Integer)
    pokemon_5_id = Column(Integer)
    pokemon_6_id = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
