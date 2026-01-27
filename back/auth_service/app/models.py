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
    pseudo = Column(String(100), nullable=False)
    team_color = Column(String(50), nullable=False)
    avatar_url = Column(String(255), nullable=True)
    aura = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now())

