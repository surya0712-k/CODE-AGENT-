'use client';

import { useEffect, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pickProjectFolder } from '@/lib/pick-folder';
import { getStoredWorkspace, setStoredWorkspace } from '@/lib/workspace';
import { cn } from '@/lib/shadcn/utils';

const EXAMPLE_PHRASES = [
  'Inspect my files',
  'Fix the login bug',
  'What language is this project?',
  'Goodbye',
];

const BEFORE_YOU_START = [
  'Allow microphone when the browser asks',
];

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
}

export const WelcomeView = ({
  startButtonText,
  onStartCall,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const [workspace, setWorkspace] = useState('');
  const [runtime] = useState('local');
  const [pickerHint, setPickerHint] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  useEffect(() => {
    setWorkspace(getStoredWorkspace());
  }, []);

  const canStart = workspace.trim().length > 0;
  const trimmedPath = workspace.trim();

  const handleSelectFolder = async () => {
    setPickerHint(null);
    setIsPicking(true);
    try {
      const result = await pickProjectFolder();
      if (result.ok) {
        setWorkspace(result.path);
        setStoredWorkspace(result.path);
        setPickerHint(null);
        return;
      }
      if ('cancelled' in result && result.cancelled) {
        return;
      }
      if ('error' in result) {
        setPickerHint(result.error);
      }
    } finally {
      setIsPicking(false);
    }
  };

  return (
    <div ref={ref} className="min-h-svh px-4 py-16">
      <section className="mx-auto flex w-full max-w-lg flex-col items-center text-center">
        <div className="border-primary/20 bg-card mb-6 flex size-14 items-center justify-center rounded-2xl border shadow-sm">
          <span className="text-primary font-mono text-lg font-bold tracking-tight">CA</span>
        </div>

        <h1 className="text-foreground text-2xl font-semibold tracking-tight">CODE-AGENT</h1>
        <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
          Voice coding assistant — speak to inspect and fix your project
        </p>

        <div className="border-border bg-card mt-8 w-full rounded-2xl border p-5 text-left shadow-sm">
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wide uppercase">
            Before you start
          </p>
          <ul className="text-muted-foreground mb-6 space-y-1.5 text-xs">
            {BEFORE_YOU_START.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-primary shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-5">
            <div>
              <p className="text-foreground mb-2 text-sm font-medium">
                <span className="text-primary mr-1.5 font-mono text-xs">1</span>
                Project folder
              </p>
              <label className="sr-only" htmlFor="workspace">
                Project folder
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="workspace"
                  type="text"
                  value={workspace}
                  title={trimmedPath || 'Enter your project folder path'}
                  onChange={(e) => {
                    const value = e.target.value;
                    setWorkspace(value);
                    setStoredWorkspace(value.trim());
                    setPickerHint(null);
                  }}
                  placeholder="C:\Users\you\my-project"
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring min-w-0 flex-1 cursor-text truncate rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPicking}
                  onClick={handleSelectFolder}
                  className="shrink-0 rounded-lg font-mono text-xs font-bold tracking-wider uppercase"
                >
                  {isPicking ? (
                    <>
                      <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
                      Choosing…
                    </>
                  ) : (
                    'Select folder'
                  )}
                </Button>
              </div>
              {trimmedPath && (
                <p
                  className="text-muted-foreground mt-1.5 truncate text-xs"
                  title={trimmedPath}
                >
                  Selected: {trimmedPath}
                </p>
              )}
              {pickerHint && (
                <p className="text-destructive mt-2 text-xs">{pickerHint}</p>
              )}
              <p className="text-muted-foreground mt-2 text-xs">
                Cursor runtime: <span className="text-foreground font-medium">{runtime}</span>
              </p>
            </div>

            <div>
              <p className="text-foreground mb-2 text-sm font-medium">
                <span className="text-primary mr-1.5 font-mono text-xs">2</span>
                Start call
              </p>
              <Button
                size="lg"
                disabled={!canStart}
                onClick={() => {
                  setStoredWorkspace(trimmedPath);
                  onStartCall();
                }}
                className={cn(
                  'w-full rounded-full font-mono text-xs font-bold tracking-wider uppercase',
                  canStart && 'shadow-md'
                )}
              >
                {startButtonText}
              </Button>
              {!canStart && (
                <p className="text-muted-foreground mt-2 text-xs">
                  Select a folder or enter a path to continue.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 w-full rounded-xl border border-dashed p-4 text-left">
          <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
            Try saying
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PHRASES.map((phrase) => (
              <span
                key={phrase}
                className="bg-muted text-foreground rounded-full px-3 py-1 text-xs"
              >
                &ldquo;{phrase}&rdquo;
              </span>
            ))}
          </div>
        </div>
      </section>

      <p className="text-muted-foreground mx-auto mt-8 max-w-md text-center text-xs">
        See the{' '}
        <a
          target="_blank"
          rel="noopener noreferrer"
          href="https://github.com/surya0712-k/CODE-AGENT-"
          className="text-foreground cursor-pointer underline underline-offset-2"
        >
          README
        </a>{' '}
        for setup details.
      </p>
    </div>
  );
};
