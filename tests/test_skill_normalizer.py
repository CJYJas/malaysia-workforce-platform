"""
Unit tests for SkillNormalizer.
Covers:
- Canonical vocabulary resolution
- Alias mapping (e.g. JS -> JavaScript, k8s -> Kubernetes, py -> Python)
- Case-insensitivity
- Unknown term handling
- Dynamic skill registration
"""

import pytest
from app.skill_normalizer import SkillNormalizer


@pytest.fixture
def normalizer():
    # Uses default data/skills_taxonomy.json
    return SkillNormalizer()


def test_alias_normalization(normalizer):
    # Test standard tech aliases
    assert normalizer.normalize("JS") == "JavaScript"
    assert normalizer.normalize("js") == "JavaScript"
    assert normalizer.normalize("javascript") == "JavaScript"
    assert normalizer.normalize("JavaScript") == "JavaScript"

    assert normalizer.normalize("k8s") == "Kubernetes"
    assert normalizer.normalize("Kubernetes") == "Kubernetes"

    assert normalizer.normalize("py") == "Python"
    assert normalizer.normalize("python3") == "Python"
    assert normalizer.normalize("Python") == "Python"

    assert normalizer.normalize("react.js") == "React"
    assert normalizer.normalize("reactjs") == "React"
    assert normalizer.normalize("React") == "React"

    assert normalizer.normalize("ts") == "TypeScript"
    assert normalizer.normalize("TypeScript") == "TypeScript"

    assert normalizer.normalize("cpp") == "C++"
    assert normalizer.normalize("c++") == "C++"

    assert normalizer.normalize("c#") == "C#"
    assert normalizer.normalize("csharp") == "C#"

    assert normalizer.normalize(".net core") == ".NET"
    assert normalizer.normalize("dotnet") == ".NET"


def test_unknown_skill_returns_none(normalizer):
    assert normalizer.normalize("Quantum Teleportation 9000") is None
    assert normalizer.normalize("") is None
    assert normalizer.normalize(None) is None


def test_is_canonical(normalizer):
    assert normalizer.is_canonical("Python") is True
    assert normalizer.is_canonical("JavaScript") is True
    assert normalizer.is_canonical("JS") is False  # JS is an alias, not the canonical name


def test_dynamic_registration():
    norm = SkillNormalizer(taxonomy_path="non_existent_file.json")
    norm.register_skill("Rust", aliases=["rust-lang", "cargo"], category="Programming Languages")

    assert norm.normalize("rust-lang") == "Rust"
    assert norm.normalize("CARGO") == "Rust"
    assert norm.normalize("rust") == "Rust"
    assert norm.get_category("Rust") == "Programming Languages"
