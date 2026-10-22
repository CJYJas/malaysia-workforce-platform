"""
Market Demand and Trend Analyzer for Malaysia Tech Workforce Intelligence Platform.
Computes empirical skill posting share, temporal trend analysis, and role comparisons.
Strictly adheres to:
- Skill Posting Share = eligible postings mentioning skill / eligible postings for role & period.
- Disclosure of denominators, time windows, and deduplication policy.
- Zero usage of prohibited subjective terms ('emerging', 'fast-growing', 'latest', 'currently in demand').
- Structured insufficient-evidence and insufficient-date responses.
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any, Tuple
import pandas as pd
from app.config import Config, load_config
from app.skill_normalizer import SkillNormalizer
from app.role_normalizer import RoleNormalizer

logger = logging.getLogger(__name__)


class RoleNotFoundError(ValueError):
    """Raised when an unrecognized role name is queried."""
    def __init__(self, role: str, supported_roles: List[str]):
        super().__init__(f"Role '{role}' is not a supported target role.")
        self.role = role
        self.supported_roles = supported_roles


class DataNotLoadedError(RuntimeError):
    """Raised when analysis is requested but processed dataset is not loaded."""
    pass


class TrendAnalyzer:
    """
    Analyzes skill demand, historical trends, and cross-role comparisons
    using processed Malaysian tech job posting data.
    """

    def __init__(
        self,
        df: Optional[pd.DataFrame] = None,
        config: Optional[Config] = None,
        normalizer: Optional[SkillNormalizer] = None,
        role_normalizer: Optional[RoleNormalizer] = None
    ):
        self.config = config or load_config()
        self.normalizer = normalizer or SkillNormalizer(config=self.config)
        self.role_normalizer = role_normalizer or RoleNormalizer(config=self.config)
        self.df: Optional[pd.DataFrame] = None
        self.is_data_loaded: bool = False

        if df is not None:
            self._set_data(df)
        else:
            self._try_load_default_data()

    def _set_data(self, df: pd.DataFrame) -> None:
        """Sets and parses the in-memory processed postings DataFrame."""
        self.df = df.copy()
        self.is_data_loaded = True
        logger.info("TrendAnalyzer initialized with %d processed postings.", len(self.df))

    def _try_load_default_data(self) -> None:
        """Attempts to load processed Parquet dataset if present on disk."""
        parquet_path = self.config.processed_output_parquet
        if os.path.exists(parquet_path):
            try:
                df = pd.read_parquet(parquet_path)
                self._set_data(df)
            except Exception as e:
                logger.warning("Could not read processed parquet at %s: %s", parquet_path, e)
                self.df = None
                self.is_data_loaded = False
        else:
            logger.info("No processed dataset found at %s. Server starting with data_loaded=false.", parquet_path)
            self.df = None
            self.is_data_loaded = False

    def get_supported_roles(self) -> List[str]:
        """Returns the list of officially supported target role names."""
        return list(self.config.role_title_rules.keys())

    def validate_role(self, role: str) -> str:
        """
        Validates and matches a role string flexibly (supporting abbreviations,
        aliases, prefix matches, and case-insensitivity, e.g. 'data en' -> 'Data Engineer').
        Returns the exact canonical role title.
        """
        supported = self.get_supported_roles()
        if not role or not isinstance(role, str):
            raise RoleNotFoundError(str(role), supported)

        canonical = self.role_normalizer.normalize_role(role)
        if canonical and canonical in supported:
            return canonical

        raise RoleNotFoundError(role, supported)

    def get_roles_summary(self) -> List[Dict[str, Any]]:
        """Returns metadata and eligible posting counts for all supported roles."""
        supported_rules = self.config.role_title_rules
        summary_list = []

        for role_name, rule_info in supported_rules.items():
            count = 0
            if self.is_data_loaded and self.df is not None:
                count = int((self.df["assigned_role"] == role_name).sum())

            min_req = self.config.min_postings_per_role
            warn_threshold = self.config.sample_size_warning_threshold

            if count < min_req:
                adequacy = "Insufficient Evidence"
                sample_warn = True
            elif count < warn_threshold:
                adequacy = "Moderate (Small Sample)"
                sample_warn = True
            else:
                adequacy = "Adequate"
                sample_warn = False

            summary_list.append({
                "role": role_name,
                "description": rule_info.get("description", ""),
                "priority": rule_info.get("priority", 999),
                "eligible_postings_count": count,
                "sample_adequacy_status": adequacy,
                "sample_size_warning": sample_warn
            })

        summary_list.sort(key=lambda r: r["priority"])
        return summary_list

    def _parse_skills_cell(self, cell_val: Any) -> List[str]:
        """Safely parses skills cell value into a list of strings."""
        if isinstance(cell_val, list):
            return cell_val
        if isinstance(cell_val, str):
            try:
                parsed = json.loads(cell_val)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                pass
        return []

    def calculate_skill_demand(
        self,
        role: str,
        top_n: Optional[int] = None,
        time_window: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculates employer skill demand metrics for a target role.
        Formula:
            Skill Posting Share = eligible postings mentioning skill / eligible postings for role and period.
            
        Discloses denominator, deduplication policy, and sample-size warnings.
        """
        if not self.is_data_loaded or self.df is None:
            raise DataNotLoadedError("Job posting dataset is not loaded. Please process data first.")

        canonical_role = self.validate_role(role)
        limit = top_n or self.config.default_top_n_skills
        dedup_policy_str = ", ".join(self.config.deduplication_key)

        # Filter by role
        role_df = self.df[self.df["assigned_role"] == canonical_role].copy()

        # Apply optional time window filter
        window_label = "2023-03 to 2025-05 (All Available)"
        if time_window == "representative_2024":
            start_m = self.config.representative_start_month
            end_m = self.config.representative_end_month
            if "listing_month" in role_df.columns:
                role_df = role_df[role_df["listing_month"].between(start_m, end_m)]
                window_label = f"{start_m} to {end_m} (Representative Peak)"

        # Denominator: Total eligible deduplicated postings for role & period
        denominator = len(role_df)
        min_required = self.config.min_postings_per_role
        warn_threshold = self.config.sample_size_warning_threshold

        # Rule: Role below minimum sample -> structured insufficient-evidence response
        if denominator < min_required:
            return {
                "status": "insufficient_evidence",
                "role": canonical_role,
                "postings_count": denominator,
                "min_postings_required": min_required,
                "message": (
                    f"Insufficient postings in Malaysian job market data for '{canonical_role}' "
                    f"(N = {denominator} < {min_required} required). Findings cannot be statistically supported."
                ),
                "deduplication_policy": dedup_policy_str,
                "skills": []
            }

        # Check sample size warning
        sample_size_warning = denominator < warn_threshold
        warning_msg = (
            f"Small sample size (N = {denominator} < {warn_threshold}). Findings should be interpreted with caution."
            if sample_size_warning else None
        )

        # Count postings mentioning each skill
        skill_mention_counts: Dict[str, int] = {}
        for cell in role_df["extracted_skills"]:
            skills_in_posting = set(self._parse_skills_cell(cell))
            for skill in skills_in_posting:
                skill_mention_counts[skill] = skill_mention_counts.get(skill, 0) + 1

        # Sort descending by count, then alphabetically
        sorted_skills = sorted(
            skill_mention_counts.items(),
            key=lambda x: (-x[1], x[0])
        )[:limit]

        skill_items = []
        for rank, (skill_name, count) in enumerate(sorted_skills, start=1):
            share = round(count / denominator, 4)
            pct = round((count / denominator) * 100, 2)
            category = self.normalizer.get_category(skill_name) or "Technical Skill"

            skill_items.append({
                "rank": rank,
                "skill": skill_name,
                "category": category,
                "mention_count": count,
                "posting_share": share,
                "posting_share_percentage": pct
            })

        return {
            "status": "success",
            "role": canonical_role,
            "time_window": window_label,
            "denominator": denominator,
            "deduplication_policy": dedup_policy_str,
            "sample_size_warning": sample_size_warning,
            "warning_message": warning_msg,
            "skills_count": len(skill_items),
            "skills": skill_items
        }

    def calculate_skill_trends(
        self,
        role: str,
        skill_filter: Optional[str] = None,
        window: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculates monthly historical demand trends for a role when dates meet config thresholds.
        Otherwise returns structured 'insufficient_date_data' status with frequency-based demand.
        
        STRICT CONSTRAINT:
            Never uses 'emerging', 'fast-growing', 'latest', or 'currently in demand'.
        """
        if not self.is_data_loaded or self.df is None:
            raise DataNotLoadedError("Job posting dataset is not loaded. Please process data first.")

        canonical_role = self.validate_role(role)
        dedup_policy_str = ", ".join(self.config.deduplication_key)
        min_months_threshold = self.config.min_months_for_trends

        role_df = self.df[self.df["assigned_role"] == canonical_role].copy()
        denominator = len(role_df)

        # Check date column existence and validity
        has_dates = "listing_month" in role_df.columns
        valid_months_series = (
            role_df["listing_month"].dropna().loc[lambda s: s.str.match(r"^\d{4}-\d{2}$")]
            if has_dates else pd.Series([], dtype=str)
        )
        distinct_months = sorted(valid_months_series.unique().tolist())
        months_count = len(distinct_months)

        # Sample size warning check
        sample_size_warning = denominator < self.config.sample_size_warning_threshold
        warning_msg = (
            f"Small sample size (N = {denominator})."
            if sample_size_warning else None
        )

        # Check threshold for trends
        if months_count < min_months_threshold:
            # Insufficient date data response with frequency-based fallback
            static_demand = self.calculate_skill_demand(role=canonical_role, top_n=10)
            return {
                "status": "insufficient_date_data",
                "role": canonical_role,
                "demand_label": "frequency-based",
                "reason": (
                    f"Fewer than {min_months_threshold} reliable monthly observation periods "
                    f"found for role '{canonical_role}' (found: {months_count} months). "
                    "Historical longitudinal trend cannot be reliably constructed."
                ),
                "denominator": denominator,
                "deduplication_policy": dedup_policy_str,
                "sample_size_warning": sample_size_warning,
                "warning_message": warning_msg,
                "frequency_based_demand": static_demand.get("skills", [])
            }

        # Filter by window if requested
        if window == "representative_2024":
            start_m = self.config.representative_start_month
            end_m = self.config.representative_end_month
            role_df = role_df[role_df["listing_month"].between(start_m, end_m)]
            distinct_months = [m for m in distinct_months if start_m <= m <= end_m]

        # Determine target skills to analyze
        if skill_filter:
            norm_skill = self.normalizer.normalize(skill_filter) or skill_filter.strip()
            skills_to_track = [norm_skill]
        else:
            # Top 5 skills for this role overall
            static_demand = self.calculate_skill_demand(role=canonical_role, top_n=5)
            skills_to_track = [item["skill"] for item in static_demand.get("skills", [])]

        monthly_trends = []
        for month_str in distinct_months:
            month_df = role_df[role_df["listing_month"] == month_str]
            month_total = len(month_df)
            if month_total == 0:
                continue

            month_skill_stats = []
            for skill_name in skills_to_track:
                mentions = 0
                for cell in month_df["extracted_skills"]:
                    if skill_name in self._parse_skills_cell(cell):
                        mentions += 1

                posting_share = round(mentions / month_total, 4)
                pct = round(posting_share * 100, 2)
                month_skill_stats.append({
                    "skill": skill_name,
                    "mentions": mentions,
                    "posting_share": posting_share,
                    "posting_share_percentage": pct
                })

            monthly_trends.append({
                "month": month_str,
                "total_role_postings": month_total,
                "sample_size_warning": month_total < 10,
                "skills": month_skill_stats
            })

        window_str = f"{distinct_months[0]} to {distinct_months[-1]}" if distinct_months else "N/A"

        return {
            "status": "success",
            "role": canonical_role,
            "time_window": window_str,
            "months_covered": len(distinct_months),
            "denominator": denominator,
            "deduplication_policy": dedup_policy_str,
            "sample_size_warning": sample_size_warning,
            "warning_message": warning_msg,
            "monthly_trends": monthly_trends
        }

    def compare_roles(
        self,
        role1: str,
        role2: str,
        top_n: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Compares skill requirements between two roles side-by-side.
        Discloses distinct denominators, deduplication policy, and flags
        sample size disparities transparently.
        """
        canonical1 = self.validate_role(role1)
        canonical2 = self.validate_role(role2)
        limit = top_n or 15

        res1 = self.calculate_skill_demand(role=canonical1, top_n=50)
        res2 = self.calculate_skill_demand(role=canonical2, top_n=50)

        denom1 = res1.get("denominator", 0)
        denom2 = res2.get("denominator", 0)
        dedup_policy_str = ", ".join(self.config.deduplication_key)

        # Sample size disparity warning if ratio exceeds 3.0
        disparity_warning = False
        disparity_msg = None
        if denom1 > 0 and denom2 > 0:
            ratio = max(denom1, denom2) / min(denom1, denom2)
            if ratio >= 3.0:
                disparity_warning = True
                disparity_msg = (
                    f"Substantial sample size difference between {canonical1} (N = {denom1}) "
                    f"and {canonical2} (N = {denom2}) [Ratio {ratio:.1f}x]. "
                    "Compare percentage shares rather than raw counts."
                )

        skills1_map = {item["skill"]: item for item in res1.get("skills", [])}
        skills2_map = {item["skill"]: item for item in res2.get("skills", [])}

        all_skills = set(skills1_map.keys()) | set(skills2_map.keys())
        comparison_items = []

        for skill_name in all_skills:
            item1 = skills1_map.get(skill_name)
            item2 = skills2_map.get(skill_name)

            count1 = item1["mention_count"] if item1 else 0
            share1 = item1["posting_share"] if item1 else 0.0
            pct1 = item1["posting_share_percentage"] if item1 else 0.0

            count2 = item2["mention_count"] if item2 else 0
            share2 = item2["posting_share"] if item2 else 0.0
            pct2 = item2["posting_share_percentage"] if item2 else 0.0

            diff_pct = round(pct1 - pct2, 2)
            category = self.normalizer.get_category(skill_name) or "Technical Skill"

            comparison_items.append({
                "skill": skill_name,
                "category": category,
                "role1_mentions": count1,
                "role1_posting_share": share1,
                "role1_share_percentage": pct1,
                "role2_mentions": count2,
                "role2_posting_share": share2,
                "role2_share_percentage": pct2,
                "share_difference_percentage": diff_pct
            })

        # Sort by maximum share across both roles
        comparison_items.sort(
            key=lambda x: max(x["role1_share_percentage"], x["role2_share_percentage"]),
            reverse=True
        )
        top_comparison = comparison_items[:limit]

        # Identify common and unique skills
        common = [
            item["skill"] for item in top_comparison
            if item["role1_mentions"] > 0 and item["role2_mentions"] > 0
        ]
        unique_to_r1 = [
            item["skill"] for item in top_comparison
            if item["role1_mentions"] > 0 and item["role2_mentions"] == 0
        ]
        unique_to_r2 = [
            item["skill"] for item in top_comparison
            if item["role2_mentions"] > 0 and item["role1_mentions"] == 0
        ]

        return {
            "status": "success",
            "role1": canonical1,
            "role2": canonical2,
            "denominator_role1": denom1,
            "denominator_role2": denom2,
            "deduplication_policy": dedup_policy_str,
            "sample_size_disparity_warning": disparity_warning,
            "warning_message": disparity_msg,
            "comparison": top_comparison,
            "common_skills": common,
            "unique_to_role1": unique_to_r1,
            "unique_to_role2": unique_to_r2
        }
