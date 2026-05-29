from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env.local", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    livekit_url: str = Field(default="", alias="LIVEKIT_URL")
    livekit_api_key: str = Field(default="", alias="LIVEKIT_API_KEY")
    livekit_api_secret: str = Field(default="", alias="LIVEKIT_API_SECRET")

    cursor_api_key: str = Field(default="", alias="CURSOR_API_KEY")
    cursor_model: str = Field(default="default", alias="CURSOR_MODEL")
    cursor_runtime: Literal["local", "cloud"] = Field(
        default="local", alias="CURSOR_RUNTIME"
    )
    cursor_default_cwd: str = Field(default="", alias="CURSOR_DEFAULT_CWD")
    cursor_allowed_roots: str = Field(default="", alias="CURSOR_ALLOWED_ROOTS")
    cursor_cloud_repo: str = Field(default="", alias="CURSOR_CLOUD_REPO")

    agent_name: str = Field(default="code-voice-agent", alias="AGENT_NAME")

    @field_validator("cursor_runtime", mode="before")
    @classmethod
    def normalize_runtime(cls, value: object) -> str:
        if value is None:
            return "local"
        return str(value).strip().lower()

    @field_validator("cursor_model", mode="before")
    @classmethod
    def normalize_cursor_model(cls, value: object) -> str:
        if value is None:
            return "default"
        model = str(value).strip()
        # Cursor API uses "default" for Auto; "auto" is rejected.
        if model.lower() == "auto":
            return "default"
        return model

    def allowed_root_paths(self) -> list[Path]:
        if not self.cursor_allowed_roots.strip():
            return []
        return [
            Path(part.strip()).expanduser().resolve()
            for part in self.cursor_allowed_roots.split(",")
            if part.strip()
        ]

    def validate_workspace(self, workspace: str) -> Path:
        path = Path(workspace).expanduser().resolve()
        if not path.exists():
            raise ValueError(f"Workspace does not exist: {path}")
        if not path.is_dir():
            raise ValueError(f"Workspace is not a directory: {path}")

        roots = self.allowed_root_paths()
        if roots:
            allowed = any(path == root or _is_under_root(path, root) for root in roots)
            if not allowed:
                raise ValueError(
                    f"Workspace {path} is outside allowed roots: {roots}"
                )
        return path

    def default_workspace(self) -> Path | None:
        if not self.cursor_default_cwd.strip():
            return None
        return self.validate_workspace(self.cursor_default_cwd)


def _is_under_root(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


@lru_cache
def get_settings() -> Settings:
    return Settings()
