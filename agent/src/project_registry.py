from __future__ import annotations

import difflib
import logging
import re
from dataclasses import dataclass
from pathlib import Path

import yaml

logger = logging.getLogger("project_registry")


@dataclass(frozen=True)
class ProjectEntry:
    name: str
    repo: str
    branch: str = "main"
    aliases: tuple[str, ...] = ()

    def matches(self, normalized: str) -> bool:
        if _normalize(self.name) == normalized:
            return True
        return any(_normalize(alias) == normalized for alias in self.aliases)


def _normalize(text: str) -> str:
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


class ProjectRegistry:
    def __init__(self, entries: list[ProjectEntry]) -> None:
        self._entries = entries

    @classmethod
    def load(cls, path: Path) -> ProjectRegistry:
        if not path.is_file():
            logger.warning("Project registry not found: %s", path)
            return cls([])
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        projects = raw.get("projects") or []
        entries: list[ProjectEntry] = []
        for item in projects:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name", "")).strip()
            repo = str(item.get("repo", "")).strip()
            if not name or not repo:
                continue
            branch = str(item.get("branch", "main")).strip() or "main"
            aliases_raw = item.get("aliases") or []
            aliases = tuple(str(a).strip() for a in aliases_raw if str(a).strip())
            entries.append(
                ProjectEntry(name=name, repo=repo, branch=branch, aliases=aliases)
            )
        logger.info("Loaded %d project(s) from %s", len(entries), path)
        return cls(entries)

    def list_names(self) -> list[str]:
        return [entry.name for entry in self._entries]

    def resolve(self, spoken_name: str) -> ProjectEntry | None:
        if not spoken_name.strip() or not self._entries:
            return None

        normalized = _normalize(spoken_name)
        for entry in self._entries:
            if entry.matches(normalized):
                return entry

        # Fuzzy match on display names and aliases
        choices: dict[str, ProjectEntry] = {}
        for entry in self._entries:
            choices[_normalize(entry.name)] = entry
            for alias in entry.aliases:
                choices[_normalize(alias)] = entry

        matches = difflib.get_close_matches(
            normalized, list(choices.keys()), n=1, cutoff=0.72
        )
        if matches:
            return choices[matches[0]]
        return None

    def resolve_or_error(self, spoken_name: str) -> tuple[ProjectEntry | None, str]:
        entry = self.resolve(spoken_name)
        if entry is not None:
            return entry, ""
        names = self.list_names()
        if not names:
            return None, "No projects are configured in the registry."
        if len(names) == 1:
            return (
                None,
                f"I could not match '{spoken_name}'. The only available project is {names[0]}.",
            )
        joined = ", ".join(names[:6])
        suffix = " and others" if len(names) > 6 else ""
        return (
            None,
            f"I could not match '{spoken_name}'. Available projects: {joined}{suffix}.",
        )


def default_registry_path(settings_path: str | None = None) -> Path:
    if settings_path and settings_path.strip():
        return Path(settings_path).expanduser().resolve()
    return Path(__file__).resolve().parent.parent / "projects.yaml"
