from typing import List
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from . import models, schema
from .database import Base, engine, get_db
app = FastAPI(title="Teams Service")

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)


# GET /teams → récupère toutes les équipes
@app.get("/teams", response_model=list[schema.TeamRead])
def get_teams(db: Session = Depends(get_db)):
    teams = db.query(models.Team).all()
    return teams

# POST /teams → créer une équipe
@app.post("/teams", response_model=schema.TeamRead)
def create_team(team: schema.TeamCreate, db: Session = Depends(get_db)):
    db_team = models.Team(name=team.name, user_id=team.user_id)
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team