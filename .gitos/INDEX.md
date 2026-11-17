# PokéLedger · Work Order Ledger

## Active
- WO-001 — Discipline adoption and automated regression foundations. Branch: `gitos-discipline-audit`. Status: implementing / verifying.

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
