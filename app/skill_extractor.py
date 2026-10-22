"""
Dictionary-Based Skill Extractor for Malaysia Tech Workforce Intelligence Platform.
Extracts technical skills from text descriptions using boundary-safe regex matching,
normalizes matches to canonical taxonomy terms, and retains the exact matched text as evidence.
Strictly dictionary-based with zero external model dependencies.
"""

import re
import logging
from typing import Dict, List, Optional, Tuple, Set, Any, Iterable
from app.config import Config, load_config
from app.skill_normalizer import SkillNormalizer

logger = logging.getLogger(__name__)


class SkillExtractor:
    """
    Extracts canonical skills from job descriptions and preserves original matched text as evidence.
    Dictionary-based only, strictly reproducible.
    """

    def __init__(
        self,
        normalizer: Optional[SkillNormalizer] = None,
        config: Optional[Config] = None
    ):
        self.config = config or load_config()
        self.normalizer = normalizer or SkillNormalizer(config=self.config)
        self._compiled_regex: Optional[re.Pattern] = None
        self._term_to_canonical: Dict[str, str] = {}
        self._build_extractor_index()

    def _build_extractor_index(self) -> None:
        """
        Builds a compiled regex from canonical skills and all surface aliases.
        Terms are sorted in descending order of length to ensure longer, more specific
        phrases are matched before shorter substrings (e.g., 'React.js' before 'React',
        'Node.js' before 'Node').
        """
        self._term_to_canonical.clear()
        all_terms: Set[str] = set()

        for canonical in self.normalizer.get_canonical_vocabulary():
            aliases = self.normalizer.get_aliases_for_skill(canonical)
            for alias in aliases:
                alias_clean = alias.strip()
                if alias_clean:
                    all_terms.add(alias_clean)
                    self._term_to_canonical[alias_clean.lower()] = canonical

        if not all_terms:
            logger.warning("SkillExtractor: Vocabulary is empty. No patterns to compile.")
            self._compiled_regex = None
            return

        # Sort descending by length to match longer, specific phrases first
        sorted_terms = sorted(all_terms, key=len, reverse=True)

        def _make_term_pattern(term: str) -> str:
            escaped = re.escape(term)
            # Leading boundary: If term begins with a dot (e.g. .NET), only disallow word chars
            if term.startswith("."):
                prefix = r"(?<![A-Za-z0-9_])"
            else:
                prefix = r"(?<![A-Za-z0-9_.\-])"

            # Trailing boundary: If term ends with non-word symbol (e.g. C++, C#), only disallow word chars
            # Otherwise disallow word chars OR dot/dash immediately followed by word chars
            # (allowing sentence periods or trailing punctuation like 'Python.' or 'React,')
            if re.search(r"[^A-Za-z0-9_]$", term):
                suffix = r"(?![A-Za-z0-9_])"
            else:
                suffix = r"(?![A-Za-z0-9_]|[\.\-][A-Za-z0-9_])"

            return f"{prefix}{escaped}{suffix}"

        pattern_parts = [f"(?:{_make_term_pattern(t)})" for t in sorted_terms]
        pattern_str = r"(" + "|".join(pattern_parts) + r")"

        self._compiled_regex = re.compile(pattern_str, re.IGNORECASE)
        logger.info(
            "SkillExtractor successfully compiled regex with %d terms representing %d canonical skills.",
            len(sorted_terms), len(self.normalizer.get_canonical_vocabulary())
        )

    def extract_matches(self, text: str) -> List[Dict[str, Any]]:
        """
        Extracts all skill occurrences from text, returning canonical name,
        original matched text evidence, and character offsets.
        
        Args:
            text: Input string (e.g., job description).
            
        Returns:
            List of match dictionaries:
            [{"canonical": "JavaScript", "matched_text": "JS", "start": 10, "end": 12}, ...]
        """
        if not text or not isinstance(text, str) or self._compiled_regex is None:
            return []

        matches = []
        for m in self._compiled_regex.finditer(text):
            raw_matched = m.group(0)
            canonical = self._term_to_canonical.get(raw_matched.lower())
            if canonical:
                matches.append({
                    "canonical": canonical,
                    "matched_text": raw_matched,
                    "start": m.start(),
                    "end": m.end()
                })
        return matches

    def extract_canonical_skills(self, text: str) -> List[str]:
        """
        Extracts sorted, unique canonical skills found in text.
        
        Args:
            text: Input string.
            
        Returns:
            Sorted list of canonical skill names (e.g. ['JavaScript', 'Python', 'SQL']).
        """
        matches = self.extract_matches(text)
        unique_canonical = sorted(list({m["canonical"] for m in matches}))
        return unique_canonical

    def extract_with_evidence(self, text: str) -> Dict[str, List[str]]:
        """
        Extracts canonical skills and maps each to a deduplicated list of original matched text evidence.
        
        Args:
            text: Input string.
            
        Returns:
            Dict mapping canonical skill to list of unique matched evidence strings:
            {'JavaScript': ['JS', 'JavaScript'], 'Kubernetes': ['k8s']}
        """
        matches = self.extract_matches(text)
        evidence_map: Dict[str, List[str]] = {}
        for m in matches:
            canonical = m["canonical"]
            matched_text = m["matched_text"]
            evidence_list = evidence_map.setdefault(canonical, [])
            if matched_text not in evidence_list:
                evidence_list.append(matched_text)
        return evidence_map

    def extract_batch(
        self,
        texts: Iterable[str]
    ) -> Tuple[List[List[str]], List[Dict[str, List[str]]]]:
        """
        Extracts canonical skills and evidence maps for a sequence of texts.
        
        Args:
            texts: Iterable of text descriptions.
            
        Returns:
            Tuple of:
            - list_of_canonical_lists: [ ['Python', 'SQL'], ... ]
            - list_of_evidence_maps: [ {'Python': ['py', 'Python'], 'SQL': ['SQL']}, ... ]
        """
        canonical_results = []
        evidence_results = []

        for text in texts:
            if not isinstance(text, str) or not text.strip():
                canonical_results.append([])
                evidence_results.append({})
                continue

            evidence_map = self.extract_with_evidence(text)
            canonical_skills = sorted(list(evidence_map.keys()))

            canonical_results.append(canonical_skills)
            evidence_results.append(evidence_map)

        return canonical_results, evidence_results
