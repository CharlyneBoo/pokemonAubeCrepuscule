import os
import json
import asyncio
from typing import List
from contextlib import asynccontextmanager
from fastapi.security import HTTPBearer
from fastapi import FastAPI, Depends, HTTPException, Header, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from aiokafka import AIOKafkaProducer

from .database import Base, SessionLocal, engine, get_db
from .models import User  # MatchHistory a été supprimé d'ici !
from .schema import UserCreate, UserLogin, UserOut, Token, UserUpdate
from .auth import hash_password, verify_password, create_token, decode_token

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

producer: AIOKafkaProducer = None
security = HTTPBearer()

@asynccontextmanager
async def lifespan(app: FastAPI):
    global producer
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Création du compte admin
        admin = db.query(User).filter(User.pseudo == "admin").first()
        if not admin:
            new_admin = User(
                name="Admin",             
                first_name="Admin",       
                pseudo="admin",
                email="admin@pokemon.com",
                hashed_password=hash_password("admin"),
                team_color="red",
                is_admin=True       
            )
            db.add(new_admin)
            # Création du compte test Team Red 
        test_red = db.query(User).filter(User.pseudo == "rouge").first()
        if not test_red:
            new_red = User(
                name="Rouge",             
                first_name="Joueur",       
                pseudo="rouge",
                email="red@pokemon.com",
                hashed_password=hash_password("test"),
                team_color="red",
                is_admin=False       
            )
            db.add(new_red)

        # Création du compte test Team Blue 
        test_blue = db.query(User).filter(User.pseudo == "bleu").first()
        if not test_blue:
            new_blue = User(
                name="Bleu",             
                first_name="Joueur",       
                pseudo="bleu",
                email="blue@pokemon.com",
                hashed_password=hash_password("test"), 
                team_color="blue",
                is_admin=False       
            )
            db.add(new_blue)
            db.commit()
    except Exception as e:
        print(f" Erreur Admin: {e}")
        db.rollback()
    finally:
        db.close()
    producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS)
    await producer.start()
        
    yield
    if producer:
        await producer.stop()


app = FastAPI(title="Auth Service", lifespan=lifespan,root_path="/api/auth")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def publish(topic: str, data: dict):
    if producer:
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