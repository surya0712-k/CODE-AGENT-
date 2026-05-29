# CODE-AGENT — Voice coding assistant

AI voice agent with a web UI ([LiveKit](https://livekit.io/) + [Agents UI](https://docs.livekit.io/frontends/agents-ui.md)) that reads and edits code via the [Cursor SDK](https://cursor.com/docs/sdk/python).

## Architecture

- **frontend/** — Next.js app (mic, transcript, workspace pre-flight, job log)
- **agent/** — Python LiveKit worker with `@function_tool` hooks into Cursor SDK

## Prerequisites

1. [LiveKit Cloud](https://cloud.livekit.io/) project (or self-hosted server)
2. [Cursor API key](https://cursor.com/dashboard/integrations)
3. Python 3.11–3.13 and Node.js 22+ (see `.nvmrc`)
4. [uv](https://docs.astral.sh/uv/) or pip for Python deps

## Setup

### 1. Environment

Copy the example env and fill in credentials (`.env` or `.env.local` both work):

```bash
cp .env.example .env
cp .env frontend/.env
```

The Python agent loads env from **repo root** and **agent/** automatically — you do not need a separate `agent/.env.local` if root `.env` exists.

Required variables:

| Variable | Description |
|----------|-------------|
| `LIVEKIT_URL` | `wss://…livekit.cloud` |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `AGENT_NAME` | `code-voice-agent` (must match in frontend) |
| `CURSOR_API_KEY` | Cursor user or service account key |
| `CURSOR_DEFAULT_CWD` | Optional default project path |
| `CURSOR_ALLOWED_ROOTS` | Optional comma-separated path allowlist |

### 2. Python agent

```bash
cd agent
uv sync
# or: pip install -e .
```

Download model assets (VAD, turn detector):

```bash
uv run python src/main.py download-files
```

### 3. Frontend

```bash
cd frontend
pnpm install
# Optional (best folder picker on Windows — Explorer-style UI):
pnpm build:picker
```

Set in `frontend/.env.local`:

```
LIVEKIT_URL=…
LIVEKIT_API_KEY=…
LIVEKIT_API_SECRET=…
AGENT_NAME=code-voice-agent
```

## Run locally

Terminal 1 — agent worker:

```bash
cd agent
uv run python src/main.py dev
```

Terminal 2 — web UI:

```bash
cd frontend
pnpm dev
```

Open http://localhost:3000, enter your project folder path, start a call, and speak (e.g. “Set workspace to my repo” or “Find the bug in auth.py”).

## Models in use (LiveKit Inference + Cursor)

Configured in [`agent/src/main.py`](agent/src/main.py) and [`agent/src/voice_agent.py`](agent/src/voice_agent.py):

| Layer | Model | Provider |
|-------|--------|----------|
| Speech-to-text | `deepgram/nova-3` (multi) | LiveKit Cloud Inference |
| Voice LLM | `openai/gpt-4.1-mini` | LiveKit Cloud Inference |
| Text-to-speech | `cartesia/sonic-3` | LiveKit Cloud Inference |
| VAD | Silero | Local plugin |
| Turn detection | MultilingualModel | Local (needs PyTorch for full accuracy) |
| Noise reduction | ai-coustics QUAIL_VF_S | Local plugin |
| Code edits (tools) | `default` (Auto, via `CURSOR_MODEL`) | Cursor SDK (`CURSOR_API_KEY`) |

To change the voice LLM, edit `llm=inference.LLM(model="...")` in `voice_agent.py`. To change STT/TTS, edit `AgentSession(...)` in `main.py`.

## Voice tools

| Tool | Purpose |
|------|---------|
| `set_workspace` | Point Cursor at a local repo |
| `inspect_code` | Read-only analysis (background job) |
| `fix_issue` | Code changes (requires verbal confirm) |
| `confirm_fix` | Apply pending fix after user says yes |
| `get_cursor_job_status` | Poll job progress |

Job updates are published on LiveKit data topic `cursor_job` and shown in the UI job log.

## Cursor runtime

- **local** (default): `CURSOR_RUNTIME=local`, uses `LocalAgentOptions(cwd=…)`
- **cloud** (stub): set `CURSOR_RUNTIME=cloud` and `CURSOR_CLOUD_REPO=github.com/org/repo`

## Troubleshooting: “Cursor internal error” / coding task failed

**Most common cause:** Cursor **Free** plan. The SDK shows a vague `internal error HTTP 500`, but the API actually returns `plan_required`. **Pro or Teams** is required for Agents / code tools.

Verify your plan:

```bash
curl -sS -H "Authorization: Bearer YOUR_CURSOR_API_KEY" https://api.cursor.com/v1/me
```

If you see `plan_required`, upgrade at [cursor.com/pricing](https://www.cursor.com/pricing).

Other checks:

1. **`CURSOR_API_KEY`** in repo `.env` from [Cursor integrations](https://cursor.com/dashboard/integrations). Restart `python src/main.py dev` after changing it.
2. **Project folder must exist on disk** — open the path in File Explorer first. OneDrive paths must be synced locally.
3. **Pick the folder before Start call** (full path like `C:\Users\you\project`).
4. Check the **agent terminal** for clearer errors after a failed inspect/fix (the app now pre-checks the API before starting jobs).

## Troubleshooting: “Agent did not enter the room”

1. **Agent worker must be running** before you click Start call:
   ```bash
   cd agent && python src/main.py dev
   ```
2. **Check the agent terminal** for `LIVEKIT_URL is missing` or `ws_url is required`. That means env was not loaded — put `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` in repo `.env` or `agent/.env`.
3. **`AGENT_NAME` must match** in root/frontend `.env` (`code-voice-agent`) and in the worker log line `registered agent code-voice-agent`.
4. **Same LiveKit project** — frontend and agent must use the same `LIVEKIT_URL` and API key pair.
5. **LiveKit Inference** — this template uses LiveKit Cloud inference for STT/LLM/TTS; ensure your project has inference enabled or swap to plugin keys in `main.py`.

## Security notes

- The bundled `/api/token` route is **dev-only** (no auth). Add authentication before production.
- Restrict workspaces with `CURSOR_ALLOWED_ROOTS`.
- Never expose `CURSOR_API_KEY` to the browser.

## License

LiveKit starter templates are MIT. See starter `LICENSE` files for details.
