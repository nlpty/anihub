"""
Менеджер каталога: держит в памяти (без базы данных) объединённый список
аниме из Shikimori (основной каталог) и AniLibria (доп. онгоинги + плееры),
с дедупликацией по названию, и обновляет его в фоне по расписанию.
"""
import asyncio
import time
from typing import List, Dict, Any, Optional

from app.services.shikimori import shikimori_provider
from app.services.anilibria import anilibria_provider

# Сколько страниц (по 50 тайтлов) тянуть с Shikimori по каждому статусу.
# Подобрано так, чтобы уложиться в память и время старта бесплатного Render-инстанса.
PAGES_ONGOING = 6      # ~300 онгоингов
PAGES_ANONS = 4        # ~200 анонсов
PAGES_RELEASED = 40    # ~2000 завершённых тайтлов

REFRESH_INTERVAL_SECONDS = 6 * 60 * 60  # обновлять каталог раз в 6 часов


def _norm_title(title: str) -> str:
    return (title or "").strip().lower()


class AnimeCatalogManager:
    def __init__(self):
        self._catalog: List[Dict[str, Any]] = []
        self._by_id: Dict[str, Dict[str, Any]] = {}
        self._last_refresh: float = 0
        self._refreshing = False
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------ #
    # Обновление каталога
    # ------------------------------------------------------------------ #
    async def refresh(self, full: bool = True):
        if self._refreshing:
            return
        self._refreshing = True
        try:
            print("[Catalog] Обновление каталога...")
            ongoing, anons, released = await asyncio.gather(
                shikimori_provider.fetch_status("ongoing", PAGES_ONGOING, order="ranked"),
                shikimori_provider.fetch_status("anons", PAGES_ANONS, order="id"),
                shikimori_provider.fetch_status("released", PAGES_RELEASED if full else 4, order="popularity"),
            )
            anilibria_extra = await anilibria_provider.get_updates(limit=50)

            combined = ongoing + anons + released
            seen_titles = {_norm_title(a["title"]) for a in combined}

            for extra in anilibria_extra:
                if _norm_title(extra["title"]) not in seen_titles:
                    combined.append(extra)
                    seen_titles.add(_norm_title(extra["title"]))

            async with self._lock:
                self._catalog = combined
                self._by_id = {a["id"]: a for a in combined}
                self._last_refresh = time.time()

            print(f"[Catalog] Готово: {len(combined)} тайтлов "
                  f"(онгоинги: {len(ongoing)}, анонсы: {len(anons)}, завершённые: {len(released)}, "
                  f"доп. из AniLibria: {len(combined) - len(ongoing) - len(anons) - len(released)})")
        except Exception as e:
            print(f"[Catalog Error] {e}")
        finally:
            self._refreshing = False

    async def start_background_refresh(self):
        """Первичная загрузка + периодическое обновление в фоне"""
        await self.refresh(full=False)   # быстрый старт: небольшой каталог сразу
        asyncio.create_task(self._grow_then_loop())

    async def _grow_then_loop(self):
        await self.refresh(full=True)    # затем докачиваем полный каталог
        while True:
            await asyncio.sleep(REFRESH_INTERVAL_SECONDS)
            await self.refresh(full=True)

    # ------------------------------------------------------------------ #
    # Чтение каталога
    # ------------------------------------------------------------------ #
    def is_ready(self) -> bool:
        return len(self._catalog) > 0

    def total_count(self) -> int:
        return len(self._catalog)

    def get_ongoings(self, limit: int = 200) -> List[Dict[str, Any]]:
        items = [a for a in self._catalog if a["status"] == "ongoing"]
        return items[:limit]

    def get_catalog_page(
        self, page: int = 1, limit: int = 12, statuses: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        items = self._catalog
        if statuses:
            items = [a for a in items if a["status"] in statuses]
        start = (page - 1) * limit
        return items[start:start + limit]

    def search(self, query: str, status_filter: Optional[str] = None, limit: int = 40) -> List[Dict[str, Any]]:
        q = _norm_title(query)
        if not q:
            return []
        results = []
        for a in self._catalog:
            haystack = " ".join([a.get("title", ""), a.get("title_en", ""), a.get("title_jap", "")]).lower()
            if q in haystack:
                if status_filter and a["status"] != status_filter:
                    continue
                results.append(a)
        return results[:limit]

    def get_by_id(self, anime_id: str) -> Optional[Dict[str, Any]]:
        return self._by_id.get(anime_id)

    async def get_by_id_live(self, anime_id: str) -> Optional[Dict[str, Any]]:
        """Если тайтла нет в кэше (например, только что вышел) — пробуем найти напрямую"""
        cached = self.get_by_id(anime_id)
        if cached:
            return cached
        if anime_id.startswith("shiki-"):
            return await shikimori_provider.get_by_id(anime_id.replace("shiki-", ""))
        if anime_id.startswith("ani-"):
            return await anilibria_provider.get_by_id(anime_id.replace("ani-", ""))
        return None

    # ------------------------------------------------------------------ #
    # Плеер
    # ------------------------------------------------------------------ #
    async def get_players(self, anime_id: str, episode: int = 1) -> List[Dict[str, Any]]:
        # Тайтл уже пришёл из AniLibria — плеер получаем напрямую по его коду
        if anime_id.startswith("ani-"):
            anime = self.get_by_id(anime_id) or await anilibria_provider.get_by_id(anime_id.replace("ani-", ""))
            code = (anime or {}).get("code", "")
            return await anilibria_provider.get_players(code, episode)

        # Тайтл из Shikimori — ищем совпадение по названию в AniLibria
        anime = await self.get_by_id_live(anime_id)
        if not anime:
            return []
        match = await anilibria_provider.search_by_title(anime["title"])
        if not match:
            match = await anilibria_provider.search_by_title(anime.get("title_en", ""))
        if not match:
            return []
        return await anilibria_provider.get_players(match.get("code", ""), episode)


catalog_manager = AnimeCatalogManager()
