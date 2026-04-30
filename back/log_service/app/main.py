import os
import json
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.sql import func
from aiokafka import AIOKafkaConsumer

DB_USER = os.getenv("MYSQL_USER", "user")
DB_PASSWORD = os.getenv("MYSQL_PASSWORD", "password")
DB_HOST = os.getenv("MYSQL_HOST", "db")
DB_PORT = os.getenv("MYSQL_PORT", "3306")
DB_NAME = os.getenv("MYSQL_DATABASE", "fastapi_db") 

DATABASE_URL = f"mysql+mysqlconnector://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class SystemLog(Base):
    __tablename__ = "system_logs"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, server_default=func.now())
    service = Column(String(50))
    message = Column(Text)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")

async def consume_system_logs():
    consumer = AIOKafkaConsumer(
        "system.logs",
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id="log-service-group",
        auto_offset_reset="latest"
    )
    await consumer.start()
    print("[Log Service] Prêt et en écoute des logs système...")
    
    try:
        async for msg in consumer:
            payload = json.loads(msg.value.decode("utf-8"))
            db = SessionLocal()
            
            new_log = SystemLog(
                service=payload.get("service", "Inconnu"),
                message=payload.get("message", "")
            )
            db.add(new_log)
            db.commit()
            db.close()
            print(f"[Log Service] Log enregistré : {payload.get('service')}")
    except Exception as e:
        print(f"Erreur Log Consumer : {e}")
    finally:
        await consumer.stop()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global consumer
    
    consumer = AIOKafkaConsumer(
        "system.logs",
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id="log-service-group",
        auto_offset_reset="latest"
    )
    
    await consumer.start()
    
    asyncio.create_task(consume_system_logs())
    
    yield
    
    if consumer:
        await consumer.stop()


app = FastAPI(title="Log Service", lifespan=lifespan,root_path="/api/log")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*", 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/admin/logs")
def get_logs(db: Session = Depends(get_db)):
    # Renvoie les 50 derniers logs
    return db.query(SystemLog).order_by(SystemLog.timestamp.desc()).limit(100).all()