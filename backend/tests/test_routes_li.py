from pathlib import Path

import pandas as pd


def test_li_run_and_download(auth_client, db_session, test_user, fake_storage, monkeypatch):
    from backend.src.api.routes import li
    from backend.src.api.db_models import Dataset

    file_id = "file-li"
    dataset = Dataset(user_id=test_user.id, file_uuid=file_id, is_modified=False)
    db_session.add(dataset)
    db_session.commit()

    csv_content = "date,target\n2024-01-01,100\n2024-01-02,101\n"

    key_raw = fake_storage.build_key(file_id, suffix="raw", ext="csv", prefix="uploads")
    key_cleaned = fake_storage.build_key(file_id, suffix="cleaned", ext="csv", prefix="uploads")
    fake_storage.put_text(key_raw, csv_content)
    fake_storage.put_text(key_cleaned, csv_content)

    results_df = pd.DataFrame([
        {"Search Query": "q1", "Correlation (Lag 0)": 0.5, "Result": "Synchronous"},
    ])

    def fake_run_api(self, primary_df, target_col, region, geo, extra, file_id, user_api_key=None):
        return ["q1"], f"raw_trends_{file_id}.csv", f"correlations_{file_id}.csv", results_df

    monkeypatch.setattr(li, "storage", fake_storage)
    monkeypatch.setattr("backend.src.api.routes.li.LeadingIndicatorsModule.run_api", fake_run_api)

    from backend.src.core import loader as loader_module

    original_init = loader_module.DataLoader.__init__

    def fake_init(self, data_folder_name="uploads", storage=None):
        original_init(self, data_folder_name=data_folder_name, storage=fake_storage)

    monkeypatch.setattr(loader_module.DataLoader, "__init__", fake_init)

    payload = {
        "file_id": file_id,
        "target_col": "target",
        "region": "UA",
        "geo": "UA",
        "extra_info": "",
    }

    response = auth_client.post("/api/li/run", json=payload)

    assert response.status_code == 200
    assert response.json()["status"] == "success"

    output_key = fake_storage.join_key("outputs", f"raw_trends_{file_id}.csv")
    fake_storage.put_text(output_key, "col\n1\n")

    download = auth_client.get(f"/api/li/download/raw_trends_{file_id}.csv")
    assert download.status_code == 200