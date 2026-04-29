from sqlalchemy import Column, DateTime, String, Integer, JSON, func
from .database import Base

class MatchHistory(Base):
    __tablename__ = "match_history"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    match_uuid = Column(String(100), unique=True) 
    player_red_id = Column(String(36)) 
    player_blue_id = Column(String(36))
    winner_id = Column(String(36), nullable=True)
    game_mode = Column(String(50))
    match_logs = Column(JSON) 
    created_at = Column(DateTime, server_default=func.now())