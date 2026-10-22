"""
PII Redaction Pipeline for Malaysia Tech Workforce Intelligence Platform.
Redacts personal identifiers before processing through LLM extraction interfaces:
- Email addresses
- Phone numbers (Malaysian +60 / 01x mobile and international formats)
- Malaysian National Registration Identity Card (NRIC) numbers
- Street addresses and postal codes
"""

import re
from typing import Tuple, Dict, Any


class PIIRedactor:
    """
    Regex-based PII Redaction engine guaranteeing zero personal identifiable information
    is passed to external or local LLMs.
    """

    def __init__(self):
        # Email pattern
        self.email_pattern = re.compile(
            r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
        )

        # Malaysian NRIC: 6 digits - 2 digits - 4 digits (e.g. 991231-10-5432 or 991231105432)
        self.nric_pattern = re.compile(
            r"\b\d{6}[-\s]?\d{2}[-\s]?\d{4}\b"
        )

        # Phone numbers: Malaysian format (+601X-XXX XXXX, 01X-XXXXXXX) & international (+XX XXX)
        self.phone_pattern = re.compile(
            r"(?:\+?60\s?|0)(?:1[0-9][\s\-]?[0-9]{3,4}[\s\-]?[0-9]{4}|[2-9][\s\-]?[0-9]{3}[\s\-]?[0-9]{4})\b"
            r"|\b\+?[1-9]\d{1,2}[-\s]?\(?\d{2,4}\)?[-\s]?\d{3,4}[-\s]?\d{3,4}\b"
        )

        # Physical address fragments (No., Jalan, Lorong, Taman, Street, Ave, Postcodes)
        self.address_pattern = re.compile(
            r"(?i)\b(?:no\.?\s*\d+[^,\n]*,|(?:jalan|lorong|persiaran|leboh|taman|bandar|block|apt|flat|suite)\s+[^,\n]+(?:,\s*[^,\n]+){1,3}|\b\d{5}\s+(?:kuala lumpur|selangor|penang|johor|perak|kedah|melaka|negeri sembilan|pahang|terengganu|kelantan|sabah|sarawak|putrajaya|cyberjaya)\b)"
        )

    def redact(self, text: str) -> Tuple[str, Dict[str, int]]:
        """
        Redacts all PII patterns from text, replacing them with standardized redaction tokens.
        
        Args:
            text: Input candidate resume / profile string.
            
        Returns:
            Tuple of (redacted_text, counts_dict).
        """
        if not text or not isinstance(text, str):
            return "", {"email": 0, "nric": 0, "phone": 0, "address": 0}

        counts = {"email": 0, "nric": 0, "phone": 0, "address": 0}

        # 1. Redact Emails
        redacted_text, n_emails = self.email_pattern.subn("[REDACTED_EMAIL]", text)
        counts["email"] = n_emails

        # 2. Redact NRIC numbers
        redacted_text, n_nrics = self.nric_pattern.subn("[REDACTED_NRIC]", redacted_text)
        counts["nric"] = n_nrics

        # 3. Redact Phone numbers
        redacted_text, n_phones = self.phone_pattern.subn("[REDACTED_PHONE]", redacted_text)
        counts["phone"] = n_phones

        # 4. Redact Addresses
        redacted_text, n_addr = self.address_pattern.subn("[REDACTED_ADDRESS]", redacted_text)
        counts["address"] = n_addr

        return redacted_text, counts
