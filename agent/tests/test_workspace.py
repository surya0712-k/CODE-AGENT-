from workspace import WorkspaceTarget


def test_workspace_target_local_configured():
    target = WorkspaceTarget(mode="local", local_path="/tmp/proj")
    assert target.is_configured()
    assert target.summary() == "/tmp/proj"


def test_workspace_target_cloud_configured():
    target = WorkspaceTarget(
        mode="cloud",
        cloud_repo_url="https://github.com/org/repo",
        project_name="Demo",
    )
    assert target.is_configured()
    assert "Demo" in target.summary()


def test_workspace_target_empty():
    target = WorkspaceTarget(mode="local")
    assert not target.is_configured()
