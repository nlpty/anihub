// ==========================================================================
// ЛОГИКА ВКЛАДКИ «КОЛЛЕКЦИИ» И ОТДЕЛЬНЫХ СПИСКОВ (COLLECTIONS)
// ==========================================================================
import { userLists, saveUserListsToStorage, setUserLists, lastWatched } from '../state.js';
import { sortAlphabetically, showToast, escapeHtml } from '../utils.js';
import { highlightNavButton, switchTab } from './navigation.js';
import { renderAnimeCardHTML } from './home.js';

let currentListType = null;

// Темы списков
const LIST_THEMES = {
  watch: { color: '#ff79c6' },
  completed: { color: '#50fa7b' },
  favorite: { color: '#bd93f9' },
  unreleased: { color: '#63b3ed' },
  optional: { color: '#2563eb' },
  dropped: { color: '#ff5555' }
};

export function getCurrentListType() {
  return currentListType;
}

/**
 * Вспомогательный рендер карточек с фолбеком
 */
function renderCard(item) {
  if (typeof renderAnimeCardHTML === 'function') {
    return renderAnimeCardHTML(item);
  }
  if (typeof window.renderAnimeCardHTML === 'function') {
    return window.renderAnimeCardHTML(item);
  }
  return '';
}

/**
 * Открытие конкретного списка
 */
export function openList(listId, titleName) {
  currentListType = listId;
  localStorage.removeItem('currentAnimeId');
  localStorage.removeItem('originTab');
  localStorage.removeItem('viewingMode');
  
  highlightNavButton('collections');

  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  const targetTab = document.getElementById('tab-single-list');
  if (targetTab) targetTab.classList.add('active');

  const titleEl = document.getElementById('currentListTitle');
  if (titleEl) {
    titleEl.innerText = titleName;
    const theme = LIST_THEMES[listId];
    titleEl.style.color = theme ? theme.color : '#ffffff';
  }

  const searchInput = document.getElementById('singleListSearchInput');
  if (searchInput) searchInput.value = '';

  const clearBtn = document.getElementById('singleListSearchClear');
  if (clearBtn) clearBtn.style.display = 'none';

  renderSingleListItems(listId);
}

/**
 * Закрытие конкретного списка и возврат к Коллекциям
 */
export function closeList() {
  currentListType = null;
  switchTab('collections');
}

/**
 * Безопасное получение базы данных (с фолбеком на пустой массив)
 */
function getDatabase() {
  return (typeof window !== 'undefined' && window.ongoingsDatabase) ? window.ongoingsDatabase : [];
}

/**
 * Отрисовка аниме внутри открытого списка
 */
export function renderSingleListItems(listId, searchQuery = '') {
  const grid = document.getElementById('singleListGrid');
  if (!grid) return;

  const clearBtn = document.getElementById('singleListSearchClear');
  if (clearBtn) {
    clearBtn.style.display = searchQuery.trim().length > 0 ? 'block' : 'none';
  }

  const animeIds = userLists[listId] || [];
  const database = getDatabase();
  
  let items = database.filter(anime => 
    animeIds.some(id => Number(id) === Number(anime.id))
  );

  const query = searchQuery.trim().toLowerCase();
  if (query !== '') {
    items = items.filter(i => 
      (i.title && i.title.toLowerCase().includes(query)) ||
      (i.titleEn && i.titleEn.toLowerCase().includes(query)) ||
      (i.titleJap && i.titleJap.toLowerCase().includes(query))
    );
  }

  items = sortAlphabetically(items);

  if (items.length === 0) {
    grid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #a0aec0; padding: 30px 0;">Ничего не найдено</p>`;
    return;
  }

  grid.innerHTML = items.map(renderCard).join('');
}

export function handleSingleListSearch(val) {
  if (currentListType) {
    renderSingleListItems(currentListType, val);
  }
}

/**
 * Сквозной поиск по всем сохранённым тайтлам во вкладке Коллекций
 */
export function handleCollectionsSearch(val) {
  const clearBtn = document.getElementById('collectionsSearchClear');
  if (clearBtn) {
    clearBtn.style.display = val.trim().length > 0 ? 'block' : 'none';
  }

  const collectionsTab = document.getElementById('tab-collections');
  if (!collectionsTab) return;

  let searchResultsContainer = document.getElementById('collectionsSearchResults');
  const mainContent = document.getElementById('mainCollectionsContent');
  const query = val.trim().toLowerCase();

  if (query === '') {
    if (searchResultsContainer) searchResultsContainer.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';
    return;
  }

  if (mainContent) mainContent.style.display = 'none';

  if (!searchResultsContainer) {
    searchResultsContainer = document.createElement('div');
    searchResultsContainer.id = 'collectionsSearchResults';
    searchResultsContainer.className = 'grid-3';
    collectionsTab.appendChild(searchResultsContainer);
  }
  searchResultsContainer.style.display = 'grid';

  const allSavedIds = [...new Set([
    ...(userLists.watch || []),
    ...(userLists.completed || []),
    ...(userLists.favorite || []),
    ...(userLists.unreleased || []),
    ...(userLists.optional || []),
    ...(userLists.dropped || [])
  ])];

  const database = getDatabase();
  let matchedItems = database.filter(i => 
    allSavedIds.some(id => Number(id) === Number(i.id)) && (
      (i.title && i.title.toLowerCase().includes(query)) ||
      (i.titleEn && i.titleEn.toLowerCase().includes(query)) ||
      (i.titleJap && i.titleJap.toLowerCase().includes(query))
    )
  );

  matchedItems = sortAlphabetically(matchedItems);

  if (matchedItems.length === 0) {
    searchResultsContainer.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #a0aec0; padding: 30px 0;">В ваших списках ничего не найдено</p>`;
    return;
  }

  searchResultsContainer.innerHTML = matchedItems.map(renderCard).join('');
}

/**
 * Обновление счётчиков списков
 */
export function updateCollectionsCounters() {
  const mainKeys = ['watch', 'completed', 'favorite', 'unreleased', 'optional', 'dropped'];
  const listColors = {
    'watch': '#ff79c6',
    'completed': '#50fa7b',
    'favorite': '#bd93f9',
    'unreleased': '#63b3ed',
    'optional': '#2563eb',
    'dropped': '#ff5555'
  };

  mainKeys.forEach(type => {
    const counterEl = document.getElementById(`count-${type}`);
    if (counterEl) {
      counterEl.innerText = (userLists[type] || []).length;
      if (listColors[type]) {
        counterEl.style.color = listColors[type];
      }
    }
  });

  updateTotalSiteTitlesCounter();
  updateLastWatchedUI();
}

/**
 * Обновление виджета «Последнее просмотренное»
 */
export function updateLastWatchedUI() {
  const infoEl = document.getElementById('lastWatchedInfo');
  if (!infoEl) return;

  if (lastWatched && lastWatched.title) {
    const safeTitle = escapeHtml(lastWatched.title);
    const safeEp = escapeHtml(String(lastWatched.episode || 0));
    const safeId = escapeHtml(String(lastWatched.id));

    infoEl.innerHTML = `
      <div style="cursor: pointer;" onclick="openAnimeDetails('${safeId}')">
        <span style="color: #66fcf1; font-weight: bold;">${safeTitle}</span> — 
        <span style="color: #45a29e;">${safeEp} серия</span>
      </div>
    `;
  } else {
    infoEl.innerText = "История просмотра пуста";
  }
}

/**
 * Обновляет счетчик всех аниме на сайте
 */
export function updateTotalSiteTitlesCounter() {
  const counterEls = document.querySelectorAll('#siteTotalTitles, #site-total-titles-count, .site-total-titles-count');
  if (!counterEls || counterEls.length === 0) return;

  const database = getDatabase();
  if (Array.isArray(database)) {
    const validTitles = database.filter(item => {
      const rating = item.rating ? String(item.rating).toLowerCase() : '';
      return rating !== 'rx';
    });
    counterEls.forEach(el => {
      el.innerText = validTitles.length;
    });
  }
}

export function exportUserDataJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userLists, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `anime_lists_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("Файл экспортирован!");
}

export function importUserDataJSON(event) {
  const fileReader = new FileReader();
  if (event && event.target && event.target.files && event.target.files[0]) {
    fileReader.readAsText(event.target.files[0], "UTF-8");
    fileReader.onload = (e) => {
      try {
        const parsedData = JSON.parse(e.target.result);
        if (typeof parsedData === 'object' && parsedData !== null) {
          setUserLists(parsedData);
          saveUserListsToStorage();
          updateCollectionsCounters();
          showToast("Списки успешно импортированы!");
          
          if (currentListType) {
            renderSingleListItems(currentListType);
          }
        } else {
          alert("Неверный формат файла!");
        }
      } catch (error) {
        alert("Ошибка при чтении JSON файла!");
        console.error(error);
      }
    };
  }
}
