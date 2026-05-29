"""Load environment variables from repo root and agent directory."""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv


def load_project_env() -> list[Path]:
    """Load .env then .env.local from agent/ and repo root (later files win)."""
    agent_dir = Path(__file__).resolve().parents[1]
    repo_root = agent_dir.parent
    loaded: list[Path] = []

    for base in (repo_root, agent_dir):
        for name in (".env", ".env.local"):
            path = base / name
            if path.is_file():
                load_dotenv(path, override=True)
                loaded.append(path)

    return loaded
