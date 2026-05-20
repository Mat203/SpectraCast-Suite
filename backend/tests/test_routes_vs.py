from pathlib import Path

import pandas as pd


def test_vs_styles(auth_client):
    response = auth_client.get("/api/vs/styles")

    assert response.status_code == 200
    assert "styles" in response.json()


def test_vs_standardize_code(auth_client):
    payload = {"raw_code": "ax.set_title('Title', color='red')", "style_name": ""}

    response = auth_client.post("/api/vs/standardize-code", json=payload)

    assert response.status_code == 200
    assert response.json()["status"] == "success"


def test_vs_generate_plot(auth_client, db_session, test_user, fake_storage, monkeypatch, tmp_path: Path):
    from backend.src.api.routes import vs
    from backend.src.api.db_models import Dataset

    file_id = "file-plot"
    dataset = Dataset(user_id=test_user.id, file_uuid=file_id, is_modified=False)
    db_session.add(dataset)
    db_session.commit()

    key = fake_storage.build_key(file_id, suffix="raw", ext="csv", prefix="uploads")
    fake_storage.put_text(key, "date,price\n2024-01-01,100\n2024-01-02,101\n")

    def fake_generate_plot(self, df, x_col, y_cols, chart_type, filename, secondary_cols=None):
        output = tmp_path / filename
        output.write_bytes(b"png")
        return output

    monkeypatch.setattr(vs, "storage", fake_storage)
    monkeypatch.setattr("backend.src.api.routes.vs.PlotEngine.generate_plot", fake_generate_plot)

    payload = {
        "file_id": file_id,
        "x_col": "date",
        "y_cols": ["price"],
        "chart_type": "1",
        "style_name": "",
        "is_cleaned": False,
    }

    response = auth_client.post("/api/vs/generate", json=payload)

    assert response.status_code == 200
    assert response.json()["status"] == "success"
