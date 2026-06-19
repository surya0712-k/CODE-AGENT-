from __future__ import annotations

import re
from typing import Any

from livekit import rtc

from config import Settings

_CALL_ROOM_PREFIX = "call-"


def is_telephony_room(room_name: str) -> bool:
    return room_name.lower().startswith(_CALL_ROOM_PREFIX)


def is_sip_participant(participant: rtc.RemoteParticipant) -> bool:
    return participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP


def caller_phone_number(participant: rtc.RemoteParticipant) -> str:
    attrs = participant.attributes or {}
    for key in ("sip.phoneNumber", "sip.callerNumber", "phone_number", "caller_id"):
        value = (attrs.get(key) or "").strip()
        if value:
            return _normalize_phone(value)
    identity = (participant.identity or "").strip()
    if identity:
        return _normalize_phone(identity)
    return ""


def _normalize_phone(value: str) -> str:
    return re.sub(r"[^\d+]", "", value)


def detect_telephony_session(
    room_name: str,
    participants: dict[str, rtc.RemoteParticipant],
) -> bool:
    if is_telephony_room(room_name):
        return True
    for participant in participants.values():
        if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
            continue
        if is_sip_participant(participant):
            return True
    return False


def verify_caller_allowed(
    participant: rtc.RemoteParticipant,
    settings: Settings,
) -> str | None:
    """Return an error message if the caller is not allowed, else None."""
    allowed = settings.telephony_allowed_callers_list()
    if not allowed:
        return None

    caller = caller_phone_number(participant)
    if not caller:
        return "Caller ID is not available for this call."

    normalized_allowed = {_normalize_phone(n) for n in allowed}
    if caller in normalized_allowed:
        return None

    suffix = caller[-4:] if len(caller) >= 4 else caller
    return f"Caller ending in {suffix} is not on the allowlist."


def verify_telephony_pin(spoken_or_metadata_pin: str, settings: Settings) -> bool:
    expected = settings.telephony_pin.strip()
    if not expected:
        return True
    return spoken_or_metadata_pin.strip() == expected


def sip_participant_has_workspace_path(participant: rtc.RemoteParticipant) -> bool:
    return bool((participant.attributes.get("workspace_path") or "").strip())


def should_skip_web_workspace(participant: rtc.RemoteParticipant, is_telephony: bool) -> bool:
    if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_AGENT:
        return True
    if is_telephony and is_sip_participant(participant):
        return True
    return False


def participant_metadata_pin(participant: rtc.RemoteParticipant) -> str:
    attrs = participant.attributes or {}
    return (attrs.get("telephony_pin") or attrs.get("pin") or "").strip()
