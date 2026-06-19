import pytest

from telephony import (
    detect_telephony_session,
    is_telephony_room,
    verify_telephony_pin,
)
from config import Settings


def test_is_telephony_room():
    assert is_telephony_room("call-abc123")
    assert not is_telephony_room("voice-room-1")


def test_detect_telephony_session_by_room_name():
    assert detect_telephony_session("call-test", {})


def test_verify_telephony_pin_optional():
    settings = Settings(telephony_pin="")
    assert verify_telephony_pin("anything", settings)


def test_verify_telephony_pin_required():
    settings = Settings(telephony_pin="1234")
    assert verify_telephony_pin("1234", settings)
    assert not verify_telephony_pin("0000", settings)
