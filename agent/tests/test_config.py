import pytest

from config import Settings


def test_validate_workspace_rejects_missing(tmp_path):
    settings = Settings(cursor_allowed_roots="")
    with pytest.raises(ValueError, match="does not exist"):
        settings.validate_workspace(str(tmp_path / "missing"))


def test_validate_workspace_allowlist(tmp_path):
    root = tmp_path / "allowed"
    root.mkdir()
    project = root / "app"
    project.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()

    settings = Settings(cursor_allowed_roots=str(root))
    assert settings.validate_workspace(str(project)) == project.resolve()

    with pytest.raises(ValueError, match="outside allowed"):
        settings.validate_workspace(str(outside))
