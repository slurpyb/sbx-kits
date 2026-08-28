#!/usr/bin/env python3
"""Idempotently merge Agent Observatory hooks into a harness configuration."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

HOME = Path(os.environ.get("HOME", "/home/agent"))
HOOK = "python3 /home/agent/.local/bin/agent-observe-hook"
MARKER = "agent-observe-hook"


def load(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text())
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def save(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    temporary.replace(path)


def command(harness: str, event: str) -> dict[str, Any]:
    return {
        "type": "command",
        "command": f"{HOOK} {harness} {event}",
        "timeout": 4,
    }


def contains_marker(value: object) -> bool:
    try:
        return MARKER in json.dumps(value, sort_keys=True)
    except (TypeError, ValueError):
        return False


def add_standard_event(events: dict[str, Any], harness: str, event: str, matcher: str | None = None) -> None:
    current = events.get(event)
    groups = current if isinstance(current, list) else []
    groups = [group for group in groups if not contains_marker(group)]
    group: dict[str, Any] = {"hooks": [command(harness, event)]}
    if matcher is not None:
        group["matcher"] = matcher
    groups.append(group)
    events[event] = groups


def install_codex() -> None:
    path = HOME / ".codex" / "hooks.json"
    config = load(path)
    hooks_value = config.get("hooks")
    hooks: dict[str, Any] = dict(hooks_value) if isinstance(hooks_value, dict) else {}
    for event in ("SessionStart", "UserPromptSubmit", "Stop", "SubagentStart", "SubagentStop"):
        add_standard_event(hooks, "codex", event)
    add_standard_event(hooks, "codex", "PostToolUse", ".*")
    config["description"] = config.get("description") or "User hooks plus Docker Sandbox Agent Observatory relay."
    config["hooks"] = hooks
    save(path, config)


def install_claude() -> None:
    path = HOME / ".claude" / "settings.json"
    config = load(path)
    hooks_value = config.get("hooks")
    hooks: dict[str, Any] = dict(hooks_value) if isinstance(hooks_value, dict) else {}
    for event in ("SessionStart", "UserPromptSubmit", "Stop", "SessionEnd", "SubagentStart", "SubagentStop"):
        add_standard_event(hooks, "claude", event)
    for event in ("PostToolUse", "PostToolUseFailure"):
        add_standard_event(hooks, "claude", event, ".*")
    config["hooks"] = hooks
    save(path, config)


def install_agy() -> None:
    path = HOME / ".gemini" / "config" / "hooks.json"
    config = load(path)
    config["sbx-observability"] = {
        "PreInvocation": [command("agy", "PreInvocation")],
        "PostInvocation": [command("agy", "PostInvocation")],
        "PostToolUse": [{"matcher": "*", "hooks": [command("agy", "PostToolUse")]}],
        "Stop": [command("agy", "Stop")],
    }
    save(path, config)


def main() -> int:
    harness = sys.argv[1] if len(sys.argv) > 1 else ""
    installers = {"codex": install_codex, "claude": install_claude, "agy": install_agy}
    installer = installers.get(harness)
    if installer is None:
        print(f"usage: {sys.argv[0]} codex|claude|agy", file=sys.stderr)
        return 2
    installer()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
