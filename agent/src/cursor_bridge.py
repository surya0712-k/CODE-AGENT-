from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

import httpx
from cursor_sdk import (
    AsyncAgent,
    AsyncClient,
    CloudAgentOptions,
    CloudRepository,
    CursorAgentError,
)
from cursor_sdk import LocalAgentOptions as SdkLocalAgentOptions

from config import Settings
from jobs import Job, JobStatus
from workspace import WorkspaceTarget

logger = logging.getLogger("cursor_bridge")

PublishFn = Callable[[dict[str, Any]], Awaitable[None]]

VOICE_PREFIX = (
    "The user is speaking via a voice interface. "
    "Reply in two or three short plain sentences suitable for text-to-speech. "
    "Do not use markdown, lists, code fences, or emojis. "
)


class CursorBridge:
    """Wraps Cursor SDK async agents for a single voice session."""

    def __init__(
        self,
        settings: Settings,
        publish: PublishFn | None = None,
    ) -> None:
        self._settings = settings
        self._publish = publish
        self._client: AsyncClient | None = None
        self._agent: AsyncAgent | None = None
        self._target: WorkspaceTarget | None = None

    @property
    def workspace(self) -> str | None:
        if self._target and self._target.mode == "local":
            return self._target.local_path
        return None

    @property
    def target(self) -> WorkspaceTarget | None:
        return self._target

    def is_configured(self) -> bool:
        if self._target is not None and self._target.is_configured():
            return True
        if self._settings.cursor_runtime == "local":
            return self._settings.default_workspace() is not None
        return bool(self._settings.cursor_cloud_repo)

    async def set_workspace(self, path: str) -> str:
        resolved = self._settings.validate_workspace(path)
        self._target = WorkspaceTarget(
            mode="local",
            local_path=str(resolved),
        )
        await self._reset_runtime()
        return str(resolved)

    async def set_cloud_project(
        self,
        *,
        project_name: str,
        repo_url: str,
        starting_ref: str = "main",
    ) -> WorkspaceTarget:
        self._target = WorkspaceTarget(
            mode="cloud",
            cloud_repo_url=repo_url,
            project_name=project_name,
            starting_ref=starting_ref or "main",
        )
        await self._reset_runtime()
        return self._target

    async def close(self) -> None:
        await self._reset_runtime()

    async def _reset_runtime(self) -> None:
        if self._agent is not None:
            try:
                await self._agent.close()
            except Exception:
                logger.exception("Failed to close Cursor agent")
            self._agent = None
        if self._client is not None:
            try:
                await self._client.aclose()
            except Exception:
                logger.exception("Failed to close Cursor bridge client")
            self._client = None

    def _effective_target(self) -> WorkspaceTarget:
        if self._target is not None and self._target.is_configured():
            return self._target

        if self._settings.cursor_runtime == "cloud" and self._settings.cursor_cloud_repo:
            return WorkspaceTarget(
                mode="cloud",
                cloud_repo_url=self._settings.cursor_cloud_repo,
                project_name="default",
                starting_ref="main",
            )

        default = self._settings.default_workspace()
        if default is not None:
            return WorkspaceTarget(mode="local", local_path=str(default))

        return WorkspaceTarget(mode="local")

    def _bridge_workspace(self) -> str:
        target = self._effective_target()
        if target.mode == "local" and target.local_path:
            return target.local_path
        default = self._settings.default_workspace()
        if default is not None:
            return str(default)
        return "."

    async def _ensure_client(self) -> AsyncClient:
        workspace = self._bridge_workspace()
        if self._client is None:
            logger.info("Launching Cursor bridge for workspace: %s", workspace)
            self._client = await AsyncClient.launch_bridge(workspace=workspace)
        return self._client

    async def _verify_cursor_api_access(self) -> None:
        """Surface plan/auth errors before the SDK turns them into opaque HTTP 500."""
        key = self._settings.cursor_api_key.strip()
        if not key:
            raise ValueError(
                "CURSOR_API_KEY is not configured. Add it to repo .env and restart the agent."
            )

        async with httpx.AsyncClient(timeout=15) as http:
            response = await http.get(
                "https://api.cursor.com/v1/me",
                headers={"Authorization": f"Bearer {key}"},
            )

        if response.status_code == 200:
            return

        message = "Cursor API rejected this key."
        try:
            body = response.json()
            err = body.get("error") if isinstance(body, dict) else None
            if isinstance(err, dict):
                message = err.get("message") or message
                if err.get("code") == "plan_required":
                    raise ValueError(
                        "Cursor Agents require a Pro or Teams plan. Your account is on "
                        "the Free plan (API returned plan_required). Upgrade at "
                        "https://www.cursor.com/pricing. The voice agent cannot inspect or "
                        "fix code until then."
                    )
        except ValueError:
            raise
        except Exception:
            pass

        if response.status_code == 401:
            raise ValueError(
                "CURSOR_API_KEY is invalid or expired. Create a new key at "
                "https://cursor.com/dashboard/integrations"
            )

        raise ValueError(f"{message} (HTTP {response.status_code})")

    async def _ensure_agent(self) -> AsyncAgent:
        if self._agent is not None:
            return self._agent

        await self._verify_cursor_api_access()

        client = await self._ensure_client()
        target = self._effective_target()

        if target.mode == "cloud":
            if not target.cloud_repo_url:
                raise ValueError(
                    "No cloud project selected. Say the project name or use "
                    "select_cloud_project before inspecting or fixing code."
                )
            self._agent = await AsyncAgent.create(
                client=client,
                model=self._settings.cursor_model,
                api_key=self._settings.cursor_api_key,
                cloud=CloudAgentOptions(
                    repos=[
                        CloudRepository(
                            url=target.cloud_repo_url,
                            starting_ref=target.starting_ref or "main",
                        )
                    ],
                    auto_create_pr=self._settings.cloud_auto_create_pr,
                ),
            )
        else:
            local_path = target.local_path
            if not local_path:
                default = self._settings.default_workspace()
                if default is None:
                    raise ValueError(
                        "No workspace set. Call set_workspace or set CURSOR_DEFAULT_CWD"
                    )
                local_path = str(default)
                self._target = WorkspaceTarget(mode="local", local_path=local_path)

            self._agent = await AsyncAgent.create(
                client=client,
                model=self._settings.cursor_model,
                api_key=self._settings.cursor_api_key,
                local=SdkLocalAgentOptions(cwd=local_path),
            )

        logger.info(
            "Cursor agent ready: %s (model=%s, mode=%s)",
            self._agent.agent_id,
            self._settings.cursor_model,
            target.mode,
        )
        return self._agent

    async def _publish_event(self, payload: dict[str, Any]) -> None:
        if self._publish is None:
            return
        try:
            await self._publish(payload)
        except Exception:
            logger.exception("Failed to publish cursor job event")

    async def run_job(self, job: Job, *, read_only: bool) -> None:
        job.touch(status=JobStatus.RUNNING)
        await self._publish_event(
            {"type": "job_update", "job": job.to_public_dict()}
        )

        mode_hint = (
            "Inspect and explain only. Do not modify any files."
            if read_only
            else "Make minimal, focused code changes to satisfy the request."
        )
        prompt = f"{VOICE_PREFIX}{mode_hint}\n\nUser request: {job.prompt}"

        try:
            agent = await self._ensure_agent()
            run = await agent.send(prompt)
            logger.info(
                "Cursor run started agent=%s run=%s job=%s",
                agent.agent_id,
                run.id,
                job.id,
            )

            summary_parts: list[str] = []
            async for message in run.messages():
                text = _extract_text(message)
                if text:
                    job.touch(last_chunk=text)
                    summary_parts.append(text)
                    await self._publish_event(
                        {
                            "type": "job_chunk",
                            "job_id": job.id,
                            "text": text,
                        }
                    )

            result = await run.wait()
            if result.status == "error":
                job.touch(
                    status=JobStatus.FAILED,
                    error=f"Cursor run failed: {result.id}",
                )
            else:
                summary = " ".join(summary_parts)[-1500:] or "Task completed."
                job.touch(
                    status=JobStatus.COMPLETED,
                    result_summary=summary,
                )
        except CursorAgentError as err:
            job.touch(
                status=JobStatus.FAILED,
                error=_format_cursor_error(err),
            )
            logger.error("CursorAgentError job=%s: %r", job.id, err)
        except Exception as err:
            job.touch(status=JobStatus.FAILED, error=str(err))
            logger.exception("Cursor job failed job=%s", job.id)
        finally:
            await self._publish_event(
                {"type": "job_update", "job": job.to_public_dict()}
            )


def _format_cursor_error(err: CursorAgentError) -> str:
    parts = [err.message or "unknown error"]
    if err.code:
        parts[0] = f"{err.code}: {parts[0]}"
    if err.status:
        parts.append(f"HTTP {err.status}")
    if err.request_id:
        parts.append(f"request_id={err.request_id}")

    hint = (
        " Check CURSOR_API_KEY, restart the agent worker, and ensure the project "
        "folder exists locally (OneDrive paths must be synced)."
    )
    if err.status == 500 and (err.code or "").lower() in {"internal", ""}:
        hint = (
            " This often means your Cursor account is on the Free plan while Agents "
            "require Pro or Teams — upgrade at https://www.cursor.com/pricing."
        )

    return f"Cursor failed: {' '.join(parts)}.{hint}"


def _extract_text(message: Any) -> str:
    """Best-effort text extraction from SDK stream messages."""
    if hasattr(message, "text") and isinstance(message.text, str):
        return message.text.strip()

    msg = getattr(message, "message", message)
    content = getattr(msg, "content", None)
    if not content:
        return ""

    chunks: list[str] = []
    for block in content:
        block_type = getattr(block, "type", None)
        if block_type == "text":
            text = getattr(block, "text", "")
            if text:
                chunks.append(str(text))
    return " ".join(chunks).strip()


async def publish_to_room(
    room: Any, payload: dict[str, Any], *, topic: str = "cursor_job"
) -> None:
    """Publish JSON events on the LiveKit data channel."""
    import json

    data = json.dumps(payload).encode("utf-8")
    await room.local_participant.publish_data(
        data,
        reliable=True,
        topic=topic,
    )
