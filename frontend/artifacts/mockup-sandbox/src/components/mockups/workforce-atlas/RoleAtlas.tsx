import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BookOpen, ChevronRight, Compass, ExternalLink, Search, Sparkles } from "lucide-react";
import snapshot from "../workforce-after/_shared/snapshot.json";
import "./roleatlas.css";

type Role = (typeof snapshot.overview.roles)[number];
type Skill = (typeof snapshot.demands)[keyof typeof snapshot.demands]["skills"][number];

const colors = ["#d9ef72", "#f1a78c", "#88c7bb", "#b7a7e3", "#f2cb73"];

export default function RoleAtlas() {
  const [roleName, setRoleName] = useState(snapshot.overview.roles[0].name);
  const [activeSkill, setActiveSkill] = useState("");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const role = snapshot.overview.roles.find((item) => item.name === roleName) as Role;
  const demand = snapshot.demands[roleName as keyof typeof snapshot.demands];
  const skills = demand?.skills ?? [];
  const grouped = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = skills.filter((item) => !needle || item.skill.toLowerCase().includes(needle) || item.category.toLowerCase().includes(needle));
    return filtered.reduce<Record<string, Skill[]>>((groups, item) => {
      (groups[item.category] ??= []).push(item);
      return groups;
    }, {});
  }, [skills, search]);
  const selected = skills.find((item) => item.skill === activeSkill) ?? skills[0];
  const courseGroup = snapshot.courses[selected?.skill as keyof typeof snapshot.courses];
  const courses = courseGroup?.courses ?? [];
  const shownCourses = showAll ? courses : courses.slice(0, 3);

  return (
    <main className="atlas min-h-[100dvh] text-[#183a36]">
      <header className="atlas-top">
        <a className="atlas-brand" href="#top" aria-label="Fieldnotes home">
          <span className="brand-mark"><Compass size={17} strokeWidth={2.1} /></span>
          <span>FIELDNOTES<span className="brand-sub">WORKFORCE ATLAS</span></span>
        </a>
        <div className="top-meta"><span className="live-dot" /> MALAYSIA · HISTORICAL SNAPSHOT</div>
        <button className="top-action" onClick={() => { setRoleName(snapshot.overview.roles[0].name); setActiveSkill(""); setSearch(""); }}>
          Start over <ArrowUpRight size={15} />
        </button>
      </header>

      <div className="atlas-layout" id="top">
        <aside className="role-rail">
          <div className="rail-intro">
            <span className="eyebrow light">01 / PICK A DIRECTION</span>
            <h1>Where do<br />you want to<br /><em>go?</em></h1>
            <p>Start with a role. Follow the skills that show up in Malaysian job postings.</p>
          </div>
          <div className="role-list" aria-label="Choose a career role">
            {snapshot.overview.roles.map((item, index) => (
              <button className={`role-choice ${roleName === item.name ? "is-active" : ""}`} key={item.name} onClick={() => { setRoleName(item.name); setActiveSkill(""); }}>
                <span className="role-index">0{index + 1}</span>
                <span className="role-title">{item.name.replace(" / ", " / ")}</span>
                <span className="role-count">{item.postings.toLocaleString()}<small>posts</small></span>
                <ChevronRight className="role-chevron" size={15} />
              </button>
            ))}
          </div>
          <div className="rail-foot">
            <span className="rail-foot-icon"><Sparkles size={15} /></span>
            <span>Not a live vacancy feed.<br />A map of what employers named.</span>
          </div>
        </aside>

        <section className="atlas-main">
          <div className="main-head">
            <div>
              <div className="eyebrow"><span>02 / THE SKILL TERRAIN</span><span className="period">{demand.time_window}</span></div>
              <h2>{roleName}</h2>
              <p className="role-description">{role.description}</p>
            </div>
            <div className="post-count">
              <strong>{demand.denominator.toLocaleString()}</strong>
              <span>postings reviewed</span>
            </div>
          </div>

          {demand.warning_message && <div className="caution"><span>!</span>{demand.warning_message}</div>}

          <div className="terrain-tools">
            <div className="terrain-label"><span className="signal-dot" /> MOST MENTIONED SKILLS <i>·</i> {skills.length} OBSERVED</div>
            <label className="search-field">
              <Search size={15} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a skill or category" aria-label="Search skills" />
              {search && <button onClick={() => setSearch("")} aria-label="Clear search">×</button>}
            </label>
          </div>

          <div className="terrain">
            {Object.entries(grouped).map(([category, categorySkills], groupIndex) => (
              <section className="terrain-group" key={category}>
                <div className="group-heading">
                  <span className="group-marker" style={{ background: colors[groupIndex % colors.length] }} />
                  <h3>{category}</h3>
                  <span>{categorySkills.length.toString().padStart(2, "0")}</span>
                </div>
                <div className="skill-map">
                  {categorySkills.map((item) => {
                    const isSelected = (selected?.skill ?? "") === item.skill;
                    const share = Math.max(5, item.posting_share_percentage);
                    return (
                      <button
                        key={item.skill}
                        className={`skill-node ${isSelected ? "selected" : ""}`}
                        onClick={() => setActiveSkill(item.skill)}
                        aria-pressed={isSelected}
                      >
                        <span className="skill-node-top"><span>{item.skill}</span><span>{item.posting_share_percentage.toFixed(1)}%</span></span>
                        <span className="skill-meter"><i style={{ width: `${share}%`, background: colors[groupIndex % colors.length] }} /></span>
                        <span className="skill-evidence">{item.mention_count.toLocaleString()} of {demand.denominator.toLocaleString()} postings</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
            {Object.keys(grouped).length === 0 && <div className="no-results">No observed skills match “{search}”. Try another term.</div>}
          </div>
          <div className="method-note">
            <span className="note-mark">i</span>
            <span>{demand.scope_note} An unlisted skill is <strong>unobserved</strong> here — not evidence of zero demand.</span>
          </div>
          <div className="coverage-line">
            <span>DATA WINDOW</span>
            <span>{snapshot.overview.coverage_start.slice(0, 10)} <i>—</i> {snapshot.overview.coverage_end.slice(0, 10)}</span>
            <span className="trend-chip">TREND UNAVAILABLE</span>
          </div>
        </section>

        <aside className="learning-panel">
          <div className="learning-head">
            <div className="eyebrow light">03 / MAKE IT REAL</div>
            <div className="learning-icon"><BookOpen size={20} /></div>
            <p className="learning-kicker">A skill worth exploring</p>
            <h2>{selected?.skill ?? "Choose a skill"}</h2>
            {selected && <div className="skill-strength"><span>{selected.posting_share_percentage.toFixed(1)}%</span> mentioned in this role’s postings</div>}
          </div>
          <div className="learning-body">
            <div className="learn-section-heading">
              <span>COURSES IN THE CATALOG</span>
              <span>{courseGroup?.total_matches ?? 0} records</span>
            </div>
            {shownCourses.length ? shownCourses.map((course, index) => (
              <article className="course-record" key={course.id}>
                <div className="course-number">0{index + 1}</div>
                <div className="course-info">
                  <h3>{course.title}</h3>
                  <p>{course.provider}{course.level ? ` · ${course.level}` : ""}</p>
                  <div className="course-meta">
                    {course.duration_hours != null && <span>{course.duration_hours} hours</span>}
                    {course.rating != null && <span>★ {course.rating}</span>}
                  </div>
                  <a href={course.url} target="_blank" rel="noreferrer">View catalog record <ExternalLink size={12} /></a>
                </div>
              </article>
            )) : <div className="course-empty">No catalog matches are recorded for this skill. That is different from evidence about employer demand.</div>}
            {courses.length > 3 && (
              <button className="more-courses" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Show fewer records" : `See all ${courses.length} shown records`} <ArrowDownRight size={14} />
              </button>
            )}
            <div className="catalog-disclosure">{courseGroup?.disclaimer ?? "Historical catalog records. Course relevance is not evidence of employer demand."}</div>
          </div>
        </aside>
      </div>
      <footer className="atlas-footer">
        <span>WORKFORCE ATLAS <b>·</b> MALAYSIA</span>
        <span>Source: deduplicated historical job postings &amp; Coursera catalog records</span>
      </footer>
    </main>
  );
}
