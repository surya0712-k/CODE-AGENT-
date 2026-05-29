import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';

const execFileAsync = promisify(execFile);

const FRONTEND_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const FOLDER_PICKER_DIR = path.join(FRONTEND_ROOT, 'tools', 'FolderPicker');

const FOLDER_PICKER_EXE = path.join(FOLDER_PICKER_DIR, 'FolderPicker.exe');

const BUILD_SCRIPT = path.join(FOLDER_PICKER_DIR, 'build-with-csc.ps1');

const POWERSHELL_64 = path.join(
  process.env.WINDIR ?? 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe'
);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let buildPromise: Promise<boolean> | null = null;

async function ensureFolderPickerExe(): Promise<boolean> {
  if (folderPickerRuntimeReady()) {
    return true;
  }

  if (process.platform !== 'win32') {
    return false;
  }

  if (!buildPromise) {
    buildPromise = new Promise((resolve) => {
      const ps = fs.existsSync(POWERSHELL_64) ? POWERSHELL_64 : 'powershell';
      const child = spawn(
        ps,
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', BUILD_SCRIPT],
        { windowsHide: true, stdio: 'inherit' }
      );
      child.on('close', (code) => {
        buildPromise = null;
        resolve(code === 0 && folderPickerRuntimeReady());
      });
      child.on('error', () => {
        buildPromise = null;
        resolve(false);
      });
    });
  }

  return buildPromise;
}

function folderPickerRuntimeReady(): boolean {
  return (
    fs.existsSync(FOLDER_PICKER_EXE) &&
    fs.existsSync(path.join(FOLDER_PICKER_DIR, 'Microsoft.WindowsAPICodePack.dll')) &&
    fs.existsSync(path.join(FOLDER_PICKER_DIR, 'Microsoft.WindowsAPICodePack.Shell.dll'))
  );
}

async function pickFolderWindows(): Promise<string | null> {
  const ready = await ensureFolderPickerExe();
  if (!ready || !folderPickerRuntimeReady()) {
    throw new Error(
      'Folder picker is not built. Run: cd frontend && pnpm build:picker — then restart pnpm dev.'
    );
  }

  const { stdout } = await execFileAsync(FOLDER_PICKER_EXE, [], {
    timeout: 300_000,
    windowsHide: false,
    cwd: FOLDER_PICKER_DIR,
  });

  const selected = stdout.trim();
  return selected.length > 0 ? selected : null;
}

async function pickFolderMac(): Promise<string | null> {
  const script =
    'POSIX path of (choose folder with prompt "Select your project folder")';
  const { stdout } = await execFileAsync('osascript', ['-e', script], {
    timeout: 300_000,
  });
  const selected = stdout.trim();
  return selected.length > 0 ? selected : null;
}

async function pickFolderLinux(): Promise<string | null> {
  const { stdout } = await execFileAsync(
    'zenity',
    ['--file-selection', '--directory', '--title=Select your project folder'],
    { timeout: 300_000 }
  );
  const selected = stdout.trim();
  return selected.length > 0 ? selected : null;
}

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Native folder picker is only available in local development.' },
      { status: 403 }
    );
  }

  try {
    let selected: string | null = null;

    if (process.platform === 'win32') {
      selected = await pickFolderWindows();
    } else if (process.platform === 'darwin') {
      selected = await pickFolderMac();
    } else if (process.platform === 'linux') {
      selected = await pickFolderLinux();
    } else {
      return NextResponse.json(
        { error: 'Folder picker is not supported on this operating system.' },
        { status: 501 }
      );
    }

    if (!selected) {
      return NextResponse.json({ cancelled: true });
    }

    return NextResponse.json({ path: selected });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to open folder picker';
    console.error('pick-folder:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
