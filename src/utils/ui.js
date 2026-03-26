import { t }     from '../i18n/index.js';
import { state } from '../core/state.js';

// ── TOAST ────────────────────────────────────────────────────
const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${ICONS[type] ?? 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-show'));
    setTimeout(() => {
        toast.classList.remove('toast-show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3400);
}

// ── MODAL ─────────────────────────────────────────────────────
export function openCardModal(card) {
    const modal = document.getElementById('card-modal');
    const body  = document.getElementById('modal-body');

    const qty   = card.quantity || 1;
    const total = ((card.price || 0) * qty).toFixed(2);
    const cmHref = card.cardmarketUrl
        || `https://www.cardmarket.com/es/Magic/Products/Search?searchString=${encodeURIComponent(card.name)}`;

    const folderEntry = Object.entries(state.folders)
        .find(([, cards]) => cards.some(c => c === card));
    const folderName = folderEntry ? folderEntry[0] : '—';

    const rows = [
        card.set       && [t('modal_set'),       esc(card.set)],
        card.condition && [t('modal_condition'),  esc(card.condition)],
        [t('modal_quantity'),   `<strong>${qty}</strong>`],
        [t('modal_price_unit'), card.price > 0
            ? `<strong class="text-emerald-400">${card.price.toFixed(2)} €</strong>`
            : `<span class="text-slate-400">${t('price_na')}</span>`],
        [t('modal_total'), card.price > 0
            ? `<strong class="text-emerald-400">${total} €</strong>`
            : `<span class="text-slate-400">${t('price_na')}</span>`],
        [t('modal_folder'), `<strong>${esc(folderName)}</strong>`],
    ].filter(Boolean);

    body.innerHTML = `
    <div class="flex flex-col sm:flex-row gap-5">
      <div class="flex-shrink-0 mx-auto sm:mx-0 w-44">
        ${card.imageUrl
        ? `<img src="${esc(card.imageUrl)}" alt="${esc(card.name)}"
               class="w-full rounded-xl shadow-2xl">`
        : `<div class="w-44 aspect-[2.5/3.5] bg-slate-700 rounded-xl flex items-center justify-center text-5xl opacity-20">🃏</div>`
    }
      </div>
      <div class="flex-1 flex flex-col gap-3 min-w-0">
        <div>
          <h2 class="text-xl font-extrabold leading-tight">${esc(card.name)}</h2>
          ${card.isFoil ? `<span class="foil-badge relative static ml-0 mt-1 inline-block">${t('foil_label')}</span>` : ''}
        </div>
        <table class="w-full text-sm">
          <tbody>
            ${rows.map(([label, val]) => `
              <tr class="border-b border-white/5">
                <td class="py-1.5 text-slate-400 pr-4 w-2/5">${label}</td>
                <td class="py-1.5">${val}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        <a href="${esc(cmHref)}" target="_blank" rel="noopener"
           class="mt-auto block text-center btn-primary text-sm">
          ${t('modal_view_cardmarket')} ↗
        </a>
      </div>
    </div>`;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

export function closeModal() {
    const modal = document.getElementById('card-modal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// ── HELPER ────────────────────────────────────────────────────
function esc(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
