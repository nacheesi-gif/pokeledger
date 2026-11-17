---
name: gitos-discipline
description: Apply evidence-led, scoped, verifiable software development to any repository. Based on Gitos principles, adapted for ChatGPT/Codex/Claude.
---

# Universal build discipline (Gitos-informed)

## Start every engineering task
1. Identify the actual repository, existing functionality and constraints. Read `AGENTS.md`, `.gitos/handoff.md`, `.gitos/INDEX.md` and relevant ADRs when present.
2. Check existing GitHub/open-source solutions, licensing, maintenance, security and platform compatibility **before installing dependencies**.
3. Trace concrete code paths and collect evidence. Label hypotheses as unverified rather than asserting a bug.
4. For multi-file or risky work, make a scoped work order with measurable pass and block cases.
5. Implement the smallest compatible change; preserve data and user-facing workflows.
6. Run parser and behavioral tests, including a known-answer negative test for each gate. Review the resulting diff and CI result.
7. Report exactly what changed, how it was verified and what still requires live or device testing.
8. Update decisions and work ledger once landed; separate what is known from what is proposed.

## Boundaries
- Never treat a GitHub commit as proof of deployment.
- Never treat passing unit tests as a phone battery/FPS benchmark.
- Never run fetched installation scripts or arbitrary GitHub code before inspection.
- Never overwrite production datasets, secrets or personal records to run a test.
- Use free, maintainable, local-first solutions when practical; justify dependencies.
- Forward, constructive, non-patronizing explanations.
- No mandatory autonomous subagent, hidden background work or unsupervised pushes.

## Work order discipline
Find → Plan → Implement → Verify → Land. Put facts in brain, decisions in ADR, actions in work orders, and runtime behavior in code; avoid duplicated truth.

## References
Read `.gitos/upstream/engineering-disciplines.md` for the reviewed upstream rule definitions when evaluating a difficult change. Its MIT license is kept in `.gitos/upstream/LICENSE`.

Gitos upstream: https://github.com/wizzo-gmb/gitos — MIT © 2026 Wizzo.
Full upstream engine is a Claude Code skill and is not installed or executed by the mere presence of this file.
