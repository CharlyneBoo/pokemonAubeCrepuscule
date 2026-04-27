from typing import List
from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from contextlib import asynccontextmanager
from aiokafka import AIOKafkaProducer
from .database import Base, engine, get_db
from .models import User
from .schema import UserCreate, UserLogin, UserOut, Token, UserUpdate
from .auth import hash_password, verify_password, create_token, decode_token
import json
import os

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

producer: AIOKafkaProducer = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global producer
    Base.metadata.create_all(bind=engine)
    producer = AIOKafkaProducer(bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS)
    await producer.start()
    yield
    await producer.stop()

app = FastAPI(title="Auth Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # à restreindre en prod
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
    return new_user

@app.post("/login", response_model=Token)
async def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user.id)
    await publish("user.logged_in", {"user_id": user.id})
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

    update_data = data.dict(exclude_unset=True) # Ne prend que les champs envoyés dans le JSON
    
    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)

    await publish("user.updated", {"user_id": user.id, "updates": update_data})

    return user