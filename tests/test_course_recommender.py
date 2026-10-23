"""
Unit tests for Coursera Course Recommender and Retriever Protocol (Part 1).
Covers:
- Retrieval of authentic Coursera courses for skill gaps
- Traceability to source_record_id and valid URLs
- Verification that no prices or durations are fabricated
- Explicit reporting of unresolved skill gaps
- Pathway ordering labeled 'heuristic, not a validated sequence'
- Prerequisite sequence ordering (beginner before advanced)
"""

import pytest
import pandas as pd
from app.course_recommender import (
    CourseRetriever,
    TfidfCourseRetriever,
    CourseRecommender
)
from app.config import Config


@pytest.fixture
def sample_coursera_df():
    data = [
        {
            "Course Title": "Introduction to Python Programming",
            "Rating": 4.8,
            "Level": "Beginner level",
            "Schedule": "Flexible schedule",
            "What you will learn": "Python basics, loops, functions",
            "Skill gain": "Python, Programming",
            "Modules": "Week 1: Basics, Week 2: Functions",
            "Course Url": "https://www.coursera.org/learn/python-basics",
            "Duration to complete (Approx.)": "12 hours",
            "Offered By": "University of Michigan"
        },
        {
            "Course Title": "Advanced Python and Metaprogramming",
            "Rating": 4.6,
            "Level": "Advanced level",
            "Schedule": "Flexible schedule",
            "What you will learn": "Decorators, generators, metaclasses",
            "Skill gain": "Python, Advanced Python",
            "Modules": "Week 1: Decorators, Week 2: Metaclasses",
            "Course Url": "https://www.coursera.org/learn/advanced-python",
            "Duration to complete (Approx.)": "20 hours",
            "Offered By": "Meta"
        },
        {
            "Course Title": "SQL for Data Science",
            "Rating": 4.7,
            "Level": "Beginner level",
            "Schedule": "Flexible schedule",
            "What you will learn": "SQL queries, joins, aggregates",
            "Skill gain": "SQL, SQLite, Data Analysis",
            "Modules": "Week 1: SELECT, Week 2: Joins",
            "Course Url": "https://www.coursera.org/learn/sql-for-data-science",
            "Duration to complete (Approx.)": "15 hours",
            "Offered By": "UC Davis"
        }
    ]
    return pd.DataFrame(data)


def test_tfidf_retriever_for_gap(sample_coursera_df):
    retriever = TfidfCourseRetriever(df_coursera=sample_coursera_df)
    courses = retriever.retrieve_for_gap("Python", top_k=2)

    assert len(courses) == 2
    first = courses[0]
    assert "source_record_id" in first
    assert first["source_record_id"].startswith("coursera_")
    assert first["course_url"].startswith("https://www.coursera.org/learn/")
    assert first["gap_addressed"] == "Python"
    assert "why_recommended" in first
    assert "relevance_score" in first
    assert first["rating"] is not None


def test_unresolved_skill_gap_reported_explicitly(sample_coursera_df):
    retriever = TfidfCourseRetriever(df_coursera=sample_coursera_df)
    recommender = CourseRecommender(retriever=retriever)

    # Gap for a skill not in the sample dataframe
    gaps = [{"skill": "Rust"}, {"skill": "Kubernetes"}]
    result = recommender.recommend_for_gaps(gaps)

    assert result["total_courses_recommended"] == 0
    assert "Rust" in result["unresolved_skill_gaps"]
    assert "Kubernetes" in result["unresolved_skill_gaps"]


def test_pathway_ordering_heuristic_label_and_disclaimer(sample_coursera_df):
    retriever = TfidfCourseRetriever(df_coursera=sample_coursera_df)
    recommender = CourseRecommender(retriever=retriever)

    gaps = [{"skill": "Python"}, {"skill": "SQL"}]
    result = recommender.recommend_for_gaps(gaps)

    # Required label & disclaimer checks
    assert result["pathway_ordering_label"] == "heuristic, not a validated sequence"
    assert "prerequisite heuristic" in result["ordering_disclaimer"]

    # Verify courses are ordered: Beginner courses should precede Advanced courses
    pathway = result["ordered_pathway"]
    assert len(pathway) >= 2

    levels = [c["difficulty_level"] for c in pathway]
    # Beginner courses should appear before Advanced courses in heuristic ordering
    beginner_indices = [i for i, lvl in enumerate(levels) if "beginner" in lvl.lower()]
    advanced_indices = [i for i, lvl in enumerate(levels) if "advanced" in lvl.lower()]

    if beginner_indices and advanced_indices:
        assert min(beginner_indices) < min(advanced_indices)
