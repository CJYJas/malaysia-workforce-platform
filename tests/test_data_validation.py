"""
Unit tests for data validation and schema checking.
Covers:
- Schema conformance and missing required columns
- Null and whitespace-only value filtering
- Empty input DataFrame handling
- Malformed row accounting
"""

import pytest
import pandas as pd
from app.data_validation import validate_schema, validate_and_clean_rows, SchemaValidationError
from app.config import Config


@pytest.fixture
def sample_config():
    raw_config = {
        "pipeline": {"version": "1.0.0", "min_postings_per_role": 5},
        "paths": {"processed_dir": "data/processed"},
        "schema": {
            "required_columns": ["job_title", "company", "descriptions", "location", "listingDate"]
        },
        "malaysia_filter": {
            "location_column": "location",
            "excluded_values": ["Others", "unknown", "nan", ""],
            "min_location_length": 2
        },
        "deduplication": {
            "key": ["job_title", "company", "location"],
            "keep": "first"
        },
        "roles": {
            "title_column": "job_title",
            "rules": {}
        }
    }
    return Config(raw_config, config_path="config.yaml")


def test_validate_schema_success(sample_config):
    df = pd.DataFrame({
        "job_title": ["Software Engineer"],
        "company": ["Acme Corp"],
        "descriptions": ["Coding in Python"],
        "location": ["Kuala Lumpur"],
        "listingDate": ["2024-03-01T00:00:00Z"]
    })
    report = validate_schema(df, config=sample_config)
    assert report["is_valid"] is True
    assert len(report["missing_columns"]) == 0


def test_validate_schema_missing_column(sample_config):
    df = pd.DataFrame({
        "job_title": ["Software Engineer"],
        "company": ["Acme Corp"],
        # Missing 'descriptions', 'location', 'listingDate'
    })
    with pytest.raises(SchemaValidationError) as exc_info:
        validate_schema(df, config=sample_config)
    assert "Missing required columns" in str(exc_info.value)
    assert "descriptions" in str(exc_info.value)


def test_validate_empty_dataframe(sample_config):
    df_empty = pd.DataFrame(columns=["job_title", "company", "descriptions", "location", "listingDate"])
    cleaned_df, metrics = validate_and_clean_rows(df_empty, config=sample_config)
    assert len(cleaned_df) == 0
    assert metrics["initial_rows"] == 0
    assert metrics["valid_rows"] == 0
    assert metrics["malformed_rows_dropped"] == 0


def test_validate_malformed_and_null_rows(sample_config):
    df = pd.DataFrame({
        "job_title": ["Engineer", None, "Data Analyst", "Dev", "Designer"],
        "company": ["Co A", "Co B", "Co C", "  ", "Co E"],
        "descriptions": ["Valid desc", "Valid desc", "", "Valid desc", "Valid desc"],
        "location": ["Kuala Lumpur", "Penang", "Johor", "Selangor", None],
        "listingDate": ["2024-01-01", "2024-01-01", "2024-01-01", "2024-01-01", "2024-01-01"]
    })
    # Row 0: Valid
    # Row 1: Null job_title -> Invalid
    # Row 2: Empty string descriptions -> Invalid
    # Row 3: Blank whitespace company -> Invalid
    # Row 4: Null location -> Invalid

    cleaned_df, metrics = validate_and_clean_rows(df, config=sample_config)
    assert len(cleaned_df) == 1
    assert cleaned_df.iloc[0]["job_title"] == "Engineer"
    assert metrics["initial_rows"] == 5
    assert metrics["valid_rows"] == 1
    assert metrics["malformed_rows_dropped"] == 4
    assert metrics["null_breakdown_by_column"]["job_title"] == 1
    assert metrics["null_breakdown_by_column"]["company"] == 1
    assert metrics["null_breakdown_by_column"]["descriptions"] == 1
    assert metrics["null_breakdown_by_column"]["location"] == 1
