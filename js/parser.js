/**
 * Parsea un CSV exportado desde ManaBox u otros gestores.
 * Soporta cabeceras en español e inglés, foil, cantidad y precio.
 * @param {string} text Contenido del archivo CSV/TXT
 * @returns {Card[]}
 */
export function parseCSV(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const headers = splitCSVLine(lines[0]).map(h =>
        h.replace(/^"|"$/g, '').toLowerCase().trim()
    );

    const idx = (candidates) => {
        for (const c of candidates) {
            const i = headers.indexOf(c);
            if (i !== -1) return i;
        }
        return -1;
    };

    const iName      = idx(['name','card name','nombre','card']);
    const iQty       = idx(['quantity','qty','cantidad','count','copies']);
    const iPrice     = idx(['price','precio','cardmarket price','value','cm price']);
    const iSet       = idx(['set','edition','edición','set name','set code']);
    const iFoil      = idx(['foil','is foil','foil?']);
    const iColors    = idx(['color','colors','colour','color identity']);
    const iImage     = idx(['image url','image_url','scryfall_uri','image','img']);
    const iCmUrl     = idx(['cardmarket url','cardmarket_url','cm url','cm_url','url']);
    const iCondition = idx(['condition','condición','grading']);

    if (iName === -1) return [];

    return lines.slice(1).reduce((acc, line) => {
        const cols = splitCSVLine(line).map(c => c.replace(/^"|"$/g, '').trim());
        const name = cols[iName] || '';
        if (!name) return acc;

        const qty   = iQty   !== -1 ? (parseInt(cols[iQty],  10) || 1) : 1;
        const price = iPrice !== -1 ? (parseFloat((cols[iPrice] || '0').replace(',', '.')) || 0) : 0;
        const foil  = iFoil  !== -1 ? /yes|true|foil|1/i.test(cols[iFoil] || '') : false;

        acc.push({
            name,
            quantity:     qty,
            price,
            set:          iSet       !== -1 ? cols[iSet]       : '',
            isFoil:       foil,
            colors:       iColors    !== -1 ? cols[iColors]    : '',
            imageUrl:     iImage     !== -1 ? cols[iImage]     : '',
            cardmarketUrl:iCmUrl     !== -1 ? cols[iCmUrl]     : '',
            condition:    iCondition !== -1 ? cols[iCondition] : 'NM',
        });
        return acc;
    }, []);
}

function splitCSVLine(line) {
    const result = [];
    let cur = '', inQ = false;
    for (const ch of line) {
        if (ch === '"')            inQ = !inQ;
        else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
        else                         cur += ch;
    }
    result.push(cur);
    return result;
}
