from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.src.api.db import get_db
from backend.src.api.db_models import Dataset, User
from backend.src.api.deps import get_current_user

router = APIRouter()


class UserProfileResponse(BaseModel):
    email: str
    datasets: List[str]


@router.get("/me", response_model=UserProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dataset_rows = (
        db.query(Dataset.file_uuid)
        .filter(Dataset.user_id == current_user.id)
        .order_by(Dataset.id.desc())
        .all()
    )
    datasets = [row[0] for row in dataset_rows]
    return UserProfileResponse(email=current_user.email, datasets=datasets)
