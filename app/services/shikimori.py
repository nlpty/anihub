"""
Провайдер каталога Shikimori — https://shikimori.one/api

Самый большой открытый бесплатный каталог аниме на русском.
Не требует ключей/токенов. Даёт онгоинги, анонсы и завершённые тайтлы
с рейтингами, жанрами, описаниями и постерами.
"""
import re
import asyncio
import time
from typing import List, Dict, Any, Optional

import httpx

BASE_URL = "https://shikimori.io/api"  # домен shikimori.one теперь постоянно редиректит сюда
HEADERS = {"User-Agent": "AnimeHub/1.0 (personal project)"}

MIN_REQUEST_INTERVAL = 0.8  # сек между ЛЮБЫМИ запросами к Shikimori (их лимит ~90/мин)
MAX_RETRIES = 3

# Возрастные рейтинги Shikimori -> человекочитаемый вид
RATING_MAP = {
    "g": "G (0+)",
    "pg": "PG (6+)",
    "pg_13": "PG-13 (13+)",
    "r": "R-17 (17+)",
    "r_plus": "R+ (17+)",
    "rx": "Rx (18+)",
}

_TAG_RE = re.compile(r"\[[^\]]*\]")  # BBCode-теги вида [character=...], [spoiler] и т.п.


def _clean_description(text: Optional[str]) -> str:
    if not text:
        return ""
    return _TAG_RE.sub("", text).replace("[/spoiler]", "").strip()


def _to_unified(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Приводит объект Shikimori к единому формату карточки аниме"""
    shiki_id = item.get("id")
    if not shiki_id:
        return None

    image = item.get("image") or {}
    poster_path = image.get("original") or image.get("preview") or ""
    poster = f"https://shikimori.io{poster_path}" if poster_path else ""

    genres = [g.get("russian") or g.get("name") for g in (item.get("genres") or []) if g]
    raw_rating = item.get("rating")
    aired_on = item.get("aired_on") or item.get("released_on") or ""
    release_year = aired_on.split("-")[0] if aired_on else ""

    return {
        "id": f"shiki-{shiki_id}",
        "title": item.get("russian") or item.get("name") or "Без названия",
        "title_en": item.get("name") or "",
        "title_jap": "",
        "poster": poster,
        "status": item.get("status") or "ongoing",
        "episodes_released": item.get("episodes_aired") or 0,
        "episodes_total": item.get("episodes") or "?",
        "rating": item.get("score") or "0",
        "genres": genres,
        "release_year": release_year,
        "description": _clean_description(item.get("description")),
        "age_rating": RATING_MAP.get(raw_rating, "—"),
        "kind": item.get("kind") or "tv",
        "provider": "shikimori",
        "updated_at": item.get("updated_at") or "",
    }


class ShikimoriProvider:
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
        self.last_error: Optional[str] = None
        self.last_ok: bool = False
        self._rate_lock = asyncio.Lock()
        self._last_request_at: float = 0.0

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=BASE_URL, headers=HEADERS, timeout=15, follow_redirects=True
            )
        return self._client

    async def _throttle(self):
        """Гарантирует минимальный интервал между ЛЮБЫМИ запросами к Shikimori,
        даже если несколько корутин дёргают провайдер одновременно."""
        async with self._rate_lock:
            elapsed = time.monotonic() - self._last_request_at
            wait = MIN_REQUEST_INTERVAL - elapsed
            if wait > 0:
                await asyncio.sleep(wait)
            self._last_request_at = time.monotonic()

    async def _request(self, path: str, params: Dict[str, Any]) -> Optional[Any]:
        """Один запрос с троттлингом и повтором при 429 (с нарастающей паузой)."""
        client = await self._get_client()
        for attempt in range(1, MAX_RETRIES + 1):
            await self._throttle()
            try:
                resp = await client.get(path, params=params)
                if resp.status_code == 429:
                    retry_after = float(resp.headers.get("Retry-After", 3 * attempt))
                    self.last_error = f"429 Too Many Requests, повтор через {retry_after:.0f}с"
                    print(f"[Shikimori] 429 на {path} {params}, жду {retry_after:.0f}с (попытка {attempt}/{MAX_RETRIES})")
                    await asyncio.sleep(retry_after)
                    continue
                resp.raise_for_status()
                self.last_ok = True
                self.last_error = None
                return resp.json()
            except Exception as e:
                self.last_ok = False
                self.last_error = f"{type(e).__name__}: {e}"
                print(f"[Shikimori Error] {path} {params}: {self.last_error}")
                return None
        return None

    async def _get(self, path: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        data = await self._request(path, params)
        return data if isinstance(data, list) else []

    async def fetch_status(
        self, status: str, pages: int, limit_per_page: int = 50, order: str = "popularity"
    ) -> List[Dict[str, Any]]:
        """Скачивает несколько страниц каталога по статусу (anons/ongoing/released)"""
        results: List[Dict[str, Any]] = []
        for page in range(1, pages + 1):
            raw = await self._get(
                "/animes",
                {
                    "page": page,
                    "limit": limit_per_page,
                    "status": status,
                    "order": order,
                    "censored": "true",
                },
            )
            if not raw:
                break
            for item in raw:
                unified = _to_unified(item)
                if unified:
                    results.append(unified)
        return results

    async def search(self, query: str, limit: int = 30) -> List[Dict[str, Any]]:
        raw = await self._get("/animes", {"search": query, "limit": limit, "censored": "true"})
        return [u for item in raw if (u := _to_unified(item))]

    async def get_by_id(self, shiki_id: str) -> Optional[Dict[str, Any]]:
        data = await self._request(f"/animes/{shiki_id}", {})
        return _to_unified(data) if data else None

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None


shikimori_provider = ShikimoriProvider()
