'use client';

import { useEffect, useRef } from 'react';
import { RoomEvent } from 'livekit-client';
import { useRoomContext, useSessionContext } from '@livekit/components-react';

const SESSION_CONTROL_TOPIC = 'session_control';
const DEFAULT_DELAY_MS = 1800;

/** Disconnect when the agent publishes an end_call signal (after goodbye). */
export function useEndCallOnSignal() {
  const room = useRoomContext();
  const { end } = useSessionContext();
  const endedRef = useRef(false);

  useEffect(() => {
    if (!room) return;

    const onData = (
      payload: Uint8Array,
      _participant: unknown,
      _kind: unknown,
      topic?: string
    ) => {
      if (topic !== SESSION_CONTROL_TOPIC || endedRef.current) return;
      try {
        const parsed = JSON.parse(new TextDecoder().decode(payload)) as {
          type?: string;
          delay_ms?: number;
        };
        if (parsed.type !== 'end_call') return;

        endedRef.current = true;
        const delay = parsed.delay_ms ?? DEFAULT_DELAY_MS;
        window.setTimeout(() => {
          if (typeof end === 'function') {
            end();
          }
        }, delay);
      } catch {
        // ignore malformed payloads
      }
    };

    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, end]);
}
