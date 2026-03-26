# MTG-Vault

> **An offline-first, multilingual Progressive Web App for managing your Magic: The Gathering collection.**

[![JavaScript](https://img.shields.io/badge/JavaScript-78.1%25-yellow)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![CSS](https://img.shields.io/badge/CSS-12.7%25-blue)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![HTML](https://img.shields.io/badge/HTML-9.2%25-orange)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-informational)]()

---

## Overview

MTG-Vault is a client-side web application designed to help Magic: The Gathering players organize, track, and analyze their card collections — entirely offline. Built as a Progressive Web App (PWA), it can be installed on any device and works without an internet connection after the initial load. The application integrates with the [Scryfall API](https://scryfall.com/docs/api) for card data retrieval and supports multiple languages through a built-in i18n system.

---

## Features

- **Collection Management** — Add, remove, and browse your owned MTG cards with quantity tracking.
- **Deck Builder** — Create and manage custom decks from your collection.
- **Deck Overview** — View all your saved decks in one place with quick-access controls.
- **Card Search** — Search cards via the Scryfall API with filtering and sorting capabilities.
- **Wishlist** — Keep track of cards you want to acquire in the future.
- **Dashboard & Statistics** — Visualize your collection data with interactive charts powered by Chart.js.
- **Offline-First (PWA)** — Installable on desktop and mobile devices, works without internet access after the first load.
- **Multilingual Support (i18n)** — Interface available in multiple languages.
- **Dark-themed UI** — Built with Tailwind CSS for a clean, responsive design.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| [Vite](https://vitejs.dev/) | Build tool and development server |
| [Tailwind CSS](https://tailwindcss.com/) | Utility-first CSS framework |
| [Chart.js](https://www.chartjs.org/) | Data visualization / charts |
| [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) | Progressive Web App support |
| [Scryfall API](https://scryfall.com/docs/api) | MTG card data source |
| Vanilla JavaScript (ES Modules) | Core application logic |

---

## Project Structure

```
MTG-Vault/
├── public/              # Static assets
├── src/
│   ├── api/             # Scryfall API integration layer
│   ├── core/            # Application core (router, state, etc.)
│   ├── i18n/            # Internationalization / translation files
│   ├── styles/          # Global and component styles
│   ├── utils/           # Utility functions
│   ├── views/           # View modules (one per page/section)
│   │   ├── collection.js
│   │   ├── dashboard.js
│   │   ├── deckbuilder.js
│   │   ├── decks.js
│   │   ├── search.js
│   │   └── wishlist.js
│   └── main.js          # Application entry point
├── index.html
├── package.json
├── vite.config.js
└── manifest.webmanifest.js
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/Phosky71/MTG-Vault.git
cd MTG-Vault

# Install dependencies
npm install
```

### Running the Development Server

```bash
npm run dev
```

Open your browser and navigate to `http://localhost:5173`.

### Building for Production

```bash
npm run build
```

### Preview the Production Build

```bash
npm run preview
```

The preview server runs on port `4173` by default.

---

## Known Issues

> **Note:** This project is currently at version 1.0.0 and contains known bugs that are pending resolution. Contributions and bug reports are welcome.

### Interface / UI Bugs

- **Inconsistent component rendering** — Some UI components may not render correctly on first load or after navigation between views, requiring a manual page refresh to display properly.
- **Layout overflow on certain screen sizes** — Elements in the Deck Builder and Collection views may overflow their containers on smaller viewports, breaking the expected Tailwind CSS layout.
- **Chart display glitches** — Dashboard charts (Chart.js) may occasionally fail to resize correctly when switching between views or resizing the browser window.
- **Navigation state highlighting** — The active navigation item does not always update to reflect the current view after in-app routing transitions.

### Persistence / Data Bugs

- **Inconsistent localStorage sync** — Collection and wishlist data saved in `localStorage` may not always reflect the latest state immediately after an add/remove operation, leading to stale data being displayed until a refresh.
- **Deck persistence on edit** — Modifications made to an existing deck in the Deck Builder are not always persisted correctly; in some cases the previous version of the deck is restored after navigating away and returning.
- **Data loss on browser cache clear** — As persistence relies entirely on `localStorage`, clearing browser storage or using private/incognito mode results in complete loss of user data with no warning.
- **No data export/import** — There is currently no mechanism to back up or restore collection data, making migration between devices or browsers impossible.

---

## Roadmap

- [ ] Fix known UI rendering and layout bugs
- [ ] Resolve localStorage synchronization issues
- [ ] Add data export / import functionality (JSON)
- [ ] Implement proper state management layer
- [ ] Add unit and integration tests
- [ ] Improve PWA offline caching strategy

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Disclaimer

MTG-Vault is an independent, non-commercial project. Magic: The Gathering is property of Wizards of the Coast. Card data is sourced from the [Scryfall API](https://scryfall.com/docs/api) in accordance with their terms of service.
