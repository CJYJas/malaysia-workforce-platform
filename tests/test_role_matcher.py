"""
Unit tests for RoleMatcher and SkillsGapAnalyzer (Part 1).
Covers:
- Empirical role matching from JobStreet posting shares
- Weighted match score calculation (skill coverage + TF-IDF cosine)
- Empty and sparse profile handling
- Match disclaimer verification
- Unrecognized skill tracking
- Gaps categorization (core vs recommended)
"""

import pytest
import pandas as pd
from app.config import Config
from app.trend_analyzer import TrendAnalyzer
from app.role_matcher import RoleMatcher
from app.skills_gap import SkillsGapAnalyzer


@pytest.fixture
def sample_config():
    raw_config = {
        "pipeline": {
            "version": "1.0.0",
            "min_postings_per_role": 5,
            "sample_size_warning_threshold": 20
        },
        "trend_analysis": {
            "min_months_for_trends": 3,
            "sample_size_warning_threshold": 20,
            "default_top_n_skills": 10
        },
        "matching": {
            "weight_skill_coverage": 0.70,
            "weight_tfidf_similarity": 0.30,
            "min_core_skill_share": 0.30,
            "min_recommended_skill_share": 0.10,
            "disclaimer": "This match score reflects empirical alignment with analyzed Malaysian job postings and does not constitute a hiring guarantee or probability of employment."
        },
        "deduplication": {
            "key": ["job_title", "company", "location"],
            "keep": "first"
        },
        "roles": {
            "title_column": "job_title",
            "rules": {
                "Software Engineer / Developer": {
                    "pattern": r"(?i)\bsoftware\s+engineer\b",
                    "priority": 1,
                    "description": "Software engineering"
                },
                "Data Engineer": {
                    "pattern": r"(?i)\bdata\s+engineer\b",
                    "priority": 2,
                    "description": "Data engineering"
                }
            }
        }
    }
    return Config(raw_config, config_path="config.yaml")


@pytest.fixture
def sample_postings_df():
    rows = []
    # 10 Software Engineers
    for i in range(10):
        skills = ["JavaScript", "HTML"]
        if i < 7:
            skills.append("Python")
        rows.append({
            "job_id": 100 + i,
            "assigned_role": "Software Engineer / Developer",
            "extracted_skills": skills,
            "listing_month": "2024-03"
        })

    # 10 Data Engineers
    for i in range(10):
        skills = ["SQL", "ETL"]
        if i < 8:
            skills.append("Python")
        rows.append({
            "job_id": 200 + i,
            "assigned_role": "Data Engineer",
            "extracted_skills": skills,
            "listing_month": "2024-03"
        })

    return pd.DataFrame(rows)


def test_role_matching_with_valid_skills(sample_config, sample_postings_df):
    analyzer = TrendAnalyzer(df=sample_postings_df, config=sample_config)
    matcher = RoleMatcher(trend_analyzer=analyzer, config=sample_config)

    result = matcher.match_roles(raw_skills=["Python", "SQL", "Docker"])

    assert result["status"] == "success"
    assert "disclaimer" in result
    assert "not constitute a hiring guarantee" in result["disclaimer"]

    candidate = result["candidate_profile"]
    assert "Python" in candidate["normalized_skills"]
    assert "SQL" in candidate["normalized_skills"]
    assert "Docker" in candidate["normalized_skills"]

    ranked = result["ranked_matches"]
    assert len(ranked) == 2

    # Data Engineer has both SQL and Python as high share skills
    de_match = next(m for m in ranked if m["role"] == "Data Engineer")
    assert de_match["match_score"] > 50.0
    assert de_match["evidence_sample_size"] == 10
    assert de_match["score_components"]["weights"]["skill_coverage"] == 0.70
    assert de_match["score_components"]["weights"]["tfidf_cosine"] == 0.30

    matched_skill_names = [s["skill"] for s in de_match["matched_skills"]]
    assert "SQL" in matched_skill_names
    assert "Python" in matched_skill_names

    core_gap_names = [g["skill"] for g in de_match["core_gaps"]]
    assert "ETL" in core_gap_names


def test_empty_profile_handling(sample_config, sample_postings_df):
    analyzer = TrendAnalyzer(df=sample_postings_df, config=sample_config)
    matcher = RoleMatcher(trend_analyzer=analyzer, config=sample_config)

    # Empty candidate profile
    result = matcher.match_roles(raw_skills=[])

    assert result["status"] == "success"
    assert result["candidate_profile"]["normalized_skills"] == []
    assert len(result["ranked_matches"]) == 2

    # Scores must gracefully be 0.0 without errors or NaN
    for match in result["ranked_matches"]:
        assert match["match_score"] == 0.0
        assert match["score_components"]["skill_coverage"] == 0.0
        assert match["score_components"]["tfidf_cosine"] == 0.0
        assert len(match["matched_skills"]) == 0
        assert match["total_gaps_count"] > 0


def test_unrecognized_skills_tracking(sample_config, sample_postings_df):
    analyzer = TrendAnalyzer(df=sample_postings_df, config=sample_config)
    matcher = RoleMatcher(trend_analyzer=analyzer, config=sample_config)

    result = matcher.match_roles(raw_skills=["Python", "Quantum Teleportation", "Ancient Alchemy"])
    candidate = result["candidate_profile"]

    assert candidate["normalized_skills"] == ["Python"]
    assert "Quantum Teleportation" in candidate["unrecognized_skills"]
    assert "Ancient Alchemy" in candidate["unrecognized_skills"]
