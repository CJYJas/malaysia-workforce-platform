"""
Unit and integration tests for PDF Resume Extraction and Resume-based Matching.
Covers:
- PDF text and metadata extraction (fitz / pypdf)
- Dictionary-based skill extraction from resumes with evidence
- Experience years and education detection
- Rejection of invalid/corrupt PDFs and non-PDF filetypes
- POST /profile/upload-resume
- POST /roles/match-resume
- POST /roadmap/generate-from-resume
"""

import io
import pytest
from reportlab.pdfgen import canvas
from fastapi.testclient import TestClient

from app.api import app
from app.resume_parser import (
    extract_text_from_pdf,
    ResumeParser,
    PDFExtractionError
)


def create_sample_resume_pdf(content_text: str) -> bytes:
    """Generates an in-memory PDF containing the specified resume text."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer)
    c.drawString(100, 750, "CANDIDATE CURRICULUM VITAE")
    y = 720
    for line in content_text.split("\n"):
        if line.strip():
            c.drawString(100, y, line.strip())
            y -= 25
    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer.getvalue()


@pytest.fixture
def sample_pdf_bytes():
    resume_text = (
        "John Doe - Senior Data Developer\n"
        "Experience: 4 years of experience building data pipelines in Python and SQL.\n"
        "Proficient with Docker, Apache Spark, and AWS cloud infrastructure.\n"
        "Education: Bachelor's Degree in Computer Science, University of Malaya."
    )
    return create_sample_resume_pdf(resume_text)


def test_extract_text_from_pdf(sample_pdf_bytes):
    text, pages = extract_text_from_pdf(sample_pdf_bytes)
    assert pages >= 1
    assert "John Doe" in text
    assert "Python" in text
    assert "SQL" in text


def test_empty_pdf_raises_error():
    with pytest.raises(PDFExtractionError):
        extract_text_from_pdf(b"")


def test_corrupt_pdf_raises_error():
    with pytest.raises(PDFExtractionError):
        extract_text_from_pdf(b"This is not a valid PDF binary stream!")


def test_resume_parser_skills_and_evidence(sample_pdf_bytes):
    parser = ResumeParser()
    result = parser.parse_resume(sample_pdf_bytes)

    assert result["has_extractable_text"] is True
    assert result["page_count"] >= 1
    assert "Python" in result["extracted_skills"]
    assert "SQL" in result["extracted_skills"]
    assert "Docker" in result["extracted_skills"]
    assert "AWS" in result["extracted_skills"]
    assert "Apache Spark" in result["extracted_skills"]

    # Verify evidence tracking
    assert "Python" in result["skill_evidence"]
    assert result["experience_years"] == 4.0
    assert result["detected_education"] == "Bachelor's Degree"


def test_api_upload_resume(sample_pdf_bytes):
    client = TestClient(app)
    response = client.post(
        "/profile/upload-resume",
        files={"file": ("my_resume.pdf", sample_pdf_bytes, "application/pdf")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["filename"] == "my_resume.pdf"
    assert "Python" in data["extracted_skills"]
    assert data["experience_years"] == 4.0


def test_api_match_resume(sample_pdf_bytes):
    client = TestClient(app)
    response = client.post(
        "/roles/match-resume",
        files={"file": ("candidate_cv.pdf", sample_pdf_bytes, "application/pdf")},
        data={"top_k": 3}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["method"] == "deterministic_matching_from_resume"
    assert "disclaimer" in data
    assert len(data["ranked_matches"]) == 3

    # Data Engineer should score highly given Python, SQL, Spark, and AWS
    de_match = next((m for m in data["ranked_matches"] if m["role"] == "Data Engineer"), None)
    assert de_match is not None
    assert de_match["match_score"] > 30.0


def test_api_roadmap_generate_from_resume(sample_pdf_bytes):
    client = TestClient(app)
    response = client.post(
        "/roadmap/generate-from-resume",
        files={"file": ("candidate_cv.pdf", sample_pdf_bytes, "application/pdf")},
        data={"target_role": "Data Engineer", "max_courses": 4}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["target_role"] == "Data Engineer"
    assert data["pathway_ordering_label"] == "heuristic, not a validated sequence"
    assert "ordering_disclaimer" in data
    assert len(data["sdg_alignments"]) > 0


def test_api_upload_resume_invalid_filetype():
    client = TestClient(app)
    response = client.post(
        "/profile/upload-resume",
        files={"file": ("document.txt", b"Plain text file", "text/plain")}
    )
    assert response.status_code == 400
    assert "Only PDF resume files (.pdf) are supported" in response.json()["detail"]


def test_api_skill_gap_from_resume(sample_pdf_bytes):
    client = TestClient(app)
    response = client.post(
        "/skills/gap-resume",
        files={"file": ("candidate_cv.pdf", sample_pdf_bytes, "application/pdf")},
        data={"target_role": "Data Engineer"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["target_role"] == "Data Engineer"
    assert data["evidence_sample_size"] == 104
    assert "Python" in data["extracted_skills"]
    assert "SQL" in data["extracted_skills"]
    assert len(data["matched_skills"]) >= 2
    assert "Python" in [m["skill"] for m in data["matched_skills"]]
    assert data["coverage_percentage"] > 0
    assert data["method"] == "deterministic_skill_gap_from_resume"


def test_api_skill_gap_json():
    client = TestClient(app)
    response = client.post(
        "/skills/gap",
        json={"target_role": "Data Engineer", "current_skills": ["Python", "SQL"]}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["target_role"] == "Data Engineer"
    assert data["evidence_sample_size"] == 104
    assert len(data["matched_skills"]) >= 2
    assert data["coverage_percentage"] > 0
    assert data["method"] == "deterministic_skill_gap"

