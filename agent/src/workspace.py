from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


@dataclass
class WorkspaceTarget:
    """Session-scoped Cursor workspace: local disk path or cloud GitHub repo."""

    mode: Literal["local", "cloud"]
    local_path: str | None = None
    cloud_repo_url: str | None = None
    project_name: str | None = None
    starting_ref: str | None = "main"

    def is_configured(self) -> bool:
        if self.mode == "local":
            return bool(self.local_path)
        return bool(self.cloud_repo_url)

    def summary(self) -> str:
        if self.mode == "local" and self.local_path:
            return self.local_path
        if self.mode == "cloud" and self.project_name:
            return f"{self.project_name} ({self.cloud_repo_url})"
        if self.mode == "cloud" and self.cloud_repo_url:
            return self.cloud_repo_url
        return "not configured"
