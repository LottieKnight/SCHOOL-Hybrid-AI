"""
SCHOOL Local GPU Embedding Server
Bridges Next.js API routes to the local sentence-transformers model.
Runs on port 8001. In production, replace with Voyage AI (see rag.ts).

PHASE 7 NOTE: When swapping to Voyage AI in production, retire this server.
Update EMBEDDING_SERVER_URL in Vercel env vars and remove this from dev startup.
Also migrate Supabase documents table from vector(384) to vector(512) for voyage-3-lite.

Usage (from repo root):
  source ~/gpu-env/bin/activate
  uvicorn scripts.embedding_server:app --port 8001 --reload

  Or run directly:
  python scripts/embedding_server.py
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        device = os.environ.get("EMBED_DEVICE", "cuda")
        _model = SentenceTransformer("all-MiniLM-L6-v2", device=device)
        print(f"[embedding_server] Model loaded on {_model.device}")
    return _model


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    get_model()  # warm up before accepting requests
    yield


app = FastAPI(
    title="SCHOOL Embedding Server",
    version="1.0.0",
    description="GPU-accelerated text embeddings for the SCHOOL RAG pipeline.",
    lifespan=lifespan,
)


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    model: str = "all-MiniLM-L6-v2"
    dims: int = 384


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    if not req.texts:
        raise HTTPException(status_code=400, detail="'texts' must be a non-empty list.")

    texts = [t.strip()[:2000] for t in req.texts if t.strip()]
    if not texts:
        raise HTTPException(status_code=400, detail="All provided texts were empty.")

    model = get_model()
    embeddings = model.encode(texts, show_progress_bar=False)
    return EmbedResponse(embeddings=embeddings.tolist())


@app.get("/health")
def health() -> dict:
    model = get_model()
    return {"status": "ok", "device": str(model.device), "dims": 384}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
