// ==========================================================================
// МОДУЛЬ УПРАВЛЕНИЯ ПЛЕЕРОМ И ОЗВУЧКАМИ (PLAYERS)
// ==========================================================================
import { escapeHtml } from '../utils.js';

/**
 * 🎬 Встраивание плеера в указанный контейнер
 * @param {Array} players - Список доступных объектов PlayerInfo [{provider, translation, url}]
 * @param {string} [iframeId='videoPlayer'] - ID элемента iframe или контейнера
 */
export function renderPlayer(players, iframeId = 'videoPlayer') {
  const iframe = document.getElementById(iframeId);
  const container = iframe ? iframe.parentElement : document.querySelector('.player-container');

  if (!container) {
    console.error(`[Player UI] Контейнер плеера не найден на странице.`);
    return;
  }

  // Если нет доступных источников
  if (!Array.isArray(players) || players.length === 0) {
    container.innerHTML = `
      <div class="player-placeholder empty" style="display: flex; align-items: center; justify-content: center; height: 100%; color: #a0aec0; padding: 20px; text-align: center;">
        <p>⚠️ Видео для этой серии не найдено или недоступно.</p>
      </div>
    `;
    return;
  }

  // Обновляем список озвучек/источников в селекте <select id="voiceSelect">
  setupVoiceSelect(players, (selectedUrl) => {
    mountIframe(container, selectedUrl);
  });

  // По умолчанию монтируем первый плеер
  const defaultPlayer = players[0];
  mountIframe(container, defaultPlayer.url);
}

/**
 * Вставка iframe в DOM
 */
function mountIframe(container, url) {
  if (!container) return;
  
  if (!url) {
    container.innerHTML = `
      <div class="player-placeholder empty" style="display: flex; align-items: center; justify-content: center; height: 100%; color: #a0aec0; padding: 20px; text-align: center;">
        <p>⚠️ Источник воспроизведения недоступен.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <iframe 
      id="videoPlayer"
      src="${url}" 
      width="100%" 
      height="100%" 
      frameborder="0" 
      allowfullscreen 
      allow="autoplay; fullscreen; picture-in-picture">
    </iframe>
  `;
}

/**
 * 🎙️ Связка со стандартным select озвучек в HTML
 */
function setupVoiceSelect(players, onSelect) {
  const voiceSelect = document.getElementById('voiceSelect');
  if (!voiceSelect) return;

  // Наполняем <select> доступными озвучками/плеерами
  voiceSelect.innerHTML = players.map((p, index) => {
    const label = escapeHtml(p.translation || p.provider || `Плеер ${index + 1}`);
    return `<option value="${index}">${label}</option>`;
  }).join('');

  // Навешиваем слушатель изменения выбора
  voiceSelect.onchange = (e) => {
    const selectedIndex = parseInt(e.target.value, 10);
    if (players[selectedIndex] && typeof onSelect === 'function') {
      onSelect(players[selectedIndex].url);
    }
  };
}

/**
 * 🧹 Очистить плеер (например, при закрытии или переключении карточки)
 */
export function destroyPlayer() {
  const container = document.querySelector('.player-container');
  if (container) {
    container.innerHTML = '<iframe id="videoPlayer" src="" frameborder="0" allowfullscreen></iframe>';
  }

  const voiceSelect = document.getElementById('voiceSelect');
  if (voiceSelect) {
    voiceSelect.innerHTML = '';
    voiceSelect.onchange = null;
  }
}
