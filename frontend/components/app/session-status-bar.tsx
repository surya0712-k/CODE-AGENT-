'use client';

import { useEffect, useState } from 'react';
import { CheckIcon, CopyIcon, FolderIcon } from 'lucide-react';
import { useAgent } from '@livekit/components-react';
import { getStoredWorkspace } from '@/lib/workspace';
import { cn } from '@/lib/shadcn/utils';

const STATE_LABELS: Record<string, string> = {
  initializing: 'Connecting',
  idle: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
};

const STATE_DOT: Record<string, string> = {
  initializing: 'bg-muted-foreground',
  idle: 'bg-muted-foreground',
  listening: 'bg-emerald-500 animate-pulse',
  thinking: 'bg-amber-500 animate-pulse',
  speaking: 'bg-primary',
};

function truncatePath(path: string, max = 42): string {
  if (path.length <= max) return path;
  const head = Math.floor(max * 0.45);
  const tail = max - head - 1;
  return `${path.slice(0, head)}…${path.slice(-tail)}`;
}

export function SessionStatusBar({ className }: { className?: string }) {
  const { state } = useAgent();
  const [workspace, setWorkspace] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setWorkspace(getStoredWorkspace());
  }, []);

  const stateKey = state ?? 'idle';
  const stateLabel = STATE_LABELS[stateKey] ?? stateKey;
  const dotClass = STATE_DOT[stateKey] ?? 'bg-muted-foreground';

  const handleCopyPath = async () => {
    if (!workspace) return;
    try {
      await navigator.clipboard.writeText(workspace);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div
      className={cn(
        'border-border/60 bg-background/90 flex w-full items-center justify-between gap-3 rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur-sm',
        className
      )}
    >
      <button
        type="button"
        onClick={handleCopyPath}
        disabled={!workspace}
        title={workspace ? `Copy path: ${workspace}` : 'No project folder selected'}
        className="hover:bg-muted/60 flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-full px-1 py-0.5 text-left transition-colors disabled:cursor-default disabled:opacity-70"
      >
        <FolderIcon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
        <span className="text-foreground truncate font-medium">
          {workspace ? truncatePath(workspace) : 'No project folder'}
        </span>
        {workspace && (
          copied ? (
            <CheckIcon className="text-emerald-600 size-3 shrink-0 dark:text-emerald-400" aria-hidden />
          ) : (
            <CopyIcon className="text-muted-foreground size-3 shrink-0 opacity-60" aria-hidden />
          )
        )}
      </button>
      <div
        className="bg-muted/60 text-foreground flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-medium"
        role="status"
        aria-live="polite"
      >
        <span className={cn('size-1.5 rounded-full', dotClass)} aria-hidden />
        {stateLabel}
      </div>
    </div>
  );
}

export function SessionCallHints({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'text-muted-foreground pointer-events-none text-center text-[11px] leading-relaxed',
        className
      )}
    >
      Speak naturally · Ask to inspect or fix code · Open transcript to type · Say goodbye to end
    </p>
  );
}
