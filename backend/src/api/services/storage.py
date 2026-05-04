from pathlib import Path
import shutil

from fastapi import UploadFile


class StorageService:
    def __init__(self, base_dir: Path | None = None):
        backend_dir = Path(__file__).resolve().parents[3]
        self.base_dir = base_dir or (backend_dir / "uploads")
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def build_filename(self, file_uuid: str, suffix: str = "raw", ext: str = "csv") -> str:
        return f"{file_uuid}_{suffix}.{ext}"

    def save_upload(self, upload_file: UploadFile, filename: str) -> Path:
        file_path = self.base_dir / filename
        try:
            with file_path.open("wb") as buffer:
                shutil.copyfileobj(upload_file.file, buffer)
        finally:
            upload_file.file.close()
        return file_path
