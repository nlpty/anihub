"""
Менеджер каталога: держит в памяти (без базы данных) объединённый список
аниме из Shikimori (основной каталог) и AniLibria (доп. онгоинги + плееры),
с дедупликацией по названию, и обновляет его в фоне по расписанию.

Важно: каталог догружается "лениво" — если первый запрос пришёл раньше,
чем фон успел всё скачать, ensure_ready() сам дождётся первой загрузки,
вместо того чтобы молча вернуть пустой список.
"""
import asyncio
import time
import traceback
from datetime import datetime
from typing import List, Dict, Any, Optional

from app.services.shikimori import shikimori_provider
from app.services.anilibria import anilibria_provider

PAGES_ONGOING = 6      # ~300 онгоингов
PAGES_ANONS = 4        # ~200 анонсов
PAGES_RELEASED_QUICK = 4     # для быстрой первой загрузки
PAGES_RELEASED_FULL = 40     # ~2000 завершённых тайтлов при полной догрузке

REFRESH_INTERVAL_SECONDS = 6 * 60 * 60  # обновлять каталог раз в 6 часов
FIRST_LOAD_TIMEOUT_SECONDS = 8           # сколько МАКСИМУМ ждать ответа, если каталог ещё грузится
RETRY_MIN_DELAY = 5                      # старт бэкоффа при неудачной загрузке (сек)
RETRY_MAX_DELAY = 120                    # потолок бэкоффа (сек)


def _norm_title(title: str) -> str:
    return (title or "").strip().lower()


class AnimeCatalogManager:
    def __init__(self):
        self._catalog: List[Dict[str, Any]] = []
        self._by_id: Dict[str, Dict[str, Any]] = {}
        self._last_refresh: float = 0
        self._last_error: Optional[str] = None
        self._refreshing = False
        self._ever_loaded = asyncio.Event()
        self._refresh_lock = asyncio.Lock()

    # ------------------------------------------------------------------ #
    # Обновление каталога
    # ------------------------------------------------------------------ #
    async def refresh(self, full: bool = True):
        if self._refreshing:
            return
        async with self._refresh_lock:
            self._refreshing = True
            try:
                print("[Catalog] Обновление каталога...")
                released_pages = PAGES_RELEASED_FULL if full else PAGES_RELEASED_QUICK
                ongoing, anons, released = await asyncio.gather(
                    shikimori_provider.fetch_status("ongoing", PAGES_ONGOING, order="ranked"),
                    shikimori_provider.fetch_status("anons", PAGES_ANONS, order="id"),
                    shikimori_provider.fetch_status("released", released_pages, order="popularity"),
                )
                anilibria_extra = await anilibria_provider.get_updates(limit=50)

                combined = ongoing + anons + released
                seen_titles = {_norm_title(a["title"]) for a in combined}

                for extra in anilibria_extra:
                    if _norm_title(extra["title"]) not in seen_titles:
                        combined.append(extra)
                        seen_titles.add(_norm_title(extra["title"]))

                if combined:
                    self._catalog = combined
                    self._by_id = {a["id"]: a for a in combined}
                    self._last_refresh = time.time()
                    self._last_error = None
                    self._ever_loaded.set()
                    print(f"[Catalog] Готово: {len(combined)} тайтлов "
                          f"(онгоинги: {len(ongoing)}, анонсы: {len(anons)}, "
                          f"завершённые: {len(released)}, "
                          f"AniLibria доп.: {len(combined) - len(ongoing) - len(anons) - len(released)})")
                else:
                    # Ничего не пришло ни с одного источника — фиксируем ошибку,
                    # чтобы её можно было увидеть через /api/health
                    self._last_error = (
                        f"Shikimori: {shikimori_provider.last_error or 'нет данных (пустой ответ)'} | "
                        f"AniLibria: {anilibria_provider.last_error or 'нет данных (пустой ответ)'}"
                    )
                    print(f"[Catalog Error] Каталог пуст: {self._last_error}")
            except Exception as e:
                self._last_error = f"{type(e).__name__}: {e}"
                print(f"[Catalog Error] {self._last_error}\n{traceback.format_exc()}")
            finally:
                self._refreshing = False

    async def start_background_refresh(self):
        """
        Первичная загрузка с автоповтором (нарастающая пауза при неудаче,
        например если Shikimori временно ответил 429), затем докачка полного
        каталога и обычный цикл обновления раз в REFRESH_INTERVAL_SECONDS.
        Это единственное место, которое инициирует загрузку каталога — запросы
        от фронтенда (ensure_ready) сами больше ничего не запускают, чтобы не
        плодить параллельные попытки и не долбить Shikimori ещё сильнее при сбое.
        """
        asyncio.create_task(self._retry_until_loaded())

    async def _retry_until_loaded(self):
        delay = RETRY_MIN_DELAY
        while not self._ever_loaded.is_set():
            await self.refresh(full=False)
            if self._ever_loaded.is_set():
                break
            print(f"[Catalog] Не удалось загрузить каталог, повтор через {delay}с")
            await asyncio.sleep(delay)
            delay = min(delay * 2, RETRY_MAX_DELAY)

        await self.refresh(full=True)  # докачиваем полный каталог
        while True:
            await asyncio.sleep(REFRESH_INTERVAL_SECONDS)
            await self.refresh(full=True)

    async def ensure_ready(self):
        """
        Вызывается перед отдачей данных. Если каталог ещё не собран — просто
        коротко ждём (фоновый цикл в _retry_until_loaded уже сам этим занят)
        и отдаём что есть, вместо того чтобы держать HTTP-запрос десятки секунд
        или запускать ещё одну параллельную загрузку.
        """
        if self._ever_loaded.is_set():
            return
        try:
            await asyncio.wait_for(self._ever_loaded.wait(), timeout=FIRST_LOAD_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            pass

    # ------------------------------------------------------------------ #
    # Диагностика
    # ------------------------------------------------------------------ #
    def get_status(self) -> Dict[str, Any]:
        return {
            "catalog_ready": self._ever_loaded.is_set(),
            "refreshing": self._refreshing,
            "total_titles": len(self._catalog),
            "last_refresh": (
                datetime.fromtimestamp(self._last_refresh).isoformat() if self._last_refresh else None
            ),
            "last_error": self._last_error,
            "shikimori_last_ok": shikimori_provider.last_ok,
            "shikimori_last_error": shikimori_provider.last_error,
            "anilibria_last_ok": anilibria_provider.last_ok,
            "anilibria_last_error": anilibria_provider.last_error,
        }

    # ------------------------------------------------------------------ #
    # Чтение каталога
    # ------------------------------------------------------------------ #
    def is_ready(self) -> bool:
        return len(self._catalog) > 0

    def total_count(self) -> int:
        return len(self._catalog)

    def get_ongoings(self, limit: int = 200) -> List[Dict[str, Any]]:
        items = [a for a in self._catalog if a["status"] == "ongoing"]
        items.sort(key=lambda a: a.get("updated_at") or "", reverse=True)
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

    def get_random(self) -> Optional[Dict[str, Any]]:
        if not self._catalog:
            return None
        import random
        return random.choice(self._catalog)

    def get_recommendations(
        self, genres: List[str], exclude_ids: Optional[List[str]] = None, limit: int = 1
    ) -> List[Dict[str, Any]]:
        if not genres:
            return []
        genre_set = {g.strip().lower() for g in genres if g.strip()}
        exclude_set = set(exclude_ids or [])
        candidates = [
            a for a in self._catalog
            if a["id"] not in exclude_set
            and any((g or "").lower() in genre_set for g in a.get("genres", []))
        ]
        if not candidates:
            return []
        candidates.sort(key=lambda a: float(a.get("rating") or 0), reverse=True)
        import random
        # немного случайности среди топ-15 лучших совпадений, чтобы рекомендация не была всегда одной и той же
        pool = candidates[:15]
        random.shuffle(pool)
        return pool[:limit]

    async def get_by_id_live(self, anime_id: str) -> Optional[Dict[str, Any]]:
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
        if anime_id.startswith("ani-"):
            anime = self.get_by_id(anime_id) or await anilibria_provider.get_by_id(anime_id.replace("ani-", ""))
            code = (anime or {}).get("code", "")
            return await anilibria_provider.get_players(code, episode)

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
