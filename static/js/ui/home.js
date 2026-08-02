// ==========================================================================
// ЛОГИКА ГЛАВНОЙ СТРАНИЦЫ И КАТАЛОГА ОНГОИНГОВ (Работа с REST API)
// ==========================================================================
import { userLists } from '../state.js';
import { escapeHtml } from '../utils.js';
import { mergeAnimeIntoDatabase } from '../db.js';

let currentOngoingsPage = 1;
let currentUpdatesPage = 1;

const ONGOINGS_PER_PAGE = 20;
const UPDATES_PER_PAGE = 12;
const PLACEHOLDER_IMAGE = 'https://placehold.co/300x450/1a1d24/cccccc?text=Нет+постера';

const LIST_CONFIG = {
  favorite: { emoji: '💜', color: 'rgba(189, 147, 249, 0.25)' },
  watch: { emoji: '🍿', color: 'rgba(255, 121, 198, 0.25)' },
  completed: { emoji: '✅', color: 'rgba(80, 250, 123, 0.25)' },
  unreleased: { emoji: '⏳', color: 'rgba(139, 233, 253, 0.25)' },
  optional: { emoji: '🧿', color: 'rgba(37, 99, 235, 0.25)' },
  dropped: { emoji: '🗑️', color: 'rgba(255, 85, 85, 0.25)' }
};

/**
 * Проверка, находится ли тайтл в списках пользователя
 */
function getUserListInfo(animeId) {
  for (const [type, config] of Object.entries(LIST_CONFIG)) {
    if (userLists && Array.isArray(userLists[type])) {
      const exists = userLists[type].some(id => String(id) === String(animeId));
      if (exists) return config;
    }
  }
  return null;
}

function getStatusBorderColor(status) {
  const strStatus = String(status || '').toLowerCase();
  if (strStatus.includes('anons') || strStatus.includes('unreleased') || strStatus.includes('анонс')) return '#ff5555';
  if (strStatus.includes('ongoing') || strStatus.includes('процессе') || strStatus.includes('онгоинг')) return '#bd93f9';
  return '#50fa7b';
}

/**
 * Генерация HTML-кода карточки аниме
 */
export function renderAnimeCardHTML(item) {
  if (!item) return '';
  const currentEp = item.episodes_released ?? item.currentEp ?? 0;
  const totalEp = item.episodes_total ?? item.totalEp ?? '?';
  const posterSrc = item.poster || item.cover_image || PLACEHOLDER_IMAGE;
  const borderColor = getStatusBorderColor(item.status);
  const listInfo = getUserListInfo(item.id);
  const safeTitle = escapeHtml(item.title || 'Без названия');

  let overlayHtml = '';
  if (listInfo) {
    overlayHtml = `
      <div class="card-list-overlay" style="background-color: ${listInfo.color};">
        <span class="card-list-emoji">${listInfo.emoji}</span>
      </div>
    `;
  }

  return `
    <div class="anime-card" style="border: 1px solid ${borderColor}; cursor: pointer;" onclick="window.openAnimeDetails ? window.openAnimeDetails('${item.id}') : console.log('${item.id}')">
      <div class="card-poster-container">
        <div class="ep-badge">${currentEp}/${totalEp}</div>
        <img src="${posterSrc}" alt="${safeTitle}" loading="lazy" onerror="this.onerror=null; this.src='${PLACEHOLDER_IMAGE}';">
        ${overlayHtml}
      </div>
      <p class="card-title-text" style="padding: 6px 4px; font-weight: 600; font-size: 0.9rem; text-align: center;">${safeTitle}</p>
    </div>
  `;
}

// 🏠 РЕНДЕР ГЛАВНОЙ СТРАНИЦЫ
export async function renderHomeOngoings(searchQuery = '') {
  // Универсальный поиск элемента главной сетки онгоингов
  const ongoingGrid = document.getElementById('ongoing-list') || 
                      document.getElementById('ongoingGrid') || 
                      document.querySelector('.ongoing-grid') || 
                      document.querySelector('.ongoings-container');

  // Универсальный поиск элемента сетки обновлений
  const updatesGrid = document.getElementById('updates-list') || 
                      document.getElementById('updatesGrid') || 
                      document.getElementById('mainAnimeGrid') || 
                      document.querySelector('.updates-grid');

  const homeSearchClear = document.getElementById('homeSearchClear');
  const mainHomeContent = document.getElementById('mainHomeContent');
  const homeSearchResults = document.getElementById('homeSearchResults');

  const query = searchQuery.trim();

  if (homeSearchClear) {
    homeSearchClear.style.display = query.length > 0 ? 'block' : 'none';
  }

  // 1. Поиск по API, если введён запрос
  if (query !== '') {
    if (mainHomeContent) mainHomeContent.style.display = 'none';
    if (homeSearchResults) {
      homeSearchResults.style.display = 'grid';
      homeSearchResults.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #a0aec0;">Поиск...</p>`;
      
      try {
        const res = await fetch(`/api/anime/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        const results = Array.isArray(data) ? data : (data.items || []);
        mergeAnimeIntoDatabase(results);

        if (!results || results.length === 0) {
          homeSearchResults.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #a0aec0; padding: 30px 0;">Ничего не найдено</p>`;
        } else {
          homeSearchResults.innerHTML = `
            <div style="grid-column: 1 / -1; font-weight: bold; margin-bottom: 10px; color: #e2e8f0;">
              Результаты поиска (${results.length}):
            </div>
            ${results.map(renderAnimeCardHTML).join('')}
          `;
        }
      } catch (err) {
        console.error('Ошибка при поиске:', err);
        homeSearchResults.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #f56565;">Ошибка загрузки поиска</p>`;
      }
    }
    return;
  }

  // 2. Обычный вид без поиска
  if (mainHomeContent) mainHomeContent.style.display = 'block';
  if (homeSearchResults) {
    homeSearchResults.style.display = 'none';
    homeSearchResults.innerHTML = '';
  }

  // Загружаем Онгоинги (отображаем до 6 элементов)
  if (ongoingGrid) {
    ongoingGrid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #a0aec0;">Загрузка...</p>`;
    try {
      const res = await fetch('/api/anime/ongoings');
      const rawData = await res.json();
      const ongoings = Array.isArray(rawData) ? rawData : (rawData.items || []);
      mergeAnimeIntoDatabase(ongoings);
      const topItems = ongoings.slice(0, 6);

      if (topItems.length === 0) {
        ongoingGrid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #a0aec0;">Нет активных онгоингов</p>`;
      } else {
        ongoingGrid.innerHTML = topItems.map(renderAnimeCardHTML).join('');
      }
    } catch (err) {
      console.error('Ошибка загрузки онгоингов:', err);
      ongoingGrid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #f56565;">Ошибка сети</p>`;
    }
  }

  // Загружаем Обновления
  if (updatesGrid) {
    currentUpdatesPage = 1;
    await fetchAndRenderUpdates(1);
  }
}

/**
 * Загрузка обновлений с бэкенда
 */
async function fetchAndRenderUpdates(page = 1) {
  const updatesGrid = document.getElementById('updates-list') || 
                      document.getElementById('updatesGrid') || 
                      document.getElementById('mainAnimeGrid') || 
                      document.querySelector('.updates-grid');
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (!updatesGrid) return;

  try {
    const res = await fetch(`/api/anime/updates?page=${page}&limit=${UPDATES_PER_PAGE}`);
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.items || []);
    mergeAnimeIntoDatabase(items);

    if (page === 1) {
      updatesGrid.innerHTML = items.map(renderAnimeCardHTML).join('');
    } else {
      updatesGrid.insertAdjacentHTML('beforeend', items.map(renderAnimeCardHTML).join(''));
    }

    if (loadMoreBtn) {
      loadMoreBtn.style.display = (items.length >= UPDATES_PER_PAGE) ? 'block' : 'none';
    }
  } catch (err) {
    console.error('Ошибка при загрузке обновлений:', err);
  }
}

export function handleHomeSearch(val) {
  renderHomeOngoings(val);
}

/**
 * Кнопка «Показать еще» на Главной
 */
export function loadMoreHomeUpdates() {
  currentUpdatesPage++;
  fetchAndRenderUpdates(currentUpdatesPage);
}

// 📂 ПОЛНЫЙ СПИСОК ВСЕХ ОНГОИНГОВ (Страница "Все онгоинги")
export async function openOngoingsPage() {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  const targetTab = document.getElementById('tab-ongoings');
  if (targetTab) targetTab.classList.add('active');

  currentOngoingsPage = 1;
  await loadOngoingsPageData();
}

export function closeOngoingsPage() {
  if (window.switchTab) {
    window.switchTab('home');
  }
}

async function loadOngoingsPageData(query = '') {
  const grid = document.getElementById('allOngoingsGrid') || document.querySelector('.all-ongoings-grid');
  if (!grid) return;

  grid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #a0aec0;">Загрузка онгоингов...</p>`;

  try {
    let url = '/api/anime/ongoings';
    if (query) {
      url = `/api/anime/search?q=${encodeURIComponent(query)}&type=ongoing`;
    }

    const res = await fetch(url);
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.items || []);
    mergeAnimeIntoDatabase(items);

    if (items.length === 0) {
      grid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #a0aec0; padding: 20px 0;">Ничего не найдено</p>`;
      return;
    }

    grid.innerHTML = items.map(renderAnimeCardHTML).join('');
  } catch (err) {
    console.error('Ошибка загрузки страницы онгоингов:', err);
    grid.innerHTML = `<p style="grid-column: 1 / -1; text-align: center; color: #f56565;">Ошибка загрузки</p>`;
  }
}

export function handleOngoingsSearch(query) {
  const cleanQuery = query.trim();
  const ongoingsSearchClear = document.getElementById('ongoingsSearchClear');

  if (ongoingsSearchClear) {
    ongoingsSearchClear.style.display = cleanQuery.length > 0 ? 'block' : 'none';
  }

  loadOngoingsPageData(cleanQuery);
}

// Автозапуск первичной загрузки при импорте скрипта
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => renderHomeOngoings());
} else {
  renderHomeOngoings();
}
