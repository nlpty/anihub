"""Общий Response-класс с явной кодировкой UTF-8 для JSON-ответов."""
import json
from fastapi.responses import Response


class UTF8JSONResponse(Response):
    """
    JSON-ответ с явно указанной кодировкой UTF-8 в заголовке Content-Type.
    Без этого некоторые браузеры (например мобильный Safari при просмотре
    сырого JSON, как на /api/health) неверно угадывают кодировку и показывают
    кириллицу кракозябрами — хотя на работу самого сайта (fetch + .json())
    это не влияет, там кодировка всегда читается верно.
    """
    media_type = "application/json"

    def render(self, content) -> bytes:
        return json.dumps(content, ensure_ascii=False).encode("utf-8")

    def init_headers(self, headers=None):
        super().init_headers(headers)
        self.headers["content-type"] = "application/json; charset=utf-8"
