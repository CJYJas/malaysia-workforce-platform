"""
Unit tests for SDGAlignmentMapper (Part 1).
Covers:
- Verified role alignments to UN SDG 8 and SDG 9
- Lifelong learning alignment to SDG 4
- Guarantee that mappings are 'documented_mapping' and measured_impact is False
- Unverified roles returning empty alignments list
- Binding disclaimer check
"""

import pytest
from app.sdg_mapper import SDGAlignmentMapper
from app.config import Config


@pytest.fixture
def sdg_mapper():
    return SDGAlignmentMapper()


def test_role_sdg_alignments(sdg_mapper):
    result = sdg_mapper.get_role_sdg_alignments("Software Engineer / Developer")

    assert result["has_verified_reference"] is True
    assert len(result["alignments"]) >= 2
    assert "disclaimer" in result
    assert "does not represent measured social impact" in result["disclaimer"]

    sdg_numbers = [item["sdg_number"] for item in result["alignments"]]
    assert 8 in sdg_numbers
    assert 9 in sdg_numbers

    for item in result["alignments"]:
        assert item["mapping_type"] == "documented_mapping"
        assert item["measured_impact"] is False
        assert len(item["sources"]) > 0
        assert len(item["rationale"]) > 0


def test_unverified_role_returns_empty_list(sdg_mapper):
    result = sdg_mapper.get_role_sdg_alignments("NonExistentRole")

    assert result["has_verified_reference"] is False
    assert result["alignments"] == []
    assert "disclaimer" in result


def test_upskilling_sdg_alignment(sdg_mapper):
    result = sdg_mapper.get_skill_remediation_sdg()

    assert result["has_verified_reference"] is True
    assert len(result["alignments"]) == 1
    alignment = result["alignments"][0]
    assert alignment["sdg_number"] == 4
    assert alignment["target"] == "4.4"
    assert "Quality Education" in alignment["sdg_title"]
    assert alignment["measured_impact"] is False
