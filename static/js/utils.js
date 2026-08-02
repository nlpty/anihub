// ==========================================================================
// ВСПОМОГАТЕЛЬНЫЕ УТИЛИТЫ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (UTILS)
// ==========================================================================

/**
 * Задержка выполнения (Debounce) для поисковых полей
 */
export function debounce(func, delay = 300) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Безопасное экранирование HTML-строк (защита от XSS)
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Сортировка массива объектов аниме по алфавиту (русское название)
 */
export function sortAlphabetically(items) {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const titleA = a.title || a.title_ru || '';
    const titleB = b.title || b.title_ru || '';
    return titleA.localeCompare(titleB, 'ru');
  });
}

/**
 * Показ всплывающего уведомления (Toast) снизу экрана
 */
export function showToast(message) {
  let toast = document.getElementById('toastNotification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastNotification';
    toast.style.cssText = "position: fixed; bottom: 75px; left: 50%; transform: translateX(-50%); background: rgba(15, 23, 42, 0.95); color: #fff; padding: 10px 20px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; z-index: 10000; opacity: 0; transition: opacity 0.3s ease, transform 0.3s ease; pointer-events: none; border: 1px solid rgba(102, 252, 241, 0.3); box-shadow: 0 4px 15px rgba(0,0,0,0.5); backdrop-filter: blur(10px);";
    document.body.appendChild(toast);
  }

  toast.innerText = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(-5px)';

  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  }, 1600);
}

/**
 * Копирование текста в буфер обмена
 */
export function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(() => showToast("Скопировано в буфер!"))
      .catch(() => showToast("Ошибка копирования"));
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast("Скопировано!");
    } catch (err) {
      showToast("Не удалось скопировать");
    }
    document.body.removeChild(textArea);
  }
}

/**
 * Очистка поля ввода поиска
 */
export function clearSearchInput(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
  }
}

/**
 * Получение эмодзи статуса списка
 */
export function getListEmoji(listKey) {
  const emojis = {
    watch: '🍿',
    completed: '✅',
    favorite: '💜',
    unreleased: '⏳',
    optional: '🧿',
    dropped: '🗑️'
  };
  return emojis[listKey] || '';
}

/**
 * Форматирование плашки серий (например, "4 / 12 эп.")
 */
export function formatEpisodeBadge(current, total) {
  if (!current && !total) return '';
  const curText = current || 0;
  const totText = total ? ` / ${total}` : '';
  return `${curText}${totText} эп.`;
}
