import os

import pytest


def test_register_and_login_flow(client, db_session):
    register_payload = {"email": "user@example.com", "password": "pass123"}
    response = client.post("/api/auth/register", json=register_payload)

    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body

    login_response = client.post("/api/auth/login", json=register_payload)
    assert login_response.status_code == 200

    invalid_response = client.post("/api/auth/login", json={"email": "user@example.com", "password": "bad"})
    assert invalid_response.status_code == 401


def test_google_login_creates_user(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-id")

    def fake_verify(token, request, client_id):
        return {"email": "google@example.com"}

    monkeypatch.setattr("backend.src.api.routes.auth.id_token.verify_oauth2_token", fake_verify)

    response = client.post("/api/auth/google", json={"token": "fake-token"})

    assert response.status_code == 200
    assert "access_token" in response.json()


def test_users_profile_and_onboard(auth_client, db_session, test_user, fake_storage, monkeypatch):
    from backend.src.api.db_models import Dataset, DatasetFileMeta, UserOnboardingState
    from backend.src.api.routes import users

    dataset1 = Dataset(user_id=test_user.id, file_uuid="file-123", is_modified=True)
    meta1 = DatasetFileMeta(user_id=test_user.id, file_uuid="file-123", original_filename="data.csv")

    dataset2 = Dataset(user_id=test_user.id, file_uuid="file-456", is_modified=False)
    meta2 = DatasetFileMeta(user_id=test_user.id, file_uuid="file-456", original_filename="data2.csv")

    onboarding = UserOnboardingState(user_id=test_user.id, is_onboarded=True)
    db_session.add_all([dataset1, meta1, dataset2, meta2, onboarding])
    db_session.commit()

    fake_storage.put_text("outputs/plot_file-123.png", "fake png data")
    monkeypatch.setattr(users, "storage", fake_storage)

    response = auth_client.get("/api/users/me")
    assert response.status_code == 200
    payload = response.json()
    assert payload["email"] == "test@example.com"
    assert payload["datasets"][0]["file_id"] == "file-456"
    assert payload["datasets"][0]["has_chart"] is False
    assert payload["datasets"][0]["chart_filename"] is None
    assert payload["datasets"][1]["file_id"] == "file-123"
    assert payload["datasets"][1]["original_filename"] == "data.csv"
    assert payload["datasets"][1]["is_modified"] is True
    assert payload["datasets"][1]["has_chart"] is True
    assert payload["datasets"][1]["chart_filename"] == "plot_file-123.png"
    assert payload["is_onboarded"] is True

    onboard_response = auth_client.patch("/api/users/me/onboard")
    assert onboard_response.status_code == 200
    assert onboard_response.json()["status"] == "success"
