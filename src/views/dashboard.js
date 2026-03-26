import { Chart, registerables } from 'chart.js';
import { state }                from '../core/state.js';
import { t }                    from '../i18n/index.js';
import { savePriceSnapshot, getPriceHistory } from '../core/storage.js';

// ── Chart.js setup ────────────────────────────────────────────
Chart.register(...registerables);
Chart.defaults.color             = '#94a3b8';
Chart.defaults.borderColor       = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family       = 'Inter, sans-serif';
Chart.defaults.font.size         = 11;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,0.92)';
Chart.defaults.plugins.tooltip.borderColor     = 'rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth     = 1;
Chart.defaults.plugins.tooltip.padding         = 10;
Chart.defaults.plugins.legend.labels.boxWidth  = 12;
Chart.defaults.plugins.legend.labels.padding   = 14;

// ── Paletas de color ──────────────────────────────────────────
const MTG_PALETTE = {
    W:     { bg: 'rgba(248,250,252,0.75)', border: '#f8fafc', label: '☀️ Blanco'    },
    U:     { bg: 'rgba(56,189,248,0.75)',  border: '#38bdf8', label: '💧 Azul'       },
    B:     { bg: 'rgba(139,92,246,0.75)',  border: '#8b5cf6', label: '💀 Negro'      },
    R:     { bg: 'rgba(248,113,113,0.75)', border: '#f87171', label: '🔥 Rojo'       },
    G:     { bg: 'rgba(74,222,128,0.75)',  border: '#4ade80', label: '🌲 Verde'      },
    C:     { bg: 'rgba(148,163,184,0.6)',  border: '#94a3b8', label: '💎 Incoloro'   },
    Multi: { bg: 'rgba(251,191,36,0.75)',  border: '#fbbf24', label: '🌈 Multicolor' },
};

const RARITY_PALETTE = {
    common:   { bg: 'rgba(148,163,184,0.65)', border: '#94a3b8', label: 'Common'   },
    uncommon: { bg: 'rgba(56,189,248,0.65)',  border: '#38bdf8', label: 'Uncommon' },
    rare:     { bg: 'rgba(251,191,36,0.65)',  border: '#fbbf24', label: 'Rare'     },
    mythic:   { bg: 'rgba(249,115,22,0.75)',  border: '#f97316', label: 'Mythic'   },
};

const GRID_COLOR  = 'rgba(255,255,255,0.05)';
const TICK_COLOR  = '#64748b';
const LABEL_COLOR = '#cbd5e1';

// ── Instancias de charts (para cleanup) ───────────────────────
const _charts = {};

function destroyChart(id) {
    if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
}

// ── Helpers ───────────────────────────────────────────────────
function getAllCards() {
    return Object.values(state.folders).flat();
}

function truncate(str, n) {
    return str.length > n ? str.slice(0, n) + '…' : str;
}

function getColorKey(card) {
    const col = (card.colors || '').toUpperCase().replace(/[^WUBRG]/g, '');
    if (!col)          return 'C';
    if (col.length > 1) return 'Multi';
    return col;
}

// ── PUNTO DE ENTRADA ──────────────────────────────────────────
export async function updateDashboard() {
    const cards = getAllCards();

    renderSummary(cards);
    renderColorChart(cards);
    renderRarityChart(cards);
    renderTopCardsChart(cards);
    renderSetsChart(cards);
    await renderValueHistoryChart(cards);
}

// ── 0. SUMMARY CARDS ─────────────────────────────────────────
function renderSummary(cards) {
    const totalCards  = cards.reduce((s, c) => s + (c.quantity || 1), 0);
    const totalValue  = cards.reduce((s, c) => s + (c.price || 0) * (c.quantity || 1), 0);
    const folderCount = Object.keys(state.folders).length;
    const deckCount   = state.decks.length;
    const avgPrice    = totalCards > 0 ? totalValue / totalCards : 0;
    const topCard     = [...cards]
        .filter(c => c.price > 0)
        .sort((a, b) => b.price - a.price)[0] ?? null;

    const stats = [
        {
            icon: '🃏', color: 'text-sky-400',
            value: totalCards.toLocaleString('es-ES'),
            label: t('total_cards'),
        },
        {
            icon: '💰', color: 'text-emerald-400',
            value: `${totalValue.toFixed(2)} €`,
            label: t('total_value'),
        },
        {
            icon: '📁', color: 'text-violet-400',
            value: folderCount,
            label: t('total_folders'),
        },
        {
            icon: '🗂️', color: 'text-yellow-400',
            value: deckCount,
            label: t('total_decks'),
        },
        {
            icon: '📊', color: 'text-pink-400',
            value: `${avgPrice.toFixed(2)} €`,
            label: t('avg_card_price'),
        },
        {
            icon: '⭐', color: 'text-orange-400',
            value: topCard ? truncate(topCard.name, 18) : '—',
            label: t('most_valuable'),
            sub: topCard?.price > 0 ? `${topCard.price.toFixed(2)} €` : '',
        },
    ];

    document.getElementById('dash-summary').innerHTML = stats.map(s => `
    <div class="glass-card dash-stat-card">
      <div class="text-2xl mb-2">${s.icon}</div>
      <div class="text-xl font-extrabold ${s.color} tabular-nums leading-tight truncate"
           title="${s.value}">${s.value}</div>
      ${s.sub ? `<div class="text-xs text-slate-500 tabular-nums">${s.sub}</div>` : ''}
      <div class="text-xs text-slate-500 mt-0.5">${s.label}</div>
    </div>`).join('');
}

// ── 1. DISTRIBUCIÓN DE COLORES (Donut) ───────────────────────
function renderColorChart(cards) {
    destroyChart('colors');

    const counts = { W:0, U:0, B:0, R:0, G:0, C:0, Multi:0 };
    cards.forEach(c => {
        counts[getColorKey(c)] += (c.quantity || 1);
    });

    const entries = Object.entries(counts).filter(([, n]) => n > 0);
    if (!entries.length) { _showEmpty('chart-colors-wrap'); return; }

    const ctx = document.getElementById('chart-colors')?.getContext('2d');
    if (!ctx) return;

    _charts.colors = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels:   entries.map(([k]) => MTG_PALETTE[k].label),
            datasets: [{
                data:            entries.map(([, n]) => n),
                backgroundColor: entries.map(([k]) => MTG_PALETTE[k].bg),
                borderColor:     entries.map(([k]) => MTG_PALETTE[k].border),
                borderWidth:     2,
                hoverOffset:     10,
            }],
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            cutout:              '62%',
            plugins: {
                legend: {
                    position: 'right',
                    labels:   { color: LABEL_COLOR, padding: 12, boxWidth: 12 },
                },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const pct   = ((ctx.parsed / total) * 100).toFixed(1);
                            return ` ${ctx.parsed} cartas (${pct}%)`;
                        },
                    },
                },
            },
        },
    });
}

// ── 2. DESGLOSE POR RAREZA (Barras) ──────────────────────────
function renderRarityChart(cards) {
    destroyChart('rarity');

    const counts = { mythic:0, rare:0, uncommon:0, common:0 };
    cards.forEach(c => {
        const r = (c.rarity ?? '').toLowerCase();
        if (r in counts) counts[r] += (c.quantity || 1);
    });

    const entries = Object.entries(counts);
    const ctx = document.getElementById('chart-rarity')?.getContext('2d');
    if (!ctx) return;

    _charts.rarity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels:   entries.map(([k]) => RARITY_PALETTE[k].label),
            datasets: [{
                label:           t('cards'),
                data:            entries.map(([, n]) => n),
                backgroundColor: entries.map(([k]) => RARITY_PALETTE[k].bg),
                borderColor:     entries.map(([k]) => RARITY_PALETTE[k].border),
                borderWidth:     2,
                borderRadius:    6,
                borderSkipped:   false,
            }],
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: GRID_COLOR }, ticks: { color: TICK_COLOR } },
                y: {
                    grid:        { color: GRID_COLOR },
                    ticks:       { color: TICK_COLOR, precision: 0 },
                    beginAtZero: true,
                },
            },
        },
    });
}

// ── 3. TOP 10 CARTAS MÁS VALIOSAS (Barras horizontales) ──────
function renderTopCardsChart(cards) {
    destroyChart('topCards');

    // Una entrada por nombre, precio unitario más alto
    const byName = {};
    cards.forEach(c => {
        if (c.price > 0 && (!byName[c.name] || c.price > byName[c.name].price)) {
            byName[c.name] = c;
        }
    });

    const top10 = Object.values(byName)
        .sort((a, b) => b.price - a.price)
        .slice(0, 10)
        .reverse(); // Chart.js pinta de abajo a arriba

    if (!top10.length) { _showEmpty('chart-top-cards-wrap'); return; }

    const ctx = document.getElementById('chart-top-cards')?.getContext('2d');
    if (!ctx) return;

    _charts.topCards = new Chart(ctx, {
        type: 'bar',
        data: {
            labels:   top10.map(c => truncate(c.name, 24)),
            datasets: [{
                label:           '€ unidad',
                data:            top10.map(c => c.price),
                backgroundColor: 'rgba(52,211,153,0.45)',
                borderColor:     '#34d399',
                borderWidth:     2,
                borderRadius:    4,
                borderSkipped:   false,
            }],
        },
        options: {
            indexAxis:           'y',
            responsive:          true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid:        { color: GRID_COLOR },
                    ticks:       { color: TICK_COLOR, callback: v => `${v} €` },
                    beginAtZero: true,
                },
                y: {
                    grid:  { display: false },
                    ticks: { color: LABEL_COLOR, font: { size: 10 } },
                },
            },
        },
    });
}

// ── 4. DISTRIBUCIÓN POR SET (Barras horizontales) ─────────────
function renderSetsChart(cards) {
    destroyChart('sets');

    const bySets = {};
    cards.forEach(c => {
        const set = (c.set || '???').toUpperCase();
        bySets[set] = (bySets[set] || 0) + (c.quantity || 1);
    });

    const top10 = Object.entries(bySets)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .reverse();

    if (!top10.length) { _showEmpty('chart-sets-wrap'); return; }

    const ctx = document.getElementById('chart-sets')?.getContext('2d');
    if (!ctx) return;

    // Gradiente azul según posición en el ranking
    const total = top10.length;
    const bgs   = top10.map((_, i) =>
        `rgba(56,189,248,${0.25 + (i / total) * 0.55})`
    );

    _charts.sets = new Chart(ctx, {
        type: 'bar',
        data: {
            labels:   top10.map(([k]) => k),
            datasets: [{
                label:           t('cards'),
                data:            top10.map(([, n]) => n),
                backgroundColor: bgs,
                borderColor:     '#38bdf8',
                borderWidth:     1,
                borderRadius:    4,
                borderSkipped:   false,
            }],
        },
        options: {
            indexAxis:           'y',
            responsive:          true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid:        { color: GRID_COLOR },
                    ticks:       { color: TICK_COLOR, precision: 0 },
                    beginAtZero: true,
                },
                y: {
                    grid:  { display: false },
                    ticks: { color: LABEL_COLOR, font: { size: 11 } },
                },
            },
        },
    });
}

// ── 5. EVOLUCIÓN DEL VALOR TOTAL (Línea con gradiente) ────────
async function renderValueHistoryChart(cards) {
    destroyChart('valueHistory');

    // Guardar snapshot de hoy
    const todayValue = cards.reduce(
        (s, c) => s + (c.price || 0) * (c.quantity || 1), 0
    );
    await savePriceSnapshot(todayValue);

    // Cargar historial
    const history = await getPriceHistory(60);

    const container = document.getElementById('chart-history-wrap');
    if (history.length < 2) {
        if (container) {
            container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full gap-2 text-slate-500">
          <span class="text-3xl">📈</span>
          <p class="text-sm font-medium">${t('not_enough_data')}</p>
          <p class="text-xs text-slate-600">${t('come_back_tomorrow')}</p>
        </div>`;
        }
        return;
    }

    // Restaurar el canvas si fue reemplazado por el mensaje vacío
    if (container && !container.querySelector('canvas')) {
        container.innerHTML = `<canvas id="chart-value-history"></canvas>`;
    }

    const ctx = document.getElementById('chart-value-history')?.getContext('2d');
    if (!ctx) return;

    // Gradiente fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0,   'rgba(52,211,153,0.4)');
    gradient.addColorStop(0.6, 'rgba(52,211,153,0.07)');
    gradient.addColorStop(1,   'rgba(52,211,153,0)');

    // Puntos de tendencia (color según subida/bajada)
    const values    = history.map(r => r.value);
    const pointColors = values.map((v, i) =>
        i === 0 ? '#34d399' : v >= values[i - 1] ? '#34d399' : '#f87171'
    );

    _charts.valueHistory = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(r => {
                const d = new Date(r.date + 'T12:00:00');
                return `${d.getDate()}/${d.getMonth() + 1}`;
            }),
            datasets: [{
                label:               t('total_value'),
                data:                values,
                borderColor:         '#34d399',
                backgroundColor:     gradient,
                borderWidth:         2.5,
                pointRadius:         history.length > 30 ? 0 : 4,
                pointHoverRadius:    6,
                pointBackgroundColor: pointColors,
                pointBorderColor:    'transparent',
                tension:             0.35,
                fill:                true,
            }],
        },
        options: {
            responsive:          true,
            maintainAspectRatio: false,
            interaction:         { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y.toFixed(2)} €`,
                        title: labels => labels[0],
                    },
                },
            },
            scales: {
                x: {
                    grid:  { color: GRID_COLOR },
                    ticks: { color: TICK_COLOR, maxTicksLimit: 14 },
                },
                y: {
                    grid:  { color: GRID_COLOR },
                    ticks: { color: TICK_COLOR, callback: v => `${v.toFixed(0)} €` },
                },
            },
        },
    });
}

// ── HELPERS ───────────────────────────────────────────────────
function _showEmpty(wrapperId) {
    const el = document.getElementById(wrapperId);
    if (el) el.innerHTML = `
    <div class="flex items-center justify-center h-full text-slate-600 text-xs">
      ${t('no_data')}
    </div>`;
}
