"""
FastAPI application main entrypoint.
Exposes `app` with configured CORSMiddleware, auth extension, and frontend SPA serving.
"""

from app.api import app

__all__ = ["app"]
