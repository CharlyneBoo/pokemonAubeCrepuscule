from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import jwt
import hashlib
import hmac
import os
import base64

SECRET_KEY = "SUPER_SECRET_KEY"
ALGORITHM = "HS256"
EXPIRE_MINUTES = 60

SECRET_KEY = b"SUPER_SECRET_KEY"  # utilisé pour le HMAC

def hash_password(password: str) -> str:
    # tronquer pour rester compatible si tu veux
    password = password[:72]
    # générer un hash HMAC-SHA256
    hashed = hmac.new(SECRET_KEY, password.encode("utf-8"), hashlib.sha256).digest()
    # retourner en base64 pour stocker facilement
    return base64.b64encode(hashed).decode("utf-8")

def verify_password(password: str, hashed: str) -> bool:
    password = password[:72]
    return hmac.compare_digest(hash_password(password), hashed)

def create_token(user_id: str):
    payload = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

