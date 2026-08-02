// ==========================================================================
// НАВИГАЦИЯ И УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ (NAVIGATION)
// ==========================================================================

/**
 * Переключение основных вкладок приложения
 */
export function switchTab(tabId, btnElement = null) {
  if (!tabId) return;

  const currentActiveTab = localStorage.getItem('activeTab');
  const homeTabEl = document.getElementById('tab-home');

  // Если нажали на Главную, когда УЖЕ находимся на Главной — сбрасываем поиск
  if (tabId === 'home') {
    if (currentActiveTab === 'home' || !homeTabEl || homeTabEl.classList.contains('active')) {
      const homeSearchInput = document.getElementById('homeSearchInput');
      if (homeSearchInput) {
        homeSearchInput.value = '';
      }
      if (typeof window.handleHomeSearch === 'function') {
        window.handleHomeSearch('');
      }
    }
  }

  // Скрываем все страницы вкладок
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Отображаем целевую вкладку
  const targetTab = document.getElementById(`tab-${tabId}`) || document.getElementById(`${tabId}-page`);
  if (targetTab) {
    targetTab.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Обновляем подсветку кнопок в нижней панели
  highlightNavButton(tabId, btnElement);

  localStorage.setItem('activeTab', tabId);
  localStorage.setItem('viewingMode', 'tab');
}

/**
 * Подсветка активной кнопки нижней навигации
 */
export function highlightNavButton(tabId, btnElement = null) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  if (btnElement) {
    btnElement.classList.add('active');
    return;
  }

  if (!tabId) return;

  const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`) || 
                    document.getElementById(`nav-${tabId}`) ||
                    document.querySelector(`.nav-btn[onclick*="${tabId}"]`);

  if (activeBtn) {
    activeBtn.classList.add('active');
  }
}

/**
 * Раскрытие / сворачивание элементов (аккордеонов)
 */
export function toggleExpand(targetId, btn) {
  const target = document.getElementById(targetId);
  if (!target || !btn) return;

  const isHidden = target.classList.toggle('hidden');
  const arrow = btn.querySelector('.accordion-arrow, .arrow, span:last-child');
  if (arrow) {
    arrow.textContent = isHidden ? '▼' : '▲';
  }
}

/**
 * Сохранение выбора озвучки
 */
export function changeVoiceover(e) {
  const selectedVoiceover = (e && typeof e === 'object' && e.target) ? e.target.value : e;
  if (selectedVoiceover && typeof selectedVoiceover === 'string') {
    localStorage.setItem('preferredVoiceover', selectedVoiceover);
  }
}

/**
 * Сохранение выбора плеера
 */
export function changePlayer(e) {
  const selectedPlayer = (e && typeof e === 'object' && e.target) ? e.target.value : e;
  if (selectedPlayer && typeof selectedPlayer === 'string') {
    localStorage.setItem('preferredPlayer', selectedPlayer);
  }
}
