export const TRANSLATIONS = {
    es: {
        nav_collection:    'Colección',
        nav_decks:         'Mazos',
        nav_dashboard:     'Dashboard',
        search_placeholder:'Buscar cartas...',
        sort_default:      'Ordenar...',
        sort_price_desc:   'Precio (Mayor a Menor)',
        sort_price_asc:    'Precio (Menor a Mayor)',
        sort_name_asc:     'Nombre (A-Z)',
        color_all:         'Todos los colores',
        color_white:       'Blanco',
        color_blue:        'Azul',
        color_black:       'Negro',
        color_red:         'Rojo',
        color_green:       'Verde',
        color_colorless:   'Incoloro / Tierras',
        folders_title:     'Carpetas',
        folder_all:        'Todas',
        total_cards:       'Total de Cartas',
        unique_cards:      'Cartas Únicas',
        total_value:       'Valor Total',
        folders_breakdown: 'Desglose por Carpetas',
        dashboard_title:   'Dashboard de Colección',
        format_select:     'Formato...',
        format_all:        'Todos los formatos',
        format_casual:     'Otro / Casual',
        btn_import_deck:   'Importar Mazo',
        deck_url_placeholder:  'URL de Moxfield, Archidekt...',
        deck_name_placeholder: 'Nombre del mazo',
        footer_text:       'MTG Vault — Gestiona tu colección',
        // Estados vacíos
        empty_collection_title: 'Tu colección está vacía',
        empty_create_folder:    'Crea una carpeta e importa un CSV de ManaBox para empezar.',
        empty_no_match:         'No hay cartas que coincidan con los filtros.',
        empty_decks_title:      'Sin mazos',
        empty_no_decks:         'No hay mazos guardados en este formato.',
        // Acciones
        confirm_delete_folder:  '¿Eliminar la carpeta "{name}" y todas sus cartas?',
        confirm_delete_deck:    '¿Eliminar el mazo "{name}"?',
        new_folder_prompt:      'Nombre de la nueva carpeta:',
        rename_folder_prompt:   'Nuevo nombre para "{name}":',
        folder_exists:          'Ya existe una carpeta con ese nombre.',
        // Toasts
        toast_folder_created:   'Carpeta "{name}" creada.',
        toast_folder_deleted:   'Carpeta "{name}" eliminada.',
        toast_folder_renamed:   'Carpeta renombrada a "{name}".',
        toast_import_success:   '{n} cartas importadas en "{folder}".',
        toast_import_error:     'Error al leer el archivo.',
        toast_import_empty:     'El archivo no contiene cartas válidas.',
        toast_deck_added:       'Mazo "{name}" añadido.',
        toast_deck_deleted:     'Mazo eliminado.',
        toast_invalid_url:      'Introduce una URL válida.',
        toast_name_required:    'El nombre del mazo es obligatorio.',
        // Modal
        modal_set:              'Edición',
        modal_condition:        'Condición',
        modal_quantity:         'Cantidad',
        modal_price_unit:       'Precio/u',
        modal_total:            'Total',
        modal_folder:           'Carpeta',
        modal_view_cardmarket:  'Ver en Cardmarket',
        // Mazos
        deck_cards:             'cartas',
        deck_est_value:         'Valor estimado',
        deck_delete:            'Eliminar',
        // Misc
        foil_label:             '✨ Foil',
        price_na:               'N/A',
        price_source:           'Cardmarket',
    },
    en: {
        nav_collection:    'Collection',
        nav_decks:         'Decks',
        nav_dashboard:     'Dashboard',
        search_placeholder:'Search cards...',
        sort_default:      'Sort...',
        sort_price_desc:   'Price (High to Low)',
        sort_price_asc:    'Price (Low to High)',
        sort_name_asc:     'Name (A-Z)',
        color_all:         'All colors',
        color_white:       'White',
        color_blue:        'Blue',
        color_black:       'Black',
        color_red:         'Red',
        color_green:       'Green',
        color_colorless:   'Colorless / Lands',
        folders_title:     'Folders',
        folder_all:        'All',
        total_cards:       'Total Cards',
        unique_cards:      'Unique Cards',
        total_value:       'Total Value',
        folders_breakdown: 'Folder Breakdown',
        dashboard_title:   'Collection Dashboard',
        format_select:     'Format...',
        format_all:        'All formats',
        format_casual:     'Other / Casual',
        btn_import_deck:   'Import Deck',
        deck_url_placeholder:  'Moxfield, Archidekt URL...',
        deck_name_placeholder: 'Deck name',
        footer_text:       'MTG Vault — Manage your collection',
        empty_collection_title: 'Your collection is empty',
        empty_create_folder:    'Create a folder and import a ManaBox CSV to get started.',
        empty_no_match:         'No cards match the current filters.',
        empty_decks_title:      'No decks yet',
        empty_no_decks:         'No decks saved in this format.',
        confirm_delete_folder:  'Delete folder "{name}" and all its cards?',
        confirm_delete_deck:    'Delete deck "{name}"?',
        new_folder_prompt:      'New folder name:',
        rename_folder_prompt:   'New name for "{name}":',
        folder_exists:          'A folder with that name already exists.',
        toast_folder_created:   'Folder "{name}" created.',
        toast_folder_deleted:   'Folder "{name}" deleted.',
        toast_folder_renamed:   'Folder renamed to "{name}".',
        toast_import_success:   '{n} cards imported into "{folder}".',
        toast_import_error:     'Error reading the file.',
        toast_import_empty:     'The file contains no valid cards.',
        toast_deck_added:       'Deck "{name}" added.',
        toast_deck_deleted:     'Deck deleted.',
        toast_invalid_url:      'Please enter a valid URL.',
        toast_name_required:    'Deck name is required.',
        modal_set:              'Set',
        modal_condition:        'Condition',
        modal_quantity:         'Quantity',
        modal_price_unit:       'Price/u',
        modal_total:            'Total',
        modal_folder:           'Folder',
        modal_view_cardmarket:  'View on Cardmarket',
        deck_cards:             'cards',
        deck_est_value:         'Est. value',
        deck_delete:            'Delete',
        foil_label:             '✨ Foil',
        price_na:               'N/A',
        price_source:           'Cardmarket',
    }
};

export let currentLang = localStorage.getItem('mtg_vault_lang') || 'es';

export function t(key, vars = {}) {
    let str = (TRANSLATIONS[currentLang] || TRANSLATIONS.es)[key] || key;
    Object.entries(vars).forEach(([k, v]) => { str = str.replaceAll(`{${k}}`, v); });
    return str;
}

export function applyTranslations() {
    document.documentElement.lang = currentLang;
    document.getElementById('lang-label').textContent = currentLang.toUpperCase();
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
}

export function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('mtg_vault_lang', lang);
}
