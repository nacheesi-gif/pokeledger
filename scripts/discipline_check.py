#!/usr/bin/env python3
"""Deterministic, dependency-free project discipline gate."""
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
required = [
    "AGENTS.md",
    "CLAUDE.md",
    ".agents/skills/gitos-discipline/SKILL.md",
    ".gitos/handoff.md",
    ".gitos/INDEX.md",
    ".gitos/brain/BRAIN.md",
    ".gitos/brain/wiki/index.md",
    ".gitos/brain/wiki/log.md",
    ".gitos/work-orders/WO-001.md",
    ".claude/settings.json",
    ".githooks/pre-commit",
    "tests/core.test.cjs",
    "tests/transactions.test.cjs",
]
errors = []
for relative in required:
    p = ROOT / relative
    if not p.is_file() or not p.read_text(encoding="utf-8").strip():
        errors.append(f"Required nonempty file missing: {relative}")
try:
    settings = json.loads((ROOT / ".claude/settings.json").read_text(encoding="utf-8"))
    hooks = settings.get("hooks", {}).get("SessionStart", [])
    if not hooks or not all(
        all(entry.get("type") == "command" and entry.get("command") == "python3 scripts/discipline_session.py"
            for entry in group.get("hooks", [])) for group in hooks
    ):
        errors.append("SessionStart must be read-only project context hook")
except (OSError, ValueError, AttributeError) as e:
    errors.append(f"Invalid Claude settings JSON: {e}")
try:
    agent = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
    if "pokeledger-v1" not in agent or "Gitos" not in agent:
        errors.append("AGENTS.md must preserve app and source attribution")
except OSError:
    pass
if errors:
    for e in errors:
        print("FAIL: " + e)
    sys.exit(1)
print(f"PASS: discipline gate, {len(required)} required files and project-scoped hook declaration")
