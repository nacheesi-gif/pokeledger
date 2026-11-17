# PokéLedger Performance & Battery Audit

Audit date: 2026-11-16  
Scope: `index.html`, `explore.js`, `gallery.js`, `allcards.js`, `scanner.js`, `slabs.js`, `market.js`, `hauls.js`, `collections.js`, `restocks.js`, `sw.js`; static PWA on GitHub Pages.

## Design goals
- Personal use: zero paid backend dependencies.
- Preserve existing local collection, purchases, sales, profit accounting, binders, optional cloud, and manual backups.
- Optimize requests and background activity before adding animations or new libraries.
- Don't claim a specific refresh rate, battery-life improvement or device performance without device measurements.

## Changes made in the performance pass
| Component | Issue / risk | Mitigation |
| --- | --- | --- |
| Card price gallery | Repeated full-document price-observer scans after each DOM mutation | Observe only inserted subtrees; one reusable IntersectionObserver; do nothing while hidden |
| Market price requests | High concurrency and repeated retries / unlimited session memory | At most 3 concurrent lookups (1 in data-saver mode); cap cache at 320 entries; failed promises evicted to permit retry |
| Explore Sets | Hundreds of card-detail fetches per opened set and full grid redraw on every dozen results | Fetch details near the current visible page only; max 2 concurrent (1 in data-saver mode); update grid every 24 completed or at the end |
| Combined All Cards | Parsing the same cached set listing and performing linear owned-card searches per card render | Parse once per session, build a set-ID map, and build one owned-card map per rendered page |
| Long grids | Offscreen cards incur painting/layout cost | Lazy card images plus `content-visibility:auto` with fallback in browsers without support |
| Card scanner | Auto OCR continuously every ~1.35 s; camera could remain on in a background tab | Auto interval relaxed to 3.5 s; stop camera, auto cycle and timers on background/navigation; reject late permission results |
| Slab scanner | Camera could continue after navigating, backgrounding or saving | Stop camera on hide/nav/re-render; reject late permission results |
| Navigation / storage | Every localStorage write by any app key could trigger a full redraw | Only reload when the actual PokéLedger local data key changes |
| Service worker | Every same-origin response could be cached; app assets were fetched network-first on every request | Cache only shell assets; cache-first for scripts/icons; network-first for app document; leave external requests untouched; release-version cache key |

## Regression checks conducted
- JavaScript parser validation passed for all 11 audited JS/HTML modules.
- Mocked All Cards: page 1 and 2, displayed prices, add to owned inventory; one cached set-catalog read.
- Mocked Trainer Gallery: all four source sets combined and preserved artwork/market labels.
- Mocked service-worker requests: app script served from cache, HTML network-first, third-party API requests not intercepted.
- No user data was migrated, deleted, or rewritten by this performance pass.

## Findings / remaining risks
**Not yet measured:** Real-world first render, interaction latency, frames-per-second, network traffic and battery consumption on a phone. Do not claim guaranteed lag-free / zero-battery use.

**Medium priority:**
1. Benchmark a representative large owned binder (hundreds to thousands of cards) and transaction history. The existing `render()` still rebuilds the whole page on most data edits; use targeted updates only if benchmarks justify the complexity.
2. The combined All Cards gallery can still grow to a very long DOM if a user repeatedly loads pages. Browser-supported offscreen painting suppression helps, but virtualization may be justified for thousands of simultaneously loaded cards.
3. The scanner uses a sizeable OCR Web Worker after first use. It is initialized on demand and camera activity now stops on hide; assess worker termination/memory only if actual phone profiling finds a problem.
4. TCGdex's market-price feed has missing/stale data in some cases. This is a data-quality issue, not a performance fault. Never confuse price age with real-time availability.
5. Image CDN performance and decoded-image memory vary by phone/network; images are lazy-loaded and enlarged only on demand. Validate on mobile Safari and Chrome.

**Safety / quality notes:** Local-first data remains stored in browser storage and manually exportable as JSON. Do not silently introduce external telemetry, paid vendors, device permissions, background polling, or a cloud requirement.

## How to benchmark on the user's phone
- Test on an actual iPhone/Android device over Wi-Fi and cellular with normal and reduced-data modes.
- Capture cold-start duration, time until navigation responds, and interaction delays on Dashboard, My Binder, Explore Sets, combined All Cards, Slab Verify, and Restock Watch.
- Scroll a gallery with 300+ cards; inspect frame drops, memory usage, unexpected reloads, and network request totals.
- Start auto-scan, lock the phone or switch tabs: confirm the camera indicator stops and background OCR ceases.
- Compare battery and heat over a representative 10–15 minute session. Use browser/OS diagnostics; no unsupported percentage claims.
- Confirm offline reload and fresh-release update after the service worker installs.

## Release rule
Every change to cached app-shell scripts must bump the service-worker `CACHE` version. Keep the data model and offline backups intact. Prefer no-dependency, incremental patches with regression tests.
