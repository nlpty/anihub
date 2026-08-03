"""
Провайдер AniLibria — ВРЕМЕННО ОТКЛЮЧЁН.

Старый API (api.anilibria.tv/v3) закрыт сервисом (отвечает 410 Gone) — проект
переехал под названием AniLiberty на новый домен с новой структурой API,
которая на момент правки отдаёт документацию только через защиту от ботов,
и я не могу надёжно проверить её форму, не рискуя снова сломать интеграцию
непроверенными полями.

Чтобы не засорять /api/health и не тратить время на заведомо мёртвые запросы,
все методы ниже сразу возвращают пустой результат с понятным last_error.
Как только форма нового API будет подтверждена — тут поменяется только
BASE_URL и разбор ответа (_to_unified), остальной код (manager.py) трогать
не придётся.
"""
from typing import List, Dict, Any, Optional

DISABLED_REASON = (
    "AniLibria сменила API на AniLiberty (новый домен), старый API закрыт (410 Gone). "
    "Интеграция временно отключена, пока не проверена новая схема ответа."
)


class AnilibriaProvider:
    def __init__(self):
        self.last_error: Optional[str] = DISABLED_REASON
        self.last_ok: bool = False

    async def get_updates(self, limit: int = 30) -> List[Dict[str, Any]]:
        return []

    async def search_by_title(self, title: str) -> Optional[Dict[str, Any]]:
        return None

    async def get_by_id(self, anilibria_id: str) -> Optional[Dict[str, Any]]:
        return None

    async def get_players(self, code: str, episode: int = 1) -> List[Dict[str, Any]]:
        return []

    async def close(self):
        pass


anilibria_provider = AnilibriaProvider()
