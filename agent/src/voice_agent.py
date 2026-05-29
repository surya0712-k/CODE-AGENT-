from __future__ import annotations

import asyncio
import json
import logging
import textwrap
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from livekit.agents import Agent, RunContext, function_tool, inference

from config import Settings
from cursor_bridge import CursorBridge
from jobs import Job, JobStatus, JobStore

logger = logging.getLogger("voice_agent")


@dataclass
class SessionData:
    workspace: str | None = None
    pending_fix_prompt: str | None = None
    jobs: JobStore = field(default_factory=JobStore)
    bridge: CursorBridge | None = None
    ending_call: bool = False
    request_end_call: Callable[[], Awaitable[None]] | None = None


class CodeVoiceAgent(Agent):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        super().__init__(
            llm=inference.LLM(model="openai/gpt-4.1-mini"),
            instructions=textwrap.dedent(
                """\
                You are a voice coding assistant. You help users understand and fix code
                in their project using available tools.

                Output rules for speech:
                - Always respond in English unless the user explicitly asks for another language.
                - Plain text only. No markdown, lists, code blocks, or emojis.
                - Keep replies brief: one to three sentences unless summarizing a completed task.
                - Do not mention internal tool names or job identifiers unless the user asks.
                - If code tools are unavailable, say so clearly instead of claiming you read files.

                Workflow:
                - If no workspace is set, ask for the project folder or use set_workspace.
                - Use inspect_code for questions, explanations, and read-only analysis.
                - Use fix_issue for bug fixes and implementation. Large changes require
                  the user to confirm with confirm_fix after you describe the plan.
                - Use get_cursor_job_status to report progress on background jobs.
                - When the user wants to hang up (bye, goodbye, end call, etc.), call
                  end_call once. Do not keep chatting after they say goodbye.

                Stay safe: refuse harmful requests and avoid unrelated file changes.
                """
            ),
        )

    def _resolved_workspace(self, data: SessionData) -> str | None:
        if data.workspace:
            return data.workspace
        if data.bridge is not None and data.bridge.workspace:
            return data.bridge.workspace
        default = self._settings.default_workspace()
        return str(default) if default is not None else None

    async def on_enter(self) -> None:
        data = self.session.userdata
        if not isinstance(data, SessionData):
            raise RuntimeError("Session userdata is not initialized")

        workspace: str | None = None
        for _ in range(40):
            workspace = self._resolved_workspace(data)
            if workspace:
                break
            await asyncio.sleep(0.25)

        if workspace:
            instructions = (
                "Greet the user briefly in one or two sentences. Their project folder "
                f"is already set to {workspace}. Say you are ready to inspect or fix code "
                "there. Do not ask them to provide the project folder again."
            )
        else:
            instructions = (
                "Greet the user briefly. Ask for their project folder path before you "
                "can read or fix code, or offer to set it if they say the path aloud."
            )

        await self.session.generate_reply(instructions=instructions)

    def _data(self, context: RunContext) -> SessionData:
        userdata = context.userdata
        if not isinstance(userdata, SessionData):
            raise RuntimeError("Session userdata is not initialized")
        return userdata

    def _bridge(self, context: RunContext) -> CursorBridge:
        data = self._data(context)
        if data.bridge is None:
            raise RuntimeError("Cursor bridge is not initialized for this session")
        return data.bridge

    def _cursor_setup_error(self) -> str | None:
        if not self._settings.cursor_api_key.strip():
            return (
                "Cursor API key is not configured. Add CURSOR_API_KEY to your "
                "repo .env file and restart the agent worker."
            )
        return None

    @function_tool
    async def set_workspace(self, context: RunContext, path: str) -> str:
        """Set the local project directory for code tools.

        Args:
            path: Absolute or relative path to the project root folder.
        """
        bridge = self._bridge(context)
        try:
            resolved = await bridge.set_workspace(path)
            self._data(context).workspace = resolved
            return f"Workspace set to {resolved}. You can now ask me to inspect or fix code."
        except ValueError as err:
            return str(err)

    @function_tool
    async def inspect_code(self, context: RunContext, request: str) -> str:
        """Read-only code analysis: explain code, find bugs, answer questions.

        Args:
            request: What to inspect or explain in the current workspace.
        """
        if err := self._cursor_setup_error():
            return err

        data = self._data(context)
        bridge = self._bridge(context)
        if not bridge.workspace and self._settings.default_workspace() is None:
            return (
                "No workspace is configured. Tell me your project folder path first."
            )

        job = data.jobs.create(kind="inspect", prompt=request)
        asyncio.create_task(
            self._run_job(context, job, read_only=True),
            name=f"cursor-inspect-{job.id}",
        )
        return (
            f"I started reviewing the code. Job {job.id} is running. "
            "Ask me for status or wait a moment for the summary."
        )

    @function_tool
    async def fix_issue(
        self,
        context: RunContext,
        request: str,
        confirmed: bool = False,
    ) -> str:
        """Apply code changes for a bug fix or feature request.

        Args:
            request: What to change or fix in the codebase.
            confirmed: Set true only after the user verbally confirmed the planned change.
        """
        data = self._data(context)

        if not confirmed:
            data.pending_fix_prompt = request
            return (
                "I will make code changes for that request. "
                "Please confirm by saying yes, then I will proceed."
            )

        if err := self._cursor_setup_error():
            return err

        prompt = data.pending_fix_prompt or request
        data.pending_fix_prompt = None

        bridge = self._bridge(context)
        if not bridge.workspace and self._settings.default_workspace() is None:
            return "Set a workspace folder before I can apply fixes."

        job = data.jobs.create(kind="fix", prompt=prompt)
        asyncio.create_task(
            self._run_job(context, job, read_only=False),
            name=f"cursor-fix-{job.id}",
        )
        return (
            f"Started the fix in the background as job {job.id}. "
            "I will summarize when it completes."
        )

    @function_tool
    async def confirm_fix(self, context: RunContext) -> str:
        """Confirm a pending fix_issue after the user said yes."""
        data = self._data(context)
        if not data.pending_fix_prompt:
            return "There is no pending fix waiting for confirmation."
        request = data.pending_fix_prompt
        return await self.fix_issue(context, request=request, confirmed=True)

    @function_tool
    async def end_call(self, context: RunContext) -> str:
        """End the voice call after a brief goodbye (user said bye, end call, etc.)."""
        data = self._data(context)
        if data.request_end_call is None:
            return "Could not end the call from this session."
        if data.ending_call:
            return "The call is already ending."
        asyncio.create_task(data.request_end_call(), name="end-call")
        return "Goodbye. Ending the call now."

    @function_tool
    async def get_cursor_job_status(
        self, context: RunContext, job_id: str
    ) -> str:
        """Check status of a background Cursor coding job.

        Args:
            job_id: The job id returned by inspect_code or fix_issue.
        """
        job = self._data(context).jobs.get(job_id)
        if job is None:
            return f"No job found with id {job_id}."

        if job.status == JobStatus.RUNNING:
            hint = job.last_chunk[-200:] if job.last_chunk else "still working"
            return f"Job {job_id} is running. Latest update: {hint}"

        if job.status == JobStatus.COMPLETED:
            return job.result_summary or f"Job {job_id} completed successfully."

        if job.status == JobStatus.FAILED:
            return job.error or f"Job {job_id} failed."

        return f"Job {job_id} status is {job.status.value}."

    async def _run_job(
        self, context: RunContext, job: Job, *, read_only: bool
    ) -> None:
        bridge = self._bridge(context)
        await bridge.run_job(job, read_only=read_only)

        try:
            if job.status == JobStatus.COMPLETED and job.result_summary:
                await self.session.generate_reply(
                    instructions=(
                        "Briefly tell the user the coding task finished. "
                        f"Summarize in two sentences: {job.result_summary}"
                    )
                )
            elif job.status == JobStatus.FAILED and job.error:
                await self.session.generate_reply(
                    instructions=(
                        "Tell the user the coding task failed in one sentence: "
                        f"{job.error}"
                    )
                )
        except Exception:
            logger.exception("Failed to announce job result")
