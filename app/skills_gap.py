"""
Skills Gap Analyzer for Malaysia Tech Workforce Intelligence Platform.
Categorizes missing skills into core, recommended, and optional gaps
based on empirical Malaysian employer demand shares.
"""

from typing import Dict, List, Set, Any, Optional
from app.config import Config, load_config
from app.skill_normalizer import SkillNormalizer


class SkillsGapAnalyzer:
    """
    Evaluates skill gaps between a normalized candidate profile and
    empirical role requirement profiles derived from JobStreet postings.
    """

    def __init__(self, config: Optional[Config] = None, normalizer: Optional[SkillNormalizer] = None):
        self.config = config or load_config()
        self.normalizer = normalizer or SkillNormalizer(config=self.config)

    def analyze_gaps(
        self,
        user_skills: List[str],
        role_skill_shares: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Identifies matched skills and categorizes gaps by empirical demand.
        
        Args:
            user_skills: Normalized user skill names.
            role_skill_shares: Dict of skill_name -> empirical posting share (0.0 - 1.0).
            
        Returns:
            Dict containing matched_skills, core_gaps, recommended_gaps, optional_gaps, and all_gaps.
        """
        user_skill_set = set(user_skills)
        min_core = self.config.min_core_skill_share
        min_rec = self.config.min_recommended_skill_share

        matched = []
        core_gaps = []
        recommended_gaps = []
        optional_gaps = []

        for skill, share in role_skill_shares.items():
            category = self.normalizer.get_category(skill) or "Technical Skill"
            skill_info = {
                "skill": skill,
                "category": category,
                "empirical_posting_share": round(share, 4),
                "posting_share_percentage": round(share * 100, 2)
            }

            if skill in user_skill_set:
                matched.append(skill_info)
            else:
                if share >= min_core:
                    core_gaps.append(skill_info)
                elif share >= min_rec:
                    recommended_gaps.append(skill_info)
                else:
                    optional_gaps.append(skill_info)

        # Sort all lists descending by posting share
        matched.sort(key=lambda x: x["empirical_posting_share"], reverse=True)
        core_gaps.sort(key=lambda x: x["empirical_posting_share"], reverse=True)
        recommended_gaps.sort(key=lambda x: x["empirical_posting_share"], reverse=True)
        optional_gaps.sort(key=lambda x: x["empirical_posting_share"], reverse=True)

        all_gaps = core_gaps + recommended_gaps + optional_gaps

        # Significant skills are core + recommended (posting share >= min_rec)
        sig_matched_count = len([m for m in matched if m["empirical_posting_share"] >= min_rec])
        sig_total_count = sig_matched_count + len(core_gaps) + len(recommended_gaps)
        coverage_pct = round((sig_matched_count / sig_total_count * 100), 2) if sig_total_count > 0 else 0.0

        return {
            "matched_skills": matched,
            "matched_skills_count": len(matched),
            "core_gaps": core_gaps,
            "core_gaps_count": len(core_gaps),
            "recommended_gaps": recommended_gaps,
            "recommended_gaps_count": len(recommended_gaps),
            "optional_gaps": optional_gaps,
            "optional_gaps_count": len(optional_gaps),
            "all_gaps": all_gaps,
            "total_gaps_count": len(all_gaps),
            "coverage_percentage": coverage_pct
        }

