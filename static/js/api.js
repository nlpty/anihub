// ==========================================================================
// МОДУЛЬ ВЗАИМОДЕЙСТВИЯ С BACKEND API (FastAPI)
// ==========================================================================

async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Ошибка сервера: ${response.status}`);
  }
  return await response.json();
}

/** Онгоинги для верхнего блока главной страницы */
export async function getOngoings() {
  try {
    const response = await fetch('/api/anime/ongoings');
    const data = await handleResponse(response);
    return Array.isArray(data) ? data : (data.items || []);
  } catch (error) {
    console.error('[API Error] Ошибка загрузки онгоингов:', error);
    return [];
  }
}

/** Завершённые тайтлы и анонсы для нижнего блока главной страницы */
export async function getAnimeUpdates(page = 1, limit = 12) {
  try {
    const response = await fetch(`/api/anime/updates?page=${page}&limit=${limit}`);
    const data = await handleResponse(response);
    if (Array.isArray(data)) {
      return { items: data, total: data.length, page, limit };
    }
    return {
      items: data.items || [],
      total: data.total || (data.items ? data.items.length : 0),
      page: data.page || page,
      limit: data.limit || limit
    };
  } catch (error) {
    console.error('[API Error] Ошибка загрузки обновлений:', error);
    return { items: [], total: 0, page: 1, limit };
  }
}

/** Поиск по всему каталогу (Shikimori + AniLibria, без дублей) */
export async function searchAnime(query, type = null) {
  if (!query || !query.trim()) return [];
  try {
    const typeParam = type ? `&type=${encodeURIComponent(type)}` : '';
    const url = `/api/anime/search?q=${encodeURIComponent(query)}${typeParam}`;
    const response = await fetch(url);
    const data = await handleResponse(response);
    return Array.isArray(data) ? data : (data.items || []);
  } catch (error) {
    console.error('[API Error] Ошибка поиска:', error);
    return [];
  }
}

/** Детальная информация об аниме по ID */
export async function getAnimeDetails(animeId) {
  try {
    const response = await fetch(`/api/anime/${animeId}`);
    return await handleResponse(response);
  } catch (error) {
    console.error(`[API Error] Ошибка загрузки аниме ${animeId}:`, error);
    return null;
  }
}

/** Доступные плееры/озвучки для конкретной серии */
export async function getAnimePlayers(animeId, episode = 1) {
  try {
    const response = await fetch(`/api/anime/${animeId}/players?episode=${episode}`);
    const data = await handleResponse(response);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`[API Error] Ошибка получения плееров для ${animeId}:`, error);
    return [];
  }
}

/** Случайный тайтл из каталога */
export async function getRandomAnime() {
  try {
    const response = await fetch('/api/anime/random/pick');
    const data = await handleResponse(response);
    return (data && data.id) ? data : null;
  } catch (error) {
    console.error('[API Error] Ошибка получения случайного аниме:', error);
    return null;
  }
}

/** Рекомендация по жанрам (genres — массив строк, excludeIds — массив id) */
export async function getRecommendations(genres = [], excludeIds = [], limit = 1) {
  if (!genres || genres.length === 0) return [];
  try {
    const params = new URLSearchParams({
      genres: genres.join(','),
      exclude: excludeIds.join(','),
      limit: String(limit)
    });
    const response = await fetch(`/api/anime/recommendations/by-genres?${params}`);
    const data = await handleResponse(response);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[API Error] Ошибка получения рекомендаций:', error);
    return [];
  }
}

/** Общее количество тайтлов в каталоге */
export async function getTitlesCount() {
  try {
    const response = await fetch('/api/titles/count');
    const data = await handleResponse(response);
    return data.total || 0;
  } catch (error) {
    console.error('[API Error] Ошибка получения количества тайтлов:', error);
    return 0;
  }
}
