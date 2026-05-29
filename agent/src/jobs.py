from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Job:
    id: str
    kind: str
    prompt: str
    status: JobStatus = JobStatus.PENDING
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    last_chunk: str = ""
    result_summary: str | None = None
    error: str | None = None
    task: asyncio.Task[Any] | None = field(default=None, repr=False)

    def touch(self, **updates: Any) -> None:
        for key, value in updates.items():
            setattr(self, key, value)
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def to_public_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "kind": self.kind,
            "status": self.status.value,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "last_chunk": self.last_chunk[-500:] if self.last_chunk else "",
            "result_summary": self.result_summary,
            "error": self.error,
        }


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}

    def create(self, kind: str, prompt: str) -> Job:
        job = Job(id=str(uuid.uuid4())[:8], kind=kind, prompt=prompt)
        self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)

    def list_jobs(self) -> list[Job]:
        return sorted(
            self._jobs.values(),
            key=lambda job: job.created_at,
            reverse=True,
        )
