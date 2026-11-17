#!/usr/bin/env python3
"""Read-only Claude Code SessionStart context hook. Gitos-inspired, not upstream Gitos.

Never accesses private files or network. Does not execute a work order.
"""
import json
import sys
from pathlib import Path


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}
    cwd = payload.get("cwd") if isinstance(payload, dict) else None
    root = Path(cwd or ".").resolve()
    for candidate in (root, *root.parents):
        if (candidate / "AGENTS.md").exists() and (candidate / ".gitos" / "INDEX.md").exists():
            root = candidate
            break
    else:
        return
    print("PokéLedger project discipline active (read-only context reminder).")
    print("Read AGENTS.md and .agents/skills/gitos-discipline/SKILL.md.")
    print("For active work, read .gitos/INDEX.md, handoff.md and relevant decisions.")
    print("Check evidence, change scope, positive/negative tests and CI before landing.")
    print("Do not run upstream Gitos agents or optional services unless separately installed.")
    for rel in (".gitos/INDEX.md",):
        try:
            for row in (root / rel).read_text(encoding="utf-8").splitlines():
                if row.startswith("- WO-") and len(row) < 230:
                    print(row)
                    break
        except (OSError, UnicodeError):
            pass


if __name__ == "__main__":
    main()
