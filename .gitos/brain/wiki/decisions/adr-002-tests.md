# ADR-002 — Deterministic tests are release gates

Status: accepted. Date: 2026-11-16.

## Context
Parser validation alone misses accounting, UI state, stale market data and caching regressions.

## Decision
Use Node's built-in test runner (zero dependencies), with positive and negative fixtures. Add a GitHub Actions workflow to parse all app scripts and test core observable behavior before releasing.

## Consequences
Small files, no new package installs or monthly costs. Real browser and phone performance remain a separate validation stage.
