from collections.abc import Generator
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from threading import Barrier

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.models import Base, LessonCompletion
from app.auth.persistence import get_db, get_engine
from app.extension_entrypoint import app


ORIGIN = "http://localhost:5173"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    monkeypatch.setenv("AUTH_ENABLED", "true")
    monkeypatch.setenv("AUTH_SIGNING_KEY", "test-signing-key-that-is-at-least-32-bytes")
    monkeypatch.setenv("AUTH_COOKIE_SECURE", "false")
    monkeypatch.setenv("AUTH_ALLOWED_ORIGINS", ORIGIN)
    from app import api
    monkeypatch.setattr(api.course_recommender.retriever.tfidf, "records", [
        {"source_record_id": "catalog-python-001", "skills_gained": "Python"},
        {"source_record_id": "catalog-sql-001", "skills_gained": "SQL"},
    ])
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    def override_db() -> Generator[Session, None, None]:
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(engine)
    engine.dispose()


def register(client: TestClient, email: str = "learner@example.com") -> dict:
    response = client.post(
        "/auth/register",
        headers={"Origin": ORIGIN},
        json={"email": email, "password": "a-long-test-password"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def csrf_headers(token: str) -> dict[str, str]:
    return {"Origin": ORIGIN, "X-CSRF-Token": token}


def test_authentication_register_login_and_duplicate_email(client: TestClient) -> None:
    account = register(client)
    assert account["user"]["email"] == "learner@example.com"
    assert client.get("/auth/me").json()["user"]["id"] == account["user"]["id"]

    duplicate = client.post(
        "/auth/register",
        headers={"Origin": ORIGIN},
        json={"email": " LEARNER@example.com ", "password": "a-long-test-password"},
    )
    assert duplicate.status_code == 409

    client.post("/auth/logout", headers=csrf_headers(account["csrf_token"]))
    login = client.post(
        "/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "LEARNER@example.com", "password": "a-long-test-password"},
    )
    assert login.status_code == 200
    assert login.json()["user"]["email"] == "learner@example.com"
    bad_login = client.post(
        "/auth/login",
        headers={"Origin": ORIGIN},
        json={"email": "learner@example.com", "password": "incorrect-password"},
    )
    assert bad_login.status_code == 401


def test_auth_routes_are_disabled_by_default(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "false")
    response = client.post(
        "/auth/register",
        headers={"Origin": ORIGIN},
        json={"email": "learner@example.com", "password": "a-long-test-password"},
    )
    assert response.status_code == 404


def test_disabled_auth_routes_return_404_without_database(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("AUTH_ENABLED", "false")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    app.dependency_overrides.pop(get_db, None)
    get_engine.cache_clear()

    response = client.post(
        "/auth/register",
        headers={"Origin": ORIGIN},
        json={"email": "learner@example.com", "password": "a-long-test-password"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Account features are disabled."


def test_sqlite_tables_are_created_on_startup(
    client: TestClient,
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database_path = tmp_path / "startup.sqlite"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+pysqlite:///{database_path.as_posix()}")
    get_engine.cache_clear()

    try:
        with TestClient(app):
            table_names = set(inspect(get_engine()).get_table_names())
        assert set(Base.metadata.tables).issubset(table_names)
    finally:
        get_engine.cache_clear()


def test_sqlite_foreign_keys_are_enabled_on_connect(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database_path = tmp_path / "foreign-keys.sqlite"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+pysqlite:///{database_path.as_posix()}")
    get_engine.cache_clear()

    engine = get_engine()
    try:
        Base.metadata.create_all(engine)
        with engine.connect() as connection:
            assert connection.exec_driver_sql("PRAGMA foreign_keys").scalar_one() == 1
            with pytest.raises(IntegrityError):
                connection.exec_driver_sql(
                    "INSERT INTO learner_profiles "
                    "(user_id, profile_data, version, updated_at) "
                    "VALUES ('missing-user', '{}', 1, CURRENT_TIMESTAMP)"
                )
    finally:
        get_engine.cache_clear()
        engine.dispose()


def test_concurrent_first_completion_requests_upsert_one_record(
    client: TestClient,
    tmp_path,
) -> None:
    database_path = tmp_path / "concurrent-completions.sqlite"
    engine = create_engine(
        f"sqlite+pysqlite:///{database_path.as_posix()}",
        connect_args={"check_same_thread": False, "timeout": 15},
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    def override_db() -> Generator[Session, None, None]:
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    account = register(client)
    barrier = Barrier(2)

    def wait_for_both_first_writes(
        connection,
        cursor,
        statement,
        parameters,
        context,
        executemany,
    ) -> None:
        if statement.lstrip().upper().startswith("INSERT INTO LESSON_COMPLETIONS"):
            barrier.wait(timeout=15)

    event.listen(engine, "before_cursor_execute", wait_for_both_first_writes)
    request_headers = csrf_headers(account["csrf_token"])
    payload = {
        "status": "completed",
        "item_type": "pathway_step",
        "title": "Concurrent Python practice",
    }

    try:
        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(executor.map(
                lambda _: client.put(
                    "/me/lessons/step-python/completion",
                    headers=request_headers,
                    json=payload,
                ),
                range(2),
            ))

        assert [response.status_code for response in responses] == [200, 200]
        with factory() as db:
            assert db.query(func.count(LessonCompletion.id)).filter(
                LessonCompletion.user_id == account["user"]["id"],
                LessonCompletion.item_id == "step-python",
            ).scalar() == 1
        assert all(response.json()["completed"] for response in responses)
        assert responses[0].json()["completed_at"] == responses[1].json()["completed_at"]
    finally:
        event.remove(engine, "before_cursor_execute", wait_for_both_first_writes)
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def test_lesson_completion_is_persistent_evidence_and_user_scoped(client: TestClient) -> None:
    account = register(client)
    headers = csrf_headers(account["csrf_token"])
    updated = client.put(
        "/me/lessons/step-python/completion",
        headers=headers,
        json={
            "status": "completed",
            "item_type": "pathway_step",
            "title": "Practice Python",
            "skills": ["not-a-real-taxonomy-skill-xyz"],
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["completed"] is True
    assert updated.json()["evidence_type"] == "lesson_completed"
    assert updated.json()["mapping_status"] == "verified"
    assert updated.json()["mapped_skills"] == ["Python"]
    assert updated.json()["unmapped_skills"] == []
    assert updated.json()["evidence_sources"] == [{
        "canonical_skill": "Python",
        "source_record_id": "catalog-python-001",
        "skill_tag": "Python",
    }]
    completed_at = updated.json()["completed_at"]
    repeated = client.put(
        "/me/lessons/step-python/completion",
        headers=headers,
        json={
            "status": "completed",
            "item_type": "pathway_step",
            "title": "Practice Python",
            "skills": ["SQL"],
        },
    )
    assert repeated.status_code == 200
    assert repeated.json()["completed_at"] == completed_at
    assert repeated.json()["mapped_skills"] == ["Python"]
    assert repeated.json()["evidence_type"] == "lesson_completed"

    evidence = client.get("/me/skill-evidence").json()
    assert evidence["evidence_type"] == "lesson_completed"
    assert evidence["skills"]["Python"][0]["is_assessed_proficiency"] is False
    assert evidence["skills"]["Python"][0]["source_item_id"] == "step-python"
    assert evidence["skills"]["Python"][0]["evidence_type"] == "lesson_completed"
    assert evidence["skills"]["Python"][0]["sources"][0]["source_record_id"] == "catalog-python-001"
    assert client.get("/me/lessons").json()[0]["item_id"] == "step-python"

    with TestClient(app) as second_client:
        second_account = register(second_client, "another@example.com")
        assert second_account["user"]["id"] != account["user"]["id"]
        assert second_client.get("/me/lessons").json() == []


def test_unmapped_lesson_does_not_award_client_claimed_skills(client: TestClient) -> None:
    account = register(client)
    response = client.put(
        "/me/lessons/step-unmapped-item/completion",
        headers=csrf_headers(account["csrf_token"]),
        json={
            "status": "completed",
            "item_type": "pathway_step",
            "title": "Unmapped item",
            "skills": ["Python"],
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["mapping_status"] == "no verified mapping"
    assert response.json()["mapped_skills"] == []
    assert response.json()["evidence_sources"] == []
    evidence = client.get("/me/skill-evidence").json()
    assert evidence["skills"] == {}
    assert evidence["unmapped_items"] == [{
        "item_id": "step-unmapped-item",
        "title": "Unmapped item",
        "mapping_status": "no verified mapping",
        "skills": [],
    }]


def test_mutations_require_csrf_and_allowed_origin(client: TestClient) -> None:
    register(client)
    missing_csrf = client.put(
        "/me/lessons/step-python/completion",
        headers={"Origin": ORIGIN},
        json={"status": "completed", "title": "Practice", "skills": ["Python"]},
    )
    assert missing_csrf.status_code == 403

    bad_origin = client.post(
        "/auth/login",
        headers={"Origin": "https://attacker.example"},
        json={"email": "learner@example.com", "password": "a-long-test-password"},
    )
    assert bad_origin.status_code == 403


def test_refresh_rotation_reuse_revokes_session_family(client: TestClient) -> None:
    account = register(client)
    old_refresh = client.cookies.get("refresh_token")
    assert old_refresh
    rotated = client.post(
        "/auth/refresh",
        headers=csrf_headers(account["csrf_token"]),
    )
    assert rotated.status_code == 200
    assert client.cookies.get("refresh_token") != old_refresh

    client.cookies.set("refresh_token", old_refresh, domain="testserver.local", path="/")
    replay = client.post(
        "/auth/refresh",
        headers=csrf_headers(account["csrf_token"]),
    )
    assert replay.status_code == 401
    assert client.get("/auth/me").status_code == 401


def test_logout_succeeds_after_access_cookie_expires(client: TestClient) -> None:
    account = register(client)
    client.cookies.delete("access_token")
    response = client.post(
        "/auth/logout",
        headers=csrf_headers(account["csrf_token"]),
    )
    assert response.status_code == 204
    assert client.post(
        "/auth/refresh",
        headers=csrf_headers(account["csrf_token"]),
    ).status_code == 401


def test_profile_updates_are_idempotent_and_reconcile_roadmap(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app import api
    import app.auth.routes as routes

    account = register(client)
    monkeypatch.setattr(api.analyzer, "validate_role", lambda role: role)
    reconciled: list[str] = []

    def fake_reconcile(db: Session, user_id: str, profile: object) -> dict:
        reconciled.append(user_id)
        return {"version": 1, "target_role": "Software Engineer"}

    monkeypatch.setattr(routes, "reconcile_roadmap", fake_reconcile)
    body = {
        "target_role": "Software Engineer",
        "skills": [{"name": "Python", "level": 2}],
        "experience_years": 1,
        "education": "Diploma",
    }
    first = client.put("/me/profile", headers=csrf_headers(account["csrf_token"]), json=body)
    second = client.put("/me/profile", headers=csrf_headers(account["csrf_token"]), json=body)
    assert first.status_code == second.status_code == 200
    assert first.json()["version"] == second.json()["version"] == 1
    assert first.json()["roadmap"]["target_role"] == "Software Engineer"
    headers = csrf_headers(account["csrf_token"])
    for status in ("completed", "in_progress", "not_started"):
        response = client.put(
            "/me/lessons/step-python/completion",
            headers=headers,
            json={
                "status": status,
                "item_type": "pathway_step",
                "title": "Practice Python",
                "skills": ["Python"],
            },
        )
        assert response.status_code == 200
    assert reconciled == [account["user"]["id"]] * 5


def test_profile_and_completion_persist_when_market_data_blocks_reconciliation(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app import api
    import app.auth.routes as routes

    account = register(client)
    monkeypatch.setattr(api.analyzer, "validate_role", lambda role: role)

    def unavailable(db: Session, user_id: str, profile: object) -> dict:
        raise HTTPException(status_code=503, detail="Job-demand data is unavailable.")

    monkeypatch.setattr(routes, "reconcile_roadmap", unavailable)
    headers = csrf_headers(account["csrf_token"])
    profile_response = client.put(
        "/me/profile",
        headers=headers,
        json={"target_role": "Software Engineer", "skills": []},
    )
    assert profile_response.status_code == 200
    assert profile_response.json()["roadmap_error"] == "Job-demand data is unavailable."

    completion_response = client.put(
        "/me/lessons/step-python/completion",
        headers=headers,
        json={
            "status": "completed",
            "item_type": "pathway_step",
            "title": "Practice Python",
            "skills": ["Python"],
        },
    )
    assert completion_response.status_code == 200
    assert completion_response.json()["roadmap_error"] == "Job-demand data is unavailable."
    assert client.get("/me/lessons").json()[0]["status"] == "completed"
    assert "Python" in client.get("/me/skill-evidence").json()["skills"]


def test_roadmap_reconciliation_is_idempotent_and_tracks_learning_changes(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app import api

    skill_shares = {"Python": 0.8, "SQL": 0.6}
    analyzer = SimpleNamespace(
        is_data_loaded=True,
        df=object(),
        validate_role=lambda role: role,
    )
    role_matcher = SimpleNamespace(
        _get_empirical_role_profiles=lambda: {
            "Software Engineer": {
                "status": "success",
                "skill_shares": skill_shares,
                "denominator": 10,
            },
        },
        normalize_profile_skills=lambda skills: (skills, []),
        gap_analyzer=SimpleNamespace(
            analyze_gaps=lambda skills, shares: {
                "all_gaps": [
                    {"skill": skill, "empirical_posting_share": share}
                    for skill, share in shares.items()
                    if skill not in skills
                ],
            },
        ),
    )
    course_recommender = SimpleNamespace(
        retriever=SimpleNamespace(
            records=[
                {"source_record_id": "catalog-python-001", "skills_gained": "Python"},
                {"source_record_id": "catalog-sql-001", "skills_gained": "SQL"},
            ],
            retrieve_for_gap=lambda skill: [],
        ),
    )
    config = SimpleNamespace(version="test-data", get_config_hash=lambda: "test-config")
    monkeypatch.setattr(api, "analyzer", analyzer)
    monkeypatch.setattr(api, "role_matcher", role_matcher)
    monkeypatch.setattr(api, "course_recommender", course_recommender)
    monkeypatch.setattr(api, "config", config)

    account = register(client)
    profile = client.put(
        "/me/profile",
        headers=csrf_headers(account["csrf_token"]),
        json={"target_role": "Software Engineer", "skills": []},
    )
    assert profile.status_code == 200
    assert profile.json()["roadmap"]["version"] == 1
    assert len(profile.json()["roadmap"]["items"]) == 2
    assert len(profile.json()["roadmap"]["unresolved_skill_gaps"]) == 2
    assert client.get("/me/roadmap").json()["version"] == 1

    completed = client.put(
        "/me/lessons/step-python/completion",
        headers=csrf_headers(account["csrf_token"]),
        json={
            "status": "completed",
            "item_type": "pathway_step",
            "title": "Practice Python",
            "skills": ["Python"],
        },
    )
    assert completed.status_code == 200
    roadmap = client.get("/me/roadmap").json()
    assert roadmap["version"] == 2
    assert next(item for item in roadmap["items"] if item["skill"] == "Python")["status"] == "learning_completed"
    assert roadmap["evidence_score"]["percentage"] == 50.0

    reverted = client.put(
        "/me/lessons/step-python/completion",
        headers=csrf_headers(account["csrf_token"]),
        json={
            "status": "not_started",
            "item_type": "pathway_step",
            "title": "Practice Python",
            "skills": ["Python"],
        },
    )
    assert reverted.status_code == 200
    assert client.get("/me/roadmap").json()["version"] == 3
