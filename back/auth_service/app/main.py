from typing import List
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from .database import Base, engine, get_db
from .models import User
from .schema import UserCreate, UserLogin, UserOut, Token
from .auth import hash_password, verify_password, create_token

app = FastAPI(title="Auth Service")

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)

@app.post("/register", response_model=UserOut)
def register(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    new_user = User(
        email=user.email,
        hashed_password=hash_password(user.password),
        pseudo=user.pseudo,
        team_color=user.team_color
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user.id)
    return {"access_token": token, "token_type": "bearer"}


@app.get("/users", response_model=List[UserOut])
def get_all_users(db: Session = Depends(get_db)):
    """
    Retourne tous les utilisateurs enregistrés.
    """
    users = db.query(User).all()
    return users