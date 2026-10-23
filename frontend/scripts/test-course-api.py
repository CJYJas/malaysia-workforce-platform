"""Read-only catalogue contract checks against the running development API."""
import json
import os
import unittest
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen

DOMAIN = os.environ.get("REPLIT_DEV_DOMAIN")
BASE = os.environ.get("COURSE_API_URL", f"https://{DOMAIN}/api/workforce/course-catalog" if DOMAIN else "http://localhost:80/api/workforce/course-catalog")


def request(path="", params=None):
    url = BASE + path + ("?" + urlencode(params) if params else "")
    try:
        with urlopen(url) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        return error.code, json.load(error)


class CourseApi(unittest.TestCase):
    def test_public_skill_sdg_mappings_preserve_the_existing_intake_vocabulary(self):
        with urlopen(BASE.rsplit("/workforce/course-catalog", 1)[0] + "/journey/catalog") as response:
            catalog = json.load(response)
        self.assertTrue(all(isinstance(skill, str) for skill in catalog["skills"]))
        self.assertEqual({row["skill"] for row in catalog["skill_sdgs"]}, set(catalog["skills"]))
        self.assertTrue(any(goal["id"] == 9 for row in catalog["skill_sdgs"] for goal in row["sdgs"]))
        official = {goal["id"]: goal for goal in catalog["sdgs"]}
        for row in catalog["skill_sdgs"]:
            for goal in row["sdgs"]:
                self.assertEqual(goal["title"], official[goal["id"]]["title"])
                self.assertEqual(goal["url"], official[goal["id"]]["url"])
                self.assertTrue(goal["reason"])

    def test_counts_are_independent_and_pagination_is_disjoint(self):
        status, page = request()
        self.assertEqual(status, 200)
        self.assertEqual((page["indexed_total"], page["source_total"], page["total"]), (205, 8370, 205))
        self.assertEqual(len(page["items"]), 20)
        status, second = request(params={"page": 2})
        self.assertEqual(status, 200)
        self.assertFalse({c["id"] for c in page["items"]} & {c["id"] for c in second["items"]})

    def test_title_skill_and_metadata_filters_use_real_records(self):
        status, page = request(params={"q": "JavaScript", "skill": "JavaScript", "provider": "IBM", "level": "Beginner level"})
        self.assertEqual(status, 200)
        self.assertGreater(page["total"], 0)
        self.assertTrue(all(c["provider"] == "IBM" and c["level"] == "Beginner level" for c in page["items"]))

    def test_detail_is_the_exact_indexed_record(self):
        _, page = request()
        original = page["items"][0]
        status, detail = request("/" + original["id"])
        self.assertEqual(status, 200)
        self.assertEqual(detail, original)
        self.assertTrue(detail["indexed_skills"])

    def test_empty_results_and_missing_record_are_explicit(self):
        status, page = request(params={"q": "not-a-real-course-99218"})
        self.assertEqual(status, 200)
        self.assertEqual((page["total"], page["items"]), (0, []))
        self.assertEqual(request("/missing-course")[0], 404)

    def test_invalid_queries_fail_instead_of_becoming_silent_defaults(self):
        for params in [{"page": 0}, {"page_size": 51}, {"page": 1.5}, {"page": "abc"}, {"provider": "not-recorded"}, {"level": "Superhero"}, {"q": "a" * 121}]:
            with self.subTest(params=params):
                self.assertEqual(request(params=params)[0], 400)


if __name__ == "__main__":
    unittest.main()
