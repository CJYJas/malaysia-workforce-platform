import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { useGetJourneyCatalog, type JourneyProfile } from "@workspace/api-client-react";
import { ArrowLeft, ArrowRight, Check, Search, UserRound, BookOpenCheck, Target, Sparkles, FileText } from "lucide-react";
import { PageHeader, ErrorPanel } from "@/components/shell";
import { ADDITIONAL_INTERESTS, EDUCATION_LEVELS, PROFILE_STATUSES, emptyProfileDetails, parseProfileDetails, type ProfileDetails } from "@/lib/profile-storage";
import { useJourney } from "@/lib/journey";
import { ResumeParserCard } from "@/components/resume-parser-card";

const blankProfile: JourneyProfile = { skills: [], experience_years: 0, interests: [], hours_per_week: 5, current_role: "" };
const panel = "rounded-xl border border-border bg-card p-5 md:p-6 soft-shadow";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55";
const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-55";
const slug = (value: string) => value.toLowerCase().replaceAll(" ", "-");

type StepId = "about" | "skills" | "direction";
const STEPS: { id: StepId; title: string; icon: typeof UserRound }[] = [
  { id: "about", title: "About you", icon: UserRound },
  { id: "skills", title: "Your skills", icon: BookOpenCheck },
  { id: "direction", title: "Your direction", icon: Target },
];

function interestLabel(value: string) {
  const match = value.toLowerCase();
  if (match.includes("software") || match === "building products") return "Software Development (Building products)";
  if (match.includes("data")) return "Data and Analytics (Working with data)";
  if (match.includes("artificial") || match.includes("machine") || match === "ai/ml" || match === "ai and automation") return "AI / ML (AI and automation)";
  if (match.includes("cloud") || match.includes("infrastructure")) return "Cloud / Infrastructure";
  if (match.includes("people") || match.includes("social")) return "People and social impact";
  if (match.includes("sustain")) return "Sustainability";
  return value;
}

export function ProfilePage() {
  const { profile, profileDetails, storageError, saveProfile, reset, selectedRole, setSelectedRole } = useJourney();
  const { data: catalog, isLoading, isError, refetch } = useGetJourneyCatalog();
  const [, navigate] = useLocation();
  const [showParser, setShowParser] = useState(false);
  const [draft, setDraft] = useState<JourneyProfile>(() => profile ? { ...profile, skills: profile.skills.map(skill => ({ ...skill })) } : { ...blankProfile });
  const [details, setDetails] = useState<ProfileDetails>(() => ({ ...profileDetails, additional_interests: [...profileDetails.additional_interests], desired_skills: [...profileDetails.desired_skills], unsure_skills: [...profileDetails.unsure_skills] }));
  const [targetId, setTargetId] = useState(selectedRole);
  const [search, setSearch] = useState("");
  const [desiredSearch, setDesiredSearch] = useState("");
  const [step, setStep] = useState<StepId>("about");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingAction, setPendingAction] = useState<"save" | null>(null);
  const savedFingerprint = JSON.stringify([profile, profileDetails, selectedRole]);
  const originalSaved = useRef(savedFingerprint);
  const savedElsewhere = originalSaved.current !== savedFingerprint;
  const loadLatest = () => {
    setDraft(profile ? { ...profile, skills: profile.skills.map(s => ({ ...s })) } : { ...blankProfile });
    setDetails({ ...profileDetails, desired_skills: [...profileDetails.desired_skills], unsure_skills: [...profileDetails.unsure_skills], additional_interests: [...profileDetails.additional_interests] });
    setTargetId(selectedRole);
    originalSaved.current = savedFingerprint;
    setError(""); setMessage("Loaded the latest saved profile. It replaced the answers previously on this screen.");
  };

  const assessedNames = useMemo(() => new Set(draft.skills.map(skill => skill.name.trim().toLocaleLowerCase())), [draft.skills]);
  const unsureNames = useMemo(() => new Set(details.unsure_skills.map(skill => skill.trim().toLocaleLowerCase())), [details.unsure_skills]);
  const allSelected = draft.skills.length + details.unsure_skills.length;
  const availableSkills = catalog?.skills ?? [];
  const matchingSuggestions = availableSkills.filter(name => name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) && !assessedNames.has(name.toLocaleLowerCase()) && !unsureNames.has(name.toLocaleLowerCase())).slice(0, 10);
  const desiredSuggestions = availableSkills.filter(name => name.toLocaleLowerCase().includes(desiredSearch.toLocaleLowerCase()) && !details.desired_skills.some(item => item.toLocaleLowerCase() === name.toLocaleLowerCase())).slice(0, 8);

  const updateDetails = <K extends keyof ProfileDetails>(key: K, value: ProfileDetails[K]) => setDetails(current => ({ ...current, [key]: value }));
  const addSkill = (raw: string) => {
    const typed = raw.trim();
    const name = availableSkills.find(item => item.toLocaleLowerCase() === typed.toLocaleLowerCase()) ?? typed;
    if (!name) return;
    if (name.length > 80) { setError("Skill names can be up to 80 characters."); return; }
    if (assessedNames.has(name.toLocaleLowerCase()) || unsureNames.has(name.toLocaleLowerCase())) { setError("That skill is already in your profile."); return; }
    if (allSelected >= 60) { setError("Choose up to 60 skills in total."); return; }
    setDraft(current => ({ ...current, skills: [...current.skills, { name, level: 1 }] }));
    setSearch("");
    setError("");
  };
  const addDesiredSkill = (raw: string) => {
    const typed = raw.trim();
    const name = availableSkills.find(item => item.toLocaleLowerCase() === typed.toLocaleLowerCase()) ?? typed;
    if (!name) return;
    if (name.length > 80) { setError("Desired skill names can be up to 80 characters."); return; }
    if (details.desired_skills.length >= 20) { setError("You can add up to 20 skills you want to develop."); return; }
    if (!details.desired_skills.some(skill => skill.toLocaleLowerCase() === name.toLocaleLowerCase())) updateDetails("desired_skills", [...details.desired_skills, name]);
    setDesiredSearch("");
  };
  const changeSkill = (name: string, level: number) => {
    if (level === 0) {
      setDraft(current => ({ ...current, skills: current.skills.filter(skill => skill.name !== name) }));
      updateDetails("unsure_skills", [...details.unsure_skills.filter(item => item.toLocaleLowerCase() !== name.toLocaleLowerCase()), name]);
    } else {
      setDraft(current => ({ ...current, skills: current.skills.some(skill => skill.name === name) ? current.skills.map(skill => skill.name === name ? { ...skill, level } : skill) : [...current.skills, { name, level }] }));
      updateDetails("unsure_skills", details.unsure_skills.filter(item => item.toLocaleLowerCase() !== name.toLocaleLowerCase()));
    }
  };
  const removeSkill = (name: string) => {
    setDraft(current => ({ ...current, skills: current.skills.filter(skill => skill.name !== name) }));
    updateDetails("unsure_skills", details.unsure_skills.filter(item => item.toLocaleLowerCase() !== name.toLocaleLowerCase()));
  };

  const validate = () => {
    setError("");
    if (!draft.interests.length) { setStep("direction"); setError("Choose at least one scored interest. The additional directions below are context only."); return false; }
    if (!Number.isInteger(draft.experience_years) || draft.experience_years < 0 || draft.experience_years > 50) { setStep("about"); setError("Enter whole years of experience from 0 to 50."); return false; }
    if (!Number.isInteger(draft.hours_per_week) || draft.hours_per_week < 1 || draft.hours_per_week > 40) { setStep("direction"); setError("Enter a learning pace from 1 to 40 hours per week."); return false; }
    if (targetId && !catalog?.roles.some(role => role.id === targetId)) { setStep("direction"); setError("Choose a supported target role or leave the target role empty."); return false; }
    if ((draft.current_role?.length ?? 0) > 100) { setStep("about"); setError("Your current role can be up to 100 characters."); return false; }
    if (draft.skills.length + details.unsure_skills.length > 60) { setStep("skills"); setError("Choose up to 60 skills in total, including Not sure skills."); return false; }
    if (details.display_name.length > 80 || details.field_of_study.length > 120 || details.experience_summary.length > 2000) { setError("Check the maximum lengths shown for your details."); return false; }
    if (details.desired_skills.length > 20 || details.desired_skills.some(skill => skill.length > 80)) { setStep("direction"); setError("Choose up to 20 skills you want to develop, with up to 80 characters each."); return false; }
    if (draft.skills.some(skill => !skill.name.trim() || skill.name.length > 80 || ![1, 2, 3].includes(skill.level))) { setStep("skills"); setError("Review your selected skill names and proficiency levels."); return false; }
    try { parseProfileDetails(details); } catch (validationError) { setError(validationError instanceof Error ? validationError.message : "Review your profile details."); return false; }
    return true;
  };
  const persist = () => {
    if (savedElsewhere) { setError("Your saved profile changed in another tab. Load the latest saved profile before saving to avoid overwriting those changes."); return null; }
    const core: JourneyProfile = { ...draft, skills: draft.skills.map(skill => ({ name: skill.name.trim(), level: skill.level })), interests: [...draft.interests], current_role: draft.current_role?.trim() || undefined };
    saveProfile(core, details);
    setSelectedRole(targetId);
    originalSaved.current = JSON.stringify([core, parseProfileDetails(details), targetId]);
    return core;
  };
  const saveOnly = (event: FormEvent) => {
    event.preventDefault();
    setMessage(""); setError("");
    if (!validate()) return;
    setPendingAction("save");
    try {
      const core = persist();
      if (!core) return;
      setMessage("Profile saved in this browser. Continue to the Radar when you're ready.");
    } finally { setPendingAction(null); }
  };
  const continueToRadar = () => {
    if (pendingAction) return;
    setMessage(""); setError("");
    if (!validate()) return;
    const core = persist();
    if (!core) return;
    navigate("/skills-radar");
  };
  const resetProfile = () => {
    if (!window.confirm("Reset your profile, saved learning progress and personal results on this browser? This cannot be undone.")) return;
    reset();
    setDraft({ ...blankProfile });
    setDetails(emptyProfileDetails());
    setTargetId("");
    originalSaved.current = JSON.stringify([null, emptyProfileDetails(), ""]);
    setMessage("Your profile and saved progress have been cleared.");
    setError("");
  };

  return <div className="mx-auto max-w-5xl profile-page">
    <PageHeader kicker="Build your starting point" title="Understand your starting point"><span>Complete this in stages, and share only what helps describe your career direction. Your profile is stored in this browser.</span></PageHeader>

    {/* AI Resume Parser Banner */}
    <div className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-teal-500/5 to-transparent p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-sm text-foreground flex items-center gap-1.5">
            Auto-fill with AI Resume Parser <span className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">FastAPI + RunPod</span>
          </p>
          <p className="text-xs text-muted-foreground">Upload your PDF resume or paste profile text to extract canonical skills, experience years, and education automatically.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setShowParser(val => !val)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary shadow-sm transition"
        data-testid="button-toggle-profile-parser"
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        {showParser ? "Close Resume Parser" : "Upload / Parse Resume"}
      </button>
    </div>

    {showParser && (
      <div className="mb-8">
        <ResumeParserCard
          onAppliedToProfile={(skills: string[], expYears: number, edu?: string | null) => {
            setDraft((current: JourneyProfile) => {
              const existing = new Map((current.skills || []).map((s: any) => [s.name.toLowerCase(), s]));
              skills.forEach((s: string) => {
                if (!existing.has(s.toLowerCase())) {
                  existing.set(s.toLowerCase(), { name: s, level: 2 });
                }
              });
              return {
                ...current,
                skills: Array.from(existing.values()).slice(0, 60),
                experience_years: expYears > 0 ? Math.min(50, Math.round(expYears)) : current.experience_years,
              };
            });
            if (edu) {
              setDetails((current: ProfileDetails) => ({
                ...current,
                education_level: edu as any,
              }));
            }
            setMessage(`Extracted and applied ${skills.length} skills and ${expYears} years of experience into your profile answers!`);
          }}
        />
      </div>
    )}

    {storageError && <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="alert" data-testid="status-storage-error">{storageError}</div>}
    {savedElsewhere && <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="alert" data-testid="status-profile-conflict"><p>The saved profile changed in another tab. Your unsaved answers are still here, but saving is paused to prevent overwriting newer data.</p><button type="button" onClick={loadLatest} disabled={!!pendingAction} className={`${secondaryButton} mt-3`} data-testid="button-load-latest-profile">Load latest saved profile (replaces these answers)</button></div>}
    <div className="profile-steps" aria-label="Profile form steps">
      {STEPS.map(({ id, title, icon: Icon }, index) => <button key={id} type="button" className="profile-step" aria-current={step === id ? "step" : undefined} onClick={() => setStep(id)} data-testid={`button-profile-step-${id}`}><strong>{index + 1}</strong><Icon size={16} aria-hidden="true" />{title}</button>)}
    </div>
    {isLoading ? <div className="profile-loading" aria-label="Loading profile options">{[1,2,3].map(index => <div key={index} className="h-28 animate-pulse rounded-xl bg-secondary" />)}</div> :
      isError || !catalog ? <ErrorPanel message="The skills, interests and role options could not be loaded." onRetry={() => refetch()} /> :
        <form onSubmit={saveOnly} className="profile-form">
          <fieldset disabled={!!pendingAction} className="contents">
            {step === "about" && <>
              <section className={`${panel} profile-about-panel`}>
                <div className="profile-section-title"><span className="profile-index">A</span><div><h2 className="font-display text-xl font-semibold">About you</h2><p className="mt-1 text-sm text-muted-foreground">Optional context helps make the starting point more personal.</p></div></div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-semibold">Preferred display name <span className="font-normal text-muted-foreground">(optional, up to 80 characters)</span><input maxLength={80} value={details.display_name} onChange={event => updateDetails("display_name", event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-input px-3 font-normal outline-none focus:ring-2 focus:ring-ring" data-testid="input-display-name" /></label>
                  <label className="text-sm font-semibold">Current status <span className="font-normal text-muted-foreground">(optional)</span><select value={details.current_status} onChange={event => updateDetails("current_status", event.target.value as ProfileDetails["current_status"])} className="mt-2 h-11 w-full rounded-lg border border-input bg-white px-3 font-normal" data-testid="select-current-status"><option value="">Choose if useful</option>{PROFILE_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}</select></label>
                  <label className="text-sm font-semibold">Highest education level <span className="font-normal text-muted-foreground">(optional)</span><select value={details.education_level} onChange={event => updateDetails("education_level", event.target.value as ProfileDetails["education_level"])} className="mt-2 h-11 w-full rounded-lg border border-input bg-white px-3 font-normal" data-testid="select-education-level"><option value="">Choose if useful</option>{EDUCATION_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}</select></label>
                  <label className="text-sm font-semibold">Field of study <span className="font-normal text-muted-foreground">(optional, up to 120 characters)</span><input maxLength={120} value={details.field_of_study} onChange={event => updateDetails("field_of_study", event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-input px-3 font-normal outline-none focus:ring-2 focus:ring-ring" data-testid="input-field-of-study" /></label>
                  <label className="text-sm font-semibold">Years of relevant experience <span className="font-normal text-muted-foreground">(0–50, whole number)</span><input type="number" min="0" max="50" step="1" value={draft.experience_years} onChange={event => setDraft(current => ({ ...current, experience_years: Number(event.target.value) }))} className="mt-2 h-11 w-full rounded-lg border border-input px-3 font-normal outline-none focus:ring-2 focus:ring-ring" data-testid="input-experience-years" /></label>
                  <label className="text-sm font-semibold">Current or most recent role <span className="font-normal text-muted-foreground">(optional)</span><input maxLength={100} value={draft.current_role || ""} onChange={event => setDraft(current => ({ ...current, current_role: event.target.value }))} placeholder="For example, customer support associate" className="mt-2 h-11 w-full rounded-lg border border-input px-3 font-normal outline-none focus:ring-2 focus:ring-ring" data-testid="input-current-role" /></label>
                </div>
              </section>
            </>}
            {step === "skills" && <section className={`${panel} profile-skills`}>
              <div className="profile-section-head"><div><span className="profile-index">B</span><div><h2 className="font-display text-xl font-semibold">Skills you’ve worked with</h2><p className="mt-1 text-sm text-muted-foreground">Add recognised skills, then choose a self-reported level. This is separate from employer-demand evidence.</p></div></div><span className="rounded-md bg-secondary px-2 py-1 text-sm text-muted-foreground">{allSelected} / 60 selected</span></div>
              <div className="mt-4 flex gap-2"><label className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search skills, for example Python" aria-label="Search skills" data-testid="input-search-skills" className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label><button type="button" onClick={() => addSkill(search)} disabled={!search.trim() || allSelected >= 60} className={secondaryButton} data-testid="button-add-custom-skill">Add skill</button></div>
              {search && matchingSuggestions.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{matchingSuggestions.map(name => <button type="button" key={name} onClick={() => addSkill(name)} className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-sm font-semibold text-secondary-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`button-skill-suggestion-${slug(name)}`}>+ {name}</button>)}</div>}
              {(draft.skills.length > 0 || details.unsure_skills.length > 0) && <div className="mt-5 space-y-2">{[...draft.skills.map(skill => ({ name: skill.name, level: skill.level })), ...details.unsure_skills.map(name => ({ name, level: 0 }))].map(skill => <div key={skill.name} className="profile-skill-row flex flex-wrap items-center justify-between gap-3 px-3 py-2.5" data-testid={`row-profile-skill-${slug(skill.name)}`}><span className="text-sm font-semibold">{skill.name}</span><div className="flex flex-wrap items-center gap-2"><div role="group" aria-label={`${skill.name} self-reported proficiency`} className="level-group flex flex-wrap p-1">{[{ label: "Beginner", value: 1 }, { label: "Intermediate", value: 2 }, { label: "Advanced", value: 3 }, { label: "Not sure", value: 0 }].map(({ label, value }) => <button key={value} type="button" onClick={() => changeSkill(skill.name, value)} aria-pressed={skill.level === value} className={`min-h-8 rounded-md px-2 py-1.5 text-sm transition ${skill.level === value ? "bg-secondary font-bold text-secondary-foreground" : "text-muted-foreground hover:bg-muted"}`} data-testid={`button-level-${slug(skill.name)}-${value}`}>{label}{value > 0 && <span className="ml-1 opacity-60">{value}</span>}</button>)}</div><button type="button" onClick={() => removeSkill(skill.name)} aria-label={`Remove ${skill.name}`} className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-rose-50 hover:text-rose-700" data-testid={`button-remove-skill-${slug(skill.name)}`}>×</button></div></div>)}</div>}
              <p className="mt-4 rounded-lg bg-secondary/60 p-3 text-sm leading-relaxed text-muted-foreground" role="note">Choosing “Not sure” stores only the skill name in your private profile context. It is not scored or sent for matching until you select a level from 1 to 3. You can also leave skills empty.</p>
            </section>}
            {step === "direction" && <>
              <div className="profile-career-grid">
                <section className={`${panel} profile-interest-panel`}>
                  <div className="profile-section-title"><span className="profile-index">C</span><div><h2 className="font-display text-xl font-semibold">Interests that guide matching</h2><p className="mt-1 text-sm text-muted-foreground">Choose at least one scored direction.</p></div></div>
                  <div className="mt-4 flex flex-wrap gap-2">{catalog.interests.map(interest => <button type="button" key={interest} onClick={() => setDraft(current => ({ ...current, interests: current.interests.includes(interest) ? current.interests.filter(item => item !== interest) : current.interests.length < 8 ? [...current.interests, interest] : current.interests }))} aria-pressed={draft.interests.includes(interest)} data-testid={`button-interest-${slug(interest)}`} className={`min-h-10 rounded-full border px-3.5 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${draft.interests.includes(interest) ? "border-teal-600 bg-teal-50 font-semibold text-teal-800" : "border-border bg-card hover:bg-secondary"}`}>{draft.interests.includes(interest) && <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}{interestLabel(interest)}</button>)}</div>
                  <p className="mt-4 border-t border-border pt-3 text-sm font-medium text-muted-foreground">Additional directions (context only)</p>
                  <div className="mt-2 flex flex-wrap gap-2">{ADDITIONAL_INTERESTS.map(interest => <button type="button" key={interest} onClick={() => updateDetails("additional_interests", details.additional_interests.includes(interest) ? details.additional_interests.filter(item => item !== interest) : [...details.additional_interests, interest])} aria-pressed={details.additional_interests.includes(interest)} className={`min-h-10 rounded-full border px-3.5 py-2 text-sm transition ${details.additional_interests.includes(interest) ? "border-slate-500 bg-slate-100 font-semibold text-slate-800" : "border-border bg-card hover:bg-secondary"}`} data-testid={`button-additional-interest-${slug(interest)}`}>{details.additional_interests.includes(interest) && <Check className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />}{interest}</button>)}</div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Cybersecurity, Research and Innovation, and Other Technology Areas are saved as context only. The current matching dataset cannot assess these directions, so they are not included in matching.</p>
                </section>
                <section className={`${panel} profile-time-panel`}>
                  <div className="profile-section-title"><span className="profile-index">D</span><div><h2 className="font-display text-xl font-semibold">Career goals</h2><p className="mt-1 text-sm text-muted-foreground">Optional priorities for what comes next.</p></div></div>
                  <label className="mt-4 block text-sm font-semibold">Target role <span className="font-normal text-muted-foreground">(optional)</span><select value={targetId} onChange={event => setTargetId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-input bg-white px-3 font-normal" data-testid="select-target-role"><option value="">No target role yet</option>{catalog.roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
                  <label className="mt-4 block text-sm font-semibold">Hours to learn each week <span className="font-normal text-muted-foreground">(1–40, whole number)</span><input type="number" min="1" max="40" step="1" value={draft.hours_per_week} onChange={event => setDraft(current => ({ ...current, hours_per_week: Number(event.target.value) }))} className="mt-2 h-11 w-full rounded-lg border border-input px-3 font-normal outline-none focus:ring-2 focus:ring-ring" data-testid="input-hours-per-week" /><span className="mt-1 block text-sm font-normal text-muted-foreground">Your learning pace is used for planning, not to assess readiness.</span></label>
                  <div className="mt-4"><label className="text-sm font-semibold" htmlFor="desired-skill-search">Skills you want to develop <span className="font-normal text-muted-foreground">(context only, up to 20)</span></label><div className="mt-2 flex gap-2"><input id="desired-skill-search" value={desiredSearch} onChange={event => setDesiredSearch(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); addDesiredSkill(desiredSearch); } }} placeholder="Search or type a skill" className="h-11 min-w-0 flex-1 rounded-lg border border-input px-3 font-normal" data-testid="input-desired-skills" /><button type="button" onClick={() => addDesiredSkill(desiredSearch)} disabled={!desiredSearch.trim() || details.desired_skills.length >= 20} className={secondaryButton} data-testid="button-add-desired-skill">Add</button></div>
                    {desiredSearch && desiredSuggestions.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{desiredSuggestions.map(name => <button key={name} type="button" onClick={() => addDesiredSkill(name)} className="rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-sm hover:bg-secondary">{name}</button>)}</div>}
                    <div className="mt-2 flex flex-wrap gap-2">{details.desired_skills.map(name => <button type="button" key={name} onClick={() => updateDetails("desired_skills", details.desired_skills.filter(item => item !== name))} aria-label={`Remove desired skill ${name}`} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm text-secondary-foreground">{name}<span aria-hidden="true">×</span></button>)}</div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Desired skills stay separate from current ability and do not affect match scores.</p>
                  </div>
                </section>
              </div>
              <section className={`${panel} profile-experience-panel`}>
                <div className="profile-section-title"><span className="profile-index">E</span><div><h2 className="font-display text-xl font-semibold">Your experience</h2><p className="mt-1 text-sm text-muted-foreground">Projects, internships, responsibilities or technical work. Optional, up to 2,000 characters.</p></div></div>
                <textarea maxLength={2000} value={details.experience_summary} onChange={event => updateDetails("experience_summary", event.target.value)} rows={5} placeholder="Add a short summary of experience you’d like to bring into your next role." className="mt-4 min-h-32 w-full resize-y rounded-lg border border-input px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-ring" data-testid="input-experience-summary" />
                <p className="mt-1 text-right text-sm text-muted-foreground">{details.experience_summary.length} / 2,000</p>
              </section>
            </>}
          </fieldset>
          {error && <p role="alert" aria-live="assertive" data-testid="status-profile-error" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
          {message && <p role="status" aria-live="polite" data-testid="status-profile-save" className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">{message}</p>}
          <div className="profile-actions flex flex-wrap items-center gap-3">
            {step !== "about" && <button type="button" onClick={() => setStep(step === "direction" ? "skills" : "about")} className={secondaryButton} data-testid="button-profile-previous"><ArrowLeft size={16} />Previous section</button>}
            {step !== "direction" && <button type="button" onClick={() => setStep(step === "about" ? "skills" : "direction")} className={secondaryButton} data-testid="button-profile-next">Next section<ArrowRight size={16} /></button>}
            <button type="submit" disabled={!!pendingAction} className={secondaryButton} data-testid="button-save-profile">{pendingAction === "save" ? "Saving…" : "Save profile"} </button>
            <button type="button" onClick={continueToRadar} disabled={!!pendingAction} className={primaryButton} data-testid="button-profile-continue">Save & continue to Radar<ArrowRight size={16} /></button>
            {profile && <button type="button" onClick={resetProfile} disabled={!!pendingAction} className={secondaryButton} data-testid="button-reset-profile">Reset profile & progress</button>}
          </div>
          <div className="profile-save-note"><span className="profile-stamp">PRIVATE BY DEFAULT</span><p className="text-sm leading-relaxed text-muted-foreground">Your answers are stored in browser storage. Saving here does not request matching. When you continue from the Radar to your matches, only assessed skills, supported interests, experience years, learning pace and current role go to the matching service. Display name, education, field of study, written experience, Not sure skills, additional interests and desired skills remain browser-only context.</p></div>
          {profile && <div className="profile-form-intro"><Link href="/skills-radar" className="text-sm font-semibold text-primary underline underline-offset-4" data-testid="link-profile-radar">Next: review the Future Skills Radar</Link></div>}
        </form>}
  </div>;
}
