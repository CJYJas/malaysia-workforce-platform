"""
Configuration Manager for Malaysia Tech Workforce Intelligence Platform.
Reads config.yaml and provides structured access to all operational parameters,
ensuring zero magic numbers exist in application code.
"""

import os
import hashlib
from typing import Dict, Any, List, Optional
import yaml

DEFAULT_CONFIG_FILENAME = "config.yaml"


class Config:
    """Encapsulates configuration loaded from config.yaml."""

    def __init__(self, raw_config: Dict[str, Any], config_path: str):
        self._raw = raw_config
        self.config_path = os.path.abspath(config_path)
        self.config_dir = os.path.dirname(self.config_path)

    @property
    def version(self) -> str:
        return self._raw.get("pipeline", {}).get("version", "1.0.0")

    @property
    def min_postings_per_role(self) -> int:
        return int(self._raw.get("pipeline", {}).get("min_postings_per_role", 30))

    @property
    def min_months_for_trends(self) -> int:
        return int(self._raw.get("pipeline", {}).get("min_months_for_trends", 3))

    def resolve_path(self, relative_or_abs_path: str) -> str:
        """Resolves relative paths relative to workspace root (config directory)."""
        if os.path.isabs(relative_or_abs_path):
            return relative_or_abs_path
        return os.path.abspath(os.path.join(self.config_dir, relative_or_abs_path))

    @property
    def raw_jobstreet_path(self) -> str:
        return self.resolve_path(self._raw.get("paths", {}).get("raw_jobstreet", "data/jobstreet_all_job_dataset.csv"))

    @property
    def raw_coursera_path(self) -> str:
        return self.resolve_path(self._raw.get("paths", {}).get("raw_coursera", "data/CourseraDataset-Clean.csv"))

    @property
    def raw_skills_path(self) -> str:
        return self.resolve_path(self._raw.get("paths", {}).get("raw_skills", "data/JobsDatasetProcessed.csv"))

    @property
    def skills_taxonomy_path(self) -> str:
        return self.resolve_path(self._raw.get("paths", {}).get("skills_taxonomy", "data/skills_taxonomy.json"))

    @property
    def processed_dir(self) -> str:
        return self.resolve_path(self._raw.get("paths", {}).get("processed_dir", "data/processed"))

    @property
    def processed_output_parquet(self) -> str:
        return self.resolve_path(self._raw.get("paths", {}).get("processed_output_parquet", "data/processed/v1.0.0/processed_jobs.parquet"))

    @property
    def processed_output_csv(self) -> str:
        return self.resolve_path(self._raw.get("paths", {}).get("processed_output_csv", "data/processed/v1.0.0/processed_jobs.csv"))

    @property
    def metadata_path(self) -> str:
        return self.resolve_path(self._raw.get("paths", {}).get("metadata_path", "data/processed/v1.0.0/processing_metadata.json"))

    @property
    def latest_metadata_path(self) -> str:
        return self.resolve_path(self._raw.get("paths", {}).get("latest_metadata_path", "data/processed/processing_metadata.json"))

    @property
    def required_columns(self) -> List[str]:
        return list(self._raw.get("schema", {}).get("required_columns", []))

    @property
    def expected_types(self) -> Dict[str, str]:
        return dict(self._raw.get("schema", {}).get("expected_types", {}))

    @property
    def location_column(self) -> str:
        return str(self._raw.get("malaysia_filter", {}).get("location_column", "location"))

    @property
    def excluded_locations(self) -> List[str]:
        return list(self._raw.get("malaysia_filter", {}).get("excluded_values", ["Others"]))

    @property
    def min_location_length(self) -> int:
        return int(self._raw.get("malaysia_filter", {}).get("min_location_length", 2))

    @property
    def deduplication_key(self) -> List[str]:
        return list(self._raw.get("deduplication", {}).get("key", ["job_title", "company", "location"]))

    @property
    def deduplication_keep(self) -> str:
        return str(self._raw.get("deduplication", {}).get("keep", "first"))

    @property
    def title_column(self) -> str:
        return str(self._raw.get("roles", {}).get("title_column", "job_title"))

    @property
    def role_title_rules(self) -> Dict[str, Dict[str, Any]]:
        return dict(self._raw.get("roles", {}).get("rules", {}))

    @property
    def role_aliases(self) -> Dict[str, str]:
        return dict(self._raw.get("roles", {}).get("aliases", {}))

    @property
    def dataset_licenses(self) -> Dict[str, str]:
        return dict(self._raw.get("dataset_licenses", {}))

    @property
    def sample_size_warning_threshold(self) -> int:
        return int(self._raw.get("trend_analysis", {}).get(
            "sample_size_warning_threshold",
            self._raw.get("pipeline", {}).get("sample_size_warning_threshold", 50)
        ))

    @property
    def default_top_n_skills(self) -> int:
        return int(self._raw.get("trend_analysis", {}).get("default_top_n_skills", 20))

    @property
    def representative_start_month(self) -> str:
        return str(self._raw.get("trend_analysis", {}).get("representative_start_month", "2024-02"))

    @property
    def representative_end_month(self) -> str:
        return str(self._raw.get("trend_analysis", {}).get("representative_end_month", "2024-06"))

    @property
    def trend_analysis(self) -> Dict[str, Any]:
        return dict(self._raw.get("trend_analysis", {}))

    @property
    def server_host(self) -> str:
        return str(self._raw.get("server", {}).get("host", "0.0.0.0"))

    @property
    def server_port(self) -> int:
        return int(self._raw.get("server", {}).get("port", 8000))

    @property
    def cors_origins_default(self) -> List[str]:
        return list(self._raw.get("server", {}).get("cors_origins_default", ["*"]))

    @property
    def matching_config(self) -> Dict[str, Any]:
        return dict(self._raw.get("matching", {}))

    @property
    def weight_skill_coverage(self) -> float:
        return float(self._raw.get("matching", {}).get("weight_skill_coverage", 0.70))

    @property
    def weight_tfidf_similarity(self) -> float:
        return float(self._raw.get("matching", {}).get("weight_tfidf_similarity", 0.30))

    @property
    def min_core_skill_share(self) -> float:
        return float(self._raw.get("matching", {}).get("min_core_skill_share", 0.25))

    @property
    def min_recommended_skill_share(self) -> float:
        return float(self._raw.get("matching", {}).get("min_recommended_skill_share", 0.10))

    @property
    def match_disclaimer(self) -> str:
        return str(self._raw.get("matching", {}).get(
            "disclaimer",
            "This match score reflects empirical alignment with analyzed Malaysian job postings and does not constitute a hiring guarantee or probability of employment."
        ))

    @property
    def course_recommendations_config(self) -> Dict[str, Any]:
        return dict(self._raw.get("course_recommendations", {}))

    @property
    def default_top_k_per_gap(self) -> int:
        return int(self._raw.get("course_recommendations", {}).get("default_top_k_per_gap", 3))

    @property
    def max_total_courses(self) -> int:
        return int(self._raw.get("course_recommendations", {}).get("max_total_courses", 10))

    @property
    def pathway_ordering_label(self) -> str:
        return str(self._raw.get("course_recommendations", {}).get("ordering_label", "heuristic, not a validated sequence"))

    @property
    def pathway_ordering_disclaimer(self) -> str:
        return str(self._raw.get("course_recommendations", {}).get(
            "ordering_disclaimer",
            "Learning order is determined by a prerequisite heuristic and does not represent an accredited educational sequence."
        ))

    @property
    def semantic_retrieval_enabled(self) -> bool:
        env_val = os.environ.get("SEMANTIC_RETRIEVAL_ENABLED")
        if env_val is not None:
            return env_val.strip().lower() in ("true", "1", "yes")
        return bool(self._raw.get("course_recommendations", {}).get("semantic_enabled", True))

    @property
    def course_retriever_type(self) -> str:
        env_val = os.environ.get("RETRIEVER")
        if env_val:
            return env_val.strip().lower()
        return str(self._raw.get("course_recommendations", {}).get("retriever", "hybrid")).lower()

    @property
    def embedding_model_name(self) -> str:
        return str(self._raw.get("course_recommendations", {}).get(
            "embedding_model", "sentence-transformers/all-MiniLM-L6-v2"
        ))

    @property
    def min_semantic_similarity(self) -> float:
        return float(self._raw.get("course_recommendations", {}).get("min_semantic_similarity", 0.25))

    @property
    def rrf_k(self) -> int:
        return int(self._raw.get("course_recommendations", {}).get("rrf_k", 60))

    @property
    def retrieval_candidate_pool_size(self) -> int:
        return int(self._raw.get("course_recommendations", {}).get("candidate_pool_size", 20))

    @property
    def sdg_mappings_config(self) -> Dict[str, Any]:
        return dict(self._raw.get("sdg_mappings", {}))

    @property
    def sdg_disclaimer(self) -> str:
        return str(self._raw.get("sdg_mappings", {}).get(
            "disclaimer",
            "Documented mapping based on UN SDG targets; does not represent measured social impact."
        ))

    def get_config_hash(self) -> str:
        """Returns the SHA-256 hash of the config.yaml file for reproducibility tracking."""
        with open(self.config_path, "rb") as f:
            return hashlib.sha256(f.read()).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        return dict(self._raw)


_CACHED_CONFIG: Optional[Config] = None


def find_default_config_path() -> str:
    """Finds config.yaml in current working directory, module parent directory, or environment."""
    env_path = os.environ.get("CONFIG_PATH")
    if env_path and os.path.exists(env_path):
        return os.path.abspath(env_path)

    cwd_path = os.path.join(os.getcwd(), DEFAULT_CONFIG_FILENAME)
    if os.path.exists(cwd_path):
        return os.path.abspath(cwd_path)

    # Check directory containing app/
    app_parent = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    parent_config = os.path.join(app_parent, DEFAULT_CONFIG_FILENAME)
    if os.path.exists(parent_config):
        return os.path.abspath(parent_config)

    raise FileNotFoundError(f"Could not locate {DEFAULT_CONFIG_FILENAME} in cwd or parent directory.")


def load_config(config_path: Optional[str] = None, reload: bool = False) -> Config:
    """Loads and validates configuration from YAML."""
    global _CACHED_CONFIG
    if _CACHED_CONFIG is not None and not reload and config_path is None:
        return _CACHED_CONFIG

    target_path = os.path.abspath(config_path) if config_path else find_default_config_path()
    if not os.path.exists(target_path):
        raise FileNotFoundError(f"Configuration file not found at: {target_path}")

    with open(target_path, "r", encoding="utf-8") as f:
        raw_config = yaml.safe_load(f)

    if not isinstance(raw_config, dict):
        raise ValueError(f"Invalid YAML configuration format in {target_path}: expected dictionary root.")

    config = Config(raw_config, target_path)
    if config_path is None:
        _CACHED_CONFIG = config
    return config
