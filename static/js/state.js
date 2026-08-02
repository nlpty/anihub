// ==========================================================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ ПРИЛОЖЕНИЯ И LOCALSTORAGE
// ==========================================================================

// Пользовательские списки
export let userLists = {
  watch: [],
  completed: [],
  favorite: [],
  unreleased: [],
  optional: [],
  dropped: []
};

// Прогресс по сериям: { [animeId]: episodeCount }
export let watchedEpisodes = {};

// Информация о последнем просмотренном аниме
export let lastWatched = null;

// --- ИНИЦИАЛИЗАЦИЯ И ЗАГРУЗКА ИЗ LOCALSTORAGE ---

function loadInitialState() {
  const savedUserLists = localStorage.getItem('userLists');
  if (savedUserLists) {
    try {
      const parsed = JSON.parse(savedUserLists);
      // Приводим все ID к строкам для гарантированной совместимости
      Object.keys(userLists).forEach(key => {
        if (Array.isArray(parsed[key])) {
          userLists[key] = parsed[key].map(id => String(id));
        }
      });
    } catch (e) {
      console.error("Ошибка при загрузке списков из LocalStorage:", e);
    }
  }

  const savedEpisodes = localStorage.getItem('watchedEpisodes');
  if (savedEpisodes) {
    try {
      watchedEpisodes = JSON.parse(savedEpisodes);
    } catch (e) {
      console.error("Ошибка при загрузке прогресса серий из LocalStorage:", e);
    }
  }

  const savedLastWatched = localStorage.getItem('lastWatched');
  if (savedLastWatched) {
    try {
      lastWatched = JSON.parse(savedLastWatched);
    } catch (e) {
      console.error("Ошибка при загрузке последнего просмотренного:", e);
    }
  }
}

// Запускаем инициализацию
loadInitialState();

// --- ФУНКЦИИ СОХРАНЕНИЯ В LOCALSTORAGE ---

export function saveUserListsToStorage() {
  localStorage.setItem('userLists', JSON.stringify(userLists));
}

export function saveWatchedEpisodesToStorage() {
  localStorage.setItem('watchedEpisodes', JSON.stringify(watchedEpisodes));
}

export function saveLastWatchedToStorage() {
  localStorage.setItem('lastWatched', JSON.stringify(lastWatched));
}

// --- ВСПОМОГАТЕЛЬНЫЕ МУТАЦИИ И ХЕЛПЕРЫ ---

/**
 * Получить текущий статус аниме в списках пользователя
 */
export function getAnimeStatus(animeId) {
  if (!animeId) return null;
  const strId = String(animeId);
  for (const [status, list] of Object.entries(userLists)) {
    if (Array.isArray(list) && list.includes(strId)) {
      return status;
    }
  }
  return null;
}

/**
 * Установить или сбросить статус аниме (автоматически удаляет из остальных списков)
 */
export function setAnimeStatus(animeId, targetStatus) {
  if (!animeId) return null;
  const strId = String(animeId);
  const currentStatus = getAnimeStatus(strId);

  // Сначала удаляем из всех списков
  Object.keys(userLists).forEach(key => {
    userLists[key] = userLists[key].filter(id => String(id) !== strId);
  });

  // Если нажали на уже активный статус — снимаем выбор (переключатель)
  let newStatus = null;
  if (currentStatus !== targetStatus && userLists[targetStatus]) {
    userLists[targetStatus].push(strId);
    newStatus = targetStatus;
  }

  saveUserListsToStorage();
  return newStatus;
}

/**
 * Обновить количество просмотренных серий для тайтла
 */
export function updateWatchedEpisode(animeId, episode, animeTitle = "") {
  if (!animeId) return;
  const strId = String(animeId);
  const epNum = Math.max(0, parseInt(episode, 10) || 0);

  if (epNum > 0) {
    watchedEpisodes[strId] = epNum;
    setLastWatched({
      id: strId,
      title: animeTitle,
      episode: epNum,
      updatedAt: new Date().toISOString()
    });
  } else {
    delete watchedEpisodes[strId];
  }

  saveWatchedEpisodesToStorage();
}

/**
 * Полное обновление списков (например, при импорте JSON)
 */
export function setUserLists(newList) {
  if (newList && typeof newList === 'object') {
    Object.keys(userLists).forEach(key => {
      if (Array.isArray(newList[key])) {
        userLists[key] = newList[key].map(id => String(id));
      }
    });
    saveUserListsToStorage();
  }
}

export function setWatchedEpisodes(newEpisodes) {
  if (newEpisodes && typeof newEpisodes === 'object') {
    watchedEpisodes = { ...newEpisodes };
    saveWatchedEpisodesToStorage();
  }
}

export function setLastWatched(data) {
  lastWatched = data;
  saveLastWatchedToStorage();
}
