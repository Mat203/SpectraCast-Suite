from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import uuid
from sqlalchemy.orm import Session

from backend.src.api.db import get_db
from backend.src.api.db_models import Dataset, DatasetFileMeta, User
from backend.src.api.deps import get_current_user
from backend.src.api.services.datasets import require_dataset_owner
from backend.src.api.services.storage import StorageService

router = APIRouter()

storage = StorageService()

@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    original_filename = file.filename or "uploaded.csv"

    if not original_filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    file_id = str(uuid.uuid4())
    safe_filename = storage.build_filename(file_id, suffix="raw", ext="csv")
    try:
        storage.save_upload(file, safe_filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")

    dataset = Dataset(user_id=current_user.id, file_uuid=file_id)
    dataset_meta = DatasetFileMeta(
        user_id=current_user.id,
        file_uuid=file_id,
        original_filename=original_filename,
    )
    db.add(dataset)
    db.add(dataset_meta)
    db.commit()

    return {"status": "success", "file_id": file_id, "original_filename": original_filename}


@router.delete("/{file_id}")
def delete_file(
    file_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_dataset_owner(db, current_user.id, file_id)

    upload_paths = [
        storage.base_dir / storage.build_filename(file_id, suffix="raw", ext="csv"),
        storage.base_dir / storage.build_filename(file_id, suffix="cleaned", ext="csv"),
    ]
    for path in upload_paths:
        if path.exists():
            path.unlink()

    outputs_dir = storage.base_dir.parent / "outputs"
    outputs_paths = [
        outputs_dir / f"raw_trends_{file_id}.csv",
        outputs_dir / f"correlations_{file_id}.csv",
    ]
    for path in outputs_paths:
        if path.exists():
            path.unlink()

    db.query(DatasetFileMeta).filter(
        DatasetFileMeta.user_id == current_user.id,
        DatasetFileMeta.file_uuid == file_id,
    ).delete(synchronize_session=False)
    db.query(Dataset).filter(
        Dataset.user_id == current_user.id,
        Dataset.file_uuid == file_id,
    ).delete(synchronize_session=False)
    db.commit()

    return {"status": "deleted", "file_id": file_id}