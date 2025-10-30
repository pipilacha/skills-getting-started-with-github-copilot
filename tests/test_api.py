import copy
import uuid
from urllib.parse import quote

from fastapi.testclient import TestClient

from src.app import app, activities


client = TestClient(app)


def _unique_email():
    return f"testuser+{uuid.uuid4().hex[:8]}@example.com"


import pytest


@pytest.fixture(autouse=True)
def isolate_activities():
    """Ensure activities dict is restored after each test to keep tests isolated."""
    backup = copy.deepcopy(activities)
    try:
        yield
    finally:
        activities.clear()
        activities.update(backup)


def test_get_activities():
    resp = client.get("/activities")
    assert resp.status_code == 200
    data = resp.json()
    # Expect several known activities to exist
    assert "Chess Club" in data


def test_signup_and_unregister_flow():
    activity = "Chess Club"
    email = _unique_email()

    # Sign up
    r = client.post(f"/activities/{activity}/signup?email={quote(email)}")
    assert r.status_code == 200
    payload = r.json()
    assert "Signed up" in payload.get("message", "")
    assert email in activities[activity]["participants"]

    # Duplicate signup should fail
    r2 = client.post(f"/activities/{activity}/signup?email={quote(email)}")
    assert r2.status_code == 400

    # Now remove via DELETE
    r3 = client.delete(f"/activities/{activity}/participants?email={quote(email)}")
    assert r3.status_code == 200
    assert email not in activities[activity]["participants"]

    # Removing again should return 404
    r4 = client.delete(f"/activities/{activity}/participants?email={quote(email)}")
    assert r4.status_code == 404
