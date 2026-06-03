from locust import HttpUser, task, between

CSV_PAYLOAD = """date,price,volume
2024-01-01,100.5,1000
2024-01-02,,1100
2024-01-03,105.2,1050
2024-01-04,103.0,900
2024-01-05,108.7,1200
"""

HEADERS = {
    "Content-Type": "application/json",
}

class SpectraCastUser(HttpUser):
    wait_time = between(1.0, 3.0)

    @task(4)
    def scan_data_quality(self):
        payload = {
            "csvData": CSV_PAYLOAD,
            "file_id": "locust-test",
        }
        self.client.post("/api/dq/scan", json=payload, headers=HEADERS, name="[POST] /api/dq/scan")

    @task(2)
    def generate_plot(self):
        payload = {
            "csvData": CSV_PAYLOAD,
            "chart_type": "line",
            "primary_cols": ["price"],
            "secondary_cols": ["volume"],
            "x_col": "date"
        }
        self.client.post("/api/visualize", json=payload, headers=HEADERS, name="[POST] /api/visualize")

    @task(1)
    def clean_data(self):
        payload = {
            "csvData": CSV_PAYLOAD,
            "column": "price",
            "method": "1" 
        }
        self.client.post("/api/dq/clean", json=payload, headers=HEADERS, name="[POST] /api/dq/clean")

    @task(1)
    def fail_leading_indicators_no_key(self):
        payload = {
            "target_col": "price",
            "region": "US"
        }
        with self.client.post("/api/leading-indicators", json=payload, headers=HEADERS, name="[POST] /api/leading-indicators (No Key)", catch_response=True) as response:
            if response.status_code in [400, 401, 403, 422]:
                response.success() 
            else:
                response.failure(f"Expected failure status, got {response.status_code}")