"""
Unit tests for data preprocessing module.
Covers:
- Malaysia location filtering (retaining gazetted districts and recording excluded counts)
- Deduplication using documented composite key
- Target role assignment rules and edge cases
- Date standardization and Year-Month formatting
"""

import pytest
import pandas as pd
from app.preprocessing import (
    filter_malaysia,
    deduplicate_postings,
    assign_roles,
    standardize_dates
)
from app.config import Config


@pytest.fixture
def sample_config():
    raw_config = {
        "pipeline": {"version": "1.0.0", "min_postings_per_role": 2},
        "malaysia_filter": {
            "location_column": "location",
            "excluded_values": ["Others", "others", "Unknown", "unknown", "nan", ""],
            "min_location_length": 2
        },
        "deduplication": {
            "key": ["job_title", "company", "location"],
            "keep": "first"
        },
        "roles": {
            "title_column": "job_title",
            "rules": {
                "Software Engineer / Developer": {
                    "pattern": r"(?i)\b(software\s+(?:engineer|developer)|full\s*stack|backend\s+developer|web\s+developer)\b",
                    "priority": 1
                },
                "Data Engineer": {
                    "pattern": r"(?i)\b(data\s+engineer|big\s*data\s+engineer|etl\s+developer)\b",
                    "priority": 2
                },
                "Data Scientist": {
                    "pattern": r"(?i)\b(data\s+scientist|data\s+science\s+specialist)\b",
                    "priority": 3
                },
                "Machine Learning / AI Engineer": {
                    "pattern": r"(?i)\b(machine\s+learning\s+engineer|ml\s+engineer|ai\s+engineer)\b",
                    "priority": 4
                },
                "Cloud Engineer": {
                    "pattern": r"(?i)\b(cloud\s+engineer|cloud\s+architect|aws\s+engineer)\b",
                    "priority": 5
                }
            }
        }
    }
    return Config(raw_config, config_path="config.yaml")


# ==============================================================================
# MALAYSIA FILTER TESTS
# ==============================================================================

def test_filter_malaysia_retains_valid_locations(sample_config):
    df = pd.DataFrame({
        "job_title": ["Dev 1", "Dev 2", "Dev 3", "Dev 4"],
        "location": ["Kuala Lumpur", "Petaling Jaya", "Bayan Lepas", "Johor Bahru"]
    })
    filtered_df, metrics = filter_malaysia(df, config=sample_config)
    assert len(filtered_df) == 4
    assert metrics["initial_rows"] == 4
    assert metrics["retained_malaysia_rows"] == 4
    assert metrics["excluded_count"] == 0


def test_filter_malaysia_excludes_unknown_and_records_count(sample_config):
    df = pd.DataFrame({
        "job_title": [f"Job {i}" for i in range(6)],
        "location": [
            "Kuala Lumpur",
            "Others",          # ambiguous -> exclude
            "others",          # case-insensitive -> exclude
            "Unknown",         # unknown -> exclude
            "",                # blank -> exclude
            "Penang"           # valid -> retain
        ]
    })
    filtered_df, metrics = filter_malaysia(df, config=sample_config)
    
    assert len(filtered_df) == 2
    assert set(filtered_df["location"].tolist()) == {"Kuala Lumpur", "Penang"}
    assert metrics["initial_rows"] == 6
    assert metrics["retained_malaysia_rows"] == 2
    assert metrics["excluded_count"] == 4
    assert metrics["exclusion_breakdown"]["Others"] == 1
    assert metrics["exclusion_breakdown"]["others"] == 1
    assert metrics["exclusion_breakdown"]["Unknown"] == 1
    assert metrics["exclusion_breakdown"]["[EMPTY]"] == 1


def test_filter_malaysia_empty_input(sample_config):
    df_empty = pd.DataFrame(columns=["job_title", "location"])
    filtered_df, metrics = filter_malaysia(df_empty, config=sample_config)
    assert len(filtered_df) == 0
    assert metrics["excluded_count"] == 0


# ==============================================================================
# DEDUPLICATION TESTS
# ==============================================================================

def test_deduplicate_postings_removes_duplicates_by_documented_key(sample_config):
    df = pd.DataFrame({
        "job_id": [101, 102, 103, 104, 105],
        "job_title": [
            "Software Engineer",
            "Software Engineer",  # duplicate of row 0
            "Software Engineer",  # different company -> unique
            "Data Engineer",
            "Software Engineer"   # different location -> unique
        ],
        "company": ["Shopee", "Shopee", "Grab", "Petronas", "Shopee"],
        "location": ["Kuala Lumpur", "Kuala Lumpur", "Kuala Lumpur", "Kuala Lumpur", "Penang"]
    })

    deduped_df, metrics = deduplicate_postings(df, config=sample_config)

    assert len(deduped_df) == 4
    assert metrics["initial_rows"] == 5
    assert metrics["retained_rows"] == 4
    assert metrics["duplicates_removed"] == 1
    assert metrics["dedup_key"] == ["job_title", "company", "location"]
    # Retained first observed id (101), not 102
    assert 101 in deduped_df["job_id"].values
    assert 102 not in deduped_df["job_id"].values


def test_deduplicate_missing_key_column_raises_error(sample_config):
    df = pd.DataFrame({
        "job_title": ["Dev"],
        # Missing 'company' and 'location'
    })
    with pytest.raises(KeyError):
        deduplicate_postings(df, config=sample_config)


# ==============================================================================
# ROLE ASSIGNMENT TESTS
# ==============================================================================

def test_assign_roles_target_classification(sample_config):
    df = pd.DataFrame({
        "job_title": [
            "Senior Software Engineer",
            "Lead Full Stack Developer",
            "Big Data Engineer",
            "Senior Data Scientist",
            "Machine Learning Engineer",
            "Cloud Architect (AWS)",
            "Accountant / Finance Manager",
            "Human Resource Officer"
        ]
    })
    df_roles, role_counts = assign_roles(df, config=sample_config)

    assert df_roles.iloc[0]["assigned_role"] == "Software Engineer / Developer"
    assert df_roles.iloc[1]["assigned_role"] == "Software Engineer / Developer"
    assert df_roles.iloc[2]["assigned_role"] == "Data Engineer"
    assert df_roles.iloc[3]["assigned_role"] == "Data Scientist"
    assert df_roles.iloc[4]["assigned_role"] == "Machine Learning / AI Engineer"
    assert df_roles.iloc[5]["assigned_role"] == "Cloud Engineer"
    assert df_roles.iloc[6]["assigned_role"] == "Other / Unassigned"
    assert df_roles.iloc[7]["assigned_role"] == "Other / Unassigned"

    assert role_counts["Software Engineer / Developer"] == 2
    assert role_counts["Data Engineer"] == 1
    assert role_counts["Data Scientist"] == 1
    assert role_counts["Machine Learning / AI Engineer"] == 1
    assert role_counts["Cloud Engineer"] == 1
    assert role_counts["Other / Unassigned"] == 2
    assert role_counts["target_roles_total"] == 6


# ==============================================================================
# DATE STANDARDIZATION TESTS
# ==============================================================================

def test_standardize_dates_formats_and_metrics():
    df = pd.DataFrame({
        "listingDate": [
            "2024-03-21T05:58:35Z",
            "2024-04-10T12:00:00Z",
            "2024-04-15T09:30:00Z",
            "invalid-date-string"
        ]
    })
    df_clean, metrics = standardize_dates(df, date_col="listingDate")

    assert metrics["valid_dates_count"] == 3
    assert metrics["months_count"] == 2
    assert metrics["monthly_distribution"]["2024-03"] == 1
    assert metrics["monthly_distribution"]["2024-04"] == 2
    assert df_clean.iloc[0]["listing_month"] == "2024-03"
    assert df_clean.iloc[1]["listing_month"] == "2024-04"
