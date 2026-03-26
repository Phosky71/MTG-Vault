import { state }         from './state.js';
import { t }             from './i18n.js';
import { saveToStorage } from './storage.js';
import { showToast }     from './ui.js';

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export function renderDecks() {
    state.activeFormatFilter = document.getElementById('format-filter').value;
    const toRender = state.activeFormatFilter
        ? state.decks.filter(d => d.format === state.activeFormatFilter)
        : state.decks;

    const grid = document.getElementById('deck-grid');
    grid.innerHTML = '';

    if (!toRender.length) {
        grid.innerHTML = `
      <div class="empty-state">
        <div class="text-5xl mb-4">🃏</div>
        <h2 class="text-lg font-bold text-slate-400 mb-2">${t('empty_decks_title')}</h2>
        <p class="text-sm text-slate-500">${t('empty_no_decks')}</p>
      </div>`;
        return;
    }

    toRender.forEach(deck => {
        const cardCount = deck.cards.reduce((s, c) => s + (c.quantity || 1), 0);
        const deckValue = deck.cards.reduce((s, c) => s + (c.price || 0) * (c.quantity || 1), 0);
        let hostname = '';
        try { hostname = new URL(deck.url).hostname; } catch { hostname = deck.url; }

        const el = document.createElement('div');
        el.className = 'deck-card';
        el.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <h3 class="font-bold text-base leading-snug">${esc(deck.name)}</h3>
        <span class="text-[11px] font-semibold bg-sky-400/15 text-sky-400 px-2 py-0.5 rounded flex-shrink-0">
          ${esc(deck.format)}
        </span>
      </div>
      <div class="flex flex-col gap-1 text-sm text-slate-400">
        <span><strong class="text-white">${cardCount}</strong> ${t('deck_cards')}</span>
        ${deckValue > 0
            ? `<span>${t('deck_est_value')}: <strong class="text-emerald-400 tabular-nums">${deckValue.toFixed(2)} €</strong></span>`
            : ''}
        ${deck.url
            ? `<a href="${esc(deck.url)}" target="_blank" rel="noopener"
               class="text-sky-400 hover:underline text-xs truncate"
               onclick="event.stopPropagation()">🔗 ${esc(hostname)}</a>`
            : ''}
      </div>
      <div class="flex gap-2 mt-auto pt-1">
        <button class="deck-delete-btn flex-1 py-1.5 rounded-md text-xs font-semibold
                       bg-red-400/10 text-red-400 hover:bg-red-400/25 transition-colors">
          ${t('deck_delete')}
        </button>
      </div>`;

        el.querySelector('.deck-delete-btn').addEventListener('click', e => {
            e.stopPropagation();
            if (!confirm(t('confirm_delete_deck', { name: deck.name }))) return;
            state.decks = state.decks.filter(d => d.id !== deck.id);
            saveToStorage();
            renderDecks();
            showToast(t('toast_deck_deleted'), 'info');
        });
        grid.appendChild(el);
    });
}

export function addDeck(url, name, format) {
    if (!url)  { showToast(t('toast_invalid_url'),   'warning'); return false; }
    if (!name) { showToast(t('toast_name_required'),  'warning'); return false; }
    state.decks.push({
        id: Date.now(),
        name,
        format: format || 'Casual',
        url,
        cards: [],
        createdAt: new Date().toISOString()
    });
    saveToStorage();
    renderDecks();
    showToast(t('toast_deck_added', { name }), 'success');
    return true;
}
