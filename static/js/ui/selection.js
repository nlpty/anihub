// ==========================================================================
// ВКЛАДКА "ПОДБОРКА": счётчик тайтлов, случайное аниме, рекомендация
// ==========================================================================
import { getTitlesCount, getRandomAnime, getRecommendations, getAnimeDetails } from '../api.js?v=3';
import { userLists } from '../state.js?v=3';
import { renderAnimeCardHTML } from './home.js?v=3';
import { mergeAnimeIntoDatabase } from '../db.js?v=3';

function allSavedIds() {
  return [...new Set([
    ...(userLists.watch || []),
    ...(userLists.completed || []),
    ...(userLists.favorite || []),
    ...(userLists.unreleased || []),
    ...(userLists.optional || []),
    ...(userLists.dropped || [])
  ])].map(String);
}

async function renderTotalTitles() {
  const el = document.getElementById('siteTotalTitles');
  if (!el) return;
  const total = await getTitlesCount();
  el.innerText = total;
}

async function renderRandomAnime() {
  const box = document.getElementById('randomCard');
  if (!box) return;
  box.innerHTML = `<p style="color: #a0aec0;">Загрузка...</p>`;

  const anime = await getRandomAnime();
  if (!anime) {
    box.innerHTML = `<p style="color: #a0aec0;">Каталог ещё грузится, попробуйте чуть позже.</p>`;
    return;
  }
  mergeAnimeIntoDatabase([anime]);
  box.innerHTML = `
    <div class="grid-3" style="grid-template-columns: 1fr; max-width: 200px;">
      ${renderAnimeCardHTML(anime)}
    </div>
    <button class="btn-full-width" style="margin-top: 10px;" onclick="window.rerollRandomAnime()">🎲 Ещё раз</button>
  `;
}
window.rerollRandomAnime = renderRandomAnime;

async function renderRecommendation() {
  const box = document.getElementById('recCard');
  if (!box) return;

  const favoriteIds = (userLists.favorite || []).map(String);
  if (favoriteIds.length === 0) {
    box.innerHTML = `<p style="color: #a0aec0;">Добавьте что-нибудь в Избранное, чтобы получить рекомендацию.</p>`;
    return;
  }

  box.innerHTML = `<p style="color: #a0aec0;">Загрузка...</p>`;

  try {
    // Берём жанры из последних (до 5) избранных тайтлов
    const sampleIds = favoriteIds.slice(-5);
    const details = await Promise.all(sampleIds.map(id => getAnimeDetails(id)));
    const genreSet = new Set();
    details.forEach(a => {
      if (a && Array.isArray(a.genres)) a.genres.forEach(g => genreSet.add(g));
    });

    if (genreSet.size === 0) {
      box.innerHTML = `<p style="color: #a0aec0;">Не удалось определить жанры избранного.</p>`;
      return;
    }

    const excludeIds = allSavedIds();
    const [recommendation] = await getRecommendations(Array.from(genreSet), excludeIds, 1);

    if (!recommendation) {
      box.innerHTML = `<p style="color: #a0aec0;">Не нашлось нового похожего тайтла — вы уже посмотрели похожее :)</p>`;
      return;
    }

    mergeAnimeIntoDatabase([recommendation]);
    box.innerHTML = `
      <div class="grid-3" style="grid-template-columns: 1fr; max-width: 200px;">
        ${renderAnimeCardHTML(recommendation)}
      </div>
    `;
  } catch (err) {
    console.error('[Selection] Ошибка рекомендации:', err);
    box.innerHTML = `<p style="color: #f56565;">Не удалось загрузить рекомендацию.</p>`;
  }
}

export async function renderSelectionTab() {
  renderTotalTitles();
  renderRandomAnime();
  renderRecommendation();
}
