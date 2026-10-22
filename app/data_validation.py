"""
Data Validation and Quality Assurance for Malaysia Tech Workforce Intelligence Platform.
Performs schema conformance checks, null detection, and malformed row filtering.
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
from app.config import Config, load_config

logger = logging.getLogger(__name__)


class SchemaValidationError(ValueError):
    """Raised when an input DataFrame fails required schema conformance checks."""
    pass


def validate_schema(
    df: pd.DataFrame,
    required_columns: Optional[List[str]] = None,
    config: Optional[Config] = None
) -> Dict[str, Any]:
    """
    Validates that the DataFrame conforms to the expected schema.
    
    Args:
        df: Input DataFrame to validate.
        required_columns: Explicit list of required column names. If None, uses config.yaml.
        config: Optional Config instance.
        
    Returns:
        Dict containing validation report: status, checked columns, missing columns, total columns.
        
    Raises:
        SchemaValidationError: If any required column is absent from df.
    """
    cfg = config or load_config()
    required = required_columns if required_columns is not None else cfg.required_columns
    existing_columns = set(df.columns)
    missing_columns = [col for col in required if col not in existing_columns]

    if missing_columns:
        error_msg = f"Schema validation failed! Missing required columns: {missing_columns}"
        logger.error(error_msg)
        raise SchemaValidationError(error_msg)

    report = {
        "is_valid": True,
        "total_columns": len(df.columns),
        "required_columns_checked": required,
        "missing_columns": []
    }
    return report


def validate_and_clean_rows(
    df: pd.DataFrame,
    required_columns: Optional[List[str]] = None,
    config: Optional[Config] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Validates rows against null/empty constraints and filters out malformed rows.
    
    Args:
        df: Input DataFrame.
        required_columns: Columns that must not be null or blank.
        config: Optional Config instance.
        
    Returns:
        Tuple of (cleaned_df, metrics_dict).
    """
    cfg = config or load_config()
    required = required_columns if required_columns is not None else cfg.required_columns
    
    # First ensure schema holds
    validate_schema(df, required_columns=required, config=cfg)

    initial_row_count = len(df)
    if initial_row_count == 0:
        return df.copy(), {
            "initial_rows": 0,
            "valid_rows": 0,
            "malformed_rows_dropped": 0,
            "null_breakdown_by_column": {col: 0 for col in required}
        }

    # Track missing/blank counts per critical column
    null_breakdown: Dict[str, int] = {}
    valid_mask = pd.Series(True, index=df.index)

    for col in required:
        # Check nulls or empty strings
        is_null = df[col].isnull()
        # For object/string columns, also check whitespace-only
        if pd.api.types.is_object_dtype(df[col]) or pd.api.types.is_string_dtype(df[col]):
            is_empty_str = df[col].fillna("").astype(str).str.strip() == ""
            col_invalid = is_null | is_empty_str
        else:
            col_invalid = is_null

        invalid_count = int(col_invalid.sum())
        null_breakdown[col] = invalid_count
        valid_mask = valid_mask & (~col_invalid)

    cleaned_df = df[valid_mask].copy()
    valid_row_count = len(cleaned_df)
    dropped_count = initial_row_count - valid_row_count

    metrics = {
        "initial_rows": initial_row_count,
        "valid_rows": valid_row_count,
        "malformed_rows_dropped": dropped_count,
        "null_breakdown_by_column": null_breakdown
    }

    logger.info(
        "Data validation: %d initial rows, %d valid, %d malformed rows dropped.",
        initial_row_count, valid_row_count, dropped_count
    )

    return cleaned_df, metrics
