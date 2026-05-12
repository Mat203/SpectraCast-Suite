from io import BytesIO


def test_upload_and_delete_file(auth_client, db_session, test_user, fake_storage, monkeypatch):
    from backend.src.api.routes import upload
    from backend.src.api.db_models import Dataset, DatasetFileMeta

    monkeypatch.setattr(upload, "storage", fake_storage)

    file_content = b"col\n1\n2\n"
    files = {"file": ("data.csv", BytesIO(file_content), "text/csv")}

    response = auth_client.post("/api/upload", files=files)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    file_id = body["file_id"]

    dataset = db_session.query(Dataset).filter(Dataset.file_uuid == file_id).first()
    meta = db_session.query(DatasetFileMeta).filter(DatasetFileMeta.file_uuid == file_id).first()

    assert dataset is not None
    assert meta is not None

    delete_response = auth_client.delete(f"/api/upload/{file_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["status"] == "deleted"
