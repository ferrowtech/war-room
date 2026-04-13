"""Backend tests for WAR ROOM /api/brief endpoint"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


def test_root():
    res = requests.get(f"{BASE_URL}/api/")
    assert res.status_code == 200
    assert "WAR ROOM" in res.json().get("message", "")


def test_brief_valid():
    payload = {
        "question": "What troop type counters Tank?",
        "server": "1042",
        "troop_type": "Tank",
        "furnace_level": 10,
        "heroes": ["Murphy", "Carlie", "Swift"]
    }
    res = requests.post(f"{BASE_URL}/api/brief", json=payload, timeout=30)
    assert res.status_code == 200
    data = res.json()
    assert "response" in data
    assert len(data["response"]) > 10


def test_brief_missing_field():
    payload = {
        "question": "test",
        "server": "1042"
        # missing troop_type, furnace_level, heroes
    }
    res = requests.post(f"{BASE_URL}/api/brief", json=payload, timeout=10)
    assert res.status_code == 422


def test_brief_with_image():
    # small 1x1 transparent PNG base64
    tiny_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    payload = {
        "question": "Analyze this screenshot",
        "server": "1042",
        "troop_type": "Aircraft",
        "furnace_level": 5,
        "heroes": ["Murphy"],
        "image_base64": tiny_png
    }
    res = requests.post(f"{BASE_URL}/api/brief", json=payload, timeout=30)
    assert res.status_code == 200
    assert "response" in res.json()
