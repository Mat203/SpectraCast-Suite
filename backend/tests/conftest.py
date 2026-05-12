import os
import sys
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

os.environ.setdefault("AWS_S3_BUCKET", "test-bucket")
os.environ.setdefault("AWS_REGION", "us-east-1")

from backend.src.api import db as db_module
from backend.src.api import db_models
from backend.src.api.db import Base, get_db
from backend.src.api.deps import get_current_user
from backend.src.api.db_models import User
from backend.src.api import main as main_module


class FakeStorage:
    def __init__(self):
        self.bucket = "test-bucket"
        self.objects: dict[str, bytes] = {}

    @staticmethod
    def join_key(prefix: str, filename: str) -> str:
        clean_prefix = prefix.strip("/")
        clean_filename = filename.lstrip("/")
        return f"{clean_prefix}/{clean_filename}" if clean_prefix else clean_filename

    def build_key(self, file_uuid: str, suffix: str = "raw", ext: str = "csv", prefix: str = "uploads") -> str:
        filename = f"{file_uuid}_{suffix}.{ext}"
        return self.join_key(prefix, filename)

    def save_upload(self, upload_file, key: str) -> None:
        upload_file.file.seek(0)
        self.objects[key] = upload_file.file.read()
        upload_file.file.close()

    def put_bytes(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
        self.objects[key] = data

    def put_text(self, key: str, text: str, content_type: str = "text/plain") -> None:
        self.put_bytes(key, text.encode("utf-8"), content_type=content_type)

    def read_bytes(self, key: str) -> bytes:
        return self.objects[key]

    def read_csv(self, key: str):
        import io
        import pandas as pd

        data = self.read_bytes(key)
        return pd.read_csv(io.BytesIO(data))

    def write_csv(self, key: str, df, include_index: bool = False) -> None:
        import io

        buffer = io.StringIO()
        df.to_csv(buffer, index=include_index)
        self.put_text(key, buffer.getvalue(), content_type="text/csv")

    def stream_object(self, key: str, chunk_size: int = 1024 * 1024):
        data = self.objects.get(key, b"")
        return iter([data])

    def exists(self, key: str) -> bool:
        return key in self.objects

    def delete(self, key: str) -> None:
        self.objects.pop(key, None)

    def delete_many(self, keys: list[str]) -> None:
        for key in keys:
            self.delete(key)


@pytest.fixture(scope="function")
def db_engine():
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(db_engine) -> Generator:
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=db_engine,
        expire_on_commit=False,
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_engine, db_session) -> Generator[TestClient, None, None]:
    db_module.engine = db_engine
    main_module.engine = db_engine

    def override_get_db():
        try:
            yield db_session
        finally:
            db_session.close()

    main_module.app.dependency_overrides[get_db] = override_get_db

    with TestClient(main_module.app) as test_client:
        yield test_client

    main_module.app.dependency_overrides.pop(get_db, None)


@pytest.fixture(scope="function")
def fake_storage() -> FakeStorage:
    return FakeStorage()


@pytest.fixture(scope="function")
def test_user(db_session) -> User:
    user = User(email="test@example.com", hashed_password="hashed")
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def auth_client(client, test_user, db_session):
    def override_get_current_user():
        return db_session.get(User, test_user.id)

    main_module.app.dependency_overrides[get_current_user] = override_get_current_user
    yield client
    main_module.app.dependency_overrides.pop(get_current_user, None)
