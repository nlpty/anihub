from typing import Optional
from fastapi import APIRouter, Query

from app.services.manager import catalog_manager

router = APIRouter(prefix="/api/anime", tags=["Anime"])


@router.get("/ongoings")
async def get_ongoings(limit: int = Query(200, le=500)):
    """Список текущих онгоингов (для верхнего блока главной страницы)"""
    await catalog_manager.ensure_ready()
    return catalog_manager.get_ongoings(limit=limit)


@router.get("/updates")
async def get_updates(page: int = Query(1, ge=1), limit: int = Query(12, le=50)):
    """Завершённые тайтлы и анонсы (для нижнего блока главной страницы)"""
    await catalog_manager.ensure_ready()
    return catalog_manager.get_catalog_page(page=page, limit=limit, statuses=["released", "anons"])


@router.get("/search")
async def search_anime(q: str = Query(""), type: Optional[str] = Query(None)):
    """
    Поиск по всему каталогу (Shikimori + AniLibria, без дублей).
    type: ongoing | released | anons — необязательный фильтр по статусу.
    """
    if not q.strip():
        return []
    await catalog_manager.ensure_ready()
    status_filter = type if type in ("ongoing", "released", "anons") else None
    return catalog_manager.search(q, status_filter=status_filter)


@router.get("/providers/list")
async def list_providers():
    return {"providers": ["shikimori", "anilibria"], "total": 2}


@router.get("/random/pick")
async def get_random_anime():
    """Случайный тайтл из каталога — для вкладки 'Подборка'"""
    await catalog_manager.ensure_ready()
    return catalog_manager.get_random() or {}


@router.get("/recommendations/by-genres")
async def get_recommendations(
    genres: str = Query(""), exclude: str = Query(""), limit: int = Query(1, le=10)
):
    """
    Рекомендация по жанрам избранных тайтлов пользователя.
    genres — через запятую, exclude — id тайтлов, которые не нужно предлагать (уже в списках).
    """
    await catalog_manager.ensure_ready()
    genre_list = [g for g in genres.split(",") if g.strip()]
    exclude_list = [e for e in exclude.split(",") if e.strip()]
    return catalog_manager.get_recommendations(genre_list, exclude_list, limit=limit)


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
