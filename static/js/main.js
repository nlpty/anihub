// ==========================================================================
// ГЛАВНЫЙ МОДУЛЬ И ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ==========================================================================
import { 
  renderHomeOngoings, 
  handleHomeSearch, 
  openOngoingsPage, 
  closeOngoingsPage, 
  handleOngoingsSearch, 
  loadMoreHomeUpdates 
} from './ui/home.js?v=3';

import { 
  openAnimeDetails, 
  closeAnimeDetails,
  renderAnimeDetailsContent, 
  setAnimeStatus as setAnimeStatusRaw, 
  resetEpisodeCount,
  changeEpisodeCount, 
  promptEpisodeChange, 
  completeAnimeCard 
} from './ui/details.js?v=3';

import { 
  openList, 
  closeList, 
  handleSingleListSearch, 
  handleCollectionsSearch, 
  updateCollectionsCounters, 
  exportUserDataJSON, 
  importUserDataJSON 
} from './ui/collections.js?v=3';

import { 
  highlightNavButton, 
  toggleExpand, 
  changeVoiceover, 
  changePlayer 
} from './ui/navigation.js?v=3';

import { copyToClipboard } from './utils.js?v=3';
import { renderSelectionTab } from './ui/selection.js?v=3';

// --- ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---
window.switchTab = function(tabName, el) {
  localStorage.removeItem('currentAnimeId');

  const searchInputIds = [
    'homeSearchInput', 
    'collectionsSearchInput', 
    'ongoingsSearchInput', 
    'singleListSearchInput'
  ];
  searchInputIds.forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });

  const homeMain = document.getElementById('mainHomeContent');
  const homeResults = document.getElementById('homeSearchResults');
  if (homeMain) homeMain.style.display = 'block';
  if (homeResults) { homeResults.style.display = 'none'; homeResults.innerHTML = ''; }

  const collMain = document.getElementById('mainCollectionsContent');
  const collResults = document.getElementById('collectionsSearchResults');
  const collCount = document.getElementById('collectionsSearchCount');
  if (collMain) collMain.style.display = 'block';
  if (collResults) { collResults.style.display = 'none'; collResults.innerHTML = ''; }
  if (collCount) { collCount.style.display = 'none'; collCount.innerHTML = ''; }

  const singleListTab = document.getElementById('tab-single-list');
  if (singleListTab) singleListTab.classList.remove('active');

  const ongoingsTab = document.getElementById('tab-ongoings');
  if (ongoingsTab) ongoingsTab.classList.remove('active');

  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) targetTab.classList.add('active');

  const detailsPage = document.getElementById('anime-details-page');
  if (detailsPage) detailsPage.classList.remove('active');

  highlightNavButton(tabName, el);

  localStorage.setItem('activeTab', tabName);
  localStorage.setItem('viewingMode', 'tab');
  window.scrollTo({ top: 0, behavior: 'instant' });

  if (tabName === 'selection') {
    renderSelectionTab();
  }
};

// --- ОЧИСТКА ПОИСКА ---
window.clearSearchInput = function(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.value = '';
  
  const clearBtnId = inputId.replace('Input', 'Clear');
  const clearBtn = document.getElementById(clearBtnId);
  if (clearBtn) clearBtn.style.display = 'none';

  if (inputId === 'homeSearchInput') {
    const main = document.getElementById('mainHomeContent');
    const results = document.getElementById('homeSearchResults');
    if (main) main.style.display = 'block';
    if (results) { results.style.display = 'none'; results.innerHTML = ''; }
    handleHomeSearch('');
  } 
  else if (inputId === 'collectionsSearchInput') {
    handleCollectionsSearch('');
  } 
  else if (inputId === 'ongoingsSearchInput') {
    handleOngoingsSearch('');
  } 
  else if (inputId === 'singleListSearchInput') {
    handleSingleListSearch('');
  }
};

// --- ИЗМЕНЕНИЕ СТАТУСА (СПИСКИ) ---
window.setAnimeStatus = async function(status, animeId) {
  const targetId = animeId || localStorage.getItem('currentAnimeId');
  if (setAnimeStatusRaw) {
    await setAnimeStatusRaw(status, targetId);
  }

  await renderHomeOngoings();
  if (updateCollectionsCounters) updateCollectionsCounters();
};

// --- ЭКСПОРТ ФУНКЦИЙ В WINDOW ДЛЯ INLINE HTML-ХЕНДЛЕРОВ ---
window.openAnimeDetails = openAnimeDetails;
window.closeAnimeDetails = closeAnimeDetails;
window.handleHomeSearch = handleHomeSearch;
window.openOngoingsPage = openOngoingsPage;
window.closeOngoingsPage = closeOngoingsPage;
window.handleOngoingsSearch = handleOngoingsSearch;
window.loadMoreHomeUpdates = loadMoreHomeUpdates;
window.openList = openList;
window.closeList = closeList;
window.handleSingleListSearch = handleSingleListSearch;
window.handleCollectionsSearch = handleCollectionsSearch;
window.resetEpisodeCount = resetEpisodeCount;
window.changeEpisodeCount = changeEpisodeCount;
window.promptEpisodeChange = promptEpisodeChange;
window.completeAnimeCard = completeAnimeCard;
window.toggleExpand = toggleExpand;
window.changeVoiceover = changeVoiceover;
window.changePlayer = changePlayer;
window.exportUserDataJSON = exportUserDataJSON;
window.importUserDataJSON = importUserDataJSON;

// --- ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ ---
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const viewingMode = localStorage.getItem('viewingMode');
    const savedAnimeId = localStorage.getItem('currentAnimeId');
    const activeTab = localStorage.getItem('activeTab') || 'home';

    // 1. Активируем вкладку
    if (window.switchTab) {
      window.switchTab(activeTab);
    }

    // 2. Первичный рендер данных с асинхронным ожиданием
    await renderHomeOngoings();

    if (typeof updateCollectionsCounters === 'function') updateCollectionsCounters();

    // 3. Если пользователь перезагрузил страницу внутри карточки аниме
    if (viewingMode === 'card' && savedAnimeId && typeof openAnimeDetails === 'function') {
      openAnimeDetails(savedAnimeId);
    }

    setupTitleCopyListeners();
  } catch (err) {
    console.error('[App Init Error] Ошибка инициализации приложения:', err);
  }
});

/**
 * Настройка клика по названиям для копирования в буфер обмена
 */
function setupTitleCopyListeners() {
  const ruTitle = document.getElementById('detailTitleRu');
  const enTitle = document.getElementById('detailTitleEn');
  const japTitle = document.getElementById('detailTitleJap');

  [ruTitle, enTitle, japTitle].forEach(el => {
    if (!el) return;
    el.style.cursor = 'pointer';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const textToCopy = el.innerText.trim();
      if (textToCopy && textToCopy !== '???') {
        if (typeof copyToClipboard === 'function') {
          copyToClipboard(textToCopy);
        }
      }
    });
  });
}
