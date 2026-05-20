import pandas as pd

from backend.src.core.loader import DataLoader


class FakeStorage:
    def __init__(self, exists_value: bool, df: pd.DataFrame | None = None):
        self.bucket = "test-bucket"
        self._exists_value = exists_value
        self._df = df if df is not None else pd.DataFrame()
        self.read_calls: list[str] = []

    def exists(self, key: str) -> bool:
        self.last_key = key
        return self._exists_value

    def read_csv(self, key: str) -> pd.DataFrame:
        self.read_calls.append(key)
        return self._df


def test_build_key_adds_prefix():
    loader = DataLoader(data_folder_name="uploads", storage=FakeStorage(True))
    assert loader._build_key("file.csv") == "uploads/file.csv"
    assert loader._build_key("uploads/file.csv") == "uploads/file.csv"


def test_load_csv_returns_none_when_missing():
    storage = FakeStorage(False)
    loader = DataLoader(data_folder_name="uploads", storage=storage)

    assert loader.load_csv("file.csv") is None
    assert storage.read_calls == []


def test_load_csv_returns_none_for_empty_dataframe():
    storage = FakeStorage(True, pd.DataFrame())
    loader = DataLoader(data_folder_name="uploads", storage=storage)

    assert loader.load_csv("file.csv") is None


def test_load_csv_returns_dataframe_when_present():
    df = pd.DataFrame({"col": [1, 2, 3]})
    storage = FakeStorage(True, df)
    loader = DataLoader(data_folder_name="uploads", storage=storage)

    loaded = loader.load_csv("file.csv")

    assert loaded is df
    assert storage.read_calls == ["uploads/file.csv"]
