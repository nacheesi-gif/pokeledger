# PokéLedger · Project birth record (Gitos-informed, 2026-11-16)

## Identity
PokéLedger is a personal, local-first Pokémon TCG collection, binder, haul, sales, market value and restock dashboard. Primary client is a mobile PWA served via GitHub Pages.

## Operator intent
An idea-driven, non-developer operator describes desired outcomes; assistant researches existing solutions, audits source/licensing, implements small verified changes, and preserves the existing app. No separate app/version needed.

## Project acceptance
- The current site stays at https://nacheesi-gif.github.io/pokeledger/
- User's existing localStorage database, backups and optional cloud behavior survive changes.
- No new recurring paid or commercial infrastructure.
- Card images, saved binder, combined gallery browsing, market links, scans, slabs, restock watch, purchases/sales continue to work.
- Arithmetic and verification gates have known-answer positive and negative tests; CI checks source syntax.
- Battery / responsiveness claims require measurements on an actual phone.

## Holdout
No formal frozen evaluation dataset exists. Deterministic mocked-data tests are versioned; real-device and retailer/source tests are recorded separately.

## Outcome
A dependable personal-use mobile app with transparent market data, robust financial calculations, fast gallery rendering, minimum unnecessary background work, and reproducible maintenance.

## Production & boundaries
Public GitHub Pages `main` deploy; user-specific collection data resides on device unless an optional private cloud is configured. Exclude all user secrets, certificates with personal details, and collection exports from the public repo.

## Prior lessons
- Source prices can be missing or stale; display age and verification links.
- 'Record match' must not claim physical slab authenticity.
- Restock links can be delayed; they do not prove inventory availability.
- Previous changes passed JS syntax checks but lacked durable behavioral regression tests.
- Cache-first app assets require a service-worker version change when published.
- Long gallery DOMs and OCR loops must not run continuously in the background.

## Adaptation
Gitos (MIT, © 2026 Wizzo) provides principles; its native Claude Code workflow is not executed in ChatGPT. Project-local documented decisions and Node CI provide a lightweight equivalent. This handoff remains a frozen record; update decision pages/INDEX as implementation evolves.
