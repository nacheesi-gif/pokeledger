# PokéLedger · Work Order Ledger

## Active
- WO-001 — Discipline adoption and automated regression foundations. Status: VERIFIED (18/18 behavioral tests, project-scoped hooks, CI). Integrated into the original `main`.

- [WO-006](work-orders/WO-006.md) — Phone launch, raster icons, offline shell, camera lifecycle and restore checks. Mobile Chromium regression runs in Actions. Physical device acceptance remains open.

- [WO-007](work-orders/WO-007.md) — Display TCGplayer Market Price per finish, alongside saved values.

- [WO-008](work-orders/WO-008.md) — Repair phone guide/capture alignment, add local QR decoding and daily price cache for all Pokemon sets.

- [WO-009](work-orders/WO-009.md) — Improve recognition of stylized names, promo numbers, lookup failures and scanner cancellation.

## Next (scoped proposals — not yet implemented)
- WO-002 — Measure 500-card/1,000-transaction real-device performance, then optimize observed bottlenecks.
- WO-003 — Audit and test data import/export + cloud conflict handling with known-answer fixtures.
- WO-004 — Investigate free and license-compatible raw price feed and integrate only after source verification.
- WO-005 — Evaluate open-source retailer monitoring on a sandbox and report actual reliability.

## Decided
- ADR-001: Preserve the existing free personal-use app; adopt Gitos disciplines instead of a parallel product or an unexecuted Claude-only runtime.
- ADR-002: Zero-dependency executable checks in CI; no external code execution or dependency installation for Gitos.
- ADR-003: Prioritize privacy, data correctness and battery safety above speculative speed claims.

## Evidence / limitations
- Historical performance audit: `PERFORMANCE_AUDIT.md`.
- Current checks: `npm test` and `npm run check`.
- Device battery/performance and live retailer response testing remain unverified until actually measured.

## Superseded or disproved
- Installing Gitos's entire Claude Code runtime into the PWA: not applicable; it is a development-time tool, not a browser component.
