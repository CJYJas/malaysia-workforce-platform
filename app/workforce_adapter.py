"""
Workforce & Career Journey Snapshot Adapter for FastAPI.

Ports and unifies the workforce overview, course catalog, and career journey
services directly into FastAPI so that the platform runs self-contained without
requiring a separate Node.js server.
"""

import os
import re
import json
import math
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Union
from fastapi import APIRouter, Query, HTTPException, Request, Response, status
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Workforce & Journey"])

# Locate snapshot data files
_DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "workforce_data")
if not os.path.isdir(_DATA_DIR):
    _DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "artifacts", "api-server", "src", "data")

_CONFIG_DIR = _DATA_DIR
if not os.path.exists(os.path.join(_CONFIG_DIR, "journey.json")):
    _CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "config")

def _load_json(filename: str, fallback_dir: str = _DATA_DIR) -> Dict[str, Any]:
    paths = [
        os.path.join(_DATA_DIR, filename),
        os.path.join(fallback_dir, filename),
        os.path.join("/workspace/app/workforce_data", filename),
        os.path.join("/workspace/frontend/artifacts/api-server/src/data", filename),
        os.path.join("/workspace/frontend/config", filename),
    ]
    for p in paths:
        if os.path.isfile(p):
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
    logger.error(f"Snapshot data file {filename} not found in searched paths: {paths}")
    return {}

workforce_snapshot: Dict[str, Any] = _load_json("workforce-snapshot.json")
outlook_snapshot: Dict[str, Any] = _load_json("outlook-snapshot.json")
journey_config: Dict[str, Any] = _load_json("journey.json", fallback_dir=_CONFIG_DIR)

# Constants & Mappings
COURSE_INDEX_SCOPE = "Indexed from Malaysian tech workforce courses snapshot"

role_id_map: Dict[str, str] = {
    "software-developer": "Software Engineer / Developer",
    "data-engineer": "Data Engineer",
    "data-scientist": "Data Scientist",
    "ai-engineer": "Machine Learning / AI Engineer",
    "cloud-engineer": "Cloud Engineer",
}

role_name_to_id: Dict[str, str] = {
    "Software Engineer / Developer": "software-developer",
    "Data Engineer": "data-engineer",
    "Data Scientist": "data-scientist",
    "Machine Learning / AI Engineer": "ai-engineer",
    "Cloud Engineer": "cloud-engineer",
}

aliases: Dict[str, str] = {
    "js": "javascript",
    "structured query language": "sql",
    "py": "python",
    "ml": "machine learning",
    "ai": "artificial intelligence",
}

goal_titles: Dict[int, str] = {
    1: "No Poverty",
    2: "Zero Hunger",
    3: "Good Health and Well-being",
    4: "Quality Education",
    5: "Gender Equality",
    6: "Clean Water and Sanitation",
    7: "Affordable and Clean Energy",
    8: "Decent Work and Economic Growth",
    9: "Industry, Innovation and Infrastructure",
    10: "Reduced Inequalities",
    11: "Sustainable Cities and Communities",
    12: "Responsible Consumption and Production",
    13: "Climate Action",
    14: "Life Below Water",
    15: "Life on Land",
    16: "Peace, Justice and Strong Institutions",
    17: "Partnerships for the Goals",
}

def build_course_index(courses: Dict[str, Any]) -> List[Dict[str, Any]]:
    course_map: Dict[str, Dict[str, Any]] = {}
    for skill, group in courses.items():
        if not group or not isinstance(group, dict) or "courses" not in group:
            continue
        for course in group["courses"]:
            if not course or not isinstance(course, dict) or not course.get("id"):
                continue
            cid = str(course["id"])
            if cid in course_map:
                if skill not in course_map[cid]["indexed_skills"]:
                    course_map[cid]["indexed_skills"].append(skill)
            else:
                entry = dict(course)
                entry["indexed_skills"] = [skill]
                course_map[cid] = entry
    return list(course_map.values())

course_index: List[Dict[str, Any]] = build_course_index(workforce_snapshot.get("courses", {}))

def get_course_facets(index: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    providers_set = set()
    levels_set = set()
    skills_set = set()
    for item in index:
        if item.get("provider"):
            providers_set.add(item["provider"])
        if item.get("level"):
            levels_set.add(item["level"])
        for s in item.get("indexed_skills", []):
            skills_set.add(s)
    return {
        "providers": sorted(list(providers_set)),
        "levels": sorted(list(levels_set)),
        "skills": sorted(list(skills_set)),
    }

course_facets_data = get_course_facets(course_index)

def filter_course_index(index: List[Dict[str, Any]], q: Optional[str], provider: Optional[str], level: Optional[str], skill: Optional[str]) -> List[Dict[str, Any]]:
    q_clean = q.strip().lower() if q else None
    prov_clean = provider.strip().lower() if provider else None
    lvl_clean = level.strip().lower() if level else None
    sk_clean = skill.strip().lower() if skill else None

    result = []
    for item in index:
        if q_clean:
            match_title = q_clean in (item.get("title") or "").lower()
            match_skill = any(q_clean in s.lower() for s in item.get("indexed_skills", []))
            if not match_title and not match_skill:
                continue
        if prov_clean and (item.get("provider") or "").lower() != prov_clean:
            continue
        if lvl_clean and (item.get("level") or "").lower() != lvl_clean:
            continue
        if sk_clean and not any(s.lower() == sk_clean for s in item.get("indexed_skills", [])):
            continue
        result.append(item)
    return result

def build_sdg_obj(goal_id: int, reason: Optional[str] = None) -> Dict[str, Any]:
    title = goal_titles.get(goal_id, f"Goal {goal_id}")
    return {
        "id": goal_id,
        "title": title,
        "url": f"https://sdgs.un.org/goals/goal{goal_id}",
        "reason": reason or f"Editorial connection to UN Sustainable Development Goal {goal_id}: {title}",
    }

def normalize_interest(raw: str) -> str:
    if not raw or not isinstance(raw, str):
        return "Working with data"
    lower = raw.lower()
    if "product" in lower or "software" in lower:
        return "Building products"
    if "data" in lower:
        return "Working with data"
    if any(k in lower for k in ["ai", "artificial", "machine", "automation"]):
        return "AI and automation"
    if "cloud" in lower or "infrastructure" in lower:
        return "Cloud and infrastructure"
    if "people" in lower or "social" in lower:
        return "People and social impact"
    if "sustain" in lower:
        return "Sustainability"
    return raw

def canonical_skill_name(raw: str) -> str:
    clean = re.sub(r"\s+", " ", raw.strip()).lower()
    return aliases.get(clean, clean)

def has_role(role_id: str) -> bool:
    return any(r.get("id") == role_id for r in journey_config.get("roles", []))

def journey_catalog() -> Dict[str, Any]:
    sdgs = [
        {"id": i + 1, "name": f"Goal {i + 1}", "url": f"https://sdgs.un.org/goals/goal{i + 1}"}
        for i in range(17)
    ]
    skills_set = set()
    demands = workforce_snapshot.get("demands", {})
    for role_data in demands.values():
        if isinstance(role_data, dict) and "skills" in role_data:
            for s in role_data["skills"]:
                if "skill" in s:
                    skills_set.add(s["skill"])

    roles_with_sdgs = []
    for r in journey_config.get("roles", []):
        goals = r.get("goals") or [8, 9]
        roles_with_sdgs.append({
            **r,
            "sdgs": [build_sdg_obj(gid, f"This role aligns with UN SDG {gid}.") for gid in goals]
        })

    skill_sdgs = []
    for skill, goals in (journey_config.get("skill_goals") or {}).items():
        skill_sdgs.append({
            "skill": skill,
            "sdgs": [build_sdg_obj(gid, f"{skill} capability links with UN SDG {gid}.") for gid in goals]
        })

    return {
        "sdgs": sdgs,
        "roles": roles_with_sdgs,
        "skills": sorted(list(skills_set)),
        "skill_sdgs": skill_sdgs,
        "scenarios": journey_config.get("scenarios", []),
        "interests": journey_config.get("interests", []),
        "methodology": {
            "aliases": aliases,
            "note": "Match score is not a hiring probability; it reflects overlap with historical skill demand.",
        },
        "privacy_note": "All personal profile details remain private in your browser. Calculations run on the backend without saving your data.",
    }

def get_signal_report(refresh: bool = False) -> Dict[str, Any]:
    now = datetime.now(timezone.utc).isoformat()
    report = json.loads(json.dumps(outlook_snapshot))
    if refresh:
        report["checked_at"] = now
    signals = []
    for s in report.get("signals", []):
        sig = dict(s)
        if "sdgs" not in sig or not sig["sdgs"]:
            sig["sdgs"] = [8, 9]
        signals.append(sig)
    report["signals"] = signals
    return report

def match_profile(profile: Dict[str, Any], scenario_id: str = "balanced") -> Dict[str, Any]:
    scenarios = journey_config.get("scenarios", [])
    scenario = next((s for s in scenarios if s.get("id") == scenario_id), scenarios[0] if scenarios else {})
    boosts: Dict[str, float] = scenario.get("boosts", {})

    user_skills_raw = profile.get("skills", [])
    user_skill_levels: Dict[str, Dict[str, Any]] = {}
    for s in user_skills_raw:
        sname = s.get("name", "")
        slvl = float(s.get("level", 1))
        canon = canonical_skill_name(sname)
        existing = user_skill_levels.get(canon)
        if not existing or slvl > existing["level"]:
            user_skill_levels[canon] = {"originalName": sname.strip(), "level": slvl}

    demands: Dict[str, Any] = workforce_snapshot.get("demands", {})
    all_known_skills = set()
    for d in demands.values():
        if isinstance(d, dict) and "skills" in d:
            for s in d["skills"]:
                if "skill" in s:
                    all_known_skills.add(canonical_skill_name(s["skill"]))

    unrecognised = []
    for canon, info in user_skill_levels.items():
        if canon not in all_known_skills:
            unrecognised.append(info["originalName"])

    scoring_conf = journey_config.get("scoring", {"skills": 75, "interests": 15, "experience": 10, "target_level": 2})
    target_level = scoring_conf.get("target_level", 2)
    max_skill_comp = scoring_conf.get("skills", 75)
    max_interest_comp = scoring_conf.get("interests", 15)
    max_exp_comp = scoring_conf.get("experience", 10)

    overview_roles = workforce_snapshot.get("overview", {}).get("roles", [])

    role_matches = []
    for role_cfg in journey_config.get("roles", []):
        role_name = role_id_map.get(role_cfg["id"], role_cfg.get("name"))
        role_demand = demands.get(role_name, {})
        demand_skills = role_demand.get("skills", [])
        role_postings = next((r.get("postings", 0) for r in overview_roles if r.get("name") == role_name), 0)

        skill_points_total = 0.0
        max_skill_points = 0.0
        gaps = []
        matched_skills = []

        for d in demand_skills:
            d_skill = d.get("skill", "")
            canon = canonical_skill_name(d_skill)
            user_lvl = user_skill_levels.get(canon, {}).get("level", 0.0)
            boost = boosts.get(d_skill, 1.0)
            weight = (d.get("posting_share_percentage") or 1.0) * boost
            max_skill_points += weight

            if user_lvl >= target_level:
                skill_points_total += weight
                matched_skills.append(d_skill)
            else:
                if user_lvl > 0:
                    skill_points_total += weight * (user_lvl / target_level)
                raw_goals = (journey_config.get("skill_goals") or {}).get(d_skill, [8, 9])
                gaps.append({
                    "skill": d_skill,
                    "current_level": int(user_lvl),
                    "target_level": target_level,
                    "importance": "High" if weight >= 20 else "Standard",
                    "sdgs": [build_sdg_obj(gid, f"Advancing {d_skill} capability connects directly to UN SDG {gid}.") for gid in raw_goals]
                })

        skill_score = (skill_points_total / max_skill_points) * max_skill_comp if max_skill_points > 0 else 0.0

        role_interests = set(role_cfg.get("interests", []))
        user_interests = [normalize_interest(i) for i in profile.get("interests", [])]
        matching_interests = [i for i in user_interests if i in role_interests]
        interest_score = (len(matching_interests) / len(role_interests)) * max_interest_comp if role_interests else 0.0

        ref_years = role_cfg.get("reference_years", 2)
        exp_years = float(profile.get("experience_years", 0))
        exp_score = min(max_exp_comp, (exp_years / ref_years) * max_exp_comp if ref_years > 0 else 0.0)

        raw_total = round(skill_score + interest_score + exp_score)
        score = max(0, min(100, raw_total))
        c_skills = round(skill_score)
        c_interests = round(interest_score)
        c_exp = score - (c_skills + c_interests)

        role_desc = next((r.get("description") for r in overview_roles if r.get("name") == role_name), role_cfg.get("name"))

        role_matches.append({
            "id": role_cfg["id"],
            "name": role_cfg.get("name"),
            "description": role_desc,
            "score": score,
            "components": {
                "skills": c_skills,
                "interests": c_interests,
                "experience": c_exp,
            },
            "matched_skills": matched_skills,
            "gaps": gaps,
            "postings": role_postings,
            "sample_warning": role_postings < 50,
            "sdgs": [build_sdg_obj(gid, f"This role's responsibilities align with UN SDG {gid}.") for gid in (role_cfg.get("goals") or [8, 9])]
        })

    role_matches.sort(key=lambda x: x["score"], reverse=True)

    return {
        "roles": role_matches,
        "scenario": scenario_id,
        "unrecognised_skills": unrecognised,
        "methodology": "Match score is not a hiring probability; it reflects overlap with historical skill demand.",
    }

def learning_pathway(profile: Dict[str, Any], scenario_id: str, role_id: str) -> Dict[str, Any]:
    matches = match_profile(profile, scenario_id)
    target_role = next((r for r in matches["roles"] if r["id"] == role_id), None)
    role_cfg = next((r for r in journey_config.get("roles", []) if r["id"] == role_id), (journey_config.get("roles") or [{}])[0])
    hours_per_week = int(profile.get("hours_per_week") or 6)

    planning_conf = journey_config.get("planning", {"new_skill_hours": 20, "improve_skill_hours": 10, "project_hours": 12})
    new_skill_hours = planning_conf.get("new_skill_hours", 20)
    improve_skill_hours = planning_conf.get("improve_skill_hours", 10)
    project_hours = planning_conf.get("project_hours", 12)

    steps = []
    elapsed_hours = 0

    if target_role:
        for gap in target_role.get("gaps", []):
            is_new = gap["current_level"] == 0
            hours = new_skill_hours if is_new else improve_skill_hours
            start_week = math.floor(elapsed_hours / hours_per_week) + 1
            elapsed_hours += hours
            end_week = math.ceil(elapsed_hours / hours_per_week)

            skill_name = gap["skill"]
            group = workforce_snapshot.get("courses", {}).get(skill_name, {})
            raw_courses = group.get("courses", []) if isinstance(group, dict) else []
            catalog_courses = []
            for c in raw_courses[:3]:
                url = c.get("url", "")
                if not url or not url.startswith("http"):
                    url = f"https://www.coursera.org/learn/{c.get('id', 'course')}"
                catalog_courses.append({
                    "id": c.get("id"),
                    "title": c.get("title"),
                    "provider": c.get("provider"),
                    "url": url,
                    "level": c.get("level"),
                    "source_record": True,
                })

            step_id = f"step-{re.sub(r'[^a-z0-9]+', '-', skill_name.lower())}"
            steps.append({
                "id": step_id,
                "title": f"Learn {skill_name}",
                "summary": f"Develop working knowledge of {skill_name} required for {target_role.get('name', 'your target role')}.",
                "skill": skill_name,
                "kind": "skill",
                "hours": hours,
                "start_week": start_week,
                "end_week": end_week,
                "current_level": gap["current_level"],
                "target_level": gap["target_level"],
                "sdgs": gap.get("sdgs", []),
                "catalog_courses": catalog_courses,
                "resources": [
                    {
                        "title": f"{skill_name} Fundamentals & Documentation",
                        "url": "https://developer.mozilla.org",
                        "cost": "Free",
                    }
                ],
            })

    proj_start_week = math.floor(elapsed_hours / hours_per_week) + 1
    elapsed_hours += project_hours
    proj_end_week = math.ceil(elapsed_hours / hours_per_week)

    matched_first = (target_role.get("matched_skills") or ["Capstone"])[0] if target_role else "Capstone"
    steps.append({
        "id": f"project-{role_id}",
        "title": f"Practical Project: {role_cfg.get('name', role_id)}",
        "summary": role_cfg.get("project") or "Build a capstone project to demonstrate your skills.",
        "skill": matched_first,
        "kind": "project",
        "hours": project_hours,
        "start_week": proj_start_week,
        "end_week": proj_end_week,
        "description": role_cfg.get("project"),
        "sdgs": [build_sdg_obj(gid, f"Capstone project contributes to UN SDG {gid}.") for gid in (role_cfg.get("goals") or [8, 9])],
        "resources": [
            {
                "title": "Project Guidance & Standards",
                "url": "https://developer.mozilla.org",
                "cost": "Free",
            }
        ],
        "catalog_courses": [],
    })

    total_hours = sum(s["hours"] for s in steps)
    weeks = math.ceil(total_hours / hours_per_week)

    skills_hash = "|".join(sorted(f"{s.get('name', '').lower()}:{s.get('level', 1)}" for s in profile.get("skills", [])))
    plan_id = f"plan-{role_id}-{scenario_id}-{hours_per_week}-{skills_hash}"

    return {
        "plan_id": plan_id,
        "role": target_role or {"id": role_id, "name": role_cfg.get("name", role_id), "score": 0, "sdgs": []},
        "scenario": scenario_id,
        "hours_per_week": hours_per_week,
        "total_hours": total_hours,
        "weeks": weeks,
        "steps": steps,
        "notes": [
            "Learning hours and weeks are editorial planning estimates — not course-provider duration, a guaranteed completion date or a job outcome.",
            "Checklist progress is stored locally in your browser and does not change your readiness score."
        ],
    }


# ==============================================================================
# ROUTE ENDPOINTS
# ==============================================================================

@router.get("/healthz", include_in_schema=False)
async def healthz():
    return {"status": "ok"}


@router.get("/workforce/overview")
async def get_workforce_overview():
    overview = workforce_snapshot.get("overview")
    if not overview:
        raise HTTPException(status_code=500, detail="Workforce overview snapshot data unavailable.")
    return overview


@router.get("/workforce/demand")
async def get_workforce_demand(role: str = Query(..., description="Role title to look up")):
    role_clean = role.strip()
    if not role_clean:
        raise HTTPException(status_code=400, detail="A non-empty role query parameter is required.")
    demands = workforce_snapshot.get("demands", {})
    if role_clean not in demands:
        raise HTTPException(status_code=400, detail="Unknown role. Select a supported role from the overview.")
    return demands[role_clean]


@router.get("/workforce/courses")
async def get_workforce_courses(skill: str = Query(..., description="Skill name to query")):
    skill_clean = skill.strip()
    if not skill_clean:
        raise HTTPException(status_code=400, detail="A non-empty skill query parameter is required.")
    courses = workforce_snapshot.get("courses", {})
    matching_key = next((k for k in courses.keys() if k.lower() == skill_clean.lower()), None)
    if matching_key:
        return courses[matching_key]
    return {
        "skill": skill_clean,
        "courses": [],
        "total_matches": 0,
        "method": "Only skills present in the role snapshot have indexed course matches.",
        "disclaimer": "No indexed course records for this skill. This does not establish catalog-wide absence.",
    }


@router.get("/workforce/course-catalog")
async def get_course_catalog(
    q: Optional[str] = Query(None),
    provider: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    skill: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
):
    if provider:
        prov_clean = provider.strip().lower()
        if not any(p.lower() == prov_clean for p in course_facets_data["providers"]):
            raise HTTPException(status_code=400, detail="Unsupported provider filter. Choose a recorded facet.")
    if level:
        lvl_clean = level.strip().lower()
        if not any(l.lower() == lvl_clean for l in course_facets_data["levels"]):
            raise HTTPException(status_code=400, detail="Unsupported level filter. Choose a recorded facet.")

    filtered = filter_course_index(course_index, q, provider, level, skill)
    start_idx = (page - 1) * page_size
    items = filtered[start_idx : start_idx + page_size]

    return {
        "items": items,
        "total": len(filtered),
        "indexed_total": len(course_index),
        "source_total": workforce_snapshot.get("overview", {}).get("course_count", len(course_index)),
        "page": page,
        "page_size": page_size,
        "providers": course_facets_data["providers"],
        "levels": course_facets_data["levels"],
        "skills": course_facets_data["skills"],
        "scope_note": COURSE_INDEX_SCOPE,
    }


@router.get("/workforce/course-catalog/{course_id}")
async def get_course_detail(course_id: str):
    course = next((c for c in course_index if str(c.get("id")) == str(course_id)), None)
    if not course:
        raise HTTPException(status_code=404, detail="No course with this ID is present in the retained index.")
    return course


@router.get("/journey/catalog")
async def get_journey_catalog():
    return journey_catalog()


@router.get("/journey/signals")
async def get_journey_signals(response: Response, refresh: Optional[str] = Query(None)):
    if refresh is not None and refresh not in ("true", "false"):
        raise HTTPException(status_code=400, detail="refresh must be true or false")
    response.headers["Cache-Control"] = "no-store"
    return get_signal_report(refresh == "true")


class ProfileSkill(BaseModel):
    name: str
    level: int = 1


class ProfilePayload(BaseModel):
    skills: List[ProfileSkill] = []
    experience_years: float = 0.0
    interests: List[str] = []
    hours_per_week: Optional[int] = 6
    current_role: Optional[str] = None


class MatchJourneyRequest(BaseModel):
    profile: ProfilePayload
    scenario: Optional[str] = "balanced"


class PathwayJourneyRequest(BaseModel):
    profile: ProfilePayload
    scenario: Optional[str] = "balanced"
    role_id: str


@router.post("/journey/matches")
async def post_journey_matches(body: MatchJourneyRequest, response: Response):
    response.headers["Cache-Control"] = "no-store"
    profile_dict = body.profile.model_dump()
    if not profile_dict.get("interests"):
        raise HTTPException(status_code=400, detail="Provide a valid profile, at least one listed interest, and a supported scenario.")
    for s in profile_dict.get("skills", []):
        if not s.get("name", "").strip():
            raise HTTPException(status_code=400, detail="Provide valid skill names.")
    return match_profile(profile_dict, body.scenario or "balanced")


@router.post("/journey/pathway")
async def post_journey_pathway(body: PathwayJourneyRequest, response: Response):
    response.headers["Cache-Control"] = "no-store"
    profile_dict = body.profile.model_dump()
    if not has_role(body.role_id):
        raise HTTPException(status_code=400, detail="Unsupported role_id.")
    if not profile_dict.get("interests"):
        raise HTTPException(status_code=400, detail="Provide a valid profile, supported scenario and role.")
    for s in profile_dict.get("skills", []):
        if not s.get("name", "").strip():
            raise HTTPException(status_code=400, detail="Provide valid skill names.")
    return learning_pathway(profile_dict, body.scenario or "balanced", body.role_id)
