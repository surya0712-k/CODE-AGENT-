'use client';

import type { JobLogEntry } from '@/hooks/useCursorJobLog';
import { cn } from '@/lib/shadcn/utils';

interface JobLogPanelProps {
  entries: JobLogEntry[];
  className?: string;
}

export function JobLogPanel({ entries, className }: JobLogPanelProps) {
  return (
    <aside
      className={cn(
        'border-border bg-background pointer-events-auto max-h-48 overflow-y-auto rounded-lg border p-3 text-left shadow-sm',
        className
      )}
    >
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        Cursor jobs
      </p>
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-xs">No coding jobs yet.</p>
      ) : (
        <ul className="space-y-2">
          {entries
            .slice()
            .reverse()
            .map((entry) => (
              <li key={entry.key} className="text-xs leading-relaxed">
                {entry.status && (
                  <span className="text-primary mr-1 font-mono font-semibold">
                    [{entry.status}]
                  </span>
                )}
                <span className="text-foreground">{entry.text}</span>
              </li>
            ))}
        </ul>
      )}
    </aside>
  );
}
