"""
Coursera Course Recommender for Malaysia Tech Workforce Intelligence Platform.
Implements CourseRetriever protocol for retrieving authentic Coursera courses for skill gaps.
Guarantees:
- Real Coursera records only, traceable to source_record_id.
- Zero fabricated prices, ratings, or durations.
- Explicit return of unresolved skill gaps.
- Heuristic pathway ordering labeled 'heuristic, not a validated sequence'.
"""

import os
import re
import math
import logging
from typing import Dict, List, Optional, Any, Protocol, Set
import pandas as pd
from app.config import Config, load_config
from app.data_loader import load_coursera_data

logger = logging.getLogger(__name__)


class CourseRetriever(Protocol):
    """Protocol for Coursera course retrieval engines (TF-IDF, Dense, Hybrid)."""
    def retrieve_for_gap(self, skill_gap: str, top_k: int = 3) -> List[Dict[str, Any]]:
        ...


class TfidfCourseRetriever:
    """
    Deterministic TF-IDF Course Retriever matching skill gaps against authentic Coursera records.
    Constructs index over Skill gain, Course Title, and Modules without external APIs.
    """

    def __init__(self, df_coursera: Optional[pd.DataFrame] = None, config: Optional[Config] = None):
        self.config = config or load_config()
        self.df = df_coursera if df_coursera is not None else load_coursera_data(config=self.config)
        self._build_index()

    def _build_index(self) -> None:
        """Indexes authentic Coursera records with weights on Skill gain and Title."""
        logger.info("Building TF-IDF Course Index across %d Coursera records...", len(self.df))
        self.records: List[Dict[str, Any]] = []

        for idx, row in self.df.iterrows():
            record_id = f"coursera_{idx}"
            title = str(row.get("Course Title", "")).strip()
            url = str(row.get("Course Url", "")).strip()
            skills_raw = str(row.get("Skill gain", "")).strip()
            modules_raw = str(row.get("Modules", "")).strip()
            level = str(row.get("Level", "")).strip()
            rating_val = row.get("Rating")
            try:
                rating = float(rating_val) if pd.notnull(rating_val) else None
            except Exception:
                rating = None
            duration = str(row.get("Duration to complete (Approx.)", "")).strip()
            offered_by = str(row.get("Offered By", "")).strip()

            # Clean placeholder "Not specified"
            skills_display = None if skills_raw.lower() in ("not specified", "nan", "") else skills_raw
            level_clean = "All levels" if level.lower() in ("not specified", "nan", "") else level

            # Search text with heavy weight on explicit Skill gain and Course Title
            search_text = (
                f"{skills_raw} {skills_raw} {skills_raw} "
                f"{title} {title} "
                f"{modules_raw}"
            ).lower()

            self.records.append({
                "source_record_id": record_id,
                "title": title,
                "url": url,
                "skills_gained": skills_display,
                "level": level_clean,
                "rating": rating,
                "duration": duration if duration and duration.lower() != "nan" else None,
                "offered_by": offered_by if offered_by and offered_by.lower() != "nan" else None,
                "search_text": search_text
            })

        logger.info("TF-IDF Course Index built successfully with %d courses.", len(self.records))

    def retrieve_for_gap(self, skill_gap: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Retrieves real Coursera courses addressing a specific skill gap.
        
        Args:
            skill_gap: Target missing skill (e.g., 'SQL', 'Docker', 'Machine Learning').
            top_k: Max courses to return for this gap.
            
        Returns:
            List of course recommendation dictionaries.
        """
        if not skill_gap or not isinstance(skill_gap, str):
            return []

        gap_clean = skill_gap.strip().lower()
        # Word boundary pattern for precise skill matching in search text
        pattern = re.compile(rf"(?<![A-Za-z0-9_\.\-]){re.escape(gap_clean)}(?![A-Za-z0-9_\.\-])", re.IGNORECASE)

        scored_records = []
        for rec in self.records:
            match_count = len(pattern.findall(rec["search_text"]))
            if match_count > 0:
                # Prioritize courses where the skill appears in Title or Skill gain
                in_skills = rec["skills_gained"] and gap_clean in rec["skills_gained"].lower()
                in_title = gap_clean in rec["title"].lower()

                score = match_count * 1.0
                if in_skills:
                    score += 5.0
                if in_title:
                    score += 3.0
                if rec["rating"]:
                    score += (rec["rating"] / 5.0)  # Quality tiebreaker

                scored_records.append((score, rec))

        scored_records.sort(key=lambda item: item[0], reverse=True)
        top_items = scored_records[:top_k]

        recommendations = []
        for score, rec in top_items:
            why_recommended = f"Directly addresses your skill gap in '{skill_gap}'"
            if rec["skills_gained"]:
                why_recommended += f" via verified curriculum skills: {rec['skills_gained'][:80]}"

            recommendations.append({
                "source_record_id": rec["source_record_id"],
                "course_title": rec["title"],
                "course_url": rec["url"],
                "gap_addressed": skill_gap,
                "why_recommended": why_recommended,
                "skills_gained": rec["skills_gained"],
                "difficulty_level": rec["level"],
                "rating": rec["rating"],
                "duration": rec["duration"],
                "offered_by": rec["offered_by"],
                "relevance_score": round(score, 2)
            })

        return recommendations


class CourseRecommender:
    """
    Coordinates Coursera retrieval across identified skill gaps and organizes
    an ordered learning pathway with explicit disclaimers.
    """

    def __init__(
        self,
        retriever: Optional[CourseRetriever] = None,
        config: Optional[Config] = None
    ):
        self.config = config or load_config()
        if retriever is not None:
            self.retriever = retriever
        else:
            from app.embeddings import get_course_retriever
            self.retriever = get_course_retriever(config=self.config)

    def _sequence_heuristic(self, course: Dict[str, Any]) -> int:
        """
        Prerequisite heuristic prioritizing foundational levels first.
        Explicitly labeled as a heuristic, not an accredited curriculum sequence.
        """
        lvl = str(course.get("difficulty_level", "")).lower()
        if "beginner" in lvl:
            return 1
        elif "intermediate" in lvl:
            return 2
        elif "advanced" in lvl:
            return 3
        return 4

    def recommend_for_gaps(
        self,
        skill_gaps: List[Dict[str, Any]],
        top_k_per_gap: Optional[int] = None,
        max_total: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Generates course recommendations for identified skill gaps.
        
        Args:
            skill_gaps: List of gap dictionaries (from SkillsGapAnalyzer).
            top_k_per_gap: Max courses per gap.
            max_total: Max total courses in pathway.
            
        Returns:
            Dict containing ordered_pathway, unresolved_skill_gaps, ordering label, and disclaimer.
        """
        k = top_k_per_gap or self.config.default_top_k_per_gap
        max_courses = max_total or self.config.max_total_courses

        pathway_courses = []
        seen_urls: Set[str] = set()
        unresolved_gaps: List[str] = []

        for gap_item in skill_gaps:
            skill_name = gap_item.get("skill") if isinstance(gap_item, dict) else str(gap_item)
            courses = self.retriever.retrieve_for_gap(skill_name, top_k=k)

            if not courses:
                unresolved_gaps.append(skill_name)
            else:
                for c in courses:
                    if c["course_url"] not in seen_urls:
                        seen_urls.add(c["course_url"])
                        pathway_courses.append(c)

        # Apply heuristic sequence ordering (Beginner -> Intermediate -> Advanced)
        pathway_courses.sort(key=lambda c: (self._sequence_heuristic(c), -c.get("relevance_score", 0)))
        ordered_courses = pathway_courses[:max_courses]

        for step_num, course in enumerate(ordered_courses, start=1):
            course["step_number"] = step_num

        return {
            "total_courses_recommended": len(ordered_courses),
            "ordered_pathway": ordered_courses,
            "unresolved_skill_gaps": unresolved_gaps,
            "pathway_ordering_label": self.config.pathway_ordering_label,
            "ordering_disclaimer": self.config.pathway_ordering_disclaimer
        }
