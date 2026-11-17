# ADR-003 — Respect user data and mobile energy

Status: accepted. Date: 2026-11-16.

## Context
Cameras, repeated DOM redraws, network requests and inaccurate external data can degrade the user experience.

## Decision
Keep camera/OCR opt-in, release tracks when hidden, lazy load grid assets, cap concurrent pricing fetches, respect reduced-data mode, avoid indefinite background polling, preserve all local financial data.

## Consequences
Prioritize measured improvements over unverified claims. Never silently overwrite a saved price with a stale quote or treat restock reports as verified current stock.
