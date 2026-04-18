import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.src.api.routes import dq, vs, upload
import uvicorn

app = FastAPI(title="SpectraCast Suite API", description="API for DQ and VS analytical modules")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(dq.router, prefix="/api/dq", tags=["Data Quality"])
app.include_router(vs.router, prefix="/api/vs", tags=["Visual Standardizer"])

@app.get("/")
def root():
    return {"message": "Welcome to the SpectraCast Suite API"}

if __name__ == "__main__":
    uvicorn.run("backend.src.api.main:app", host="0.0.0.0", port=8000, reload=True)