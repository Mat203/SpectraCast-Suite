from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.src.api.db import get_db
from backend.src.api.db_models import User
from backend.src.api.models.auth import LoginRequest, RegisterRequest, TokenResponse
from backend.src.api.security import create_access_token, hash_password, verify_password

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    normalized_email = request.email.strip().lower()
    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(email=normalized_email, hashed_password=hash_password(request.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, token_type="bearer")


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    normalized_email = request.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, token_type="bearer")
