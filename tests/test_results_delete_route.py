"""Regression tests for the admin result-upload deletion endpoint."""

import asyncio

import pytest

from api.app import app
from api.deps import CurrentUser
import api.routes_learning as learning_routes


def _admin():
    return CurrentUser("admin", "ADMIN", None)


def _hod():
    return CurrentUser("hod", "HOD", None)


def test_admin_result_delete_route_is_registered_and_requires_delete_key(monkeypatch):
    routes = [
        route for route in app.routes
        if getattr(route, "path", "") == "/api/results/admin/{batch_id}"
        and "DELETE" in (getattr(route, "methods", set()) or set())
    ]
    assert routes, "Admin result DELETE route must be registered on the main API app"

    monkeypatch.setenv("RESULT_DELETE_KEY", "TEST-RESULT-KEY")
    calls = []
    monkeypatch.setattr(
        learning_routes,
        "delete_result_batch",
        lambda **kwargs: calls.append(kwargs) or {
            "id": kwargs["batch_id"],
            "title": "Test Result",
            "department": "CSD",
            "batch": "2024-2028",
            "semester_id": 4,
            "semester_code": "IV",
            "semester_name": "IV Semester",
            "deleted": True,
        },
    )

    with pytest.raises(Exception) as exc:
        asyncio.run(learning_routes.results_admin_delete(41, "WRONG", _admin()))
    assert getattr(exc.value, "status_code", None) == 403
    assert getattr(exc.value, "detail", None) == "Invalid result delete key"
    assert calls == []

    response = asyncio.run(learning_routes.results_admin_delete(41, "TEST-RESULT-KEY", _admin()))
    assert response.status_code == 200
    assert response.body
    assert calls == [{"batch_id": 41, "admin_username": "admin"}]


def test_non_admin_cannot_delete_result_even_with_valid_key(monkeypatch):
    monkeypatch.setenv("RESULT_DELETE_KEY", "TEST-RESULT-KEY")
    monkeypatch.setattr(
        learning_routes,
        "delete_result_batch",
        lambda **kwargs: (_ for _ in ()).throw(AssertionError("service must not be called for non-admin")),
    )

    with pytest.raises(Exception) as exc:
        asyncio.run(learning_routes.results_admin_delete(41, "TEST-RESULT-KEY", _hod()))
    assert getattr(exc.value, "status_code", None) == 403
    assert getattr(exc.value, "detail", None) == "Admin access only"


def test_result_delete_compatibility_router_has_same_security_contract(monkeypatch):
    from api.routes_result_delete import results_admin_delete_fallback

    monkeypatch.setenv("RESULT_DELETE_KEY", "TEST-RESULT-KEY")
    calls = []
    import api.routes_result_delete as fallback
    monkeypatch.setattr(
        fallback,
        "delete_result_batch",
        lambda **kwargs: calls.append(kwargs) or {"id": kwargs["batch_id"], "title": "X", "deleted": True},
    )

    response = asyncio.run(
        results_admin_delete_fallback(7, "TEST-RESULT-KEY", _admin())
    )
    assert response.status_code == 200
    assert calls == [{"batch_id": 7, "admin_username": "admin"}]

    with pytest.raises(Exception) as exc:
        asyncio.run(results_admin_delete_fallback(7, "BAD", _admin()))
    assert getattr(exc.value, "status_code", None) == 403
