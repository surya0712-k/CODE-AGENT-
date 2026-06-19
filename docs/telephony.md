# Inbound telephony for CODE-AGENT

Phone callers reach the **same** `code-voice-agent` worker as the web UI. The difference is workspace selection: callers say a **project name** from `projects.yaml` instead of picking a local folder.

## Architecture

```
PSTN caller → SIP trunk → LiveKit room (call-*) → agent dispatch → CodeVoiceAgent
                                                      ↓
                                            select_cloud_project
                                                      ↓
                                            Cursor Cloud (GitHub repo)
```

## 1. LiveKit Phone Numbers (recommended)

Follow [LiveKit Telephony](https://docs.livekit.io/telephony/):

1. In **LiveKit Cloud**, buy or port a phone number.
2. Create an **inbound SIP trunk** linked to that number.
3. Create a **dispatch rule** that creates rooms with prefix `call-` and dispatches your agent:

```json
{
  "rule": {
    "dispatchRuleIndividual": {
      "roomPrefix": "call-"
    }
  },
  "roomConfig": {
    "agents": [
      {
        "agentName": "code-voice-agent"
      }
    ]
  }
}
```

4. Deploy the agent worker 24/7 (`CURSOR_RUNTIME=cloud`, `PROJECT_REGISTRY_PATH` set).
5. Edit `agent/projects.yaml` with your real GitHub repos.

The worker detects telephony when:

- Room name starts with `call-`, or
- A SIP participant joins (`ParticipantKind.SIP`).

### Caller flow

1. Agent: “Which project do you want to work on?”
2. Caller: “ANN PROJECT”
3. Agent calls `select_cloud_project` → Cursor cloud repo from registry
4. Caller: “inspect the API routes” → `inspect_code`
5. Caller: “fix the login bug” → `confirm_fix` → `fix_issue` (opens a PR when `CLOUD_AUTO_CREATE_PR=true`)

## 2. Twilio / Telnyx (alternate trunk)

Use the **same dispatch rule** above. Only the SIP trunk credentials change:

| Provider | Steps |
|----------|--------|
| **Twilio** | Elastic SIP Trunk → Origination URI → your LiveKit SIP endpoint. Inbound calls hit LiveKit; dispatch rule assigns `code-voice-agent`. |
| **Telnyx** | SIP Connection → forward to LiveKit SIP URI. Same dispatch rule. |

No code changes are required — configure the provider to send inbound calls to LiveKit.

## 3. Worker environment (telephony)

```bash
CURSOR_RUNTIME=cloud
CURSOR_API_KEY=...
LIVEKIT_URL=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
AGENT_NAME=code-voice-agent
PROJECT_REGISTRY_PATH=/app/projects.yaml

# Security (recommended before public number)
TELEPHONY_PIN=1234
TELEPHONY_ALLOWED_CALLERS=+15551234567,+15559876543
CLOUD_AUTO_CREATE_PR=true
```

## 4. Security

| Control | Env var | Behavior |
|---------|---------|----------|
| PR-only writes | `CLOUD_AUTO_CREATE_PR=true` | Cloud fixes never push directly to `main` |
| Caller allowlist | `TELEPHONY_ALLOWED_CALLERS` | Comma-separated E.164 numbers |
| PIN | `TELEPHONY_PIN` | Caller must pass `verify_call_pin` or SIP attr `telephony_pin` |
| Repo allowlist | `projects.yaml` | Only registered repos; no arbitrary URLs from speech |

## 5. Docker deploy

```bash
cd agent
docker build -t code-voice-agent .
docker run --env-file ../.env code-voice-agent
```

Or deploy the image to [LiveKit Cloud Agents](https://docs.livekit.io/agents/ops/deployment/), Fly.io, or Kubernetes with secrets mounted for `.env`.

## 6. Testing without a phone

1. Set `CURSOR_RUNTIME=cloud` and edit `projects.yaml`.
2. Start the worker: `python src/main.py dev`
3. Start a web call and **say the project name** — the agent uses `select_cloud_project` the same way as phone callers.

## Troubleshooting

- **Agent asks for folder path on phone** — room may not match telephony detection; ensure `call-` prefix or SIP participant.
- **Project not found** — check STT transcript vs aliases in `projects.yaml`.
- **Cursor plan_required** — Pro/Teams plan required for cloud agents.
