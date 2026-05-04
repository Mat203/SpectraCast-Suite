import sys
import os
import logging
import re

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.src.api.routes import auth, dq, li, users, vs, upload, llm
from backend.src.api.db import engine
from backend.src.api.db_models import Base
import uvicorn
from dotenv import load_dotenv
load_dotenv()


class RedactApiKeyFilter(logging.Filter):
    pattern = re.compile(r"(?i)(x-llm-api-key\s*[:=]\s*)([^\s,;]+)")

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        if "x-llm-api-key" in message.lower():
            redacted = self.pattern.sub(r"\1[REDACTED]", message)
            record.msg = redacted
            record.args = ()
        return True


def configure_logging() -> None:
    redact_filter = RedactApiKeyFilter()
    logging.getLogger().addFilter(redact_filter)
    for logger_name in ("uvicorn.access", "uvicorn.error", "fastapi"):
        logging.getLogger(logger_name).addFilter(redact_filter)


configure_logging()
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
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(dq.router, prefix="/api/dq", tags=["Data Quality"])
app.include_router(vs.router, prefix="/api/vs", tags=["Visual Standardizer"])
app.include_router(li.router, prefix="/api/li", tags=["Leading Indicators"])
app.include_router(llm.router, prefix="/api/llm", tags=["LLM"])


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

@app.get("/")
def root():
    return {"message": "Welcome to the SpectraCast Suite API"}

if __name__ == "__main__":
    uvicorn.run("backend.src.api.main:app", host="127.0.0.1", port=8000, reload=True)