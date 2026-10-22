"""
Role Normalizer for Malaysia Tech Workforce Intelligence Platform.
Normalizes arbitrary role queries, abbreviations, aliases, and surface titles
(e.g., 'data en' -> 'Data Engineer', 'swe' -> 'Software Engineer / Developer',
'cloud en' -> 'Cloud Engineer') to standardized canonical role names.
Guarantees:
- Replaces hardcoded string checks with flexible, multi-tier role resolution.
- Respects official target roles defined in config.
- Tiered matching: exact -> config aliases -> token prefix -> regex rule -> fuzzy.
"""

import re
import difflib
import logging
from typing import Dict, List, Optional, Set, Any, Tuple
from app.config import Config, load_config

logger = logging.getLogger(__name__)


class RoleNormalizer:
    """
    Normalizes candidate role titles, shorthand queries, and abbreviations
    to official canonical roles supported by the platform.
    """

    def __init__(
        self,
        config: Optional[Config] = None,
        custom_aliases: Optional[Dict[str, str]] = None
    ):
        self.config = config or load_config()
        self.rules: Dict[str, Dict[str, Any]] = self.config.role_title_rules
        self.canonical_roles: List[str] = list(self.rules.keys())
        
        # Load aliases from config and merge with custom aliases
        self.aliases: Dict[str, str] = {}
        for alias, canonical in self.config.role_aliases.items():
            if canonical in self.canonical_roles:
                self.aliases[alias.strip().lower()] = canonical

        if custom_aliases:
            for alias, canonical in custom_aliases.items():
                if canonical in self.canonical_roles:
                    self.aliases[alias.strip().lower()] = canonical

        # Precompile regex patterns from rules
        self._compiled_rules: List[Tuple[str, re.Pattern]] = []
        for role_name, rule_info in sorted(self.rules.items(), key=lambda x: x[1].get("priority", 999)):
            pattern_str = rule_info.get("pattern", "")
            if pattern_str:
                try:
                    self._compiled_rules.append((role_name, re.compile(pattern_str)))
                except Exception as e:
                    logger.warning("Failed to compile pattern for role '%s': %s", role_name, e)

        # Build token sets for token prefix matching
        self._role_tokens: Dict[str, List[str]] = {}
        for role_name in self.canonical_roles:
            # Normalize and split role name into clean tokens (removing punctuation like '/')
            clean_name = re.sub(r"[^a-zA-Z0-9\s]", " ", role_name).lower()
            tokens = [t for t in clean_name.split() if t]
            self._role_tokens[role_name] = tokens

    def normalize_role(self, query: Optional[str]) -> Optional[str]:
        """
        Resolves a user-provided role query or title to its canonical target role.
        
        Examples:
            'data en' -> 'Data Engineer'
            'data eng' -> 'Data Engineer'
            'DATA ENGINEER' -> 'Data Engineer'
            'de' -> 'Data Engineer'
            'software en' -> 'Software Engineer / Developer'
            'swe' -> 'Software Engineer / Developer'
            'cloud en' -> 'Cloud Engineer'
            'data sc' -> 'Data Scientist'
            'Chief Happiness Officer' -> None
            
        Args:
            query: Input role string or abbreviation.
            
        Returns:
            Standardized canonical role name, or None if unrecognized.
        """
        if not query or not isinstance(query, str):
            return None

        clean = query.strip()
        if not clean:
            return None

        clean_lower = clean.lower()

        # -------------------------------------------------------------
        # Tier 1: Canonical Exact Match (case-insensitive)
        # -------------------------------------------------------------
        for canonical in self.canonical_roles:
            if canonical.lower() == clean_lower:
                return canonical

        # -------------------------------------------------------------
        # Tier 2: Explicit Aliases Lookup (from config.yaml)
        # -------------------------------------------------------------
        if clean_lower in self.aliases:
            return self.aliases[clean_lower]

        # Normalized without extra spaces/punctuation
        clean_compact = re.sub(r"[^a-zA-Z0-9\s]", " ", clean_lower)
        clean_compact = re.sub(r"\s+", " ", clean_compact).strip()
        if clean_compact in self.aliases:
            return self.aliases[clean_compact]

        # -------------------------------------------------------------
        # Tier 3: Token Prefix / Abbreviation Matching
        # e.g., 'data en' matches 'Data Engineer' because:
        #   token 1 'data' == 'data'
        #   token 2 'en' is a prefix of 'engineer' (len >= 2)
        # -------------------------------------------------------------
        input_tokens = clean_compact.split()
        if input_tokens:
            candidates: Set[str] = set()

            for role_name, tokens in self._role_tokens.items():
                if len(input_tokens) == 1:
                    # Single token abbreviation or word prefix
                    single = input_tokens[0]
                    # Check if single token matches any token in role or is unambiguous prefix (>= 4 chars)
                    if any(t == single or (len(single) >= 4 and t.startswith(single)) for t in tokens):
                        candidates.add(role_name)
                else:
                    # Multi-token matching
                    # First token must match or prefix, subsequent tokens must match or prefix
                    matches_all = True
                    for i, in_tok in enumerate(input_tokens):
                        # Token must match or be a prefix of at least one token in the canonical role
                        tok_matched = False
                        for c_tok in tokens:
                            if c_tok == in_tok:
                                tok_matched = True
                                break
                            elif len(in_tok) >= 2 and c_tok.startswith(in_tok):
                                tok_matched = True
                                break
                        if not tok_matched:
                            matches_all = False
                            break

                    if matches_all:
                        candidates.add(role_name)

            # If unambiguous single candidate matches, return it
            if len(candidates) == 1:
                return next(iter(candidates))
            elif len(candidates) > 1:
                # Disambiguate by matching priority
                sorted_cands = sorted(
                    candidates,
                    key=lambda r: self.rules.get(r, {}).get("priority", 999)
                )
                return sorted_cands[0]

        # -------------------------------------------------------------
        # Tier 4: Pattern Match against Official Role Regex Rules
        # e.g., 'etl developer' -> Data Engineer
        # -------------------------------------------------------------
        for role_name, pattern in self._compiled_rules:
            if pattern.search(clean):
                return role_name

        # -------------------------------------------------------------
        # Tier 5: Fuzzy String Similarity Matcher (high threshold >= 0.80)
        # -------------------------------------------------------------
        canonical_map = {c.lower(): c for c in self.canonical_roles}
        matches = difflib.get_close_matches(clean_lower, canonical_map.keys(), n=1, cutoff=0.80)
        if matches:
            return canonical_map[matches[0]]

        # Unrecognized role
        return None

    def get_supported_roles(self) -> List[str]:
        """Returns official canonical supported roles list."""
        return list(self.canonical_roles)
