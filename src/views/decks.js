import { state }           from '../core/state.js';
import { t }               from '../i18n/index.js';
import { saveDeck, deleteDeck } from '../core/storage.js';
import { showToast }       from '../utils/ui.js';
import { openDeckBuilder } from './deckbuilder.js';

const esc = s => String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// Compatibilidad formato antiguo (cards) y nuevo (mainboard)
function getDeckCards(deck) {
    return deck.mainboard ?? deck.cards ?? [];
}

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
                <button id="empty-new-deck-btn" class="btn-primary mt-5 px-6 py-2">
                    + ${t('new_deck')}
                </button>
            </div>`;
        document.getElementById('empty-new-deck-btn')
            ?.addEventListener('click', createBlankDeckAndOpen);
        return;
    }

    toRender.forEach(deck => {
        const realIdx   = state.decks.indexOf(deck);
        const cards     = getDeckCards(deck);
        const cardCount = cards.reduce((s, c) => s + (c.quantity || 1), 0);
        const deckValue = cards.reduce((s, c) => s + (c.price || 0) * (c.quantity || 1), 0);
        const cmdCount  = deck.commander ? 1 : 0;

        let hostname = '';
        try { hostname = deck.url ? new URL(deck.url).hostname : ''; } catch { hostname = deck.url ?? ''; }

        const mainCount  = (deck.mainboard ?? deck.cards ?? []).reduce((s, c) => s + (c.quantity || 1), 0);
        const isCommFmt  = ['commander','duel','brawl','oathbreaker'].includes(deck.format);
        const minCards   = isCommFmt ? 100 : 60;
        const isValid    = mainCount >= minCards && (!isCommFmt || deck.commander);

        const el = document.createElement('div');
        el.className = 'deck-card';
        el.innerHTML = `
            <div class="flex items-start justify-between gap-2 mb-2">
                <h3 class="font-bold text-base leading-snug">${esc(deck.name)}</h3>
                <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full
                             bg-violet-400/15 text-violet-400 border border-violet-400/25 flex-shrink-0">
                    ${esc(deck.format)}
                </span>
            </div>

            <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400 mb-3">
                <span>🃏 <strong class="text-white">${cardCount + cmdCount}</strong> ${t('deck_cards')}</span>
                ${deckValue > 0
            ? `<span>💰 <strong class="text-emerald-400 tabular-nums">${deckValue.toFixed(2)} €</strong></span>`
            : ''}
                ${deck.commander
            ? `<span class="text-yellow-400 text-xs">⭐ ${esc(deck.commander.name)}</span>`
            : ''}
                <span class="${isValid ? 'text-emerald-400' : 'text-red-400'} text-xs font-semibold">
                    ${isValid ? '✓ Válido' : `✗ ${mainCount}/${minCards}`}
                </span>
            </div>

            ${hostname
            ? `<a href="${esc(deck.url)}" target="_blank" rel="noopener"
                       class="text-sky-400 hover:underline text-xs truncate block mb-3"
                       onclick="event.stopPropagation()">🔗 ${esc(hostname)}</a>`
            : ''}

            <div class="flex gap-2 mt-auto">
                <button class="btn-build flex-1 btn-primary text-sm py-2">
                    🔨 ${t('build_deck')}
                </button>
                <button class="btn-delete py-2 px-3 rounded-lg text-sm font-semibold
                               bg-red-400/10 text-red-400 border border-red-400/20
                               hover:bg-red-400/25 transition-colors flex-shrink-0">
                    🗑️
                </button>
            </div>`;

        el.querySelector('.btn-build').addEventListener('click', e => {
            e.stopPropagation();
            openDeckBuilder(realIdx);
        });

        el.querySelector('.btn-delete').addEventListener('click', async e => {
            e.stopPropagation();
            if (!confirm(t('confirm_delete_deck', { name: deck.name }))) return;
            try {
                await deleteDeck(deck._dbId ?? deck.id);
            } catch (err) {
                console.error('[MTGVault] Error eliminando mazo:', err);
                showToast('❌ Error al eliminar el mazo', 'error');
                return;
            }
            state.decks = state.decks.filter(d => d !== deck);
            renderDecks();
            showToast(t('toast_deck_deleted'), 'info');
        });

        grid.appendChild(el);
    });
}

// ── CREAR MAZO ────────────────────────────────────────────────

export async function addDeck(url, name, format) {
    if (!name?.trim()) { showToast(t('toast_name_required'), 'warning'); return -1; }

    const newDeck = {
        name:      name.trim(),
        format:    format || 'modern',
        url:       url?.trim() || '',
        mainboard: [],
        sideboard: [],
        commander: null,
        companion: null,
        notes:     '',
        createdAt: new Date().toISOString(),
    };

    try {
        const dbId    = await saveDeck(newDeck);
        newDeck._dbId = dbId;
        newDeck.id    = dbId;
    } catch (err) {
        console.error('[MTGVault] Error guardando mazo:', err);
        showToast('❌ Error al crear el mazo', 'error');
        return -1;
    }

    state.decks.push(newDeck);
    renderDecks();
    showToast(t('toast_deck_added', { name: newDeck.name }), 'success');
    return state.decks.length - 1;
}

export async function createBlankDeckAndOpen() {
    const name = prompt(t('new_deck_name_prompt'), t('new_deck_default_name'));
    if (!name?.trim()) return;

    const format = prompt(
        `${t('new_deck_format_prompt')}\n(standard, pioneer, modern, legacy, pauper, commander, brawl…)`,
        'modern'
    )?.toLowerCase().trim() || 'modern';

    const idx = await addDeck('', name.trim(), format);
    if (idx >= 0) openDeckBuilder(idx);
}