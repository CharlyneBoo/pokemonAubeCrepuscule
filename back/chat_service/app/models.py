from sqlalchemy import Column, DateTime, Integer, String, Text, func

from .database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    match_id = Column(String(100), index=True, nullable=False)
    channel = Column(String(20), nullable=False)
    author = Column(String(100), nullable=False)
    player = Column(String(20), nullable=True)
    visible_to_team = Column(String(20), nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
