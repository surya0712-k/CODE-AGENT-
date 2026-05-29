const WORKSPACE_KEY = 'code-agent-workspace';

export function getStoredWorkspace(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(WORKSPACE_KEY) ?? '';
}

export function setStoredWorkspace(path: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(WORKSPACE_KEY, path);
}

export function createTokenSource(agentName?: string) {
  return async () => {
    const workspacePath = getStoredWorkspace();
    const roomConfig = agentName
      ? { agents: [{ agent_name: agentName }] }
      : undefined;

    const res = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_path: workspacePath,
        room_config: roomConfig,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Failed to fetch connection details');
    }

    return res.json();
  };
}
