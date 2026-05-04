import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.src.api.routes import auth, dq, li, vs, upload
from backend.src.api.db import engine
from backend.src.api.db_models import Base
import uvicorn

app = FastAPI(title="SpectraCast Suite API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost",
        "http://127.0.0.1"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(dq.router, prefix="/api/dq", tags=["Data Quality"])
app.include_router(vs.router, prefix="/api/vs", tags=["Visual Standardizer"])
app.include_router(li.router, prefix="/api/li", tags=["Leading Indicators"])


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "Welcome to the SpectraCast Suite API"}

if __name__ == "__main__":
    uvicorn.run("backend.src.api.main:app", host="127.0.0.1", port=8000, reload=True)