#!/usr/bin/env python3
"""Claude Code UserPromptSubmit hook.

Appends every prompt the user sends to docs/log/<date>_<git-user>_<host>.md so that
requests from every machine and account are preserved in git. One file per
person+machine+day means two machines never edit the same file (no merge conflicts).

Never blocks the prompt and prints nothing (stdout of this hook would be fed to the model).
Obvious secrets (GitHub/OpenAI/Slack tokens, AWS keys, private keys) are masked.
"""
import json
import re
import socket
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOG_DIR = ROOT / "docs" / "log"

SECRET = re.compile(
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"
    r"|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}"
    r"|sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}"
)


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "unknown"


def git_user() -> str:
    try:
        out = subprocess.run(
            ["git", "config", "user.name"], cwd=ROOT, capture_output=True, text=True, timeout=5
        ).stdout.strip()
        return out or "unknown"
    except Exception:
        return "unknown"


def main() -> None:
    data = json.load(sys.stdin)
    prompt = (data.get("prompt") or "").strip()
    if not prompt:
        return
    prompt = SECRET.sub("[REDACTED]", prompt)

    now = datetime.now().astimezone()
    user = git_user()
    host = socket.gethostname().split(".")[0]
    session = (data.get("session_id") or "")[:8] or "-"

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    path = LOG_DIR / f"{now:%Y-%m-%d}_{slug(user)}_{slug(host)}.md"
    if not path.exists():
        path.write_text(
            f"# Запросы {now:%Y-%m-%d} · {user} · {host}\n\n"
            "Пишется автоматически hook-ом `scripts/log_prompt.py`. "
            "Под запросом Claude дописывает `**Сделано:**`.\n"
        )

    quoted = "\n".join(f"> {line}" if line else ">" for line in prompt.splitlines())
    with path.open("a") as f:
        f.write(f"\n### {now:%H:%M:%S %z} · сессия {session}\n\n{quoted}\n")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass  # logging must never break the user's prompt
    sys.exit(0)
