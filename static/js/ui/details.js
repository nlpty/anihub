// ==========================================================================
// ЛОГИКА ДЕТАЛИЗАЦИИ КАРТОЧКИ АНИМЕ, СЧЕТЧИКОВ СЕРИЙ И ИНТЕГРАЦИИ ПЛЕЕРА
// ==========================================================================
import { getAnimeById } from '../db.js';
import { 
  userLists, 
  saveUserListsToStorage, 
  watchedEpisodes, 
  saveWatchedEpisodesToStorage, 
  setLastWatched 
} from '../state.js';
import { 
  updateCollectionsCounters, 
  renderSingleListItems, 
  getCurrentListType, 
  updateLastWatchedUI 
} from './collections.js';
import { highlightNavButton } from './navigation.js';
import { escapeHtml } from '../utils.js';

// Импорты плеера и API
import { getAnimePlayers } from '../api.js';
import { renderPlayer, destroyPlayer } from './player.js';

let currentAnimeId = null;
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22300%22%20height%3D%22450%22%3E%3Crect%20width%3D%22300%22%20height%3D%22450%22%20fill%3D%22%231a1d24%22/%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20fill%3D%22%238b93a3%22%20font-family%3D%22sans-serif%22%20font-size%3D%2220%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%3E%D0%9D%D0%B5%D1%82%20%D0%BF%D0%BE%D1%81%D1%82%D0%B5%D1%80%D0%B0%3C/text%3E%3C/svg%3E';

export function getCurrentAnimeId() {
  return currentAnimeId || localStorage.getItem('currentAnimeId');
}

/**
 * Вспомогательная функция синхронизации прогресса серии с хранилищем
 */
function syncEpisodeProgress(anime) {
  if (!anime) return;
  watchedEpisodes[anime.id] = anime.currentEp || 0;
  saveWatchedEpisodesToStorage();
  
  setLastWatched({
    id: anime.id,
    title: anime.title,
    episode: anime.currentEp || 0
  });
  
  updateLastWatchedUI();
}

/**
 * 🎬 Вспомогательная загрузка плеера для текущей серии
 */
async function loadEpisodePlayer(animeId, episode) {
  let playerContainer = document.querySelector('.player-container') || document.getElementById('player-container');

  if (!playerContainer) {
    const epControls = document.getElementById('detailEpControls');
    if (epControls && epControls.parentElement) {
      const playerWrapper = document.createElement('div');
      playerWrapper.id = 'player-section-wrapper';
      playerWrapper.style.marginTop = '20px';
      playerWrapper.innerHTML = `
        <div id="player-container" class="player-container" style="width: 100%; height: 400px; background: #000; border-radius: 8px; overflow: hidden;"></div>
      `;
      epControls.parentElement.appendChild(playerWrapper);
      playerContainer = document.getElementById('player-container');
    }
  }

  if (playerContainer) {
    playerContainer.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100%; color:#a0aec0;"><p>⏳ Загрузка плеера...</p></div>';
  }

  try {
    const epToFetch = episode > 0 ? episode : 1;
    const players = await getAnimePlayers(animeId, epToFetch);
    renderPlayer(players, 'videoPlayer');
  } catch (err) {
    console.error('Ошибка при загрузке плеера:', err);
  }
}

// 📂 ОТКРЫТИЕ КАРТОЧКИ АНИМЕ
export function openAnimeDetails(animeId) {
  currentAnimeId = String(animeId);
  localStorage.setItem('currentAnimeId', currentAnimeId);

  const activeTabEl = document.querySelector('.tab-content.active');
  let currentTabName = 'home';
  
  if (activeTabEl && activeTabEl.id.startsWith('tab-')) {
    currentTabName = activeTabEl.id.replace('tab-', '');
  }
  
  localStorage.setItem('originTab', currentTabName);
  localStorage.setItem('viewingMode', 'card');
  highlightNavButton(currentTabName);

  renderAnimeDetailsContent(currentAnimeId);

  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  const detailsPage = document.getElementById('anime-details-page');
  if (detailsPage) detailsPage.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ✕ ЗАКРЫТИЕ КАРТОЧКИ АНИМЕ
export function closeAnimeDetails() {
  destroyPlayer(); // Очищаем плеер при закрытии
  currentAnimeId = null;
  localStorage.removeItem('currentAnimeId');
  localStorage.setItem('viewingMode', 'tab');

  const detailsPage = document.getElementById('anime-details-page');
  if (detailsPage) detailsPage.classList.remove('active');

  const originTab = localStorage.getItem('originTab') || 'home';
  if (typeof window.switchTab === 'function') {
    window.switchTab(originTab);
  }
}

// 🎨 ОБНОВЛЕНИЕ ЦВЕТА БОКОВЫХ ПАЛОЧЕК ПОСТЕРА
function updateStatusBars(status) {
  const leftBar = document.getElementById('statusBarLeft');
  const rightBar = document.getElementById('statusBarRight');
  if (!leftBar || !rightBar) return;

  leftBar.className = 'status-indicator left-bar';
  rightBar.className = 'status-indicator right-bar';

  if (status === 'ongoing') {
    leftBar.classList.add('status-ongoing');   
    rightBar.classList.add('status-ongoing');
  } else if (status === 'anons' || status === 'unreleased') {
    leftBar.classList.add('status-anons');     
    rightBar.classList.add('status-anons');
  } else {
    leftBar.classList.add('status-completed'); 
    rightBar.classList.add('status-completed');
  }
}

// 🖼 РЕНДЕР КОНТЕНТА КАРТОЧКИ
export function renderAnimeDetailsContent(animeId) {
  if (!animeId) animeId = getCurrentAnimeId();
  currentAnimeId = String(animeId);

  const anime = getAnimeById(currentAnimeId);
  if (!anime) return;

  if (watchedEpisodes[anime.id] !== undefined) {
    anime.currentEp = watchedEpisodes[anime.id];
  }

  updateStatusBars(anime.status);

  const posterImg = document.getElementById('detailPoster');
  if (posterImg) {
    posterImg.src = anime.poster || anime.cover_image || PLACEHOLDER_IMAGE;
    posterImg.onerror = function() {
      this.onerror = null;
      this.src = PLACEHOLDER_IMAGE;
    };
  }

  const epBadge = document.getElementById('detailEpBadge');
  if (epBadge) {
    if (anime.status === 'ongoing' || anime.currentEp !== undefined) {
      const totalDisplay = anime.totalEp ? anime.totalEp : '?';
      epBadge.innerText = `${anime.currentEp || 0}/${totalDisplay}`;
      epBadge.style.display = 'block';
    } else {
      epBadge.style.display = 'none';
    }
  }

  const titleRu = document.getElementById('detailTitleRu');
  if (titleRu) titleRu.innerText = anime.title || '???';

  const titleEn = document.getElementById('detailTitleEn');
  if (titleEn) titleEn.innerText = anime.titleEn || '???';

  const titleJap = document.getElementById('detailTitleJap');
  if (titleJap) titleJap.innerText = anime.titleJap || '???';

  const desc = document.getElementById('detailDescription');
  if (desc) desc.innerText = anime.description || 'Описание отсутствует.';

  const rating = document.getElementById('detailRating');
  if (rating) rating.innerText = anime.rating || '???';

  const release = document.getElementById('detailReleaseDate');
  if (release) release.innerText = anime.releaseDate || '???';

  const ageEl = document.getElementById('detailAgeRating');
  if (ageEl) {
    ageEl.innerText = anime.age_rating || anime.ageRating || '—';
  }

  const genresBox = document.getElementById('detailGenres');
  if (genresBox) {
    if (anime.genres && anime.genres.length > 0) {
      genresBox.innerHTML = anime.genres.map(g => `<span class="tag-item">${escapeHtml(g)}</span>`).join('');
    } else {
      genresBox.innerHTML = '???';
    }
  }

  renderEpisodesControlPanel(anime);
  updateListButtonsState();

  loadEpisodePlayer(anime.id, anime.currentEp || 1);
}

// 🎛 ПАНЕЛЬ УПРАВЛЕНИЯ СЕРИЯМИ
function renderEpisodesControlPanel(anime) {
  const container = document.getElementById('detailEpControls');
  if (!container) return;

  const total = anime.totalEp || 12;

  container.innerHTML = `
    <button onclick="resetEpisodeCount('${anime.id}')" class="ep-btn-reset" title="Сбросить до 0">Сброс</button>
    <button onclick="changeEpisodeCount(-1)" class="ep-btn-step">-</button>
    <div onclick="promptEpisodeChange('${anime.id}')" class="ep-counter-text" style="cursor: pointer;" title="Нажмите, чтобы ввести вручную">
      ${anime.currentEp || 0}/${total}
    </div>
    <button onclick="changeEpisodeCount(1)" class="ep-btn-step">+</button>
    <button onclick="completeAnimeCard('${anime.id}')" class="ep-btn-finish">Завершить</button>
  `;
}

// 🔄 СБРОС СЧЕТЧИКА ДО 0
export function resetEpisodeCount(animeId) {
  const targetId = animeId || getCurrentAnimeId();
  if (!targetId) return;

  const anime = getAnimeById(targetId);
  if (!anime) return;

  anime.currentEp = 0;
  syncEpisodeProgress(anime);

  saveUserListsToStorage();
  renderAnimeDetailsContent(anime.id);

  const listType = getCurrentListType();
  if (listType) {
    renderSingleListItems(listType);
  }
}

export function changeEpisodeCount(delta) {
  const id = getCurrentAnimeId();
  if (!id) return;

  const anime = getAnimeById(id);
  if (!anime) return;

  const total = anime.totalEp || 12;
  let newEp = (anime.currentEp || 0) + delta;

  if (newEp < 0) newEp = 0;
  if (newEp > total) newEp = total;

  anime.currentEp = newEp;
  syncEpisodeProgress(anime);

  if (newEp >= total) {
    moveToCompletedAutomatically(anime.id);
  } else {
    saveUserListsToStorage();
    renderAnimeDetailsContent(anime.id);
  }
}

export function promptEpisodeChange(animeId) {
  const anime = getAnimeById(animeId);
  if (!anime) return;

  const total = anime.totalEp || 12;
  const input = prompt(`Введите количество просмотренных серий (от 0 до ${total}):`, anime.currentEp || 0);
  
  if (input !== null) {
    let parsed = parseInt(input, 10);
    if (!isNaN(parsed)) {
      if (parsed < 0) parsed = 0;
      if (parsed > total) parsed = total;

      anime.currentEp = parsed;
      syncEpisodeProgress(anime);

      if (parsed >= total) {
        moveToCompletedAutomatically(anime.id);
      } else {
        saveUserListsToStorage();
        renderAnimeDetailsContent(anime.id);
      }
    }
  }
}

export function completeAnimeCard(animeId) {
  const anime = getAnimeById(animeId);
  if (!anime) return;

  anime.currentEp = anime.totalEp || anime.currentEp || 0;
  syncEpisodeProgress(anime);
  moveToCompletedAutomatically(anime.id);
}

export function moveToCompletedAutomatically(animeId) {
  const mainStatuses = ['watch', 'completed', 'unreleased', 'optional', 'dropped'];
  
  mainStatuses.forEach(status => {
    if (userLists[status]) {
      userLists[status] = userLists[status].filter(id => String(id) !== String(animeId));
    }
  });

  if (!userLists.completed) userLists.completed = [];
  if (!userLists.completed.some(id => String(id) === String(animeId))) {
    userLists.completed.push(animeId);
  }

  saveUserListsToStorage();
  updateCollectionsCounters();
  renderAnimeDetailsContent(animeId);

  const listType = getCurrentListType();
  if (listType) {
    renderSingleListItems(listType);
  }
}

// ⭐ СМЕНА СТАТУСА И СПИСКОВ
export function setAnimeStatus(targetList, explicitAnimeId = null) {
  const targetId = explicitAnimeId || getCurrentAnimeId();
  if (!targetId) return;

  currentAnimeId = String(targetId);

  if (targetList === 'favorite') {
    if (!userLists.favorite) userLists.favorite = [];
    const index = userLists.favorite.findIndex(id => String(id) === String(targetId));
    if (index > -1) {
      userLists.favorite.splice(index, 1);
    } else {
      userLists.favorite.push(targetId);
    }
  } else {
    const mainStatuses = ['watch', 'completed', 'unreleased', 'optional', 'dropped'];
    
    if (!userLists[targetList]) userLists[targetList] = [];
    const isAlreadyInTarget = userLists[targetList].some(id => String(id) === String(targetId));

    mainStatuses.forEach(status => {
      if (userLists[status]) {
        userLists[status] = userLists[status].filter(id => String(id) !== String(targetId));
      }
    });

    if (!isAlreadyInTarget) {
      userLists[targetList].push(targetId);
    }
  }

  saveUserListsToStorage();
  updateListButtonsState();
  updateCollectionsCounters();

  const listType = getCurrentListType();
  if (listType) {
    renderSingleListItems(listType);
  }
}

// 🎨 ПОДСВЕТКА КНОПОК СТАТУСОВ
export function updateListButtonsState() {
  const activeId = getCurrentAnimeId();
  if (!activeId) return;

  const listStyles = {
    'watch': { border: '#ff79c6', bg: 'rgba(255, 121, 198, 0.35)', glow: 'rgba(255, 121, 198, 0.6)' },
    'completed': { border: '#50fa7b', bg: 'rgba(80, 250, 123, 0.35)', glow: 'rgba(80, 250, 123, 0.6)' },
    'favorite': { border: '#bd93f9', bg: 'rgba(189, 147, 249, 0.35)', glow: 'rgba(189, 147, 249, 0.6)' },
    'unreleased': { border: '#63b3ed', bg: 'rgba(99, 179, 237, 0.35)', glow: 'rgba(99, 179, 237, 0.6)' },
    'optional': { border: '#2563eb', bg: 'rgba(37, 99, 235, 0.35)', glow: 'rgba(37, 99, 235, 0.6)' },
    'dropped': { border: '#ff5555', bg: 'rgba(255, 85, 85, 0.35)', glow: 'rgba(255, 85, 85, 0.6)' }
  };

  const listTypes = ['watch', 'completed', 'favorite', 'unreleased', 'optional', 'dropped'];
  
  listTypes.forEach(type => {
    const btn = document.getElementById(`btn-${type}`);
    if (btn) {
      const isInList = userLists[type] && userLists[type].some(id => String(id) === String(activeId));
      if (isInList) {
        const style = listStyles[type];
        btn.classList.add('active');
        btn.style.setProperty('border-color', style.border, 'important');
        btn.style.setProperty('background-color', style.bg, 'important');
        btn.style.setProperty('box-shadow', `0 0 12px ${style.glow}`, 'important');
      } else {
        btn.classList.remove('active');
        btn.style.borderColor = 'transparent';
        btn.style.backgroundColor = 'transparent';
        btn.style.boxShadow = 'none';
      }
    }
  });
}
