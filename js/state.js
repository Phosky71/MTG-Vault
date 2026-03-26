// Estado global compartido entre módulos (mutable por referencia)
export const state = {
    folders: {},              // { [folderName]: Card[] }
    decks: [],                // Deck[]
    activeFolderFilter: '',   // '' = todas las carpetas
    activeFormatFilter: '',   // '' = todos los formatos
    pendingImportFolder: null // carpeta destino del próximo CSV
};
