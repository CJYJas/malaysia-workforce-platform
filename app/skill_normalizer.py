"""
Skill Normalizer for Malaysia Tech Workforce Intelligence Platform.
Maintains a canonical tech skill taxonomy and resolves aliases (e.g., 'JS' -> 'JavaScript',
'k8s' -> 'Kubernetes', 'py' -> 'Python') to their standardized canonical representation.
"""

import os
import json
import logging
from typing import Dict, List, Optional, Set, Any
from app.config import Config, load_config

logger = logging.getLogger(__name__)


class SkillNormalizer:
    """
    Manages canonical skills taxonomy and maps surface forms/aliases to canonical skills.
    Dictionary-based only, strictly reproducible.
    """

    def __init__(self, taxonomy_path: Optional[str] = None, config: Optional[Config] = None):
        cfg = config or load_config()
        self.taxonomy_path = taxonomy_path or cfg.skills_taxonomy_path
        self._canonical_set: Set[str] = set()
        self._canonical_list: List[str] = []
        self._alias_to_canonical: Dict[str, str] = {}
        self._canonical_to_aliases: Dict[str, List[str]] = {}
        self._canonical_to_category: Dict[str, str] = {}
        
        self.load_taxonomy()

    def load_taxonomy(self) -> None:
        """Loads canonical skills and aliases from taxonomy JSON file."""
        if not os.path.exists(self.taxonomy_path):
            logger.warning("Taxonomy file not found at %s. Initializing empty normalizer.", self.taxonomy_path)
            return

        with open(self.taxonomy_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        skills_list = data.get("skills", [])
        for item in skills_list:
            canonical = item.get("canonical", "").strip()
            if not canonical:
                continue

            category = item.get("category", "General")
            aliases = item.get("aliases", [])

            self.register_skill(canonical, aliases=aliases, category=category)

        logger.info(
            "SkillNormalizer loaded %d canonical skills and %d total surface aliases from %s.",
            len(self._canonical_set), len(self._alias_to_canonical), self.taxonomy_path
        )

    def register_skill(self, canonical: str, aliases: Optional[List[str]] = None, category: str = "General") -> None:
        """Registers a canonical skill and its aliases into lookup indices."""
        clean_canonical = canonical.strip()
        if not clean_canonical:
            return

        self._canonical_set.add(clean_canonical)
        if clean_canonical not in self._canonical_list:
            self._canonical_list.append(clean_canonical)

        self._canonical_to_category[clean_canonical] = category

        # Canonical name itself maps to canonical (lowercased)
        self._alias_to_canonical[clean_canonical.lower()] = clean_canonical

        current_aliases = self._canonical_to_aliases.setdefault(clean_canonical, [])
        if clean_canonical not in current_aliases:
            current_aliases.append(clean_canonical)

        if aliases:
            for alias in aliases:
                alias_clean = alias.strip()
                if not alias_clean:
                    continue
                self._alias_to_canonical[alias_clean.lower()] = clean_canonical
                if alias_clean not in current_aliases:
                    current_aliases.append(alias_clean)

    def normalize(self, term: str) -> Optional[str]:
        """
        Resolves a skill surface form or alias to its canonical vocabulary term.
        
        Args:
            term: Surface form (e.g., 'JS', 'k8s', 'python3', 'React.js').
            
        Returns:
            Canonical skill string (e.g., 'JavaScript', 'Kubernetes', 'Python', 'React'),
            or None if the term is unrecognized.
        """
        if not term or not isinstance(term, str):
            return None

        clean_term = term.strip().lower()
        return self._alias_to_canonical.get(clean_term)

    def is_canonical(self, term: str) -> bool:
        """Checks if a term is an exact canonical skill name."""
        return term in self._canonical_set

    def get_canonical_vocabulary(self) -> List[str]:
        """Returns sorted list of all canonical skills in vocabulary."""
        return sorted(list(self._canonical_set))

    def get_aliases_for_skill(self, canonical: str) -> List[str]:
        """Returns all registered aliases for a given canonical skill."""
        return list(self._canonical_to_aliases.get(canonical, []))

    def get_category(self, canonical: str) -> Optional[str]:
        """Returns the category for a canonical skill."""
        return self._canonical_to_category.get(canonical)

    @property
    def total_canonical_skills(self) -> int:
        return len(self._canonical_set)

    @property
    def total_aliases(self) -> int:
        return len(self._alias_to_canonical)
