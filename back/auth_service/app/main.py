import os
import json
import asyncio
from typing import List
from contextlib import asynccontextmanager
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer

from .database import Base, engine, get_db
from .models import User, MatchHistory
from .schema import UserCreate, UserLogin, UserOut, Token, UserUpdate
from .auth import hash_password, verify_password, create_token, decode_token

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

producer: AIOKafkaProducer = None
security = HTTPBearer()

async def consume_history_loop():
    consumer = AIOKafkaConsumer(
        "match.history", # On écoute le topic de l'historique
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id="history-saver",
        auto_offset_reset="latest"
    )
    await consumer.start()
    print("[Auth Service] En écoute de l'historique des matchs...")
    
    try:
        async for msg in consumer:
            data = json.loads(msg.value.decode("utf-8"))
            if data.get("kind") == "match_finished":
                db = next(get_db()) # On ouvre une session BDD
                
                # On sauvegarde en base de données
                new_history = MatchHistory(
                    match_uuid=data.get("match_uuid", "inconnu"),
                    player_red_id=data.get("player_red", "inconnu"),
                    player_blue_id=data.get("player_blue", "inconnu"),
                    winner_id=data.get("winner"),
                    game_mode=data.get("game_mode", "inconnu"),
                    match_logs=data.get("match_logs", [])
                )
                db.add(new_history)
                db.commit()
                print(f"[Auth Service] Historique sauvegardé : {data.get('match_uuid')}")
    except Exception as e:
        print(f"Erreur Consumer Historique : {e}")
    finally:
        await consumer.stop()

@asynccontextmanager
async def lifespan(app: FastAPI):
    global producer
    Base.metadata.create_all(bind=engine)
    producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS)
    await producer.start()
    
    # Lancement du consumer en fond au démarrage de l'API
    asyncio.create_task(consume_history_loop())
    
    yield
    await producer.stop()


app = FastAPI(title="Auth Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def publish(topic: str, data: dict):
    await producer.send_and_wait(topic, json.dumps(data).encode())

@app.post("/register", response_model=UserOut)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    new_user = User(
        email=user.email,
        hashed_password=hash_password(user.password),
        name=user.name,
        first_name=user.first_name,
        pseudo=user.pseudo,
        team_color=user.team_color
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    await publish("user.registered", {"user_id": new_user.id, "email": new_user.email})
    if producer:
        await producer.send_and_wait("system.logs", json.dumps({
            "service": "AuthService",
            "message": f"Nouvelle inscription : {new_user.pseudo} ({new_user.email})"
        }).encode("utf-8"))
    return new_user

@app.post("/login", response_model=Token)
async def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user.id)
    await publish("user.logged_in", {"user_id": user.id})
    if producer:
        await producer.send_and_wait("system.logs", json.dumps({
            "service": "AuthService",
            "message": f"Connexion réussie pour l'utilisateur : {data.email}"
        }).encode("utf-8"))
    return {"access_token": token, "token_type": "bearer"}

@app.get("/me", response_model=UserOut)
def get_me(authorization: str = Header(...), db: Session = Depends(get_db)):
    try:
        token = authorization.replace("Bearer ", "")
        user_id = decode_token(token)
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.get("/users", response_model=List[UserOut])
def get_all_users(db: Session = Depends(get_db)):
    return db.query(User).all()

@app.patch("/update_profile", response_model=UserOut)
async def update_profile(
    data: UserUpdate, 
    authorization: str = Header(...), 
    db: Session = Depends(get_db)
):
    try:
        token = authorization.replace("Bearer ", "")
        user_id = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = data.dict(exclude_unset=True) 
    
    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)

    await publish("user.updated", {"user_id": user.id, "updates": update_data})

    return user

class MatchResult(BaseModel):
    result: str 

@app.patch("/users/me/aura")
async def update_aura(
    data: MatchResult, 
    authorization: str = Header(...), 
    db: Session = Depends(get_db)
):
    try:
        token = authorization.replace("Bearer ", "")
        user_id = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.result == "win":
        current_user.aura += 10
    elif data.result == "loss":
        current_user.aura = max(0, current_user.aura - 10)
        
    db.commit()
    db.refresh(current_user)
    
    await publish("user.aura_updated", {"user_id": current_user.id, "new_aura": current_user.aura})
    
    return {"message": "Aura mise à jour", "nouvelle_aura": current_user.aura}

@app.get("/users/me/history")
def get_my_match_history(authorization: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    try:
        token = authorization.credentials
        user_id = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    history = db.query(MatchHistory).filter(
        (MatchHistory.player_red_id == user.pseudo) | 
        (MatchHistory.player_blue_id == user.pseudo)
    ).order_by(MatchHistory.created_at.desc()).all()
    
    return history