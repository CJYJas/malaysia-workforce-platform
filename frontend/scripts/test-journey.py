"""Available proof-of-concept suite; no private data or external writes."""
import copy
import json
import math
import os
import unittest
import urllib.error
import urllib.request

DOMAIN = os.environ.get("REPLIT_DEV_DOMAIN")
BASE = os.environ.get("JOURNEY_API_URL", f"https://{DOMAIN}/api/journey" if DOMAIN else "http://localhost:5000/api/journey")
PROFILE = {
    "skills": [{"name": "Python", "level": 2}, {"name": "SQL", "level": 2}],
    "experience_years": 2,
    "interests": ["Working with data"],
    "hours_per_week": 6,
}


def request(path, data=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, json.load(error)


def payload(profile=None, scenario="balanced", role_id=None):
    body = {"profile": copy.deepcopy(profile or PROFILE), "scenario": scenario}
    if role_id is not None:
        body["role_id"] = role_id
    return body


class JourneyContract(unittest.TestCase):
    def test_catalog_and_all_seventeen_goals(self):
        status, catalog = request("/catalog")
        self.assertEqual(status, 200)
        self.assertEqual({s["id"] for s in catalog["sdgs"]}, set(range(1, 18)))
        self.assertEqual(len(catalog["roles"]), 5)
        self.assertIn("Python", catalog["skills"])
        self.assertIn("browser", catalog["privacy_note"])
        for goal in catalog["sdgs"]:
            self.assertEqual(goal["url"], f'https://sdgs.un.org/goals/goal{goal["id"]}')

    def test_match_score_components_and_skill_gaps(self):
        status, result = request("/matches", payload())
        self.assertEqual(status, 200)
        self.assertEqual(len(result["roles"]), 5)
        scores = [r["score"] for r in result["roles"]]
        self.assertEqual(scores, sorted(scores, reverse=True))
        self.assertIn("not a hiring probability", result["methodology"])
        for role in result["roles"]:
            self.assertEqual(sum(role["components"].values()), role["score"])
            self.assertTrue(0 <= role["score"] <= 100)
            self.assertTrue(role["sdgs"])
            for gap in role["gaps"]:
                self.assertTrue(gap["sdgs"])
                self.assertLess(gap["current_level"], gap["target_level"])
            self.assertEqual(role["sample_warning"], role["postings"] < 50)

    def test_newcomer_is_supported(self):
        p = copy.deepcopy(PROFILE)
        p["skills"], p["experience_years"] = [], 0
        status, result = request("/matches", payload(p))
        self.assertEqual(status, 200)
        self.assertTrue(all(r["components"]["skills"] == 0 for r in result["roles"]))
        self.assertTrue(all(len(r["gaps"]) == 10 for r in result["roles"]))

    def test_duplicate_skills_and_aliases_cannot_inflate(self):
        _, first = request("/matches", payload())
        p = copy.deepcopy(PROFILE)
        p["skills"] += [{"name": "python", "level": 2}, {"name": " Python ", "level": 1}]
        _, duplicate = request("/matches", payload(p))
        self.assertEqual(first["roles"], duplicate["roles"])

    def test_unrecognised_skills_are_explicit_and_unscored(self):
        _, first = request("/matches", payload())
        p = copy.deepcopy(PROFILE)
        p["skills"].append({"name": "Unindexed test skill", "level": 3})
        _, result = request("/matches", payload(p))
        self.assertEqual(first["roles"], result["roles"])
        self.assertIn("Unindexed test skill", result["unrecognised_skills"])

    def test_working_skill_removes_gap(self):
        p = copy.deepcopy(PROFILE)
        p["skills"][0]["level"] = 1
        _, beginner = request("/matches", payload(p))
        _, working = request("/matches", payload())
        a = next(r for r in beginner["roles"] if r["id"] == "data-scientist")
        b = next(r for r in working["roles"] if r["id"] == "data-scientist")
        self.assertGreater(b["score"], a["score"])
        self.assertIn("Python", [g["skill"] for g in a["gaps"]])
        self.assertNotIn("Python", [g["skill"] for g in b["gaps"]])

    def test_all_three_scenarios_are_real_assumptions(self):
        outputs = []
        for scenario in ["balanced", "ai_acceleration", "human_centred"]:
            status, result = request("/matches", payload(scenario=scenario))
            self.assertEqual(status, 200)
            self.assertEqual(result["scenario"], scenario)
            outputs.append({r["id"]: r["score"] for r in result["roles"]})
        self.assertNotEqual(outputs[0], outputs[1])

    def test_invalid_profile_inputs_are_rejected(self):
        for key, value in [("skills", "Python"), ("interests", []), ("interests", ["Unknown"]),
                           ("experience_years", -1), ("hours_per_week", 0),
                           ("skills", [{"name": "   ", "level": 2}]),
                           ("skills", [{"name": "Python", "level": 9}])]:
            p = copy.deepcopy(PROFILE)
            p[key] = value
            self.assertEqual(request("/matches", payload(p))[0], 400, key)
        self.assertEqual(request("/matches", payload(scenario="certain_future"))[0], 400)
        self.assertEqual(request("/matches", {})[0], 400)

    def test_pathway_order_time_resources_and_sdgs(self):
        _, catalog = request("/catalog")
        for role in catalog["roles"]:
            status, plan = request("/pathway", payload(role_id=role["id"]))
            self.assertEqual(status, 200)
            self.assertEqual(plan["role"]["id"], role["id"])
            self.assertEqual(plan["steps"][-1]["kind"], "project")
            self.assertEqual(plan["total_hours"], sum(s["hours"] for s in plan["steps"]))
            self.assertEqual(plan["weeks"], math.ceil(plan["total_hours"] / PROFILE["hours_per_week"]))
            elapsed = 0
            for step in plan["steps"]:
                self.assertEqual(step["start_week"], elapsed // PROFILE["hours_per_week"] + 1)
                elapsed += step["hours"]
                self.assertEqual(step["end_week"], math.ceil(elapsed / PROFILE["hours_per_week"]))
                self.assertTrue(step["sdgs"])
                self.assertTrue(step["resources"])
                self.assertIn("Free", step["resources"][0]["cost"])
                self.assertTrue(step["resources"][0]["url"].startswith("https://"))
                for course in step["catalog_courses"]:
                    self.assertTrue(course["url"].startswith("https://"))
                    self.assertTrue(course["source_record"])
            self.assertNotIn("Python", [s["skill"] for s in plan["steps"]])

    def test_plan_identity_and_pacing(self):
        _, plan = request("/pathway", payload(role_id="data-engineer"))
        _, same = request("/pathway", payload(role_id="data-engineer"))
        self.assertEqual(plan["plan_id"], same["plan_id"])
        p = copy.deepcopy(PROFILE)
        p["hours_per_week"] = 2
        _, slower = request("/pathway", payload(p, role_id="data-engineer"))
        self.assertNotEqual(plan["plan_id"], slower["plan_id"])
        self.assertGreater(slower["weeks"], plan["weeks"])
        _, scenario = request("/pathway", payload(scenario="ai_acceleration", role_id="data-engineer"))
        self.assertNotEqual(plan["plan_id"], scenario["plan_id"])

    def test_fully_declared_role_still_gets_project(self):
        snapshot_path = "artifacts/api-server/src/data/workforce-snapshot.json"
        with open(snapshot_path) as f:
            source = json.load(f)
        p = copy.deepcopy(PROFILE)
        p["skills"] = [{"name": s["skill"], "level": 2} for s in source["demands"]["Data Engineer"]["skills"]]
        _, plan = request("/pathway", payload(p, role_id="data-engineer"))
        self.assertEqual(plan["role"]["score"], 100)
        self.assertEqual(len(plan["steps"]), 1)
        self.assertEqual(plan["steps"][0]["kind"], "project")

    def test_unknown_role_rejected(self):
        self.assertEqual(request("/pathway", payload(role_id="does-not-exist"))[0], 400)

    def test_signal_provenance_and_both_directions(self):
        status, report = request("/signals")
        self.assertEqual(status, 200)
        self.assertIn("weforum.org", report["source_url"])
        self.assertEqual(report["published_at"], "2025-01-07")
        self.assertIn("Global", report["scope"])
        self.assertTrue(report["retrieved_at"])
        self.assertTrue(report["checked_at"])
        self.assertEqual({(s["kind"], s["direction"]) for s in report["signals"]},
                         {("role", "rising"), ("role", "declining"), ("skill", "rising"), ("skill", "declining")})
        self.assertTrue(all(s["sdgs"] for s in report["signals"]))
        self.assertEqual(request("/signals?refresh=garbage")[0], 400)


if __name__ == "__main__":
    unittest.main(verbosity=2)
