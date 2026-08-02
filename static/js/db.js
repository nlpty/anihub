// ==========================================================================
// БАЗА ДАННЫХ КЛИЕНТА (ТАЙТЛЫ / ОНГОИНГИ)
// ==========================================================================

export let ongoingsDatabase = [
  {
    id: "101",
    title: "Магическая битва 3 сезон",
    title_en: "Jujutsu Kaisen 3rd Season",
    title_jap: "呪術廻戦",
    episodes_released: 4,
    episodes_total: 12,
    status: "ongoing",
    poster: "https://shikimori.one/system/animes/original/51179.jpg",
    age_rating: "R-17 (17+)",
    rating: "8.6",
    release_year: "2024",
    description: "Продолжение истории Юдзи Итадори и магической битвы.",
    genres: ["Экшен", "Фэнтези", "Сёнэн"]
  },
  {
    id: "102",
    title: "Поднятие уровня в одиночку 2",
    title_en: "Solo Leveling Season 2",
    title_jap: "俺だけレベルアップな件",
    episodes_released: 8,
    episodes_total: 12,
    status: "ongoing",
    poster: "https://shikimori.one/system/animes/original/52299.jpg",
    age_rating: "PG-13 (13+)",
    rating: "8.7",
    release_year: "2025",
    description: "Сон Джин-у продолжает становиться сильнее, сражаясь в подземельях.",
    genres: ["Экшен", "Приключения", "Фэнтези"]
  },
  {
    id: "103",
    title: "Реинкарнация безработного 3",
    title_en: "Mushoku Tensei III",
    title_jap: "無職転生",
    episodes_released: 12,
    episodes_total: 12,
    status: "completed",
    poster: "https://shikimori.one/system/animes/original/39535.jpg",
    age_rating: "R-17 (17+)",
    rating: "8.8",
    release_year: "2025",
    description: "Новый этап в жизни Рудеуса Грейрата в волшебном мире.",
    genres: ["Исекай", "Драма", "Приключения"]
  }
];

/**
 * Обновление глобального массива базы данных (например, при загрузке с бэкенда)
 */
export function setAnimeDatabase(newData) {
  if (Array.isArray(newData)) {
    ongoingsDatabase = newData;
  }
}

/**
 * Добавляет/обновляет тайтлы в локальном кэше, не затирая уже загруженные ранее
 * (нужно, чтобы карточка деталей находила тайтл после любой загрузки: онгоинги,
 * обновления или результаты поиска — бэкенд не хранит свою базу).
 */
export function mergeAnimeIntoDatabase(items) {
  if (!Array.isArray(items) || items.length === 0) return;
  const byId = new Map(ongoingsDatabase.map(item => [String(item.id), item]));
  for (const item of items) {
    if (item && item.id !== undefined) {
      byId.set(String(item.id), item);
    }
  }
  ongoingsDatabase = Array.from(byId.values());
}

/**
 * Получение аниме по ID (безопасное сравнение строк)
 */
export function getAnimeById(id) {
  if (id === null || id === undefined) return null;
  const targetId = String(id).trim();
  return ongoingsDatabase.find(item => String(item.id).trim() === targetId);
}

/**
 * Получение всего списка аниме
 */
export function getAnimeList() {
  return ongoingsDatabase;
}

/**
 * Фильтр: Только активные Онгоинги (сортируются по свежести)
 */
export function getActiveOngoings() {
  return ongoingsDatabase
    .filter(anime => {
      const status = String(anime.status || '').toLowerCase();
      const isCompleted = anime.isCompleted || status === 'completed' || status === 'released';
      
      const released = anime.episodes_released ?? anime.currentEp ?? 0;
      const total = anime.episodes_total ?? anime.totalEp;
      const isMaxEp = typeof total === 'number' && total > 0 && released >= total;

      return (status === 'ongoing' || status === 'в процессе') && !isCompleted && !isMaxEp;
    })
    .sort((a, b) => {
      const dateA = new Date(a.lastUpdateDate || a.releaseDate || a.release_year || 0);
      const dateB = new Date(b.lastUpdateDate || b.releaseDate || b.release_year || 0);
      return dateB - dateA;
    });
}

/**
 * Фильтр: Основная сетка на главной (Завершённые и Анонсы)
 */
export function getMainGridAnime() {
  return ongoingsDatabase
    .filter(anime => {
      const status = String(anime.status || '').toLowerCase();
      const isCompleted = anime.isCompleted || status === 'completed' || status === 'released';
      
      const released = anime.episodes_released ?? anime.currentEp ?? 0;
      const total = anime.episodes_total ?? anime.totalEp;
      const isMaxEp = typeof total === 'number' && total > 0 && released >= total;
      
      const isAnons = status === 'anons' || status === 'unreleased';
      return isCompleted || isMaxEp || isAnons;
    })
    .sort((a, b) => {
      const dateA = new Date(a.releaseDate || a.release_year || 0);
      const dateB = new Date(b.releaseDate || b.release_year || 0);
      return dateB - dateA;
    });
}
