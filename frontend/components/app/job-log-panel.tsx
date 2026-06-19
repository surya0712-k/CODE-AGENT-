'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, ListTodoIcon } from 'lucide-react';
import type { JobLogEntry } from '@/hooks/useCursorJobLog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/shadcn/utils';

interface JobLogPanelProps {
  entries: JobLogEntry[];
  className?: string;
  /** Mobile: render as collapsible sheet triggered by FAB */
  collapsibleOnMobile?: boolean;
}

function statusBadgeClass(status?: string): string {
  switch (status?.toLowerCase()) {
    case 'running':
      return 'job-badge-running';
    case 'completed':
      return 'job-badge-completed';
    case 'failed':
      return 'job-badge-failed';
    case 'pending':
      return 'job-badge-pending';
    default:
      return 'job-badge-pending';
  }
}

function JobEntryRow({ entry }: { entry: JobLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = entry.text.length > 120;
  const displayText = expanded || !isLong ? entry.text : `${entry.text.slice(0, 120)}…`;

  return (
    <li className="text-xs leading-relaxed">
      {entry.status && (
        <span
          className={cn(
            'mr-1.5 inline-flex rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase',
            statusBadgeClass(entry.status)
          )}
        >
          {entry.status}
        </span>
      )}
      <span className="text-foreground">{displayText}</span>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-primary ml-1 cursor-pointer text-[10px] font-medium underline underline-offset-2"
        >
          {expanded ? 'less' : 'more'}
        </button>
      )}
    </li>
  );
}

function JobLogContent({ entries }: { entries: JobLogEntry[] }) {
  const sorted = useMemo(
    () => entries.slice().reverse(),
    [entries]
  );

  const latestAnnouncement = useMemo(() => {
    const latest = sorted[0];
    if (!latest) return '';
    return latest.status === 'failed'
      ? `Job failed: ${latest.text.slice(0, 80)}`
      : latest.status === 'completed'
        ? 'Coding job completed'
        : '';
  }, [sorted]);

  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {latestAnnouncement}
      </div>
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No coding jobs yet. Ask the agent to inspect or fix code.
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((entry) => (
            <JobEntryRow key={entry.key} entry={entry} />
          ))}
        </ul>
      )}
    </>
  );
}

function JobLogCard({
  entries,
  className,
  onClose,
}: {
  entries: JobLogEntry[];
  className?: string;
  onClose?: () => void;
}) {
  return (
    <aside
      className={cn(
        'border-border bg-background pointer-events-auto max-h-52 overflow-y-auto rounded-xl border p-3 text-left shadow-lg',
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Cursor jobs
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer text-xs"
            aria-label="Close job log"
          >
            <ChevronDownIcon className="size-4" />
          </button>
        )}
      </div>
      <JobLogContent entries={entries} />
    </aside>
  );
}

export function JobLogPanel({
  entries,
  className,
  collapsibleOnMobile = true,
}: JobLogPanelProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const runningCount = entries.filter((e) => e.status === 'running').length;

  if (!collapsibleOnMobile) {
    return <JobLogCard entries={entries} className={className} />;
  }

  return (
    <>
      {/* Desktop */}
      <JobLogCard entries={entries} className={cn('hidden md:block', className)} />

      {/* Mobile FAB + sheet */}
      <div className="pointer-events-none fixed right-4 bottom-36 z-30 md:hidden">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="pointer-events-auto rounded-full shadow-md"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-job-log"
        >
          <ListTodoIcon className="size-4" />
          Jobs
          {runningCount > 0 && (
            <span className="bg-amber-500/20 text-amber-700 dark:text-amber-300 ml-1 rounded-full px-1.5 text-[10px] font-semibold">
              {runningCount}
            </span>
          )}
          {mobileOpen ? (
            <ChevronDownIcon className="size-3.5" />
          ) : (
            <ChevronUpIcon className="size-3.5" />
          )}
        </Button>
      </div>

      {mobileOpen && (
        <div
          id="mobile-job-log"
          className="fixed inset-x-3 bottom-48 z-30 md:hidden"
        >
          <JobLogCard
            entries={entries}
            onClose={() => setMobileOpen(false)}
          />
        </div>
      )}
    </>
  );
}
