from fastapi import HTTPException
from sqlalchemy.orm import Session

from backend.src.api.db_models import Dataset


def require_dataset_owner(db: Session, user_id: int, file_id: str) -> Dataset:
    dataset = (
        db.query(Dataset)
        .filter(Dataset.user_id == user_id, Dataset.file_uuid == file_id)
        .first()
    )
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


def require_dataset_owner_for_filename(db: Session, user_id: int, filename: str) -> None:
    file_uuids = db.query(Dataset.file_uuid).filter(Dataset.user_id == user_id).all()
    for (file_uuid,) in file_uuids:
        if file_uuid in filename:
            return
    raise HTTPException(status_code=404, detail="File not found")
