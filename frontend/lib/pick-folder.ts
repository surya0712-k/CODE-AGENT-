/**
 * Native folder picker for local dev (real filesystem path on Windows via .NET).
 */

export type PickFolderResult =
  | { ok: true; path: string }
  | { ok: false; cancelled: true }
  | { ok: false; error: string };

export async function pickProjectFolder(): Promise<PickFolderResult> {
  if (typeof window === 'undefined') {
    return { ok: false, error: 'Folder picker is only available in the browser.' };
  }

  try {
    const res = await fetch('/api/pick-folder', { method: 'POST' });
    const data = (await res.json()) as {
      path?: string;
      cancelled?: boolean;
      error?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: data.error ?? 'Could not open folder picker. Enter the path manually.',
      };
    }

    if (data.cancelled) {
      return { ok: false, cancelled: true };
    }

    if (data.path) {
      return { ok: true, path: data.path };
    }

    return { ok: false, cancelled: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Folder picker failed. Enter the full path in the text field.',
    };
  }
}
