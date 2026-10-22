"""
Preprocessing Pipeline for Malaysia Tech Workforce Intelligence Platform.
Handles:
1. Malaysia geographic filtering (excluding unknown/ambiguous and recording counts).
2. Deduplication with documented composite key.
3. Target role assignment via rule-based regex patterns.
4. Date parsing and temporal feature extraction.
"""

import re
import logging
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
from app.config import Config, load_config

logger = logging.getLogger(__name__)


def filter_malaysia(
    df: pd.DataFrame,
    location_col: Optional[str] = None,
    excluded_values: Optional[List[str]] = None,
    min_length: Optional[int] = None,
    config: Optional[Config] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Filters job postings to confidently identified Malaysian locations.
    Excludes unknown or ambiguous locations (e.g. 'Others', blanks, 'Unknown')
    and strictly records the exact exclusion count and breakdown.
    
    Args:
        df: Input DataFrame.
        location_col: Column containing location text. If None, uses config.
        excluded_values: Explicit list of location values to exclude. If None, uses config.
        min_length: Minimum character length for valid location.
        config: Optional Config instance.
        
    Returns:
        Tuple of (filtered_df, metrics_dict).
    """
    cfg = config or load_config()
    loc_column = location_col or cfg.location_column
    excluded = set(s.strip().lower() for s in (excluded_values or cfg.excluded_locations))
    min_len = min_length if min_length is not None else cfg.min_location_length

    initial_count = len(df)
    if initial_count == 0:
        return df.copy(), {
            "initial_rows": 0,
            "retained_malaysia_rows": 0,
            "excluded_count": 0,
            "exclusion_breakdown": {}
        }

    loc_series = df[loc_column].fillna("").astype(str).str.strip()
    
    # Identify reasons for exclusion
    is_blank = loc_series == ""
    is_too_short = loc_series.str.len() < min_len
    is_in_excluded_list = loc_series.str.lower().isin(excluded)

    is_excluded_mask = is_blank | is_too_short | is_in_excluded_list
    retained_mask = ~is_excluded_mask

    filtered_df = df[retained_mask].copy()
    retained_count = len(filtered_df)
    excluded_count = initial_count - retained_count

    # Breakdown by exact excluded value
    excluded_values_series = loc_series[is_excluded_mask]
    exclusion_breakdown = {
        str(val if val else "[EMPTY]"): int(count)
        for val, count in excluded_values_series.value_counts().items()
    }

    metrics = {
        "initial_rows": initial_count,
        "retained_malaysia_rows": retained_count,
        "excluded_count": excluded_count,
        "exclusion_breakdown": exclusion_breakdown
    }

    logger.info(
        "Malaysia filter: %d initial rows, %d retained as verified Malaysia, %d unknown/Others excluded.",
        initial_count, retained_count, excluded_count
    )

    return filtered_df, metrics


def deduplicate_postings(
    df: pd.DataFrame,
    subset: Optional[List[str]] = None,
    keep: Optional[str] = None,
    config: Optional[Config] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Deduplicates job postings based on a documented composite key.
    
    DOCUMENTED DEDUPLICATION KEY:
        (`job_title`, `company`, `location`)
        
    RATIONALE:
        Job listings frequently get refreshed or reposted across consecutive weeks
        with identical position title, employer, and work location. Retaining only
        the first observed instance prevents frequency bias in employer demand rankings.
        
    Args:
        df: Input DataFrame.
        subset: Columns to use as deduplication key.
        keep: 'first', 'last', or False.
        config: Optional Config instance.
        
    Returns:
        Tuple of (deduplicated_df, metrics_dict).
    """
    cfg = config or load_config()
    dedup_key = subset or cfg.deduplication_key
    keep_strategy = keep or cfg.deduplication_keep

    initial_count = len(df)
    if initial_count == 0:
        return df.copy(), {
            "initial_rows": 0,
            "retained_rows": 0,
            "duplicates_removed": 0,
            "dedup_key": dedup_key,
            "dedup_rationale": "Deduplicate on job_title, company, and location to eliminate re-advertisements."
        }

    # Verify key columns exist
    missing_keys = [k for k in dedup_key if k not in df.columns]
    if missing_keys:
        raise KeyError(f"Deduplication key columns missing from DataFrame: {missing_keys}")

    deduped_df = df.drop_duplicates(subset=dedup_key, keep=keep_strategy).copy()
    retained_count = len(deduped_df)
    duplicates_removed = initial_count - retained_count

    metrics = {
        "initial_rows": initial_count,
        "retained_rows": retained_count,
        "duplicates_removed": duplicates_removed,
        "dedup_key": dedup_key,
        "dedup_rationale": "Deduplicate on job_title, company, and location to eliminate re-advertisements."
    }

    logger.info(
        "Deduplication (key=%s): %d initial rows, %d retained, %d duplicate postings removed.",
        dedup_key, initial_count, retained_count, duplicates_removed
    )

    return deduped_df, metrics


def assign_roles(
    df: pd.DataFrame,
    role_rules: Optional[Dict[str, Dict[str, Any]]] = None,
    title_col: Optional[str] = None,
    config: Optional[Config] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Assigns canonical tech roles to job postings based on documented title matching rules.
    
    Target Roles:
        1. Software Engineer / Developer
        2. Data Engineer
        3. Data Scientist
        4. Machine Learning / AI Engineer
        5. Cloud Engineer
        
    Postings not matching any target pattern receive 'Other / Unassigned'.
    
    Args:
        df: Input DataFrame.
        role_rules: Dictionary mapping role name to pattern & priority.
        title_col: Column containing job titles.
        config: Optional Config instance.
        
    Returns:
        Tuple of (df_with_roles, role_counts_dict).
    """
    cfg = config or load_config()
    rules = role_rules or cfg.role_title_rules
    t_col = title_col or cfg.title_column

    df_out = df.copy()
    if len(df_out) == 0:
        return df_out, {role: 0 for role in rules}

    # Compile regexes sorted by priority
    sorted_roles = sorted(
        rules.items(),
        key=lambda item: item[1].get("priority", 999)
    )
    compiled_patterns = [
        (role_name, re.compile(rule_info["pattern"]))
        for role_name, rule_info in sorted_roles
    ]

    titles = df_out[t_col].fillna("").astype(str)

    # Vectorized / series matching
    assigned_roles = pd.Series("Other / Unassigned", index=df_out.index)

    for role_name, pattern in compiled_patterns:
        # Match only currently unassigned to respect priority
        unassigned_mask = assigned_roles == "Other / Unassigned"
        match_mask = unassigned_mask & titles.map(lambda t: bool(pattern.search(t)))
        assigned_roles[match_mask] = role_name

    df_out["assigned_role"] = assigned_roles

    # Calculate distribution
    role_counts = {role_name: int((assigned_roles == role_name).sum()) for role_name, _ in sorted_roles}
    role_counts["Other / Unassigned"] = int((assigned_roles == "Other / Unassigned").sum())
    role_counts["target_roles_total"] = sum(
        role_counts[role_name] for role_name, _ in sorted_roles
    )

    logger.info("Role assignment breakdown: %s", role_counts)

    return df_out, role_counts


def standardize_dates(
    df: pd.DataFrame,
    date_col: str = "listingDate"
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Parses listing dates into standard datetime and Year-Month strings.
    
    Args:
        df: Input DataFrame.
        date_col: Column containing raw date strings.
        
    Returns:
        Tuple of (df_with_clean_dates, date_metrics_dict).
    """
    df_out = df.copy()
    if len(df_out) == 0 or date_col not in df_out.columns:
        return df_out, {
            "valid_dates_count": 0,
            "min_date": None,
            "max_date": None,
            "months_count": 0,
            "monthly_distribution": {}
        }

    parsed_dates = pd.to_datetime(df_out[date_col], errors="coerce", utc=True)
    valid_dates = parsed_dates.dropna()

    df_out["listing_date_clean"] = parsed_dates.dt.strftime("%Y-%m-%d %H:%M:%S")
    # Convert to tz-naive before period conversion to eliminate warning
    tz_naive_dates = parsed_dates.dt.tz_localize(None)
    df_out["listing_month"] = tz_naive_dates.dt.to_period("M").astype(str)

    monthly_dist = {}
    if len(valid_dates) > 0:
        valid_tz_naive = valid_dates.dt.tz_localize(None)
        monthly_dist = {
            str(k): int(v)
            for k, v in valid_tz_naive.dt.to_period("M").value_counts().sort_index().items()
        }

    date_metrics = {
        "valid_dates_count": len(valid_dates),
        "min_date": str(valid_dates.min()) if len(valid_dates) > 0 else None,
        "max_date": str(valid_dates.max()) if len(valid_dates) > 0 else None,
        "months_count": len(monthly_dist),
        "monthly_distribution": monthly_dist
    }

    return df_out, date_metrics
