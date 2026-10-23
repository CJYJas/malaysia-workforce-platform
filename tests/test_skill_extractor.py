"""
Unit tests for SkillExtractor.
Covers:
- Dictionary-based skill extraction from job descriptions
- Preservation of original matched text as evidence
- Boundary safety for technical symbols (C++, C#, .NET, Node.js)
- Avoiding false positive collisions (e.g., 'Node.js' must not match 'JS')
- Empty, null, and whitespace input handling
- Batch extraction
"""

import pytest
from app.skill_normalizer import SkillNormalizer
from app.skill_extractor import SkillExtractor


@pytest.fixture
def extractor():
    normalizer = SkillNormalizer()
    return SkillExtractor(normalizer=normalizer)


def test_extract_skills_with_evidence(extractor):
    text = (
        "We are looking for a Senior Developer with strong proficiency in JS and Python. "
        "Experience in building applications using Kubernetes and Docker is required."
    )
    matches = extractor.extract_matches(text)
    
    # Verify canonical and matched text evidence
    canonical_to_evidence = {m["canonical"]: m["matched_text"] for m in matches}
    
    assert "JavaScript" in canonical_to_evidence
    assert canonical_to_evidence["JavaScript"] == "JS"  # Matched alias 'JS' retained as evidence

    assert "Python" in canonical_to_evidence
    assert canonical_to_evidence["Python"] == "Python"

    assert "Kubernetes" in canonical_to_evidence
    assert canonical_to_evidence["Kubernetes"] == "Kubernetes"

    assert "Docker" in canonical_to_evidence
    assert canonical_to_evidence["Docker"] == "Docker"


def test_extract_with_evidence_dict(extractor):
    text = "Proficient in JS and JavaScript, along with Python and py scripts."
    evidence_map = extractor.extract_with_evidence(text)

    # JavaScript was mentioned as both 'JS' and 'JavaScript'
    assert "JavaScript" in evidence_map
    assert set(evidence_map["JavaScript"]) == {"JS", "JavaScript"}

    # Python was mentioned as both 'Python' and 'py'
    assert "Python" in evidence_map
    assert set(evidence_map["Python"]) == {"Python", "py"}


def test_special_symbols_and_word_boundaries(extractor):
    text = (
        "Seeking talent skilled in C++, C#, and .NET Core. "
        "Candidates should have experience with Node.js and React."
    )
    canonical_skills = extractor.extract_canonical_skills(text)

    assert "C++" in canonical_skills
    assert "C#" in canonical_skills
    assert ".NET" in canonical_skills
    assert "Node.js" in canonical_skills
    assert "React" in canonical_skills

    # CRITICAL CHECK: 'Node.js' should NOT match 'JS' as a standalone skill!
    evidence_map = extractor.extract_with_evidence(text)
    assert "JavaScript" not in evidence_map


def test_empty_and_malformed_input(extractor):
    assert extractor.extract_matches("") == []
    assert extractor.extract_matches("   ") == []
    assert extractor.extract_matches(None) == []

    assert extractor.extract_canonical_skills("") == []
    assert extractor.extract_canonical_skills(None) == []

    assert extractor.extract_with_evidence("") == {}


def test_extract_batch(extractor):
    texts = [
        "Required: Python, SQL, and AWS.",
        "Must know Java, Spring Boot, and Docker.",
        "Non-technical description with no IT skills mentioned."
    ]
    canonical_batch, evidence_batch = extractor.extract_batch(texts)

    assert len(canonical_batch) == 3
    assert set(canonical_batch[0]) == {"AWS", "Python", "SQL"}
    assert set(canonical_batch[1]) == {"Docker", "Java", "Spring Boot"}
    assert canonical_batch[2] == []
