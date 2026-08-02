"""
Провайдер AniLibria — https://api.anilibria.tv/v3

Используется для двух целей:
1. Как дополнительный источник онгоингов (у AniLibria они обновляются очень быстро).
2. Как источник видеоплеера — по названию тайтла ищем совпадение в AniLibria
   и отдаём встраиваемый плеер (официальный, бесплатный, с русской озвучкой).
"""
import asyncio
from typing import List, Dict, Any, Optional

import httpx

BASE_URL = "https://api.anilibria.tv/v3"
HEADERS = {"User-Agent": "AnimeHub/1.0 (personal project)"}


def _to_unified(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not item or "id" not in item:
        return None

    posters = item.get("posters") or {}
    medium = posters.get("medium") or posters.get("small") or posters.get("original") or {}
    raw_poster = medium.get("url") if isinstance(medium, dict) else None
    poster = f"https://static.anilibria.tv{raw_poster}" if raw_poster else ""

    names = item.get("names") or {}
    player = item.get("player") or {}
    episodes_info = player.get("episodes") or {}
    type_info = item.get("type") or {}
    status_info = item.get("status") or {}

    status_raw = (status_info.get("string") or "").lower()
    status = "ongoing"
    if "заверш" in status_raw or "released" in status_raw:
        status = "released"
    elif "анонс" in status_raw:
        status = "anons"

    return {
        "id": f"ani-{item.get('id')}",
        "code": item.get("code", ""),
        "title": names.get("ru") or item.get("title") or "Без названия",
        "title_en": names.get("en") or "",
        "title_jap": names.get("alternative") or "",
        "poster": poster,
        "status": status,
        "episodes_released": episodes_info.get("last") or 0,
        "episodes_total": type_info.get("episodes") or "?",
        "rating": str(round(item.get("in_favorites", 0) / 1000, 1)) if item.get("in_favorites") else "0",
        "genres": item.get("genres") or [],
        "release_year": str(item.get("year") or ""),
        "description": item.get("description") or "",
        "age_rating": "—",
        "kind": "tv",
        "provider": "anilibria",
    }


class AnilibriaProvider:
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self.last_error: Optional[str] = None
        self.last_ok: bool = False

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(base_url=BASE_URL, headers=HEADERS, timeout=15)
        return self._client

    async def _get(self, path: str, params: Dict[str, Any]) -> Any:
        client = await self._get_client()
        try:
            resp = await client.get(path, params=params)
            resp.raise_for_status()
            self.last_ok = True
            self.last_error = None
            return resp.json()
        except Exception as e:
            self.last_ok = False
            self.last_error = f"{type(e).__name__}: {e}"
            print(f"[AniLibria Error] {path} {params}: {self.last_error}")
            return None

    async def get_updates(self, limit: int = 30) -> List[Dict[str, Any]]:
        data = await self._get("/title/updates", {"limit": limit})
        items = (data or {}).get("list", []) if isinstance(data, dict) else []
        return [u for item in items if (u := _to_unified(item))]

    async def search_by_title(self, title: str) -> Optional[Dict[str, Any]]:
        """Ищет тайтл в AniLibria по названию (для подбора плеера к тайтлу из каталога)"""
        if not title:
            return None
        data = await self._get("/title/search", {"search": title, "limit": 5})
        items = (data or {}).get("list", []) if isinstance(data, dict) else []
        if not items:
            return None
        return _to_unified(items[0])

    async def get_by_id(self, anilibria_id: str) -> Optional[Dict[str, Any]]:
        data = await self._get("/title", {"id": anilibria_id})
        return _to_unified(data) if data else None

    async def get_players(self, code: str, episode: int = 1) -> List[Dict[str, Any]]:
        """Формирует ссылку на встроенный официальный плеер AniLibria"""
        if not code:
            return []
        embed_url = f"https://www.anilibria.tv/app/embed/index.html?code={code}&series={episode}"
        return [{
            "provider": "AniLibria",
            "translation": "AniLibria (официальная озвучка)",
            "player_type": "iframe",
            "url": embed_url,
            "quality": "1080p",
        }]

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None


anilibria_provider = AnilibriaProvider()
