"""
Data Pipeline CLI Runner for Malaysia Tech Workforce Intelligence Platform.
Executes end-to-end data processing:
1. Ingestion of raw JobStreet data
2. Schema validation and malformed row filtering
3. Malaysia location filtering (excluding unknown and recording counts)
4. Deduplication using documented key
5. Target role assignment
6. Date standardization and temporal coverage analysis
7. Dictionary-based skill extraction with original matched text evidence
8. Output versioning and generation of processing_metadata.json
"""

import os
import sys
import json
import logging
import argparse
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import pandas as pd

from app.config import Config, load_config
from app.data_loader import load_jobstreet_data
from app.data_validation import validate_and_clean_rows
from app.preprocessing import (
    filter_malaysia,
    deduplicate_postings,
    assign_roles,
    standardize_dates
)
from app.skill_normalizer import SkillNormalizer
from app.skill_extractor import SkillExtractor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("app.pipeline")


def run_pipeline(
    config_path: Optional[str] = None,
    output_dir: Optional[str] = None,
    version: Optional[str] = None,
    sample_n: Optional[int] = None
) -> Dict[str, Any]:
    """
    Executes the complete data pipeline and returns processing metadata.
    
    Args:
        config_path: Optional path to config.yaml.
        output_dir: Optional output directory override.
        version: Optional version override.
        sample_n: Optional row limit for fast sampling.
        
    Returns:
        Dict containing comprehensive processing metadata.
    """
    start_time = datetime.now(timezone.utc)
    config = load_config(config_path=config_path, reload=True)
    pipeline_version = version or config.version
    config_hash = config.get_config_hash()

    logger.info("Starting Data Pipeline [Version: %s, Config Hash: %s]", pipeline_version, config_hash[:12])

    # --------------------------------------------------------------------------
    # STAGE 1: Data Ingestion
    # --------------------------------------------------------------------------
    logger.info("--- Stage 1: Data Ingestion ---")
    df_raw = load_jobstreet_data(config=config)
    raw_count = len(df_raw)

    if sample_n and sample_n > 0:
        logger.info("Sampling %d rows for testing execution.", sample_n)
        df_raw = df_raw.head(sample_n).copy()
        raw_count = len(df_raw)

    # --------------------------------------------------------------------------
    # STAGE 2: Schema Validation & Malformed Row Cleaning
    # --------------------------------------------------------------------------
    logger.info("--- Stage 2: Schema Validation & Quality Checks ---")
    df_validated, validation_metrics = validate_and_clean_rows(df_raw, config=config)
    validated_count = len(df_validated)
    malformed_dropped = validation_metrics["malformed_rows_dropped"]

    # --------------------------------------------------------------------------
    # STAGE 3: Malaysia Geographic Filtering
    # --------------------------------------------------------------------------
    logger.info("--- Stage 3: Malaysia Geographic Filtering ---")
    df_my, my_filter_metrics = filter_malaysia(df_validated, config=config)
    my_filtered_count = len(df_my)
    unknown_excluded_count = my_filter_metrics["excluded_count"]

    # --------------------------------------------------------------------------
    # STAGE 4: Deduplication with Documented Key
    # --------------------------------------------------------------------------
    logger.info("--- Stage 4: Deduplication ---")
    df_deduped, dedup_metrics = deduplicate_postings(df_my, config=config)
    deduped_count = len(df_deduped)
    duplicates_removed_count = dedup_metrics["duplicates_removed"]

    # --------------------------------------------------------------------------
    # STAGE 5: Target Role Assignment
    # --------------------------------------------------------------------------
    logger.info("--- Stage 5: Target Role Assignment ---")
    df_roles, role_counts = assign_roles(df_deduped, config=config)

    # Check sample adequacy against config threshold
    min_postings_threshold = config.min_postings_per_role
    role_sample_adequacy = {}
    for role_name in config.role_title_rules:
        count = role_counts.get(role_name, 0)
        role_sample_adequacy[role_name] = {
            "postings_count": count,
            "min_required": min_postings_threshold,
            "meets_threshold": count >= min_postings_threshold,
            "sample_warning": count < min_postings_threshold
        }

    # --------------------------------------------------------------------------
    # STAGE 6: Date Standardization & Temporal Analysis
    # --------------------------------------------------------------------------
    logger.info("--- Stage 6: Date Standardization ---")
    df_clean, date_metrics = standardize_dates(df_roles, date_col="listingDate")
    min_months_for_trends = config.min_months_for_trends
    has_sufficient_trend_data = date_metrics["months_count"] >= min_months_for_trends

    # --------------------------------------------------------------------------
    # STAGE 7: Skill Normalization & Extraction with Evidence
    # --------------------------------------------------------------------------
    logger.info("--- Stage 7: Skill Extraction & Evidence Retention ---")
    normalizer = SkillNormalizer(config=config)
    extractor = SkillExtractor(normalizer=normalizer, config=config)

    canonical_skills_list, evidence_maps_list = extractor.extract_batch(df_clean["descriptions"])

    # Store structured extracted columns
    # We store json-serialized strings for parquet/csv compatibility
    df_clean["extracted_skills"] = [json.dumps(s) for s in canonical_skills_list]
    df_clean["skill_evidence"] = [json.dumps(e) for e in evidence_maps_list]
    df_clean["skill_count"] = [len(s) for s in canonical_skills_list]

    # Calculate overall skill frequencies
    all_extracted_skills = [skill for sublist in canonical_skills_list for skill in sublist]
    total_skill_mentions = len(all_extracted_skills)
    skill_series = pd.Series(all_extracted_skills)
    top_skills_overall = {
        str(k): int(v) for k, v in skill_series.value_counts().head(25).items()
    } if not skill_series.empty else {}

    # Calculate top skills for target roles
    target_role_skills: Dict[str, Dict[str, int]] = {}
    for role_name in config.role_title_rules:
        role_mask = df_clean["assigned_role"] == role_name
        role_skills_nested = [canonical_skills_list[i] for i, m in enumerate(role_mask) if m]
        flat_role_skills = [s for sub in role_skills_nested for s in sub]
        if flat_role_skills:
            target_role_skills[role_name] = {
                str(k): int(v) for k, v in pd.Series(flat_role_skills).value_counts().head(10).items()
            }
        else:
            target_role_skills[role_name] = {}

    # --------------------------------------------------------------------------
    # STAGE 8: Versioned Output Persistence
    # --------------------------------------------------------------------------
    logger.info("--- Stage 8: Saving Versioned Processed Outputs ---")
    version_dir = os.path.join(output_dir or config.processed_dir, f"v{pipeline_version}")
    os.makedirs(version_dir, exist_ok=True)

    parquet_filename = "processed_jobs.parquet"
    csv_filename = "processed_jobs.csv"
    metadata_filename = "processing_metadata.json"

    parquet_path = os.path.join(version_dir, parquet_filename)
    csv_path = os.path.join(version_dir, csv_filename)
    versioned_metadata_path = os.path.join(version_dir, metadata_filename)

    logger.info("Writing Parquet dataset to: %s", parquet_path)
    df_clean.to_parquet(parquet_path, index=False)

    logger.info("Writing CSV dataset to: %s", csv_path)
    df_clean.to_csv(csv_path, index=False)

    # --------------------------------------------------------------------------
    # STAGE 9: Processing Metadata Construction
    # --------------------------------------------------------------------------
    logger.info("--- Stage 9: Writing Processing Metadata ---")
    end_time = datetime.now(timezone.utc)
    duration_seconds = (end_time - start_time).total_seconds()

    stage_row_counts = {
        "raw_loaded": raw_count,
        "schema_validated": validated_count,
        "malformed_dropped": malformed_dropped,
        "malaysia_filtered": my_filtered_count,
        "unknown_location_excluded": unknown_excluded_count,
        "deduplicated": deduped_count,
        "duplicates_removed": duplicates_removed_count,
        "final_processed_rows": len(df_clean)
    }

    metadata = {
        "pipeline_version": pipeline_version,
        "timestamp_utc": end_time.isoformat(),
        "execution_duration_seconds": round(duration_seconds, 2),
        "config_hash_sha256": config_hash,
        "dataset_licenses": config.dataset_licenses,
        "deduplication_policy": {
            "key": config.deduplication_key,
            "keep": config.deduplication_keep,
            "rationale": "Deduplicate on job_title, company, and location to eliminate re-advertisements."
        },
        "malaysia_filtering_policy": {
            "location_column": config.location_column,
            "excluded_values": config.excluded_locations,
            "unknown_location_excluded_count": unknown_excluded_count,
            "exclusion_breakdown": my_filter_metrics["exclusion_breakdown"]
        },
        "stage_row_counts": stage_row_counts,
        "role_counts": role_counts,
        "role_sample_adequacy": role_sample_adequacy,
        "date_coverage": {
            "valid_dates_count": date_metrics["valid_dates_count"],
            "min_date": date_metrics["min_date"],
            "max_date": date_metrics["max_date"],
            "months_count": date_metrics["months_count"],
            "min_months_for_trends_threshold": min_months_for_trends,
            "has_sufficient_trend_data": has_sufficient_trend_data,
            "monthly_distribution": date_metrics["monthly_distribution"]
        },
        "skill_extraction_summary": {
            "vocabulary_canonical_count": normalizer.total_canonical_skills,
            "vocabulary_total_aliases": normalizer.total_aliases,
            "total_skill_mentions_extracted": total_skill_mentions,
            "postings_with_at_least_one_skill": int((df_clean["skill_count"] > 0).sum()),
            "top_skills_overall": top_skills_overall,
            "target_role_top_skills": target_role_skills
        },
        "output_artifacts": {
            "parquet_path": os.path.abspath(parquet_path),
            "csv_path": os.path.abspath(csv_path),
            "versioned_metadata_path": os.path.abspath(versioned_metadata_path),
            "latest_metadata_path": os.path.abspath(config.latest_metadata_path)
        }
    }

    # Save versioned metadata
    with open(versioned_metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    # Save latest copy in root of processed directory
    os.makedirs(os.path.dirname(config.latest_metadata_path), exist_ok=True)
    with open(config.latest_metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    logger.info("Processing metadata written successfully to: %s", versioned_metadata_path)
    logger.info("Latest metadata updated at: %s", config.latest_metadata_path)

    # --------------------------------------------------------------------------
    # STAGE 10: Real Row Counts Report to stdout
    # --------------------------------------------------------------------------
    print("\n" + "=" * 70)
    print(" MALAYSIA TECH WORKFORCE INTELLIGENCE PLATFORM - PIPELINE REPORT")
    print("=" * 70)
    print(f"Pipeline Version : v{pipeline_version}")
    print(f"Timestamp (UTC)  : {end_time.isoformat()}")
    print(f"Config Hash      : {config_hash[:16]}...")
    print(f"Execution Time   : {duration_seconds:.2f} seconds")
    print("-" * 70)
    print("STAGE ROW COUNTS:")
    print(f"  1. Raw JobStreet Postings Loaded : {stage_row_counts['raw_loaded']:,}")
    print(f"  2. Validated Schema Rows         : {stage_row_counts['schema_validated']:,} (Dropped malformed: {stage_row_counts['malformed_dropped']:,})")
    print(f"  3. Malaysia Postings Retained    : {stage_row_counts['malaysia_filtered']:,} (Excluded unknown/Others: {stage_row_counts['unknown_location_excluded']:,})")
    print(f"  4. Deduplicated Final Postings   : {stage_row_counts['deduplicated']:,} (Removed duplicates: {stage_row_counts['duplicates_removed']:,})")
    print("-" * 70)
    print("TARGET ROLE DISTRIBUTION:")
    for role_name, rule_info in config.role_title_rules.items():
        count = role_counts.get(role_name, 0)
        adequacy = role_sample_adequacy[role_name]
        status = "[Adequate]" if adequacy["meets_threshold"] else f"[Small Sample: N < {min_postings_threshold}]"
        print(f"  * {role_name:<32} : {count:>5,} postings  {status}")
    print(f"  * Other / Unassigned Tech Roles  : {role_counts.get('Other / Unassigned', 0):>5,} postings")
    print(f"  * Total Target Roles             : {role_counts.get('target_roles_total', 0):>5,} postings")
    print("-" * 70)
    print("TEMPORAL COVERAGE:")
    print(f"  * Date Span : {date_metrics['min_date']} to {date_metrics['max_date']}")
    print(f"  * Months Covered : {date_metrics['months_count']} months")
    print(f"  * Meets Minimum Months Threshold : {has_sufficient_trend_data}")
    print("-" * 70)
    print("SKILL EXTRACTION SUMMARY:")
    print(f"  * Canonical Skills in Taxonomy   : {normalizer.total_canonical_skills}")
    print(f"  * Surface Aliases Compiled       : {normalizer.total_aliases}")
    print(f"  * Total Skill Mentions Extracted : {total_skill_mentions:,}")
    print(f"  * Postings with Extracted Skills : {metadata['skill_extraction_summary']['postings_with_at_least_one_skill']:,}")
    print("=" * 70 + "\n")

    return metadata


def main():
    parser = argparse.ArgumentParser(
        description="Run Malaysia Tech Workforce Intelligence Data Pipeline"
    )
    parser.add_argument(
        "--config",
        type=str,
        default=None,
        help="Path to config.yaml (defaults to config.yaml in workspace root)"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Directory where processed datasets and metadata will be saved"
    )
    parser.add_argument(
        "--version",
        type=str,
        default=None,
        help="Pipeline release version string (defaults to version in config.yaml)"
    )
    parser.add_argument(
        "--sample",
        type=int,
        default=None,
        help="Optional row limit to process a small sample for rapid testing"
    )

    args = parser.parse_args()

    try:
        run_pipeline(
            config_path=args.config,
            output_dir=args.output_dir,
            version=args.version,
            sample_n=args.sample
        )
    except Exception as exc:
        logger.exception("Pipeline failed with error: %s", exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
