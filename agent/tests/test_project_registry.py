import pytest

from project_registry import ProjectRegistry


def test_registry_exact_match(tmp_path):
    yaml_file = tmp_path / "projects.yaml"
    yaml_file.write_text(
        """
projects:
  - name: "ANN PROJECT"
    aliases: ["ann"]
    repo: "https://github.com/org/ann-project"
    branch: "main"
""",
        encoding="utf-8",
    )
    registry = ProjectRegistry.load(yaml_file)
    entry = registry.resolve("ann project")
    assert entry is not None
    assert entry.name == "ANN PROJECT"
    assert entry.repo == "https://github.com/org/ann-project"


def test_registry_fuzzy_match(tmp_path):
    yaml_file = tmp_path / "projects.yaml"
    yaml_file.write_text(
        """
projects:
  - name: "ANN PROJECT"
    aliases: ["ann"]
    repo: "https://github.com/org/ann"
    branch: "main"
""",
        encoding="utf-8",
    )
    registry = ProjectRegistry.load(yaml_file)
    entry = registry.resolve("ann proj")
    assert entry is not None
    assert entry.name == "ANN PROJECT"


def test_registry_resolve_or_error(tmp_path):
    registry = ProjectRegistry([])
    entry, error = registry.resolve_or_error("missing")
    assert entry is None
    assert "No projects" in error
