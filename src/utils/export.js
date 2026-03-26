import {state} from '../core/state.js';
import {showToast} from './ui.js';

// ── HELPERS ───────────────────────────────────────────────────
function csvField(val) {
    const s = String(val ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
}

function download(filename, content, mime = 'text/plain') {
    const blob = new Blob([content], {type: `${mime};charset=utf-8;`});
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'),
        {href: url, download: filename});
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
    }, 1000);
}

function timestamp() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── 1. EXPORT CSV — Colección (carpeta o completa) ────────────
/**
 * @param {string|null} folderName  null = toda la colección
 */
export function exportToCSV(folderName = null) {
    const headers = [
        'Name', 'Set code', 'Set name', 'Collector number',
        'Foil', 'Rarity', 'Quantity', 'Scryfall ID',
        'Purchase price', 'Condition', 'Language',
        'Purchase price currency', 'Folder', 'Notes',
    ];

    const folders = folderName
        ? {[folderName]: state.folders[folderName] ?? []}
        : state.folders;

    const rows = [];
    Object.entries(folders).forEach(([folder, cards]) => {
        cards.forEach(c => {
            rows.push([
                c.name,
                (c.set ?? '').toUpperCase(),
                c.setName ?? '',
                c.collectorNumber ?? '',
                c.isFoil ? 'foil' : '',
                c.rarity ?? '',
                c.quantity ?? 1,
                c.scryfallId ?? '',
                (c.price ?? 0).toFixed(2),
                c.condition ?? 'NM',
                c.language ?? 'en',
                'EUR',
                folder,
                c.notes ?? '',
            ].map(csvField).join(','));
        });
    });

    if (!rows.length) {
        showToast('⚠️ No hay cartas para exportar', 'warning');
        return;
    }

    const suffix = folderName
        ? `_${folderName.replace(/[^a-z0-9]/gi, '_')}`
        : '_completa';

    download(
        `mtgvault_coleccion${suffix}_${timestamp()}.csv`,
        [headers.join(','), ...rows].join('\r\n'),
        'text/csv'
    );

    showToast(`📥 CSV exportado — ${rows.length} cartas`, 'success');
}

// ── 2. EXPORT JSON — backup completo ─────────────────────────
export function exportToJSON() {
    const totalCards = Object.values(state.folders).flat().length;
    const totalDecks = state.decks?.length ?? 0;

    if (!totalCards && !totalDecks) {
        showToast('⚠️ No hay datos para exportar', 'warning');
        return;
    }

    const totalValue = Object.values(state.folders).flat()
        .reduce((s, c) => s + (c.price || 0) * (c.quantity || 1), 0);

    const backup = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        stats: {
            folders: Object.keys(state.folders).length,
            cards: totalCards,
            decks: totalDecks,
            totalValue: parseFloat(totalValue.toFixed(2)),
        },
        folders: state.folders,
        decks: state.decks ?? [],
    };

    download(
        `mtgvault_backup_${timestamp()}.json`,
        JSON.stringify(backup, null, 2),
        'application/json'
    );

    showToast(
        `💾 Backup exportado — ${totalCards} cartas, ${totalDecks} mazos`,
        'success'
    );
}

// ── 3. EXPORT CSV — Un mazo ───────────────────────────────────
/**
 * @param {object} deck  objeto deck de state.decks
 */
export function exportDeckToCSV(deck) {
    if (!deck) return;

    const headers = [
        'Name', 'Set code', 'Set name', 'Collector number',
        'Foil', 'Rarity', 'Quantity', 'Scryfall ID',
        'Purchase price', 'Condition', 'Language',
        'Purchase price currency', 'Board',
    ];

    const all = [
        ...(deck.commander ? [{...deck.commander, board: 'Commander'}] : []),
        ...(deck.mainboard ?? []).map(c => ({...c, board: 'Mainboard'})),
        ...(deck.sideboard ?? []).map(c => ({...c, board: 'Sideboard'})),
    ];

    if (!all.length) {
        showToast('⚠️ El mazo está vacío', 'warning');
        return;
    }

    const rows = all.map(c => [
        c.name,
        (c.set ?? '').toUpperCase(),
        c.setName ?? '',
        c.collectorNumber ?? '',
        c.isFoil ? 'foil' : '',
        c.rarity ?? '',
        c.quantity ?? 1,
        c.scryfallId ?? '',
        (c.price ?? 0).toFixed(2),
        c.condition ?? 'NM',
        c.language ?? 'en',
        'EUR',
        c.board,
    ].map(csvField).join(','));

    const safeName = (deck.name ?? 'mazo').replace(/[^a-z0-9]/gi, '_');

    download(
        `mtgvault_mazo_${safeName}_${timestamp()}.csv`,
        [headers.join(','), ...rows].join('\r\n'),
        'text/csv'
    );

    showToast(`📥 Mazo exportado — ${all.length} cartas`, 'success');
}

// ── 4. COPIAR LISTA — formato MTGO / Arena ────────────────────
/**
 * @param {object} deck  objeto deck de state.decks
 */
export function copyDeckList(deck) {
    if (!deck?.cards?.length) {
        showToast('⚠️ El mazo está vacío', 'warning');
        return;
    }

    const boards = {
        Commander: deck.cards.filter(c => c.board === 'Commander'),
        Mainboard: deck.cards.filter(c => (c.board ?? 'Mainboard') === 'Mainboard'),
        Sideboard: deck.cards.filter(c => c.board === 'Sideboard'),
        Maybeboard: deck.cards.filter(c => c.board === 'Maybeboard'),
    };

    const lines = [];

    if (boards.Commander.length) {
        lines.push('Commander');
        boards.Commander.forEach(c => lines.push(`${c.quantity ?? 1} ${c.name}`));
        lines.push('');
    }
    if (boards.Mainboard.length) {
        boards.Mainboard.forEach(c => lines.push(`${c.quantity ?? 1} ${c.name}`));
    }
    if (boards.Sideboard.length) {
        lines.push('');
        lines.push('Sideboard');
        boards.Sideboard.forEach(c => lines.push(`${c.quantity ?? 1} ${c.name}`));
    }
    if (boards.Maybeboard.length) {
        lines.push('');
        lines.push('Maybeboard');
        boards.Maybeboard.forEach(c => lines.push(`${c.quantity ?? 1} ${c.name}`));
    }

    const text = lines.join('\n');
    const mainCount = boards.Mainboard.reduce((s, c) => s + (c.quantity ?? 1), 0);

    navigator.clipboard.writeText(text).then(
        () => showToast(`📋 Lista copiada — ${mainCount} cartas`, 'success'),
        () => showToast('❌ Error al copiar al portapapeles', 'error')
    );
}

// ── 5. EXPORT TXT — Un mazo (descarga fichero) ────────────────
/**
 * @param {object} deck  objeto deck de state.decks
 */
export function exportDeckToTxt(deck) {
    if (!deck) return;

    const lines = [];

    if (deck.commander) {
        lines.push('Commander');
        lines.push(`1 ${deck.commander.name}`);
        lines.push('');
    }

    const groups = _groupCardsDeck(deck.mainboard ?? []);
    groups.forEach(g => {
        lines.push(`// ${g.label}`);
        g.cards
            .sort((a, b) => (a.cmc ?? 0) - (b.cmc ?? 0) || a.name.localeCompare(b.name))
            .forEach(c => lines.push(`${c.quantity || 1} ${c.name}`));
        lines.push('');
    });

    if (deck.sideboard?.length) {
        lines.push('Sideboard');
        deck.sideboard
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(c => lines.push(`${c.quantity || 1} ${c.name}`));
        lines.push('');
    }

    const mainCount = (deck.mainboard ?? []).reduce((s, c) => s + (c.quantity || 1), 0);
    const sideCount = (deck.sideboard ?? []).reduce((s, c) => s + (c.quantity || 1), 0);
    const totalVal = [
        ...(deck.mainboard ?? []),
        ...(deck.sideboard ?? []),
        ...(deck.commander ? [deck.commander] : []),
    ].reduce((s, c) => s + (c.price || 0) * (c.quantity || 1), 0);

    lines.push(`// ${deck.name}`);
    lines.push(`// Main: ${mainCount} · Side: ${sideCount} · Valor: ${totalVal.toFixed(2)} €`);

    const safeName = (deck.name ?? 'mazo').replace(/[^a-z0-9]/gi, '_');
    download(
        `mtgvault_mazo_${safeName}_${timestamp()}.txt`,
        lines.join('\n'),
        'text/plain'
    );

    showToast(`📄 TXT exportado — ${mainCount} cartas`, 'success');
}

// ── 6. EXPORT JSON — Un mazo ──────────────────────────────────
/**
 * @param {object} deck  objeto deck de state.decks
 */
export function exportDeckToJSON(deck) {
    if (!deck) return;

    const mainCount = (deck.mainboard ?? []).reduce((s, c) => s + (c.quantity || 1), 0);
    const totalVal = [
        ...(deck.mainboard ?? []),
        ...(deck.sideboard ?? []),
        ...(deck.commander ? [deck.commander] : []),
    ].reduce((s, c) => s + (c.price || 0) * (c.quantity || 1), 0);

    const payload = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        stats: {
            format: deck.format ?? 'unknown',
            main: mainCount,
            side: (deck.sideboard ?? []).reduce((s, c) => s + (c.quantity || 1), 0),
            totalValue: parseFloat(totalVal.toFixed(2)),
        },
        deck,
    };

    const safeName = (deck.name ?? 'mazo').replace(/[^a-z0-9]/gi, '_');
    download(
        `mtgvault_mazo_${safeName}_${timestamp()}.json`,
        JSON.stringify(payload, null, 2),
        'application/json'
    );

    showToast(`💾 JSON exportado — ${mainCount} cartas`, 'success');
}

// ── Helper interno para agrupar cartas (replica TYPE_GROUPS) ──
const _TYPE_GROUPS_EXPORT = [
    {key: 'creature', label: 'Criaturas', match: tl => tl.includes('creature')},
    {key: 'planeswalker', label: 'Planeswalkers', match: tl => tl.includes('planeswalker')},
    {key: 'instant', label: 'Instantáneos', match: tl => tl.includes('instant')},
    {key: 'sorcery', label: 'Conjuros', match: tl => tl.includes('sorcery')},
    {key: 'enchantment', label: 'Encantamientos', match: tl => tl.includes('enchantment') && !tl.includes('creature')},
    {key: 'artifact', label: 'Artefactos', match: tl => tl.includes('artifact') && !tl.includes('creature')},
    {key: 'land', label: 'Tierras', match: tl => tl.includes('land')},
    {key: 'other', label: 'Otros', match: () => true},
];

function _groupCardsDeck(cards) {
    const groups = _TYPE_GROUPS_EXPORT.map(g => ({...g, cards: []}));
    cards.forEach(card => {
        const tl = (card.type_line ?? '').toLowerCase();
        const g = groups.find(g => g.match(tl));
        if (g) g.cards.push(card);
    });
    return groups.filter(g => g.cards.length > 0);
}

