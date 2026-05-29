'use client';

import { useEffect, useState } from 'react';
import { RoomEvent } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';

export type JobLogEntry = {
  /** Stable key for React lists (job id or chunk id). */
  key: string;
  id: string;
  kind?: string;
  status?: string;
  text: string;
  at: number;
};

type JobPayload = {
  type?: string;
  job_id?: string;
  text?: string;
  job?: {
    id?: string;
    kind?: string;
    status?: string;
    last_chunk?: string;
    result_summary?: string;
    error?: string;
  };
};

function upsertEntry(prev: JobLogEntry[], entry: JobLogEntry): JobLogEntry[] {
  const idx = prev.findIndex((e) => e.key === entry.key);
  if (idx === -1) {
    return [...prev.slice(-49), entry];
  }
  const next = [...prev];
  next[idx] = entry;
  return next;
}

export function useCursorJobLog() {
  const room = useRoomContext();
  const [entries, setEntries] = useState<JobLogEntry[]>([]);

  useEffect(() => {
    if (!room) return;

    const onData = (
      payload: Uint8Array,
      _participant: unknown,
      _kind: unknown,
      topic?: string
    ) => {
      if (topic !== 'cursor_job') return;
      try {
        const parsed = JSON.parse(new TextDecoder().decode(payload)) as JobPayload;
        const at = Date.now();

        if (parsed.type === 'job_chunk' && parsed.job_id && parsed.text) {
          const chunkKey = `${parsed.job_id}-chunk-${at}`;
          setEntries((prev) =>
            upsertEntry(prev, {
              key: chunkKey,
              id: parsed.job_id!,
              text: parsed.text ?? '',
              at,
            })
          );
          return;
        }

        if (parsed.type === 'job_update' && parsed.job) {
          const job = parsed.job;
          const jobId = job.id ?? `job-${at}`;
          const summary =
            job.result_summary ??
            job.error ??
            job.last_chunk ??
            `Status: ${job.status ?? 'unknown'}`;
          setEntries((prev) =>
            upsertEntry(prev, {
              key: jobId,
              id: jobId,
              kind: job.kind,
              status: job.status,
              text: summary ?? '',
              at,
            })
          );
        }
      } catch {
        // ignore malformed payloads
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  return entries;
}
