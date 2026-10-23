"""
Unit tests for RoleNormalizer and flexible role matching.
Verifies:
- 'data en' matches 'Data Engineer'
- 'data eng', 'DATA EN', 'de' match 'Data Engineer'
- 'software en', 'swe', 'se' match 'Software Engineer / Developer'
- 'data sc', 'ds' match 'Data Scientist'
- 'ml en', 'ml', 'ai' match 'Machine Learning / AI Engineer'
- 'cloud en', 'cloud' match 'Cloud Engineer'
- Unrecognized roles return None / raise RoleNotFoundError
- Integration with TrendAnalyzer and API endpoints
"""

import pytest
from fastapi.testclient import TestClient

from app.config import Config, load_config
from app.role_normalizer import RoleNormalizer
from app.trend_analyzer import TrendAnalyzer, RoleNotFoundError
from app.api import app


@pytest.fixture
def normalizer():
    return RoleNormalizer()


def test_data_en_resolves_to_data_engineer(normalizer):
    assert normalizer.normalize_role("data en") == "Data Engineer"
    assert normalizer.normalize_role("DATA EN") == "Data Engineer"
    assert normalizer.normalize_role("  data   en  ") == "Data Engineer"
    assert normalizer.normalize_role("data eng") == "Data Engineer"
    assert normalizer.normalize_role("de") == "Data Engineer"
    assert normalizer.normalize_role("Data Engineer") == "Data Engineer"
    assert normalizer.normalize_role("data engineer") == "Data Engineer"


def test_other_role_abbreviations_resolve_correctly(normalizer):
    # Software Engineer
    assert normalizer.normalize_role("software en") == "Software Engineer / Developer"
    assert normalizer.normalize_role("swe") == "Software Engineer / Developer"
    assert normalizer.normalize_role("se") == "Software Engineer / Developer"
    assert normalizer.normalize_role("full stack") == "Software Engineer / Developer"

    # Data Scientist
    assert normalizer.normalize_role("data sc") == "Data Scientist"
    assert normalizer.normalize_role("ds") == "Data Scientist"

    # ML / AI Engineer
    assert normalizer.normalize_role("ml en") == "Machine Learning / AI Engineer"
    assert normalizer.normalize_role("ml") == "Machine Learning / AI Engineer"
    assert normalizer.normalize_role("ai") == "Machine Learning / AI Engineer"

    # Cloud Engineer
    assert normalizer.normalize_role("cloud en") == "Cloud Engineer"
    assert normalizer.normalize_role("cloud") == "Cloud Engineer"


def test_unrecognized_roles_return_none(normalizer):
    assert normalizer.normalize_role("Chief Happiness Officer") is None
    assert normalizer.normalize_role("Random Unrelated Job 98765") is None
    assert normalizer.normalize_role("") is None
    assert normalizer.normalize_role("   ") is None
    assert normalizer.normalize_role(None) is None


def test_trend_analyzer_validates_data_en():
    analyzer = TrendAnalyzer()
    canonical = analyzer.validate_role("data en")
    assert canonical == "Data Engineer"

    canonical_swe = analyzer.validate_role("swe")
    assert canonical_swe == "Software Engineer / Developer"

    with pytest.raises(RoleNotFoundError):
        analyzer.validate_role("Chief Happiness Officer")


def test_api_endpoints_accept_data_en():
    client = TestClient(app)

    # 1. GET /skills/demand?role=data en
    resp = client.get("/skills/demand?role=data%20en")
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "Data Engineer"
    assert data["status"] == "success"

    # 2. GET /skills/trends?role=data en
    resp_trends = client.get("/skills/trends?role=data%20en")
    assert resp_trends.status_code == 200
    data_trends = resp_trends.json()
    assert data_trends["role"] == "Data Engineer"

    # 3. GET /skills/compare?role1=data en&role2=data sc
    resp_compare = client.get("/skills/compare?role1=data%20en&role2=data%20sc")
    assert resp_compare.status_code == 200
    data_compare = resp_compare.json()
    assert data_compare["role1"] == "Data Engineer"
    assert data_compare["role2"] == "Data Scientist"

    # 4. POST /skills/gap with target_role='data en'
    resp_gap = client.post("/skills/gap", json={
        "target_role": "data en",
        "current_skills": ["SQL", "Python"]
    })
    assert resp_gap.status_code == 200
    data_gap = resp_gap.json()
    assert data_gap["target_role"] == "Data Engineer"

    # 5. POST /roadmap/generate with target_role='data en'
    resp_roadmap = client.post("/roadmap/generate", json={
        "target_role": "data en",
        "current_skills": ["SQL", "Python"]
    })
    assert resp_roadmap.status_code == 200
    data_roadmap = resp_roadmap.json()
    assert data_roadmap["target_role"] == "Data Engineer"
