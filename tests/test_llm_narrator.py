"""
Unit tests for Part 4: LLM Narration & Factual Fidelity Verification Gate.
Covers:
- Factual fidelity checker numerical grounding.
- Rejection of banned buzzwords ('emerging', 'fast-growing', 'guaranteed hire', etc.).
- LLMNarrator role match narration (template and LLM modes).
- LLMNarrator roadmap narration (template and LLM modes).
- Fallback to deterministic template on factual or policy violation.
- API integration tests: POST /roles/match and POST /roadmap/generate with explain parameter.
"""

import pytest
from fastapi.testclient import TestClient

from app.api import app
from app.llm_narrator import FactualFidelityChecker, LLMNarrator
from app.llm_client import LLMClient


class FaithfulMockClient:
    def generate(self, prompt, **kwargs):
        # Generates narration adhering strictly to numbers in prompt
        return "Based on Malaysian postings (N = 104), your profile matches Data Engineer with a 52.8% score."


class FabricatingMockClient:
    def generate(self, prompt, **kwargs):
        # Fabricates a 99.9% score not in ground truth facts
        return "You are an amazing fit with a 99.9% match score for Data Engineer!"


class BuzzwordMockClient:
    def generate(self, prompt, **kwargs):
        # Uses forbidden banned buzzwords
        return "Data Engineer is an emerging and fast-growing role with 52.8% match."


def test_factual_fidelity_checker_valid():
    checker = FactualFidelityChecker()
    facts = {"role": "Data Engineer", "match_score": 75.5, "evidence_sample_size": 104}
    text = "Data Engineer alignment is 75.5% based on 104 postings."
    is_valid, reason = checker.verify(text, facts, {"Data Engineer"})

    assert is_valid is True
    assert reason is None


def test_factual_fidelity_checker_rejects_ungrounded_numbers():
    checker = FactualFidelityChecker()
    facts = {"role": "Data Engineer", "match_score": 75.5, "evidence_sample_size": 104}
    # 98.2 is ungrounded
    text = "Data Engineer alignment is 98.2% based on 104 postings."
    is_valid, reason = checker.verify(text, facts, {"Data Engineer"})

    assert is_valid is False
    assert "ungrounded numbers" in reason


def test_factual_fidelity_checker_rejects_banned_buzzwords():
    checker = FactualFidelityChecker()
    facts = {"role": "Data Engineer", "match_score": 75.5}
    text = "This emerging and fast-growing career path has a 75.5% match."
    is_valid, reason = checker.verify(text, facts, {"Data Engineer"})

    assert is_valid is False
    assert "banned_phrase_detected" in reason


def test_llm_narrator_template_mode():
    narrator = LLMNarrator()
    sample_match = {
        "ranked_matches": [{
            "role": "Data Engineer",
            "match_score": 65.0,
            "evidence_sample_size": 104,
            "score_components": {"skill_coverage": 0.7},
            "matched_skills": [{"skill": "Python"}, {"skill": "SQL"}],
            "core_gaps": [{"skill": "ETL"}]
        }]
    }
    res = narrator.narrate_role_match(sample_match, explain_mode="template")

    assert res["method"] == "deterministic_template"
    assert "Data Engineer" in res["narration"]
    assert "65.0%" in res["narration"]


def test_llm_narrator_faithful_llm_mode():
    narrator = LLMNarrator(llm_client=FaithfulMockClient())
    sample_match = {
        "ranked_matches": [{
            "role": "Data Engineer",
            "match_score": 52.8,
            "evidence_sample_size": 104,
            "score_components": {"skill_coverage": 0.5},
            "matched_skills": [{"skill": "Python"}],
            "core_gaps": []
        }]
    }
    res = narrator.narrate_role_match(sample_match, explain_mode="llm")

    assert res["method"] == "verified_llm_narration"
    assert res["fallback_reason"] is None
    assert "52.8%" in res["narration"]


def test_llm_narrator_fabrication_reverts_to_template():
    narrator = LLMNarrator(llm_client=FabricatingMockClient())
    sample_match = {
        "ranked_matches": [{
            "role": "Data Engineer",
            "match_score": 52.8,
            "evidence_sample_size": 104,
            "score_components": {"skill_coverage": 0.5},
            "matched_skills": [{"skill": "Python"}],
            "core_gaps": []
        }]
    }
    res = narrator.narrate_role_match(sample_match, explain_mode="llm")

    # Guardrail must reject the hallucinated 99.9% score
    assert res["method"] == "deterministic_template"
    assert "factual_fidelity_violation" in res["fallback_reason"]
    assert "52.8%" in res["narration"]


def test_llm_narrator_banned_buzzwords_reverts_to_template():
    narrator = LLMNarrator(llm_client=BuzzwordMockClient())
    sample_match = {
        "ranked_matches": [{
            "role": "Data Engineer",
            "match_score": 52.8,
            "evidence_sample_size": 104,
            "score_components": {"skill_coverage": 0.5},
            "matched_skills": [{"skill": "Python"}],
            "core_gaps": []
        }]
    }
    res = narrator.narrate_role_match(sample_match, explain_mode="llm")

    # Guardrail must reject "emerging" and "fast-growing"
    assert res["method"] == "deterministic_template"
    assert "banned_phrase_detected" in res["fallback_reason"]


def test_api_match_roles_with_llm_narration():
    client = TestClient(app)
    response = client.post(
        "/roles/match",
        json={
            "skills": ["Python", "SQL", "Docker"],
            "top_k": 3,
            "explain": "template"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["narration"] is not None
    assert data["narration_method"] == "deterministic_template"


def test_api_roadmap_generate_with_narration():
    client = TestClient(app)
    response = client.post(
        "/roadmap/generate",
        json={
            "target_role": "Data Engineer",
            "current_skills": ["Python"],
            "max_courses": 4,
            "explain": "template"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["narration"] is not None
    assert data["narration_method"] == "deterministic_template"
