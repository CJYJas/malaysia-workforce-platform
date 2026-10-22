"""Contract/invariant checks for the whole read-only milestone; no UI automation."""
import json
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = json.loads(
    (ROOT / "artifacts/api-server/src/data/workforce-snapshot.json").read_text()
)
BASE = "http://localhost:80/api/workforce"


def request(path, params=None):
    url = BASE + path + ("?" + urlencode(params) if params else "")
    try:
        with urlopen(url, timeout=15) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, json.load(error)


class SnapshotInvariants(unittest.TestCase):
    def test_role_totals_are_separate_from_overall_market(self):
        overview = SNAPSHOT["overview"]
        self.assertEqual(sum(r["postings"] for r in overview["roles"]), overview["target_postings"])
        self.assertLess(overview["target_postings"], overview["total_postings"])

    def test_processing_counts_reconcile(self):
        o = SNAPSHOT["overview"]
        self.assertEqual(o["raw_postings"] - o["excluded_postings"] - o["duplicates_removed"],
                         o["total_postings"])

    def test_posting_shares_are_computed_from_denominators(self):
        for demand in SNAPSHOT["demands"].values():
            for skill in demand["skills"]:
                self.assertGreaterEqual(skill["mention_count"], 0)
                self.assertLessEqual(skill["mention_count"], demand["denominator"])
                self.assertAlmostEqual(skill["posting_share_percentage"],
                                       skill["mention_count"] / demand["denominator"] * 100)
                self.assertAlmostEqual(skill["posting_share"], skill["posting_share_percentage"] / 100)

    def test_ranks_are_sorted_and_not_duplicate_mentions(self):
        for demand in SNAPSHOT["demands"].values():
            skills = demand["skills"]
            self.assertEqual([s["rank"] for s in skills], list(range(1, len(skills) + 1)))
            counts = [s["mention_count"] for s in skills]
            self.assertEqual(counts, sorted(counts, reverse=True))

    def test_sample_thresholds_come_from_imported_source_config(self):
        audit = json.loads((ROOT / "docs/source-inventory.json").read_text())
        threshold = audit["thresholds"]["sample_warning"]
        for demand in SNAPSHOT["demands"].values():
            self.assertEqual(demand["sample_size_warning"], demand["denominator"] < threshold)

    def test_trends_are_not_inferred_from_global_coverage(self):
        self.assertEqual(SNAPSHOT["overview"]["trend_status"], "unavailable")

    def test_courses_have_source_records_and_safe_urls(self):
        for result in SNAPSHOT["courses"].values():
            self.assertGreaterEqual(result["total_matches"], len(result["courses"]))
            for course in result["courses"]:
                self.assertGreater(course["source_record"], 0)
                self.assertTrue(course["title"].strip())
                if course["url"]:
                    self.assertTrue(course["url"].startswith((
                        "https://www.coursera.org/", "https://coursera.org/"
                    )))


class ApiContract(unittest.TestCase):
    def test_overview(self):
        status, data = request("/overview")
        self.assertEqual(status, 200)
        self.assertEqual(data, SNAPSHOT["overview"])

    def test_all_supported_roles(self):
        for role, expected in SNAPSHOT["demands"].items():
            with self.subTest(role=role):
                status, data = request("/demand", {"role": role})
                self.assertEqual(status, 200)
                self.assertEqual(data, expected)

    def test_invalid_role_inputs(self):
        for value in [None, "", "unrecognized", "__proto__", "constructor"]:
            with self.subTest(value=value):
                status, _ = request("/demand", {"role": value} if value is not None else None)
                self.assertEqual(status, 400)

    def test_indexed_course_lookup_and_case_normalization(self):
        skill = next(iter(SNAPSHOT["courses"]))
        status, data = request("/courses", {"skill": skill.lower()})
        self.assertEqual(status, 200)
        self.assertEqual(data, SNAPSHOT["courses"][skill])

    def test_unknown_skill_has_explicit_empty_state(self):
        status, data = request("/courses", {"skill": "unindexed-skill"})
        self.assertEqual(status, 200)
        self.assertEqual(data["courses"], [])
        self.assertIn("indexed", data["disclaimer"])

    def test_empty_skill_is_rejected(self):
        for value in [None, "", " "]:
            with self.subTest(value=value):
                status, _ = request("/courses", {"skill": value} if value is not None else None)
                self.assertEqual(status, 400)


if __name__ == "__main__":
    unittest.main(verbosity=2)
