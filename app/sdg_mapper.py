"""
SDG Alignment Mapper for Malaysia Tech Workforce Intelligence Platform.
Provides defensible, documented alignments to UN Sustainable Development Goals.
Strictly adheres to:
- Mappings represent potential documented alignment, NEVER measured social impact.
- Returns empty list if no verified reference exists.
"""

import logging
from typing import Dict, List, Optional, Any
from app.config import Config, load_config

logger = logging.getLogger(__name__)


class SDGAlignmentMapper:
    """
    Maps tech roles and lifelong learning skills to documented UN SDG targets.
    """

    def __init__(self, config: Optional[Config] = None):
        self.config = config or load_config()
        self.mappings_config = self.config.sdg_mappings_config

    def get_role_sdg_alignments(self, role: str) -> Dict[str, Any]:
        """
        Retrieves documented SDG mappings for a supported tech role.
        
        Args:
            role: Target tech role name.
            
        Returns:
            Dict containing alignments list, documented sources, and disclaimer.
        """
        roles_data = self.mappings_config.get("roles", {})
        role_entry = roles_data.get(role)

        if not role_entry or "sdgs" not in role_entry:
            return {
                "role": role,
                "has_verified_reference": False,
                "alignments": [],
                "disclaimer": self.config.sdg_disclaimer
            }

        alignments = []
        sources = self.mappings_config.get("sources", [])

        for item in role_entry["sdgs"]:
            alignments.append({
                "sdg_number": item["number"],
                "target": item["target"],
                "sdg_title": item["title"],
                "rationale": item["rationale"],
                "sources": sources,
                "mapping_type": "documented_mapping",
                "measured_impact": False
            })

        return {
            "role": role,
            "has_verified_reference": True,
            "alignments": alignments,
            "disclaimer": self.config.sdg_disclaimer
        }

    def get_skill_remediation_sdg(self) -> Dict[str, Any]:
        """
        Retrieves documented alignment for lifelong technical upskilling (SDG 4 - Target 4.4).
        """
        skills_data = self.mappings_config.get("skills", {})
        upskill_entry = skills_data.get("technical_gap_remediation")

        if not upskill_entry or "sdgs" not in upskill_entry:
            return {
                "has_verified_reference": False,
                "alignments": [],
                "disclaimer": self.config.sdg_disclaimer
            }

        alignments = []
        sources = self.mappings_config.get("sources", [])
        for item in upskill_entry["sdgs"]:
            alignments.append({
                "sdg_number": item["number"],
                "target": item["target"],
                "sdg_title": item["title"],
                "rationale": item["rationale"],
                "sources": sources,
                "mapping_type": "documented_mapping",
                "measured_impact": False
            })

        return {
            "has_verified_reference": True,
            "alignments": alignments,
            "disclaimer": self.config.sdg_disclaimer
        }
