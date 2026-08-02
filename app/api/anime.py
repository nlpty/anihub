from typing import Optional
from fastapi import APIRouter, Query

from app.services.manager import catalog_manager

router = APIRouter(prefix="/api/anime", tags=["Anime"])


@router.get("/ongoings")
async def get_ongoings(limit: int = Query(200, le=500)):
    """Список текущих онгоингов (для верхнего блока главной страницы)"""
    return catalog_manager.get_ongoings(limit=limit)


@router.get("/updates")
async def get_updates(page: int = Query(1, ge=1), limit: int = Query(12, le=50)):
    """Завершённые тайтлы и анонсы (для нижнего блока главной страницы)"""
    return catalog_manager.get_catalog_page(page=page, limit=limit, statuses=["released", "anons"])


@router.get("/search")
async def search_anime(q: str = Query(""), type: Optional[str] = Query(None)):
    """
    Поиск по всему каталогу (Shikimori + AniLibria, без дублей).
    type: ongoing | released | anons — необязательный фильтр по статусу.
    """
    if not q.strip():
        return []
    status_filter = type if type in ("ongoing", "released", "anons") else None
    return catalog_manager.search(q, status_filter=status_filter)


@router.get("/providers/list")
async def list_providers():
    return {"providers": ["shikimori", "anilibria"], "total": 2}


@router.get("/{anime_id}")
async def get_anime_by_id(anime_id: str):
    """Подробная информация о тайтле"""
    anime = await catalog_manager.get_by_id_live(anime_id)
    if not anime:
        return {}
    return anime


@router.get("/{anime_id}/players")
async def get_players(anime_id: str, episode: int = Query(1, ge=1)):
    """Плеер (озвучки) для конкретной серии — подбирается через AniLibria по названию"""
    return await catalog_manager.get_players(anime_id, episode)
