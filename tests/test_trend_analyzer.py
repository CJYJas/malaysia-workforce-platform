"""
Unit tests for TrendAnalyzer.
Covers:
- Unloaded data handling and DataNotLoadedError
- Valid vs Invalid role queries (RoleNotFoundError)
- Skill demand calculation, denominator disclosure, and posting share
- Role below minimum sample threshold (structured insufficient_evidence response)
- Small sample size warning (N < 50)
- Historical monthly trend calculation
- Insufficient date data handling with frequency-based fallback
- Strict absence of subjective marketing terms ('emerging', 'fast-growing', 'latest', 'currently in demand')
- Role-to-role comparison
"""

import pytest
import pandas as pd
from app.trend_analyzer import TrendAnalyzer, RoleNotFoundError, DataNotLoadedError
from app.config import Config


@pytest.fixture
def mock_config():
    raw_config = {
        "pipeline": {
            "version": "1.0.0",
            "min_postings_per_role": 10,
            "sample_size_warning_threshold": 30,
            "min_months_for_trends": 3
        },
        "trend_analysis": {
            "min_months_for_trends": 3,
            "sample_size_warning_threshold": 30,
            "default_top_n_skills": 10,
            "representative_start_month": "2024-02",
            "representative_end_month": "2024-06"
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
                    "description": "Software development"
                },
                "Data Engineer": {
                    "pattern": r"(?i)\bdata\s+engineer\b",
                    "priority": 2,
                    "description": "Data engineering"
                },
                "Data Scientist": {
                    "pattern": r"(?i)\bdata\s+scientist\b",
                    "priority": 3,
                    "description": "Data science"
                }
            }
        }
    }
    return Config(raw_config, config_path="config.yaml")


@pytest.fixture
def mock_postings_df():
    # 20 Software Engineers, 15 Data Engineers, 5 Data Scientists
    # Software Engineer: meets 10 min, below 30 -> small sample warning
    # Data Engineer: meets 10 min, below 30 -> small sample warning
    # Data Scientist: 5 rows < 10 min -> insufficient evidence
    rows = []

    # 20 Software Engineers across 4 months (2024-02 to 2024-05)
    months = ["2024-02", "2024-03", "2024-04", "2024-05"]
    for i in range(20):
        m = months[i % len(months)]
        # Python in 15 rows, JS in 10 rows
        skills = []
        if i < 15:
            skills.append("Python")
        if i < 10:
            skills.append("JavaScript")
        rows.append({
            "job_id": 1000 + i,
            "job_title": "Software Engineer",
            "assigned_role": "Software Engineer / Developer",
            "listing_month": m,
            "extracted_skills": skills
        })

    # 15 Data Engineers across 3 months
    for i in range(15):
        m = months[i % 3]
        skills = ["SQL"]
        if i < 10:
            skills.append("Python")
        rows.append({
            "job_id": 2000 + i,
            "job_title": "Data Engineer",
            "assigned_role": "Data Engineer",
            "listing_month": m,
            "extracted_skills": skills
        })

    # 5 Data Scientists (insufficient sample)
    for i in range(5):
        rows.append({
            "job_id": 3000 + i,
            "job_title": "Data Scientist",
            "assigned_role": "Data Scientist",
            "listing_month": "2024-02",
            "extracted_skills": ["Python", "Machine Learning"]
        })

    return pd.DataFrame(rows)


def test_analyzer_unloaded_data(mock_config):
    analyzer = TrendAnalyzer(df=None, config=mock_config)
    analyzer.is_data_loaded = False
    analyzer.df = None

    with pytest.raises(DataNotLoadedError):
        analyzer.calculate_skill_demand("Software Engineer / Developer")

    with pytest.raises(DataNotLoadedError):
        analyzer.calculate_skill_trends("Software Engineer / Developer")


def test_invalid_role_raises_error(mock_config, mock_postings_df):
    analyzer = TrendAnalyzer(df=mock_postings_df, config=mock_config)
    with pytest.raises(RoleNotFoundError) as exc_info:
        analyzer.calculate_skill_demand("Prompt Wizard")
    assert "Prompt Wizard" in str(exc_info.value)
    assert "Software Engineer / Developer" in exc_info.value.supported_roles


def test_skill_demand_success(mock_config, mock_postings_df):
    analyzer = TrendAnalyzer(df=mock_postings_df, config=mock_config)
    result = analyzer.calculate_skill_demand("Software Engineer / Developer")

    assert result["status"] == "success"
    assert result["role"] == "Software Engineer / Developer"
    assert result["denominator"] == 20
    assert result["deduplication_policy"] == "job_title, company, location"
    assert result["sample_size_warning"] is True  # 20 < 30
    assert "Small sample size" in result["warning_message"]

    skills = result["skills"]
    assert len(skills) == 2
    # Python: 15 / 20 = 0.75 (75%)
    assert skills[0]["skill"] == "Python"
    assert skills[0]["mention_count"] == 15
    assert skills[0]["posting_share"] == 0.75
    assert skills[0]["posting_share_percentage"] == 75.0

    # JavaScript: 10 / 20 = 0.50 (50%)
    assert skills[1]["skill"] == "JavaScript"
    assert skills[1]["mention_count"] == 10
    assert skills[1]["posting_share"] == 0.50


def test_role_below_minimum_sample_returns_insufficient_evidence(mock_config, mock_postings_df):
    analyzer = TrendAnalyzer(df=mock_postings_df, config=mock_config)
    # Data Scientist has N = 5 < 10 (min required)
    result = analyzer.calculate_skill_demand("Data Scientist")

    assert result["status"] == "insufficient_evidence"
    assert result["role"] == "Data Scientist"
    assert result["postings_count"] == 5
    assert result["min_postings_required"] == 10
    assert "Insufficient postings" in result["message"]
    assert result["skills"] == []


def test_trends_success_and_forbidden_terms_check(mock_config, mock_postings_df):
    analyzer = TrendAnalyzer(df=mock_postings_df, config=mock_config)
    result = analyzer.calculate_skill_trends("Software Engineer / Developer")

    assert result["status"] == "success"
    assert result["months_covered"] == 4
    assert len(result["monthly_trends"]) == 4

    # Strict compliance check: Forbidden subjective words must never appear in payload
    result_str = str(result).lower()
    for forbidden in ["emerging", "fast-growing", "latest", "currently in demand"]:
        assert forbidden not in result_str, f"Forbidden term '{forbidden}' found in trends output!"


def test_trends_insufficient_date_data(mock_config):
    # Create DF with only 1 month (less than min_months_for_trends = 3)
    df_one_month = pd.DataFrame([
        {
            "job_id": i,
            "assigned_role": "Data Engineer",
            "listing_month": "2024-03",
            "extracted_skills": ["SQL", "Python"]
        }
        for i in range(15)
    ])
    analyzer = TrendAnalyzer(df=df_one_month, config=mock_config)
    result = analyzer.calculate_skill_trends("Data Engineer")

    assert result["status"] == "insufficient_date_data"
    assert result["demand_label"] == "frequency-based"
    assert "Fewer than 3 reliable monthly observation periods" in result["reason"]
    assert "frequency_based_demand" in result
    assert len(result["frequency_based_demand"]) > 0


def test_compare_roles(mock_config, mock_postings_df):
    analyzer = TrendAnalyzer(df=mock_postings_df, config=mock_config)
    res = analyzer.compare_roles("Software Engineer / Developer", "Data Engineer")

    assert res["status"] == "success"
    assert res["role1"] == "Software Engineer / Developer"
    assert res["role2"] == "Data Engineer"
    assert res["denominator_role1"] == 20
    assert res["denominator_role2"] == 15
    assert "Python" in res["common_skills"]
    assert "JavaScript" in res["unique_to_role1"]
    assert "SQL" in res["unique_to_role2"]
