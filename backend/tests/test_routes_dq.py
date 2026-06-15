def test_dq_scan_returns_report(auth_client, db_session, test_user, fake_storage):
    from backend.src.api.routes import dq
    from backend.src.api.db_models import Dataset

    file_id = "file-123"
    dataset = Dataset(user_id=test_user.id, file_uuid=file_id, is_modified=False)
    db_session.add(dataset)
    db_session.commit()

    key = fake_storage.build_key(file_id, suffix="raw", ext="csv", prefix="uploads")
    fake_storage.put_text(key, "date,price\n2024-01-01,100\n2024-01-02,101\n")

    response = auth_client.post("/api/dq/scan", json={"file_id": file_id})

    assert response.status_code == 200
    payload = response.json()
    assert payload["rows"] == 2
    assert payload["columns"] == ["date", "price"]
    assert payload["is_modified"] is False


def test_dq_clean_writes_output(auth_client, db_session, test_user, fake_storage):
    from backend.src.api.routes import dq
    from backend.src.api.db_models import Dataset

    file_id = "file-clean"
    dataset = Dataset(user_id=test_user.id, file_uuid=file_id, is_modified=False)
    db_session.add(dataset)
    db_session.commit()

    key = fake_storage.build_key(file_id, suffix="raw", ext="csv", prefix="uploads")
    fake_storage.put_text(key, "date,price\n2024-01-01,100\n2024-01-02,\n")

    payload = {
        "file_id": file_id,
        "align_index": False,
        "imputation_methods": {"price": "1"},
        "outlier_methods": {},
    }

    response = auth_client.post("/api/dq/clean", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    assert fake_storage.exists(body["saved_path"])


def test_dq_handle_outliers_updates_dataset(auth_client, db_session, test_user, fake_storage):
    from backend.src.api.routes import dq
    from backend.src.api.db_models import Dataset

    file_id = "file-outliers"
    dataset = Dataset(user_id=test_user.id, file_uuid=file_id, is_modified=False)
    db_session.add(dataset)
    db_session.commit()

    key = fake_storage.build_key(file_id, suffix="raw", ext="csv", prefix="uploads")
    fake_storage.put_text(key, "value\n1\n2\n1000\n3\n")

    response = auth_client.post(
        "/api/dq/handle-outliers",
        json={"file_id": file_id, "column": "value", "strategy": "median"},
    )

    assert response.status_code == 200
    updated_df = fake_storage.read_csv(key)
    assert updated_df["value"].max() < 1000


def test_dq_preview_outliers_returns_series(auth_client, db_session, test_user, fake_storage):
    from backend.src.api.routes import dq
    from backend.src.api.db_models import Dataset

    file_id = "file-preview"
    dataset = Dataset(user_id=test_user.id, file_uuid=file_id, is_modified=False)
    db_session.add(dataset)
    db_session.commit()

    key = fake_storage.build_key(file_id, suffix="raw", ext="csv", prefix="uploads")
    fake_storage.put_text(key, "value\n1\n2\n1000\n3\n")

    response = auth_client.post(
        "/api/dq/preview-outliers",
        json={"file_id": file_id, "column": "value", "strategy": "clip_iqr"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["column"] == "value"
    assert len(payload["before"]) == len(payload["after"])


def test_dq_handle_missing_updates_dataset(auth_client, db_session, test_user, fake_storage):
    from backend.src.api.routes import dq
    from backend.src.api.db_models import Dataset

    file_id = "file-missing"
    dataset = Dataset(user_id=test_user.id, file_uuid=file_id, is_modified=False)
    db_session.add(dataset)
    db_session.commit()

    key = fake_storage.build_key(file_id, suffix="raw", ext="csv", prefix="uploads")
    fake_storage.put_text(key, "value\n1\n\n3\n")

    response = auth_client.post(
        "/api/dq/handle-missing",
        json={"file_id": file_id, "column": "value", "strategy": "3"},
    )

    assert response.status_code == 200
    updated_df = fake_storage.read_csv(key)
    assert updated_df["value"].isna().sum() == 0


def test_dq_preview_missing_returns_series(auth_client, db_session, test_user, fake_storage):
    from backend.src.api.routes import dq
    from backend.src.api.db_models import Dataset

    file_id = "file-missing-preview"
    dataset = Dataset(user_id=test_user.id, file_uuid=file_id, is_modified=False)
    db_session.add(dataset)
    db_session.commit()

    key = fake_storage.build_key(file_id, suffix="raw", ext="csv", prefix="uploads")
    fake_storage.put_text(key, "value\n1\n\n3\n")

    response = auth_client.post(
        "/api/dq/preview-missing",
        json={"file_id": file_id, "column": "value", "strategy": "3"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["column"] == "value"
    assert len(payload["before"]) == len(payload["after"])


def test_dq_fix_timestamps_inserts_rows(auth_client, db_session, test_user, fake_storage):
    from backend.src.api.routes import dq
    from backend.src.api.db_models import Dataset

    file_id = "file-fix"
    dataset = Dataset(user_id=test_user.id, file_uuid=file_id, is_modified=False)
    db_session.add(dataset)
    db_session.commit()

    key = fake_storage.build_key(file_id, suffix="raw", ext="csv", prefix="uploads")
    fake_storage.put_text(key, "date,value\n2024-01-01,1\n2024-01-02,2\n2024-01-04,4\n")

    response = auth_client.post("/api/dq/fix-timestamps", json={"file_id": file_id})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["inserted_rows"] == 1


def test_dq_undo_restores_previous(auth_client, db_session, test_user, fake_storage):
    from backend.src.api.routes import dq
    from backend.src.api.db_models import Dataset

    file_id = "file-undo"
    dataset = Dataset(user_id=test_user.id, file_uuid=file_id, is_modified=False)
    db_session.add(dataset)
    db_session.commit()

    previous_key = fake_storage.build_key(file_id, suffix="previous", ext="csv", prefix="uploads")
    fake_storage.put_text(previous_key, "value\n10\n")

    response = auth_client.post("/api/dq/undo", json={"file_id": file_id})

    assert response.status_code == 200
    raw_key = fake_storage.build_key(file_id, suffix="raw", ext="csv", prefix="uploads")
    assert fake_storage.exists(raw_key)
    assert not fake_storage.exists(previous_key)


def test_dq_save_modified_marks_dataset(auth_client, db_session, test_user, fake_storage):
    from backend.src.api.routes import dq
    from backend.src.api.db_models import Dataset

    file_id = "file-save"
    dataset = Dataset(user_id=test_user.id, file_uuid=file_id, is_modified=False)
    db_session.add(dataset)
    db_session.commit()

    previous_key = fake_storage.build_key(file_id, suffix="previous", ext="csv", prefix="uploads")
    fake_storage.put_text(previous_key, "value\n10\n")

    response = auth_client.post("/api/dq/save-modified", json={"file_id": file_id})

    assert response.status_code == 200
    updated = db_session.query(Dataset).filter(Dataset.file_uuid == file_id).first()
    assert updated is not None
    assert updated.is_modified is True
    assert not fake_storage.exists(previous_key)


def test_dq_download_dataset(auth_client, db_session, test_user, fake_storage):
    from backend.src.api.routes import dq
    from backend.src.api.db_models import Dataset

    file_id = "file-download"
    dataset = Dataset(user_id=test_user.id, file_uuid=file_id, is_modified=False)
    db_session.add(dataset)
    db_session.commit()

    key = fake_storage.build_key(file_id, suffix="raw", ext="csv", prefix="uploads")
    fake_storage.put_text(key, "value\n1\n")

    response = auth_client.get(f"/api/dq/download/{file_id}")

    assert response.status_code == 200
    assert response.content == b"value\n1\n"
