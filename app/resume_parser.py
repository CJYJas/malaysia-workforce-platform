"""
PDF Resume Parser for Malaysia Tech Workforce Intelligence Platform.
Extracts raw text from PDF resume uploads and applies dictionary-based skill extraction
with evidence retention to support automated role matching and skill-gap analysis.
"""

import io
import re
import logging
from typing import Dict, List, Optional, Tuple, Any
import pypdf
try:
    import fitz  # PyMuPDF
    HAVE_FITZ = True
except ImportError:
    HAVE_FITZ = False

from app.config import Config, load_config
from app.skill_normalizer import SkillNormalizer
from app.skill_extractor import SkillExtractor

logger = logging.getLogger(__name__)


class PDFExtractionError(ValueError):
    """Raised when PDF bytes cannot be parsed or decoded."""
    pass


def extract_text_from_pdf(pdf_bytes: bytes) -> Tuple[str, int]:
    """
    Extracts text and page count from raw PDF bytes.
    Uses PyMuPDF (fitz) if available for speed and layout fidelity,
    falling back to pypdf.
    
    Args:
        pdf_bytes: Raw bytes of the uploaded PDF file.
        
    Returns:
        Tuple of (extracted_text, page_count).
        
    Raises:
        PDFExtractionError: If PDF structure is invalid or corrupt.
    """
    if not pdf_bytes or len(pdf_bytes) == 0:
        raise PDFExtractionError("Uploaded PDF file is empty (0 bytes).")

    full_text_parts = []
    page_count = 0

    if HAVE_FITZ:
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            page_count = len(doc)
            for page in doc:
                text = page.get_text()
                if text:
                    full_text_parts.append(text)
            doc.close()
        except Exception as e:
            logger.warning("PyMuPDF failed to extract text (%s). Attempting pypdf fallback.", e)
            full_text_parts = []

    # Fallback to pypdf if PyMuPDF was unavailable or returned empty text
    if not full_text_parts:
        try:
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            page_count = len(reader.pages)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    full_text_parts.append(text)
        except Exception as e:
            logger.error("Failed to parse PDF bytes: %s", e)
            raise PDFExtractionError(f"Corrupt or invalid PDF file format: {e}")

    extracted_text = "\n".join(full_text_parts).strip()
    return extracted_text, page_count


class ResumeParser:
    """
    Parses PDF resumes into structured candidate profiles containing
    canonical skills, verbatim matched evidence, and detected experience.
    """

    def __init__(
        self,
        config: Optional[Config] = None,
        extractor: Optional[SkillExtractor] = None,
        normalizer: Optional[SkillNormalizer] = None
    ):
        self.config = config or load_config()
        self.normalizer = normalizer or SkillNormalizer(config=self.config)
        self.extractor = extractor or SkillExtractor(normalizer=self.normalizer, config=self.config)

    def extract_experience_years(self, text: str) -> Optional[float]:
        """Heuristically extracts years of experience mentioned in resume text."""
        # Matches patterns like "3 years of experience", "5+ years experience", "2 yrs in software"
        pattern = re.compile(
            r"(?i)\b(\d{1,2}(?:\.\d)?)\+?\s*(?:years?|yrs?)(?:\s+(?:of\s+)?experience|\s+in\b|\s+working)?",
            re.IGNORECASE
        )
        matches = pattern.findall(text)
        if matches:
            try:
                years = [float(m) for m in matches if 0 < float(m) <= 50]
                if years:
                    return max(years)  # Return the maximum cited experience span
            except Exception:
                pass
        return None

    def detect_education(self, text: str) -> Optional[str]:
        """Detects standard degree levels mentioned in resume text."""
        text_lower = text.lower()
        if re.search(r"\b(ph\.?d|doctorate|doctor of philosophy)\b", text_lower):
            return "Doctorate"
        if re.search(r"\b(master'?s?|m\.?sc|m\.?tech|mba)\b", text_lower):
            return "Master's Degree"
        if re.search(r"\b(bachelor'?s?|b\.?sc|b\.?tech|b\.?eng|undergraduate)\b", text_lower):
            return "Bachelor's Degree"
        if re.search(r"\b(diploma|associate'?s?)\b", text_lower):
            return "Diploma"
        return None

    def parse_resume(self, pdf_bytes: bytes) -> Dict[str, Any]:
        """
        Parses PDF resume bytes into a structured candidate profile.
        
        Args:
            pdf_bytes: Raw bytes from uploaded PDF file.
            
        Returns:
            Dict containing page_count, extracted_skills, skill_evidence,
            experience_years, and education.
        """
        raw_text, page_count = extract_text_from_pdf(pdf_bytes)

        if not raw_text.strip():
            logger.warning("PDF uploaded has no extractable text (possibly a scanned image).")
            return {
                "has_extractable_text": False,
                "page_count": page_count,
                "text_length": 0,
                "extracted_skills": [],
                "skill_evidence": {},
                "skill_count": 0,
                "experience_years": None,
                "detected_education": None,
                "warning": "No readable text found in PDF. Scanned images without OCR are not supported."
            }

        # Extract skills and evidence maps using our dictionary-based extractor
        evidence_map = self.extractor.extract_with_evidence(raw_text)
        canonical_skills = sorted(list(evidence_map.keys()))
        exp_years = self.extract_experience_years(raw_text)
        education = self.detect_education(raw_text)

        return {
            "has_extractable_text": True,
            "page_count": page_count,
            "text_length": len(raw_text),
            "extracted_skills": canonical_skills,
            "skill_evidence": evidence_map,
            "skill_count": len(canonical_skills),
            "experience_years": exp_years,
            "detected_education": education,
            "warning": None
        }
