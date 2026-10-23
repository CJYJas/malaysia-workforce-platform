"""FastAPI entrypoint with the account and learning routes mounted."""

from app.api import app
from app.auth.persistence import initialize_sqlite_schema
from app.auth.routes import router as account_router

app.include_router(account_router)
app.router.add_event_handler("startup", initialize_sqlite_schema)
