from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.src.api.db import get_db
from backend.src.api.db_models import Dataset, DatasetFileMeta, User, UserOnboardingState
from backend.src.api.deps import get_current_user

router = APIRouter()


class DatasetInfo(BaseModel):
    file_id: str
    original_filename: Optional[str] = None


class UserProfileResponse(BaseModel):
    email: str
    datasets: List[DatasetInfo]
    is_onboarded: bool = False


class OnboardResponse(BaseModel):
    status: str
    message: str
    is_onboarded: bool


@router.get("/me", response_model=UserProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dataset_rows = (
        db.query(Dataset.file_uuid, DatasetFileMeta.original_filename)
        .outerjoin(DatasetFileMeta, Dataset.file_uuid == DatasetFileMeta.file_uuid)
        .filter(Dataset.user_id == current_user.id)
        .order_by(Dataset.id.desc())
        .all()
    )
    datasets = [
        DatasetInfo(file_id=row[0], original_filename=row[1])
        for row in dataset_rows
    ]
    onboarding_state = (
        db.query(UserOnboardingState)
        .filter(UserOnboardingState.user_id == current_user.id)
        .first()
    )

    return UserProfileResponse(
        email=current_user.email,
        datasets=datasets,
        is_onboarded=bool(onboarding_state and onboarding_state.is_onboarded),
    )


@router.patch("/me/onboard", response_model=OnboardResponse)
def set_onboarded(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    onboarding_state = (
        db.query(UserOnboardingState)
        .filter(UserOnboardingState.user_id == current_user.id)
        .first()
    )

    if onboarding_state is None:
        onboarding_state = UserOnboardingState(user_id=current_user.id, is_onboarded=True)
        db.add(onboarding_state)
    else:
        onboarding_state.is_onboarded = True

    db.commit()

    return OnboardResponse(
        status="success",
        message="Onboarding completed",
        is_onboarded=False,
    )
