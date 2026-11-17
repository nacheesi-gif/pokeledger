# ADR-001 — Preserve existing PokéLedger

Status: accepted. Date: 2026-11-16.

## Context
The operator requested a complete refresh under Gitos discipline, not a fork or separately hosted app. Gitos is a Claude Code agent skill and workflow, whereas PokéLedger is a browser PWA.

## Decision
Apply evidence-led diagnostics, scoped work orders, persistent decisions, and independent checks to the existing repository. Use a temporary branch for safety, then integrate verified changes into `main`. Do not install Gitos's Python/Claude runtime inside the phone application.

## Consequences
Keeps free hosting and the existing user data unchanged. Automated Gitos agents and Claude hooks are not represented as active.
