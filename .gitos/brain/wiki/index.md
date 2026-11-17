# Project Knowledge Index

## Decisions
- [ADR-001 · Keep same personal-use app](decisions/adr-001-existing-app.md)
- [ADR-002 · Zero-dependency regression gates](decisions/adr-002-tests.md)
- [ADR-003 · Battery and data boundaries](decisions/adr-003-battery-data.md)

## System map
- `index.html`: app shell, local data, dashboard, transactions, navigation, optional cloud sync
- `explore.js` / `allcards.js`: grouped / paged Pokémon set galleries
- `gallery.js` / `market.js`: zoom and indicative price source display
- `scanner.js` / `slabs.js`: opt-in camera and OCR
- `collections.js` / `hauls.js`: binders and itemized purchases
- `restocks.js`: user-curated third-party restock source shortcuts
- `sw.js`: offline app shell, cache version
- `PERFORMANCE_AUDIT.md`: prior code/performance findings
- `tests/`: reproducible regression checks

## Source
- https://github.com/wizzo-gmb/gitos
- https://github.com/wizzo-gmb/gitos/blob/main/references/disciplines.md
