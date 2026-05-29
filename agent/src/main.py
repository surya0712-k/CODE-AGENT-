import asyncio
import json
import logging

from livekit import rtc
from livekit.agents import (
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    cli,
    inference,
    room_io,
)
from livekit.plugins import ai_coustics, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from livekit.agents.voice.events import UserInputTranscribedEvent

from config import get_settings
from cursor_bridge import CursorBridge, publish_to_room
from env_loader import load_project_env
from goodbye import looks_like_goodbye
from voice_agent import CodeVoiceAgent, SessionData

GOODBYE_END_DELAY_SEC = 1.8

logger = logging.getLogger("code-voice-agent")

_loaded_env = load_project_env()
if _loaded_env:
    logger.info("Loaded env from: %s", ", ".join(str(p) for p in _loaded_env))
else:
    logger.warning(
        "No .env or .env.local found. Copy .env.example to agent/.env or repo .env"
    )

settings = get_settings()
if not settings.livekit_url:
    logger.error(
        "LIVEKIT_URL is missing — agent worker cannot connect. "
        "Set LIVEKIT_URL in repo .env or agent/.env"
    )

server = AgentServer()


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name=settings.agent_name)
async def entrypoint(ctx: JobContext) -> None:
    ctx.log_context_fields = {"room": ctx.room.name}

    session_data = SessionData()
    session_data.bridge = CursorBridge(
        settings,
        publish=lambda payload: publish_to_room(ctx.room, payload),
    )

    default = settings.default_workspace()
    if default is not None:
        try:
            await session_data.bridge.set_workspace(str(default))
            session_data.workspace = str(default)
            logger.info("Default workspace: %s", session_data.workspace)
        except ValueError as err:
            logger.warning("Invalid CURSOR_DEFAULT_CWD: %s", err)

    async def apply_workspace_from_attributes(
        participant: rtc.RemoteParticipant,
    ) -> None:
        if session_data.bridge is None:
            return
        if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            return
        path = (participant.attributes.get("workspace_path") or "").strip()
        if not path:
            return
        try:
            resolved = await session_data.bridge.set_workspace(path)
            session_data.workspace = resolved
            logger.info(
                "Workspace from participant %s: %s",
                participant.identity,
                resolved,
            )
        except ValueError as err:
            logger.warning("Invalid workspace from participant: %s", err)

    def schedule_workspace_from_participant(
        participant: rtc.RemoteParticipant,
    ) -> None:
        asyncio.create_task(apply_workspace_from_attributes(participant))

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant) -> None:
        schedule_workspace_from_participant(participant)

    @ctx.room.on("participant_attributes_changed")
    def on_participant_attributes_changed(
        changed_attributes: dict[str, str],
        participant: rtc.RemoteParticipant,
    ) -> None:
        if "workspace_path" in changed_attributes:
            schedule_workspace_from_participant(participant)

    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language="multi"),
        tts=inference.TTS(
            model="cartesia/sonic-3",
            voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        ),
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
        userdata=session_data,
    )

    async def request_end_call() -> None:
        if session_data.ending_call:
            return
        session_data.ending_call = True
        logger.info("Ending call after user goodbye (%.1fs delay)", GOODBYE_END_DELAY_SEC)
        try:
            await session.generate_reply(
                instructions=(
                    "The user is ending the call. Say a brief warm goodbye in one "
                    "short sentence. Do not ask questions or offer more help."
                )
            )
        except Exception:
            logger.exception("Goodbye reply failed")
        await asyncio.sleep(GOODBYE_END_DELAY_SEC)
        try:
            await publish_to_room(
                ctx.room,
                {"type": "end_call", "delay_ms": 0},
                topic="session_control",
            )
        except Exception:
            logger.exception("Failed to publish end_call to client")
        session.shutdown(drain=False)

    session_data.request_end_call = request_end_call

    @session.on("user_input_transcribed")
    def on_user_input_transcribed(ev: UserInputTranscribedEvent) -> None:
        if not ev.is_final or session_data.ending_call:
            return
        if looks_like_goodbye(ev.transcript):
            asyncio.create_task(request_end_call(), name="end-call-goodbye")

    try:
        await session.start(
            agent=CodeVoiceAgent(settings),
            room=ctx.room,
            room_options=room_io.RoomOptions(
                audio_input=room_io.AudioInputOptions(
                    noise_cancellation=ai_coustics.audio_enhancement(
                        model=ai_coustics.EnhancerModel.QUAIL_VF_S
                    ),
                ),
            ),
        )
        await ctx.connect()

        @ctx.room.local_participant.register_rpc_method("agent.set_workspace")
        async def rpc_set_workspace(data) -> str:
            try:
                payload = json.loads(data.payload or "{}")
                path = payload.get("path", "")
                if not path:
                    return json.dumps({"ok": False, "error": "path is required"})
                resolved = await session_data.bridge.set_workspace(path)
                session_data.workspace = resolved
                return json.dumps({"ok": True, "workspace": resolved})
            except ValueError as err:
                return json.dumps({"ok": False, "error": str(err)})
            except Exception as err:
                logger.exception("RPC set_workspace failed")
                return json.dumps({"ok": False, "error": str(err)})

        for participant in ctx.room.remote_participants.values():
            schedule_workspace_from_participant(participant)

        logger.info("Agent connected to room %s", ctx.room.name)
    finally:
        if session_data.bridge is not None:
            await session_data.bridge.close()


if __name__ == "__main__":
    cli.run_app(server)
    
