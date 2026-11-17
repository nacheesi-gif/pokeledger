# PokéLedger — Development Working Agreement

This is the existing personal-use PokéLedger PWA. The original site and data model are authoritative. Read `.gitos/handoff.md`, `.gitos/INDEX.md`, `.gitos/brain/BRAIN.md`, and relevant decisions before making changes.

**Gitos provenance:** This project adapts the transferable engineering principles of [wizzo-gmb/gitos](https://github.com/wizzo-gmb/gitos), MIT license, Copyright © 2026 Wizzo. Its Claude Code skill, hooks, worktree scripts, agents, and System One runtime are NOT installed or automatically executed by this repository. The written roles below are workflow responsibilities, not claims of running autonomous agents.

## Scope and invariants
- Same app, same GitHub Pages URL, same local data. No replacement product or paid services.
- Preserve localStorage `pokeledger-v1`, JSON backups/restores, card IDs, family data, owned inventory, itemized hauls, realized sales P/L, saved market values, optional cloud synchronization.
- Realized P/L comes only from completed sales with actual costs and fees. Paper gains are separate. Stale or missing price feeds must not become verified valuations.
- A slab certification number cannot establish physical authenticity; a restock report cannot certify stock at checkout.
- No tokens/secrets, personal inventory exports, analytics tracking, endless polling, or heavy background jobs committed to this public repository.
- Battery-first: stop camera when hidden, keep OCR opt-in, lazy load artwork, limit network requests, honor data-saving settings.

## Work loop (Gitos-informed)
1. **Find:** read the actual execution path and reproduce the issue; write evidence, not speculation.
2. **Plan:** create one scoped work order, acceptance criteria, constraints and expected paths. Record architectural decisions as ADRs.
3. **Implement:** change only the approved scope on a non-production branch.
4. **Verify independently:** review the exact diff, run positive AND negative known-answer tests, check backward compatibility and edge cases.
5. **Land:** integrate into the existing `main` only after checks. Keep work-order outcomes and newly discovered limitations in the ledger.

For production-impacting changes, the test matrix includes: dashboard totals, purchase / sale arithmetic, saved binder quantities, scanner camera cleanup, card price freshness, gallery browsing, slab disclaimers, restock source transparency, service-worker shell/offline behavior. Tests are code evidence, not evidence of actual device FPS or battery life.

## Commands
- `npm test` — Node built-in test runner; zero package dependencies.
- `npm run check` — check JavaScript parser and HTML inline script.
- CI repeats these checks on every pull request and push. No deployment secrets required.
- Service worker shell changes require a cache-key bump and release validation.

## User-facing reporting
Explain what changed, what was actually verified, what remains uncertain, and whether the existing live app is affected. Prefer concise, solution-oriented summaries.
