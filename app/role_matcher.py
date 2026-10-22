"""
Role Matcher for Malaysia Tech Workforce Intelligence Platform.
Computes explainable role alignment scores based on empirical JobStreet posting skill shares.
Scores represent weighted combinations of skill coverage and TF-IDF cosine similarity.
Includes strict disclaimers, evidence sample sizes, and handling for sparse/empty profiles.
"""

import math
import logging
from typing import Dict, List, Optional, Any, Tuple
from app.config import Config, load_config
from app.skill_normalizer import SkillNormalizer
from app.trend_analyzer import TrendAnalyzer
from app.skills_gap import SkillsGapAnalyzer

logger = logging.getLogger(__name__)


class RoleMatcher:
    """
    Ranks target roles for a given candidate profile using empirical requirement profiles
    derived from JobStreet Malaysia postings.
    """

    def __init__(
        self,
        trend_analyzer: TrendAnalyzer,
        config: Optional[Config] = None,
        normalizer: Optional[SkillNormalizer] = None,
        gap_analyzer: Optional[SkillsGapAnalyzer] = None
    ):
        self.analyzer = trend_analyzer
        self.config = config or load_config()
        self.normalizer = normalizer or SkillNormalizer(config=self.config)
        self.gap_analyzer = gap_analyzer or SkillsGapAnalyzer(config=self.config, normalizer=self.normalizer)
        self._cached_role_profiles: Optional[Dict[str, Dict[str, Any]]] = None

    def _get_empirical_role_profiles(self) -> Dict[str, Dict[str, Any]]:
        """
        Derives role requirement profiles dynamically from JobStreet posting skill shares.
        Guarantees requirements come from real data, not hand-written lists.
        """
        if self._cached_role_profiles is not None:
            return self._cached_role_profiles

        profiles = {}
        supported_roles = self.analyzer.get_supported_roles()

        for role in supported_roles:
            try:
                demand_res = self.analyzer.calculate_skill_demand(role=role, top_n=50)
                status = demand_res.get("status")
                denominator = demand_res.get("denominator", 0)

                if status == "insufficient_evidence" or denominator < self.config.min_postings_per_role:
                    profiles[role] = {
                        "status": "insufficient_evidence",
                        "denominator": denominator,
                        "sample_size_warning": True,
                        "skill_shares": {},
                        "skills_list": []
                    }
                    continue

                skill_shares = {
                    item["skill"]: item["posting_share"]
                    for item in demand_res.get("skills", [])
                }

                profiles[role] = {
                    "status": "success",
                    "denominator": denominator,
                    "sample_size_warning": demand_res.get("sample_size_warning", False),
                    "warning_message": demand_res.get("warning_message"),
                    "skill_shares": skill_shares,
                    "skills_list": demand_res.get("skills", [])
                }
            except Exception as e:
                logger.warning("Could not derive profile for role '%s': %s", role, e)
                profiles[role] = {
                    "status": "error",
                    "denominator": 0,
                    "sample_size_warning": True,
                    "skill_shares": {},
                    "skills_list": []
                }

        self._cached_role_profiles = profiles
        return profiles

    def normalize_profile_skills(self, raw_skills: List[str]) -> Tuple[List[str], List[str]]:
        """
        Normalizes a list of candidate skills into canonical vocabulary and unrecognized tokens.
        
        Returns:
            Tuple of (canonical_skills, unrecognized_tokens).
        """
        canonical_skills = []
        unrecognized = []

        for raw in raw_skills:
            if not isinstance(raw, str) or not raw.strip():
                continue
            norm = self.normalizer.normalize(raw)
            if norm:
                if norm not in canonical_skills:
                    canonical_skills.append(norm)
            else:
                clean_raw = raw.strip()
                if clean_raw not in unrecognized:
                    unrecognized.append(clean_raw)

        return canonical_skills, unrecognized

    def _compute_match_scores(
        self,
        user_skills: List[str],
        role_skill_shares: Dict[str, float]
    ) -> Tuple[float, float, float]:
        """
        Calculates:
        1. Weighted skill coverage score (core skills weighted 2x, recommended 1x).
        2. TF-IDF cosine similarity between user skill bag and role empirical distribution.
        3. Combined weighted overall score.
        
        Returns:
            Tuple of (coverage_score, tfidf_score, overall_score).
        """
        if not user_skills or not role_skill_shares:
            return 0.0, 0.0, 0.0

        user_skill_set = set(user_skills)
        min_core = self.config.min_core_skill_share
        core_weight_mult = 2.0
        rec_weight_mult = 1.0

        # 1. Skill Coverage Score
        total_possible_weight = 0.0
        matched_weight = 0.0

        for skill, share in role_skill_shares.items():
            mult = core_weight_mult if share >= min_core else rec_weight_mult
            weight = share * mult
            total_possible_weight += weight
            if skill in user_skill_set:
                matched_weight += weight

        coverage_score = (matched_weight / total_possible_weight) if total_possible_weight > 0 else 0.0
        coverage_score = min(max(coverage_score, 0.0), 1.0)

        # 2. TF-IDF Cosine Similarity
        # User vector: binary presence (1.0 for each user skill)
        # Role vector: empirical posting share for each skill
        dot_product = 0.0
        norm_user_sq = len(user_skill_set)
        norm_role_sq = sum(share ** 2 for share in role_skill_shares.values())

        for skill in user_skill_set:
            if skill in role_skill_shares:
                dot_product += role_skill_shares[skill]

        denominator_norm = math.sqrt(norm_user_sq) * math.sqrt(norm_role_sq)
        tfidf_score = (dot_product / denominator_norm) if denominator_norm > 0 else 0.0
        tfidf_score = min(max(tfidf_score, 0.0), 1.0)

        # 3. Overall Combined Score (0.0 to 100.0)
        w_cov = self.config.weight_skill_coverage
        w_tfidf = self.config.weight_tfidf_similarity

        combined_ratio = (w_cov * coverage_score) + (w_tfidf * tfidf_score)
        overall_score = round(combined_ratio * 100.0, 2)

        return round(coverage_score, 4), round(tfidf_score, 4), overall_score

    def match_roles(
        self,
        raw_skills: List[str],
        experience_years: Optional[float] = None,
        top_k: int = 5
    ) -> Dict[str, Any]:
        """
        Ranks target roles for a given profile.
        
        Args:
            raw_skills: Raw skill strings provided by user.
            experience_years: Optional candidate experience.
            top_k: Number of ranked roles to return.
            
        Returns:
            Dict containing normalized profile, ranked matches, component breakdown,
            gaps, and legal disclaimer.
        """
        canonical_skills, unrecognized = self.normalize_profile_skills(raw_skills)
        role_profiles = self._get_empirical_role_profiles()

        w_cov = self.config.weight_skill_coverage
        w_tfidf = self.config.weight_tfidf_similarity
        disclaimer = self.config.match_disclaimer

        matches = []
        insufficient_evidence_roles = []

        for role_name, profile_info in role_profiles.items():
            if profile_info.get("status") == "insufficient_evidence":
                insufficient_evidence_roles.append({
                    "role": role_name,
                    "evidence_sample_size": profile_info.get("denominator", 0),
                    "min_required": self.config.min_postings_per_role,
                    "reason": "Insufficient empirical postings in Malaysian dataset."
                })
                continue

            skill_shares = profile_info.get("skill_shares", {})
            denominator = profile_info.get("denominator", 0)
            sample_warning = profile_info.get("sample_size_warning", False)
            warning_msg = profile_info.get("warning_message")

            # Calculate gap analysis
            gap_data = self.gap_analyzer.analyze_gaps(
                user_skills=canonical_skills,
                role_skill_shares=skill_shares
            )

            # Calculate scores
            coverage, tfidf, overall = self._compute_match_scores(
                user_skills=canonical_skills,
                role_skill_shares=skill_shares
            )

            matches.append({
                "role": role_name,
                "match_score": overall,
                "score_components": {
                    "skill_coverage": coverage,
                    "tfidf_cosine": tfidf,
                    "weights": {
                        "skill_coverage": w_cov,
                        "tfidf_cosine": w_tfidf
                    }
                },
                "evidence_sample_size": denominator,
                "sample_size_warning": sample_warning,
                "warning_message": warning_msg,
                "matched_skills": gap_data["matched_skills"],
                "matched_skills_count": gap_data["matched_skills_count"],
                "core_gaps": gap_data["core_gaps"],
                "recommended_gaps": gap_data["recommended_gaps"],
                "total_gaps_count": gap_data["total_gaps_count"]
            })

        # Sort matches by overall score descending, then by sample size
        matches.sort(key=lambda m: (-m["match_score"], -m["evidence_sample_size"]))
        top_matches = matches[:top_k]

        return {
            "status": "success",
            "candidate_profile": {
                "raw_skills_count": len(raw_skills),
                "normalized_skills": canonical_skills,
                "unrecognized_skills": unrecognized,
                "experience_years": experience_years
            },
            "disclaimer": disclaimer,
            "total_roles_evaluated": len(matches),
            "ranked_matches": top_matches,
            "insufficient_evidence_roles": insufficient_evidence_roles
        }
