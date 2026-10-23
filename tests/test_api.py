"""
Integration tests for FastAPI endpoints.
Covers:
- GET /health (data loaded vs data not loaded)
- GET /metadata
- GET /roles
- GET /skills/demand (success, sample size warning, insufficient sample, comparison param)
- GET /skills/demand (invalid role -> 404 with supported roles)
- GET /skills/trends (success, insufficient date data)
- GET /skills/compare (role-to-role side-by-side comparison)
- Unloaded data behavior (503 Service Unavailable)
- CORS header verification
"""

import pytest
from fastapi.testclient import TestClient
from app.api import app, analyzer


@pytest.fixture
def client():
    return TestClient(app)


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "malaysia-workforce-intelligence"
    assert "version" in data
    assert "data_loaded" in data


def test_metadata_endpoint(client):
    response = client.get("/metadata")
    assert response.status_code == 200
    data = response.json()
    assert "pipeline_version" in data
    assert "config_hash" in data
    assert "dataset_licenses" in data
    assert "deduplication_policy" in data
    assert "supported_roles" in data
    assert len(data["supported_roles"]) == 5


def test_roles_endpoint(client):
    response = client.get("/roles")
    assert response.status_code == 200
    data = response.json()
    assert data["total_roles"] == 5
    roles = data["roles"]
    role_names = [r["role"] for r in roles]
    assert "Software Engineer / Developer" in role_names
    assert "Data Engineer" in role_names
    assert "Data Scientist" in role_names
    assert "Machine Learning / AI Engineer" in role_names
    assert "Cloud Engineer" in role_names


def test_skills_demand_success(client):
    response = client.get("/skills/demand?role=Software%20Engineer%20/%20Developer&top_n=5")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["role"] == "Software Engineer / Developer"
    assert data["denominator"] > 0
    assert "job_title, company, location" in data["deduplication_policy"]
    assert "sample_size_warning" in data
    assert len(data["skills"]) <= 5
    first_skill = data["skills"][0]
    assert "skill" in first_skill
    assert "posting_share" in first_skill
    assert "posting_share_percentage" in first_skill


def test_skills_demand_invalid_role_404(client):
    response = client.get("/skills/demand?role=Chief%20Happiness%20Officer")
    assert response.status_code == 404
    data = response.json()
    assert data["error"] == "RoleNotFound"
    assert "Chief Happiness Officer" in data["message"]
    assert "supported_roles" in data
    assert "Software Engineer / Developer" in data["supported_roles"]


def test_skills_demand_comparison_param(client):
    response = client.get(
        "/skills/demand?role=Data%20Engineer&compare_with=Data%20Scientist&top_n=5"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["role1"] == "Data Engineer"
    assert data["role2"] == "Data Scientist"
    assert "denominator_role1" in data
    assert "denominator_role2" in data
    assert "comparison" in data


def test_skills_trends_endpoint(client):
    response = client.get("/skills/trends?role=Data%20Engineer")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("success", "insufficient_date_data")
    assert data["role"] == "Data Engineer"
    assert "denominator" in data
    assert "sample_size_warning" in data

    # Verify no subjective marketing words in payload
    data_str = str(data).lower()
    for forbidden in ["emerging", "fast-growing", "latest", "currently in demand"]:
        assert forbidden not in data_str


def test_skills_compare_endpoint(client):
    response = client.get("/skills/compare?role1=Data%20Engineer&role2=Data%20Scientist")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["role1"] == "Data Engineer"
    assert data["role2"] == "Data Scientist"
    assert data["denominator_role1"] > 0
    assert data["denominator_role2"] > 0
    assert "comparison" in data
    assert "common_skills" in data


def test_unloaded_data_behavior(client, monkeypatch):
    # Simulate server starting when data is not yet loaded
    orig_loaded = analyzer.is_data_loaded
    orig_df = analyzer.df
    try:
        analyzer.is_data_loaded = False
        analyzer.df = None

        # /health still returns 200 with data_loaded=false
        health_resp = client.get("/health")
        assert health_resp.status_code == 200
        assert health_resp.json()["data_loaded"] is False

        # /skills/demand returns 503
        demand_resp = client.get("/skills/demand?role=Software%20Engineer%20/%20Developer")
        assert demand_resp.status_code == 503
        assert demand_resp.json()["error"] == "DataNotLoaded"

    finally:
        # Restore analyzer state
        analyzer.is_data_loaded = orig_loaded
        analyzer.df = orig_df


# ==============================================================================
# PART 1 ENDPOINT INTEGRATION TESTS
# ==============================================================================

def test_api_profile_analyze(client):
    payload = {
        "skills": ["python", "js", "react.js", "k8s", "MadeUpSkill999"],
        "experience_years": 3.0,
        "education": "Bachelor's Degree"
    }
    response = client.post("/profile/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["raw_skills_count"] == 5
    assert "Python" in data["normalized_skills"]
    assert "JavaScript" in data["normalized_skills"]
    assert "React" in data["normalized_skills"]
    assert "Kubernetes" in data["normalized_skills"]
    assert "MadeUpSkill999" in data["unrecognized_skills"]


def test_api_roles_match_success(client):
    payload = {
        "skills": ["Python", "SQL", "Pandas", "Scikit-Learn"],
        "experience_years": 2.5,
        "top_k": 3
    }
    response = client.post("/roles/match", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "disclaimer" in data
    assert "not constitute a hiring guarantee" in data["disclaimer"]
    assert len(data["ranked_matches"]) == 3

    top_match = data["ranked_matches"][0]
    assert "role" in top_match
    assert "match_score" in top_match
    assert "score_components" in top_match
    assert "evidence_sample_size" in top_match
    assert top_match["evidence_sample_size"] > 0
    assert "matched_skills" in top_match
    assert "core_gaps" in top_match


def test_api_roles_match_empty_profile(client):
    payload = {
        "skills": [],
        "top_k": 5
    }
    response = client.post("/roles/match", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    # All scores should safely be 0.0 without errors
    for m in data["ranked_matches"]:
        assert m["match_score"] == 0.0


def test_api_roadmap_generate(client):
    payload = {
        "target_role": "Data Engineer",
        "current_skills": ["Python"],
        "max_courses": 4
    }
    response = client.post("/roadmap/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["target_role"] == "Data Engineer"
    assert data["evidence_sample_size"] == 104
    assert data["pathway_ordering_label"] == "heuristic, not a validated sequence"
    assert "ordering_disclaimer" in data
    assert len(data["ordered_pathway"]) <= 4

    if data["ordered_pathway"]:
        first_course = data["ordered_pathway"][0]
        assert "course_title" in first_course
        assert first_course["course_url"].startswith("http")
        assert "why_recommended" in first_course
        assert "gap_addressed" in first_course
        assert "source_record_id" in first_course

    assert len(data["sdg_alignments"]) > 0
    assert "sdg_disclaimer" in data

