'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { pickProjectFolder } from '@/lib/pick-folder';
import { getStoredWorkspace, setStoredWorkspace } from '@/lib/workspace';

function WelcomeImage() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-fg0 mb-4 size-16"
    >
      <path
        d="M15 24V40C15 40.7957 14.6839 41.5587 14.1213 42.1213C13.5587 42.6839 12.7956 43 12 43C11.2044 43 10.4413 42.6839 9.87868 42.1213C9.31607 41.5587 9 40.7957 9 40V24C9 23.2044 9.31607 22.4413 9.87868 21.8787C10.4413 21.3161 11.2044 21 12 21C12.7956 21 13.5587 21.3161 14.1213 21.8787C14.6839 22.4413 15 23.2044 15 24ZM22 5C21.2044 5 20.4413 5.31607 19.8787 5.87868C19.3161 6.44129 19 7.20435 19 8V56C19 56.7957 19.3161 57.5587 19.8787 58.1213C20.4413 58.6839 21.2044 59 22 59C22.7956 59 23.5587 58.6839 24.1213 58.1213C24.6839 57.5587 25 56.7957 25 56V8C25 7.20435 24.6839 6.44129 24.1213 5.87868C23.5587 5.31607 22.7956 5 22 5ZM32 13C31.2044 13 30.4413 13.3161 29.8787 13.8787C29.3161 14.4413 29 15.2044 29 16V48C29 48.7957 29.3161 49.5587 29.8787 50.1213C30.4413 50.6839 31.2044 51 32 51C32.7956 51 33.5587 50.6839 34.1213 50.1213C34.6839 49.5587 35 48.7957 35 48V16C35 15.2044 34.6839 14.4413 34.1213 13.8787C33.5587 13.3161 32.7956 13 32 13ZM42 21C41.2043 21 40.4413 21.3161 39.8787 21.8787C39.3161 22.4413 39 23.2044 39 24V40C39 40.7957 39.3161 41.5587 39.8787 42.1213C40.4413 42.6839 41.2043 43 42 43C42.7957 43 43.5587 42.6839 44.1213 42.1213C44.6839 41.5587 45 40.7957 45 40V24C45 23.2044 44.6839 22.4413 44.1213 21.8787C43.5587 21.3161 42.7957 21 42 21ZM52 17C51.2043 17 50.4413 17.3161 49.8787 17.8787C49.3161 18.4413 49 19.2044 49 20V44C49 44.7957 49.3161 45.5587 49.8787 46.1213C50.4413 46.6839 51.2043 47 52 47C52.7957 47 53.5587 46.6839 54.1213 46.1213C54.6839 45.5587 55 44.7957 55 44V20C55 19.2044 54.6839 18.4413 54.1213 17.8787C53.5587 17.3161 52.7957 17 52 17Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
    <div ref={ref}>
      <section className="bg-background flex flex-col items-center justify-center px-4 text-center">
        <WelcomeImage />

        <p className="text-foreground max-w-prose pt-1 leading-6 font-medium">
          Voice coding assistant — speak to inspect and fix your project
        </p>

        <div className="border-border bg-muted/30 mt-6 w-full max-w-md rounded-xl border p-4 text-left">
          <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
            Pre-flight
          </p>
          <label className="text-foreground mb-1 block text-sm font-medium" htmlFor="workspace">
            Project folder
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="workspace"
              type="text"
              value={workspace}
              onChange={(e) => {
                const value = e.target.value;
                setWorkspace(value);
                setStoredWorkspace(value.trim());
                setPickerHint(null);
              }}
              placeholder="C:\Users\you\my-project"
              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring min-w-0 flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
            <Button
              type="button"
              variant="outline"
              disabled={isPicking}
              onClick={handleSelectFolder}
              className="shrink-0 font-mono text-xs font-bold tracking-wider uppercase"
            >
              {isPicking ? 'Choose folder…' : 'Select folder'}
            </Button>
          </div>
          {pickerHint && (
            <p className="text-muted-foreground mt-2 text-xs">{pickerHint}</p>
          )}
          <p className="text-muted-foreground mt-2 text-xs">
            Cursor runtime: <span className="text-foreground font-medium">{runtime}</span>
            {' · '}
            Select folder opens the native Windows folder dialog (browse + search).
          </p>
        </div>

        <Button
          size="lg"
          disabled={!canStart}
          onClick={() => {
            setStoredWorkspace(workspace.trim());
            onStartCall();
          }}
          className="mt-6 w-64 rounded-full font-mono text-xs font-bold tracking-wider uppercase"
        >
          {startButtonText}
        </Button>
        {!canStart && (
          <p className="text-muted-foreground mt-2 text-xs">
            Select a folder or enter a path to continue.
          </p>
        )}
      </section>

      <div className="fixed bottom-5 left-0 flex w-full items-center justify-center px-4">
        <p className="text-muted-foreground max-w-prose pt-1 text-xs leading-5 md:text-sm">
          Requires LiveKit credentials and a running Python agent worker. See{' '}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://github.com/surya0712-k/CODE-AGENT-"
            className="underline"
          >
            README
          </a>
          .
        </p>
      </div>
    </div>
  );
};
