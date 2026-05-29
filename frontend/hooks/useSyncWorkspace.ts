'use client';

import { useEffect, useRef } from 'react';
import { useAgent, useRoomContext } from '@livekit/components-react';
import { getStoredWorkspace } from '@/lib/workspace';

/** Push workspace to the agent via RPC after the room connects. */
export function useSyncWorkspace() {
  const room = useRoomContext();
  const agent = useAgent();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!room) return;

    const path = getStoredWorkspace().trim();
    if (!path) return;

    const sync = async () => {
      const destination = agent.identity;
      if (!destination || syncedRef.current) return;

      try {
        const response = await room.localParticipant.performRpc({
          destinationIdentity: destination,
          method: 'agent.set_workspace',
          payload: JSON.stringify({ path }),
          responseTimeout: 15000,
        });
        const parsed = JSON.parse(response) as { ok?: boolean; error?: string };
        if (parsed.ok) {
          syncedRef.current = true;
        } else {
          console.warn('Workspace RPC sync:', parsed.error ?? response);
        }
      } catch (err) {
        console.warn('Workspace RPC sync failed:', err);
      }
    };

    void sync();

    const interval = window.setInterval(() => {
      if (!syncedRef.current) {
        void sync();
      }
    }, 2000);

    return () => {
      window.clearInterval(interval);
    };
  }, [room, agent.identity]);
}
