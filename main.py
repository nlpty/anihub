from contextlib import asynccontextmanager
from pathlib import Path
import mimetypes

# На некоторых Linux-контейнерах (в т.ч. на Render) системная база mimetypes
# неполная, и .js может отдаваться с неправильным Content-Type. Браузер по
# спецификации ОТКАЗЫВАЕТСЯ выполнять <script type="module">, если тип не
# javascript — молча, без ошибки на странице. Из-за этого сайт выглядит
# полностью "мёртвым" (ничего не работает), хотя HTML/CSS/API в порядке.
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.api.anime import router as anime_router
from app.services.manager import catalog_manager
from app.http import UTF8JSONResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Запускаем фоновую загрузку каталога, не блокируя старт сервера
    import asyncio
    asyncio.create_task(catalog_manager.start_background_refresh())
    yield


app = FastAPI(title="Anime Hub API", version="2.0.0", lifespan=lifespan, default_response_class=UTF8JSONResponse)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app.include_router(anime_router)


@app.get("/api/health")
async def health_check():
    """
    Диагностика. Открой этот адрес прямо в браузере (например
    https://твой-сайт.onrender.com/api/health), чтобы увидеть, загрузился
    ли каталог и что именно пошло не так, если нет.
    """
    return catalog_manager.get_status()


@app.get("/api/titles/count")
async def get_titles_count():
    return {"total": catalog_manager.total_count()}


@app.post("/api/sync")
async def force_sync():
    """Ручной запуск обновления каталога"""
    import asyncio
    asyncio.create_task(catalog_manager.refresh(full=True))
    return {"status": "sync_started"}


if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
async def serve_root():
    index_path = BASE_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "Anime Hub API"}


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """SPA fallback — любые не-API пути отдают index.html"""
    if full_path.startswith("api/") or full_path.startswith("static/"):
        raise HTTPException(status_code=404)
    index_path = BASE_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    raise HTTPException(status_code=404)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
