import { state }    from './state.js';
import { t }        from './i18n.js';
import { getAllCards } from './collection.js';

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export function updateDashboard() {
    const all = getAllCards();
    const totalQty = all.reduce((s, c) => s + (c.quantity || 1), 0);
    const totalVal = all.reduce((s, c) => s + (c.price || 0) * (c.quantity || 1), 0);

    document.getElementById('dash-total-cards').textContent  = totalQty;
    document.getElementById('dash-unique-cards').textContent = all.length;
    document.getElementById('dash-total-value').textContent  = totalVal.toFixed(2) + ' €';
    document.getElementById('dash-total-decks').textContent  = state.decks.length;

    const grid = document.getElementById('folders-grid');
    grid.innerHTML = '';

    if (!Object.keys(state.folders).length) {
        grid.innerHTML = `<p class="text-slate-500 text-sm">${t('empty_create_folder')}</p>`;
        return;
    }

    Object.entries(state.folders)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([name, cards]) => {
            const qty = cards.reduce((s, c) => s + (c.quantity || 1), 0);
            const val = cards.reduce((s, c) => s + (c.price || 0) * (c.quantity || 1), 0);
            const pct = totalVal > 0 ? Math.round((val / totalVal) * 100) : 0;

            const div = document.createElement('div');
            div.className = 'glass-card p-4 hover:border-sky-400/30 transition-colors';
            div.innerHTML = `
        <div class="flex justify-between items-start mb-3">
          <span class="font-semibold">📁 ${esc(name)}</span>
          <span class="text-emerald-400 font-bold tabular-nums text-sm">${val.toFixed(2)} €</span>
        </div>
        <div class="w-full bg-white/8 rounded-full h-1.5 mb-2">
          <div class="h-1.5 rounded-full bg-sky-400 transition-all" style="width:${pct}%"></div>
        </div>
        <div class="flex justify-between text-xs text-slate-400">
          <span>${qty} ${t('total_cards').toLowerCase()}</span>
          <span>${pct}%</span>
        </div>`;
            grid.appendChild(div);
        });
}
