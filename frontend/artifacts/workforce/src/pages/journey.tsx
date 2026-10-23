import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { getJourneySignals, getGetJourneySignalsQueryKey, useGetJourneyCatalog, useGetJourneySignals, useMatchJourney, useCreateJourneyPathway, useGetWorkforceOverview } from "@workspace/api-client-react";
import type { JourneyProfile, LearningPathway, RoleMatch, SignalReport } from "@workspace/api-client-react";
import { ArrowRight, BookOpen, Check, ChevronRight, Download, ExternalLink, RefreshCw, Search, Sparkles, Target } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader, ErrorPanel, Warn } from "@/components/shell";
import { ScenarioPicker, SdgExplorer, SourceNote } from "@/components/journey-ui";
import { profileKey, useJourney } from "@/lib/journey";
import { useJourneyFlow } from "@/lib/journey-flow";
import { flowFingerprint } from "@/lib/journey-flow-model";
import { PLAN_SUMMARY_KEY, summarisePlan, readLearningProgress as readProgress, type LearningProgress, type LearningStatus } from "@/lib/plan-summary-model";
import { MalaysianRadar } from "@/components/malaysian-radar";
import { RadarGroup } from "@/components/radar-group";
import { DashboardTools } from "@/components/dashboard-tools";

const panel = "rounded-[22px] border border-[#e7e3d8] bg-card p-5 md:p-6 soft-shadow";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173a37] px-5 py-2.5 text-sm font-semibold text-[#fffaf0] transition hover:bg-[#28564e] active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7785b] disabled:cursor-not-allowed disabled:opacity-55";
const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d9ded6] bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-[#f2f2e9] active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function HomePage() {
  const { profile, storageError } = useJourney();
  const first = profile ? "Pick a role that feels like a next step." : "Start with where you are. We’ll help map what could come next.";
  return <div className="mx-auto max-w-6xl">
    <section className="journey-intro rise">
      <div className="pointer-events-none absolute -right-12 -top-20 h-72 w-72 rounded-full border border-white/10" /><div className="pointer-events-none absolute -right-1 -top-8 h-52 w-52 rounded-full border border-white/10" />
      <div className="relative max-w-2xl"><p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#cfe7d9]"><Sparkles className="h-3.5 w-3.5" /> YOUR MALAYSIA TECH JOURNEY</p>
        <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">{profile ? "Your next chapter starts here." : "A career path that starts with you."}</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75 md:text-lg">{first}</p>
      </div>
    </section>
    {storageError && <p className="mt-4 rounded-xl border border-[#d99070]/30 bg-[#fbede5] p-4 text-sm text-[#8b4932]" role="alert" data-testid="status-storage-error">{storageError}</p>}
    <DashboardTools />
  </div>;
}

const blankProfile: JourneyProfile = { skills: [], experience_years: 0, interests: [], hours_per_week: 5, current_role: "" };
export function ProfilePage() {
  const { profile, storageError, saveProfile, reset } = useJourney();
  const { data: catalog, isLoading, isError, refetch } = useGetJourneyCatalog();
  const [draft, setDraft] = useState<JourneyProfile>(profile || blankProfile);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => { setDraft(profile || blankProfile); }, [profile]);
  const skillNames = useMemo(() => draft.skills.map((s) => s.name.toLowerCase()), [draft.skills]);
  const filtered = (catalog?.skills || []).filter((s) => s.toLowerCase().includes(search.toLowerCase()) && !skillNames.includes(s.toLowerCase())).slice(0, 12);
  const addSkill = (name: string) => { const clean = name.trim(); if (clean.length > 80) { setMessage("Skill names can be up to 80 characters."); return; } if (clean && !skillNames.includes(clean.toLowerCase()) && draft.skills.length < 60) setDraft((d) => ({ ...d, skills: [...d.skills, { name: clean, level: 1 }] })); setSearch(""); };
  const changeSkill = (name: string, level: number) => setDraft((d) => ({ ...d, skills: d.skills.map((s) => s.name === name ? { ...s, level } : s) }));
  const submit = (event: FormEvent) => { event.preventDefault(); if (!draft.interests.length) { setMessage("Choose at least one interest so we can understand what work energises you."); return; } if (!Number.isInteger(draft.experience_years) || draft.experience_years < 0 || draft.experience_years > 50 || !Number.isInteger(draft.hours_per_week) || draft.hours_per_week < 1 || draft.hours_per_week > 40) { setMessage("Check your experience and weekly study time. Enter whole numbers within the ranges shown."); return; } const ok = saveProfile({ ...draft, current_role: draft.current_role?.trim() || undefined }); setMessage(ok ? "Saved on this device. Your next step is ready." : "We couldn't save this profile. Your answers are still on screen."); };
  return <div className="mx-auto max-w-5xl profile-page">
    <PageHeader kicker="01 / Your starting point" title="A little about you"><span>There’s no right starting line. Share only what feels useful — this profile is saved in your browser.</span></PageHeader>
    {storageError && <div className="mb-5 rounded-xl border border-[#d99070]/30 bg-[#fbede5] p-4 text-sm text-[#8b4932]" role="alert" data-testid="status-storage-error">{storageError}</div>}
    {isLoading ? <div className="profile-loading">{[1,2,3].map(i=><div key={i} className="h-28 animate-pulse rounded-2xl bg-[#ebe9df]" />)}</div> : isError || !catalog ? <ErrorPanel message="The skill and interest guide couldn’t load." onRetry={() => refetch()} /> : <form onSubmit={submit} className="profile-form">
      <div className="profile-form-intro"><span className="profile-stamp">YOUR NOTES / 01</span><p>Start anywhere. A skill can come from work, study, a side project or something you’re curious about.</p></div>
      <section className={`${panel} profile-skills`}><div className="profile-section-head"><div><span className="profile-index">A</span><div><h2 className="font-display text-xl font-semibold">Skills you’ve tried</h2><p className="mt-1 text-sm text-muted-foreground">Choose any that fit. No skills yet? Leave this part empty.</p></div></div><span className="text-xs text-muted-foreground">{draft.skills.length} / 60 added</span></div>
        <div className="mt-4 flex gap-2"><label className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search skills, e.g. Python" aria-label="Search skills" data-testid="input-search-skills" className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label><button type="button" onClick={()=>addSkill(search)} disabled={!search.trim()} className={secondaryButton} data-testid="button-add-custom-skill">Add skill</button></div>
        {search && filtered.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{filtered.map(s=><button type="button" key={s} onClick={()=>addSkill(s)} className="rounded-full border border-[#d8e3d9] bg-[#f0f5ef] px-3 py-1.5 text-xs font-semibold text-[#315f51] hover:bg-[#e3eee4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={`button-skill-suggestion-${s.toLowerCase().replaceAll(" ","-")}`}>+ {s}</button>)}</div>}
        {draft.skills.length > 0 && <div className="mt-5 space-y-2">{draft.skills.map((s)=><div key={s.name} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f7f6ef] px-3 py-2.5" data-testid={`row-profile-skill-${s.name.toLowerCase().replaceAll(" ","-")}`}><span className="text-sm font-semibold">{s.name}</span><div className="flex flex-wrap items-center gap-2"><div role="group" aria-label={`${s.name} skill level`} className="flex rounded-lg bg-white p-1">{["Beginner","Working","Confident"].map((label,i)=><button key={label} type="button" onClick={()=>changeSkill(s.name,i+1)} aria-pressed={s.level===i+1} className={`rounded-md px-2.5 py-1.5 text-xs transition ${s.level===i+1?"bg-[#dcebe1] font-bold text-[#255b4f]":"text-muted-foreground hover:bg-[#f1f1e9]"}`} data-testid={`button-level-${s.name.toLowerCase().replaceAll(" ","-")}-${i+1}`}>{label} <span className="opacity-60">{i+1}</span></button>)}</div><button type="button" onClick={()=>setDraft(d=>({...d,skills:d.skills.filter(x=>x.name!==s.name)}))} aria-label={`Remove ${s.name}`} className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-[#f8e8dd] hover:text-[#9a4d37]" data-testid={`button-remove-skill-${s.name.toLowerCase().replaceAll(" ","-")}`}>×</button></div></div>)}</div>}
      </section>
      <div className="profile-lower-grid">
        <section className={`${panel} profile-interest-panel`}><div className="profile-section-title"><span className="profile-index">B</span><div><h2 className="font-display text-xl font-semibold">What interests you?</h2><p className="mt-1 text-sm text-muted-foreground">Pick at least one. You can change this whenever you like.</p></div></div><div className="mt-4 flex flex-wrap gap-2">{catalog.interests.map((interest)=><button type="button" key={interest} onClick={()=>setDraft(d=>({...d,interests:d.interests.includes(interest)?d.interests.filter(i=>i!==interest):d.interests.length<8?[...d.interests,interest]:d.interests}))} aria-pressed={draft.interests.includes(interest)} data-testid={`button-interest-${interest.toLowerCase().replaceAll(" ","-")}`} className={`min-h-10 rounded-full border px-4 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${draft.interests.includes(interest)?"border-[#4f8a74] bg-[#e5f1e9] font-semibold text-[#255b4f]":"border-border bg-card hover:bg-[#f2f2e9]"}`}>{draft.interests.includes(interest)&&<Check className="mr-1 inline h-3.5 w-3.5" />}{interest}</button>)}</div>{draft.interests.length>=8&&<p className="mt-2 text-xs text-muted-foreground">You’ve selected the maximum of 8 interests.</p>}</section>
        <section className={`${panel} profile-time-panel`}><div className="profile-section-title"><span className="profile-index">C</span><div><h2 className="font-display text-xl font-semibold">Time & experience</h2><p className="mt-1 text-sm text-muted-foreground">A learning plan should fit around your life.</p></div></div><div className="mt-4 grid gap-4"><label className="text-sm font-semibold">Years of experience <span className="font-normal text-muted-foreground">(0–50)</span><input type="number" min="0" max="50" step="1" value={draft.experience_years} onChange={e=>setDraft(d=>({...d,experience_years:Number(e.target.value)}))} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring" data-testid="input-experience-years" /></label><label className="text-sm font-semibold">Hours to learn each week <span className="font-normal text-muted-foreground">(1–40)</span><input type="number" min="1" max="40" step="1" value={draft.hours_per_week} onChange={e=>setDraft(d=>({...d,hours_per_week:Number(e.target.value)}))} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring" data-testid="input-hours-per-week" /></label><label className="text-sm font-semibold">Current role <span className="font-normal text-muted-foreground">(optional)</span><input maxLength={100} value={draft.current_role || ""} onChange={e=>setDraft(d=>({...d,current_role:e.target.value}))} placeholder="e.g. Customer support associate" className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring" data-testid="input-current-role" /></label></div></section>
      </div>
      {message && <p role="status" data-testid="status-profile-save" className={`rounded-xl p-3 text-sm ${message.startsWith("Saved")?"bg-[#e5f1e9] text-[#255b4f]":"bg-[#fbede5] text-[#8b4932]"}`}>{message}</p>}
      <div className="flex flex-wrap items-center gap-3"><button type="submit" className={primaryButton} data-testid="button-save-profile">{profile ? "Save changes" : "Save my starting point"}<ArrowRight className="h-4 w-4" /></button>{profile && <button type="button" onClick={()=>{if(window.confirm("Reset your profile, saved learning progress and personal results on this browser? This cannot be undone.")){reset();setDraft(blankProfile);setMessage("Your profile and saved progress have been cleared.");}}} className={secondaryButton} data-testid="button-reset-profile">Reset profile & progress</button>}</div>
       {profile && <div className="flex flex-wrap gap-3 rounded-2xl bg-[#e8f2ed] p-4"><Link href="/radar" className={primaryButton} data-testid="link-profile-radar">Next: explore the skills radar<ArrowRight className="h-4 w-4" /></Link><Link href="/matches" className={secondaryButton} data-testid="link-profile-matches">See my role matches</Link></div>}
        <div className="profile-save-note"><span className="profile-stamp">PRIVATE BY DEFAULT</span><p className="text-sm leading-relaxed text-muted-foreground">{catalog.privacy_note} Profile details remain in browser storage. Matching details are sent only when you ask for role matches or a plan.</p></div>
    </form>}
  </div>;
}

export function RadarPage() {
  const { completeRadar, reviewRadar } = useJourneyFlow();
  const [, navigate] = useLocation();
  const { data: report, isLoading, isError, refetch } = useGetJourneySignals();
  const [fresh, setFresh] = useState<SignalReport | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [refreshNotice, setRefreshNotice] = useState("");
  const queryClient = useQueryClient();
  const activeReport = fresh || report;
  const refresh = async () => {
    setRefreshing(true); setRefreshError(""); setRefreshNotice("");
    try {
      const value = await getJourneySignals({ refresh: true });
      setFresh(value); queryClient.setQueryData(getGetJourneySignalsQueryKey(), value);
      const outcome = value.status === "refreshed"
        ? "The source was retrieved and checked. This does not mean a new report edition was published."
        : value.status === "cached"
          ? "The service returned its cached report. No new source retrieval is claimed; see the report dates above."
          : value.status === "bundled"
            ? "The service returned the last verified bundled report, not newly retrieved data. See its recorded dates above."
            : "No verified source report is available from this check.";
      setRefreshNotice(`${outcome}${value.error ? ` ${value.error}` : ""}`);
    } catch { setRefreshError("We couldn’t refresh the source just now. The last available report may still be useful."); }
    finally { setRefreshing(false); }
  };
  const signals = activeReport?.signals || [];
  const { data: catalog } = useGetJourneyCatalog();
  const statusText = activeReport?.status === "refreshed" ? "Just refreshed" : activeReport?.status === "cached" ? "Cached source" : activeReport?.status === "bundled" ? "Bundled source" : "Source unavailable";
  return <div className="mx-auto max-w-6xl radar-page">
    <PageHeader kicker="02 / Read the landscape" title="Future Skills Radar"><span>Start with Malaysian posting evidence, then review the separate global AI outlook. Frequency alone does not establish growth.</span></PageHeader>
    <MalaysianRadar />
    <section className="radar-source-docket" aria-label="Signal source and refresh">
      <div className="radar-source-main"><span className="radar-source-stamp">{statusText}</span><h2>What employers say may be changing</h2><p>Every signal stays attached to its source, dates and limitations.</p>
      {activeReport && <div className="radar-source-dates" data-testid="status-signal-dates"><a href={activeReport.source_url} target="_blank" rel="noreferrer" className="font-semibold text-foreground underline underline-offset-2">{activeReport.source_title}</a><span className="mt-1 block">Published {dateLabel(activeReport.published_at)} · Retrieved {dateLabel(activeReport.retrieved_at)} · Checked {dateLabel(activeReport.checked_at)}. SDG associations below are editorial, not source claims.</span></div>}</div>
      <button onClick={refresh} disabled={refreshing} className="radar-refresh-button" data-testid="button-refresh-signals"><RefreshCw className={`h-4 w-4 ${refreshing?"animate-spin":""}`} />{refreshing?"Checking source…":"Refresh source"}</button>
    </section>
     {refreshError&&<p className="mb-4 rounded-xl bg-[#fbede5] p-3 text-sm text-[#8b4932]" role="alert" data-testid="status-refresh-error">{refreshError}</p>}
     {refreshNotice&&<p className="mb-4 rounded-xl border border-border bg-card p-3 text-sm" role="status" aria-live="polite" data-testid="status-refresh-outcome">{refreshNotice}</p>}
     {isLoading&&!activeReport?<div className="grid gap-4 md:grid-cols-2">{[1,2,3,4].map(i=><div key={i} className="h-32 animate-pulse rounded-2xl bg-[#ebe9df]"/> )}</div>:isError&&!activeReport?<ErrorPanel message="The radar source could not be reached." onRetry={()=>refetch()}/>:activeReport?<><div className="radar-signal-board">
        <section className="radar-signal-category"><header><span className="radar-category-index">01</span><div><h2>Skills in motion</h2><p>Global skill signals, grouped by direction</p></div></header><div className="radar-direction-grid"><RadarGroup title="Rising skills" signals={signals} kind="skill" direction="rising" /><RadarGroup title="Declining skills" signals={signals} kind="skill" direction="declining" /></div></section>
        <section className="radar-signal-category"><header><span className="radar-category-index">02</span><div><h2>Roles in motion</h2><p>Role families with related outlook signals</p></div></header><div className="radar-direction-grid"><RadarGroup title="Rising roles" signals={signals} kind="role" direction="rising" /><RadarGroup title="Declining roles" signals={signals} kind="role" direction="declining" /></div></section>
       </div>
      {signals.length===0&&<div className="mt-4"><Warn>This report has no signals to display yet. Try refreshing the source.</Warn></div>}
      <div className="mt-5"><SourceNote><div className="space-y-2"><p><b className="text-foreground">{activeReport.source_title}</b> · {activeReport.scope}</p><p>{activeReport.caveat}</p><p>Published {dateLabel(activeReport.published_at)} · Retrieved {dateLabel(activeReport.retrieved_at)} · Last checked {dateLabel(activeReport.checked_at)}.</p>{activeReport.error&&<p className="text-[#98573e]">Source note: {activeReport.error}</p>}<a className="inline-flex items-center gap-1 font-semibold text-[#255b4f] underline" href={activeReport.source_url} target="_blank" rel="noreferrer" data-testid="link-radar-source">{activeReport.source_title}<ExternalLink className="h-3.5 w-3.5"/></a><p>WEF 2025 describes global employer expectations for 2025–2030. This is not live Malaysian vacancy data. Related skill/role signals are not exact local role projections; no growth percentages are inferred.</p></div></SourceNote></div>
       {catalog&&<section className="radar-reading-guide"><div><span className="radar-category-index">READ THE MARGIN</span><h2>Three lenses, one source</h2><p>The scenario lens changes assumptions in your role match and plan; it does not change the source’s reported evidence.</p></div><div className="radar-scenario-notes">{catalog.scenarios.map(s=><article key={s.id}><p className="text-sm font-semibold">{s.title}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.description}</p></article>)}</div></section>}
      </>:null}
    <section className={`${panel} mt-6`} aria-label="Finish the radar step">
      <p className="text-sm font-semibold text-primary">STEP 2 OF 4</p>
      <h2 className="mt-2 text-xl font-semibold">Ready to see where you fit?</h2>
      <p className="mt-2 text-sm text-muted-foreground">Review the rising and declining signals and their sources above. Next, we’ll compare your saved profile with future roles, explain each match score and show the skills gaps.</p>
      <button type="button" className={`${primaryButton} mt-4`} disabled={!activeReport?.source_url || !signals.length || activeReport.status === "unavailable"} data-testid="button-radar-continue" onClick={() => {
        const onComplete = reviewRadar || completeRadar;
        if (activeReport?.source_url && signals.length && activeReport.status !== "unavailable") {
          if (onComplete) onComplete();
          navigate("/role-matches");
        }
      }}>I’ve reviewed the Radar — show my matches<ArrowRight className="h-4 w-4" /></button>
      {(!activeReport?.source_url || !signals.length || activeReport.status === "unavailable") && <p className="mt-2 text-sm text-muted-foreground">The source signals need to load before you can complete this step. Retry the source above; your profile remains saved.</p>}
    </section>
    {catalog&&<div className="mt-5"><SdgExplorer goals={catalog.sdgs}/></div>}
  </div>;
}
function dateLabel(date: string) { if (!date) return "not recorded"; const parsed = new Date(date); return Number.isNaN(parsed.getTime())?date:parsed.toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}); }
function HistoricalEvidence() {
  const { data, isLoading, isError, refetch } = useGetWorkforceOverview();
  return <section className="mt-5 rounded-2xl border border-[#e7e3d8] bg-[#f6f0e4] p-5">
    <p className="text-xs font-bold uppercase tracking-[.16em] text-[#987451]">A separate local lens</p>
    <h2 className="mt-1 font-display text-xl font-semibold">Malaysian historical evidence</h2>
    {isLoading ? <div className="mt-3 h-14 animate-pulse rounded-xl bg-white/70" /> : isError || !data ?
      <div className="mt-2 flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Historical evidence is temporarily unavailable.</p><button onClick={() => refetch()} className={secondaryButton} data-testid="button-retry-historical">Retry</button></div> :
      <div className="mt-2">
        <p className="text-sm leading-relaxed text-muted-foreground">A repository snapshot covering {dateLabel(data.coverage_start)} to {dateLabel(data.coverage_end)}. It is a historical dataset, not a live market feed.</p>
        <Link href="/skills" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[#255b4f] underline underline-offset-4" data-testid="link-historical-skills">Open historical skills dashboard<ArrowRight className="h-4 w-4" /></Link>
        <details className="mt-4 border-t border-[#e3dacc] pt-3 text-xs leading-relaxed" data-testid="details-local-source">
          <summary className="cursor-pointer font-semibold">Source details, coverage & limitations</summary>
          <div className="mt-3 space-y-3 break-words text-muted-foreground">
            <p><a href={data.repository_url} target="_blank" rel="noreferrer" className="font-semibold text-foreground underline">View source repository</a> · Revision {data.source_commit} · Processed {data.processed_at}</p>
            <p>{data.total_postings.toLocaleString()} deduplicated Malaysian postings in total; {data.target_postings.toLocaleString()} postings across the five covered tech role families. Deduplication: {data.deduplication_policy}. {data.course_count.toLocaleString()} historical course catalog records.</p>
            <p>{data.trend_reason}</p>
            <ul className="list-disc space-y-1 pl-4">{data.limitations.map(note => <li key={note}>{note}</li>)}</ul>
            <p className="font-semibold text-foreground">Dataset licenses need review before public release.</p>
            <ul className="list-disc pl-4">{data.licenses.map(license => <li key={license.filename}>{license.filename}: {license.status}</li>)}</ul>
          </div>
        </details>
      </div>}
  </section>;
}

export function MatchesPage() {
  const { chooseRole } = useJourneyFlow();
  const { profile, results, resultKey, setResults, selectedRole, setSelectedRole, scenario, setScenario } = useJourney();
  const { data: catalog, isLoading: catalogLoading, isError: catalogError, refetch: retryCatalog } = useGetJourneyCatalog();
  const match = useMatchJourney();
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const requestId = useRef(0);
  const [location, setLocation] = useLocation();
  const key = profile ? profileKey(profile, scenario) : "";
  const currentResults = resultKey === key ? results : null;
  useEffect(() => { requestId.current += 1; setError(""); }, [key]);
  useEffect(() => { const roleId = new URLSearchParams(window.location.search).get("role"); if (roleId) setSelectedRole(roleId); }, [location, setSelectedRole]);
  useEffect(() => {
    if (!profile || currentResults) return;
    const current = ++requestId.current;
    let active = true;
    setError("");
    match.mutateAsync({ data: { profile, scenario } }).then((response) => {
      if (active && requestId.current === current) setResults(response, profile, scenario);
    }).catch(() => {
      if (active && requestId.current === current) setError("We couldn’t create role matches just now. Your profile remains saved here; try again in a moment.");
    });
    return () => { active = false; };
  }, [profile, scenario, currentResults, match.mutateAsync, setResults]);
  const runMatch = async () => {
    if (!profile) return;
    const current = ++requestId.current; setError("");
    try { const response = await match.mutateAsync({ data: { profile, scenario } }); if (current === requestId.current) setResults(response, profile, scenario); }
    catch { if (current === requestId.current) setError("We couldn’t create role matches just now. Your profile remains saved here; try again in a moment."); }
  };
  const choosePath = (role: RoleMatch) => {
    if (chooseRole(role.id)) setLocation(`/pathway?role=${encodeURIComponent(role.id)}`);
    else setError("This match no longer belongs to your current profile or scenario. Review the Radar if needed, then refresh your matches before choosing a role.");
  };
  if (!profile) return <div className="mx-auto max-w-4xl"><PageHeader kicker="03 / Find a direction" title="Role matches" /><section className={`${panel} text-center`}><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e5f1e9] text-[#38705d]"><Target className="h-7 w-7"/></div><h2 className="mt-4 font-display text-2xl font-semibold">Let’s start with your story</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">Add your skills, interests and available learning time first. You can leave skills blank if you’re just beginning.</p><Link href="/profile" className={`${primaryButton} mt-5`} data-testid="link-match-profile">Build your starting point<ArrowRight className="h-4 w-4"/></Link></section></div>;
  if (catalogLoading) return <div className="mx-auto max-w-5xl"><PageHeader kicker="03 / Find a direction" title="Role matches"/><div className="h-48 animate-pulse rounded-2xl bg-[#ebe9df]"/></div>;
  if (catalogError || !catalog) return <div className="mx-auto max-w-5xl"><PageHeader kicker="03 / Find a direction" title="Role matches"/><ErrorPanel message="The role and scenario guide couldn’t load." onRetry={()=>retryCatalog()}/></div>;
  return <div className="mx-auto max-w-6xl matches-page">
    <PageHeader kicker="03 / Find a direction" title="A shortlist to think with"><span>Five role families to explore, each with its strengths, gaps and assumptions in view. A readiness score is not a job outcome.</span></PageHeader>
    <div className="match-control-desk">
      <section className="match-scenario-card"><span className="match-desk-label">FIRST, CHOOSE A LENS</span><ScenarioPicker scenarios={catalog.scenarios} value={scenario} onChange={setScenario}/></section>
      <section className="match-request-card"><span className="match-desk-label">THEN, MAKE A SHORTLIST</span><h2>What might fit from here?</h2><p>Your profile is sent to the matching service only when you request matches. Results aren’t saved there; changing the scenario means a fresh what-if comparison.</p><button onClick={runMatch} disabled={match.isPending} className={primaryButton} data-testid="button-create-matches">{match.isPending?<RefreshCw className="h-4 w-4 animate-spin"/>:<Sparkles className="h-4 w-4"/>}{match.isPending?"Finding possibilities…":"Find my role matches"}</button></section>
    </div>
    {error&&<div className="mt-4"><ErrorPanel message={error} onRetry={runMatch}/></div>}
    {currentResults&&<section className="match-results mt-6 rise">
      <header className="match-results-heading"><div><span className="match-desk-label">MATCH ANALYSIS / {currentResults.scenario.replaceAll("_"," ")}</span><h2 className="mt-2 font-display text-3xl font-semibold">Possible next chapters</h2></div><p>Ranked role families · each based on its top 10 recorded skills</p></header>
      {currentResults.unrecognised_skills.length>0&&<div className="mb-4"><Warn>We didn’t recognise these skill names: {currentResults.unrecognised_skills.join(", ")}. They may not count toward the readiness breakdown.</Warn></div>}
      {currentResults.roles.length===0&&<section className={`${panel} mb-4`}><h3 className="font-display text-xl font-semibold">No role matches in this view</h3><p className="mt-1 text-sm text-muted-foreground">Try another what-if scenario or revisit your profile. No match is a useful starting point, not a judgment.</p><Link href="/profile" className="mt-3 inline-flex text-sm font-semibold text-[#255b4f] underline underline-offset-4" data-testid="link-empty-matches-profile">Review my starting point</Link></section>}
      <div className="space-y-4">{currentResults.roles.map((role,index)=><RoleCard key={role.id} role={role} rank={index+1} expanded={expanded.includes(role.id)} onExpand={()=>setExpanded(old=>old.includes(role.id)?old.filter(id=>id!==role.id):[...old,role.id])} onPathway={()=>choosePath(role)}/>)}</div>
      <div className="mt-5"><SourceNote><p>{currentResults.methodology}</p><p className="mt-2">Readiness heuristic: 75 skill points + 15 interest points + 10 experience points. Skill points use target level 2. These are weighted component points, not percentages or hiring odds. The ranked roles are a top-10 snapshot; they may not represent every possible role. Posting counts are historical sample context only and can be small.</p></SourceNote></div>
      <div className="mt-5"><SdgExplorer goals={catalog.sdgs}/></div>
    </section>}
    {!currentResults&&!match.isPending&&!error&&<section className="match-empty-note mt-6"><span className="match-desk-label">WHAT YOU’LL GET</span><div><h2 className="font-display text-xl font-semibold">Evidence, not a verdict.</h2><p className="mt-1 text-sm text-muted-foreground">Each role includes a score breakdown, skills already in your profile, gaps to build and a practical project idea.</p></div><Target className="match-empty-icon" aria-hidden="true"/></section>}
    {!currentResults&&<div className="mt-5"><SdgExplorer goals={catalog.sdgs}/></div>}
  </div>;
}
function RoleCard({ role, rank, expanded, onExpand, onPathway }: { role: RoleMatch; rank: number; expanded: boolean; onExpand: () => void; onPathway: () => void }) {
  const bar = (label: string, value: number, max: number) => <div key={label}><div className="mb-1 flex justify-between text-xs"><span>{label}</span><b>{value} / {max} pts</b></div><div className="h-2 overflow-hidden rounded-full bg-[#e6e9e0]"><div className="h-full rounded-full bg-[#578773] transition-all duration-500" style={{width:`${Math.max(0,Math.min(100,(value/max)*100))}%`}}/></div></div>;
  return <article className="overflow-hidden rounded-[22px] border border-[#e7e3d8] bg-card soft-shadow" data-testid={`card-role-match-${role.id}`}>
    <div className="p-5 md:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e9eee6] text-sm font-bold text-[#557b68]">0{rank}</span><div><h3 className="font-display text-xl font-semibold">{role.name}</h3><p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{role.description}</p></div></div><div className="rounded-2xl bg-[#e5f1e9] px-4 py-2 text-center"><span className="block font-display text-2xl font-bold text-[#255b4f]" data-testid={`text-readiness-${role.id}`}>{role.score}</span><span className="text-[10px] font-bold uppercase tracking-widest text-[#547367]">readiness / 100</span></div></div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-[#f4f1e7] px-3 py-1.5">{role.postings} historical postings in sample</span>{role.sample_warning&&<span className="rounded-full bg-[#fbede5] px-3 py-1.5 text-[#8b4932]">Small sample — interpret carefully</span>}<span className="rounded-full bg-[#e8edf5] px-3 py-1.5">Outlook: related global signal</span></div>
      {role.sample_warning&&<p className="mt-2 text-xs text-[#925b46]" data-testid={`warning-sample-${role.id}`}>This role’s posting sample is limited. The count is historical context, not a measure of your chances.</p>}
      {role.matched_skills.length>0&&<p className="mt-3 text-xs text-muted-foreground"><b className="text-[#557b68]">Already in your profile:</b> {role.matched_skills.map((s: any) => typeof s === "string" ? s : s?.skill || "").filter(Boolean).join(", ")}</p>}
      <div className="mt-4 flex flex-wrap gap-3"><button onClick={onExpand} aria-expanded={expanded} className={secondaryButton} data-testid={`button-explain-role-${role.id}`}>{expanded?"Hide why this match":"See why this match"}<ChevronRight className={`h-4 w-4 transition-transform ${expanded?"rotate-90":""}`}/></button><button onClick={onPathway} className={primaryButton} data-testid={`button-pathway-role-${role.id}`}>Build this learning plan<ArrowRight className="h-4 w-4"/></button></div>
    </div>
    {expanded&&<div className="border-t border-[#e7e3d8] bg-[#faf9f3] p-5 md:p-6 rise"><div className="grid gap-5 md:grid-cols-[.8fr_1.2fr]"><section><h4 className="font-semibold">How the score is assembled</h4><p className="mb-4 mt-1 text-xs leading-relaxed text-muted-foreground">Weighted contribution points. The score is a heuristic readiness snapshot, not a probability.</p><div className="space-y-3">{bar("Skills",role.components.skills,75)}{bar("Interests",role.components.interests,15)}{bar("Experience",role.components.experience,10)}</div></section><section><h4 className="font-semibold">Skills to build</h4>{role.gaps.length===0?<p className="mt-2 text-sm text-[#557b68]">No priority skill gaps were returned for this role. Keep learning through the project idea below.</p>:<ul className="mt-3 space-y-2">{role.gaps.map((g: any, idx: number)=>{
  const gSkill = typeof g === "string" ? g : g?.skill || "";
  const curLvl = typeof g === "object" && typeof g?.current_level === "number" ? g.current_level : 0;
  const tgtLvl = typeof g === "object" && typeof g?.target_level === "number" ? g.target_level : 2;
  const imp = typeof g === "object" && g?.importance !== undefined ? String(g.importance) : "Standard";
  const sdgsList = typeof g === "object" && Array.isArray(g?.sdgs) ? g.sdgs : [];
  return <li key={gSkill || idx} className="rounded-xl border border-[#ebe7db] bg-card p-3" data-testid={`gap-${role.id}-${gSkill.toLowerCase().replaceAll(" ","-")}`}><div className="flex flex-wrap justify-between gap-2"><b className="text-sm">{gSkill}</b><span className="text-xs text-muted-foreground">You: level {curLvl} · target: {tgtLvl} · importance {imp}</span></div>{sdgsList.length>0?<div className="mt-2 flex flex-wrap gap-2">{sdgsList.map((s: any)=><a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="rounded-lg bg-[#e8f2ed] px-2.5 py-2 text-xs text-[#315f51] hover:underline" data-testid={`link-gap-sdg-${role.id}-${gSkill.toLowerCase().replaceAll(" ","-")}-${s.id}`}><b>Goal {s.id}: {s.title}</b><span className="mt-0.5 block">{s.reason}</span></a>)}</div>:<p className="mt-2 text-xs text-muted-foreground">No related SDG mapping was supplied for this gap.</p>}</li>;
})}</ul>}</section></div>
      <div className="mt-5 grid gap-4 border-t border-[#e7e3d8] pt-4 md:grid-cols-2"><div><h4 className="text-sm font-semibold">Related global outlook</h4><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{role.outlook || "No related signal detail was supplied."} This is not a projection for this exact Malaysian role.</p></div><div><h4 className="text-sm font-semibold">A practical project idea</h4><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{role.project || "Try a small project that demonstrates your new skills."}</p></div></div>
      {role.sdgs.length>0&&<div className="mt-4 rounded-xl bg-[#e8f2ed] p-3"><p className="text-xs font-bold uppercase tracking-wider text-[#527967]">Possible SDG contributions</p><div className="mt-2 flex flex-wrap gap-2">{role.sdgs.map(g=><a key={g.id} href={g.url} target="_blank" rel="noreferrer" className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#315f51] hover:underline" data-testid={`link-role-sdg-${role.id}-${g.id}`}>Goal {g.id}: {g.title}<span className="mt-0.5 block max-w-xs font-normal text-muted-foreground">{g.reason}</span></a>)}</div><p className="mt-2 text-[11px] text-muted-foreground">Editorial mapping of possible contribution; not UN endorsement.</p></div>}
    </div>}
  </article>;
}

export function PathwayPage() {
  const journeyFlow = useJourneyFlow();
  const completePathway = journeyFlow.completePathway || journeyFlow.finishPathway || (() => {});
  const { profile, results, resultKey, selectedRole, setSelectedRole, setResults, scenario, setScenario } = useJourney();
  const { data: catalog, isLoading, isError, refetch } = useGetJourneyCatalog();
  const createPlan = useCreateJourneyPathway();
  const match = useMatchJourney();
  const [plan, setPlan] = useState<LearningPathway | null>(null);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [stepProgress, setChecks] = useState<LearningProgress>({});
  const checks = Object.fromEntries(Object.entries(stepProgress).map(([id, status]) => [id, status === "completed"]));
  const [, setLocation] = useLocation();
  const search = useSearch();
  const urlRole = new URLSearchParams(search).get("role") || "";
  const roleId = urlRole || selectedRole || (resultKey === (profile ? profileKey(profile, scenario) : "") ? results?.roles[0]?.id : "") || "";
  const currentKey = profile ? `${profileKey(profile, scenario)}:${roleId}` : "";
  const requestKey = useRef("");
  useEffect(() => () => { requestKey.current = ""; }, []);
  useEffect(() => {
    if (plan && plan.role.id === roleId && plan.scenario === scenario && requestKey.current === currentKey) {
      if (typeof completePathway === "function") completePathway(plan.role.id);
    }
  }, [plan, roleId, scenario, currentKey, completePathway]);
  const roles = resultKey === (profile ? profileKey(profile, scenario) : "") ? results?.roles || [] : [];
  const targetRole = roles.find(r=>r.id===roleId);
  const defaultAttempt = useRef("");
  const loadPlanRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => { if (urlRole) setSelectedRole(urlRole); }, [urlRole, setSelectedRole]);
  useEffect(() => {
    if (!profile || urlRole || selectedRole) return;
    const key = profileKey(profile, scenario);
    if (resultKey === key && results?.roles.length) { setSelectedRole(results.roles[0].id); return; }
    if (defaultAttempt.current === key) return;
    defaultAttempt.current = key;
    let ignore = false;
    match.mutateAsync({ data: { profile, scenario } }).then((response) => {
      if (ignore) return;
      setResults(response, profile, scenario);
      if (response.roles[0]) setSelectedRole(response.roles[0].id);
      else setError("No role matches were returned. Try updating your profile or exploring another scenario.");
    }).catch(() => { if (!ignore) setError("We couldn’t find your top role match. Choose a role below or retry matches."); });
    return () => { ignore = true; };
  }, [profile, scenario, urlRole, selectedRole, resultKey, results, match.mutateAsync, setResults, setSelectedRole]);
  useEffect(() => {
    setPlan(null); setChecks({}); setError(""); requestKey.current = "";
  }, [currentKey]);
  const loadPlan = async () => {
    if (!profile || !roleId) return;
    const key = currentKey; requestKey.current = key; setError("");
    try {
      const created = await createPlan.mutateAsync({ data: { profile, scenario, role_id: roleId } });
      if (requestKey.current !== key) return;
      setPlan(created);
      setStorageWarning("");
      try {
        const saved = localStorage.getItem(`my-next-chapter.progress.${created.plan_id}`);
        setChecks(readProgress(saved, created.steps));
      } catch { setChecks({}); setStorageWarning("Progress storage is unavailable. Step completion will last only while this page stays open."); }
      try {
        localStorage.setItem(PLAN_SUMMARY_KEY, JSON.stringify(summarisePlan(created, flowFingerprint(profile))));
      } catch { setStorageWarning("Your plan is ready, but its Overview summary could not be saved. Your existing learning checklist has not been changed."); }
    } catch { if (requestKey.current === key) setError("We couldn’t build this plan right now. Your saved profile is safe; try again."); }
  };
  loadPlanRef.current = loadPlan;
  useEffect(() => {
    if (!plan) return;
    const sync = (event: StorageEvent) => {
      if (event.key !== `my-next-chapter.progress.${plan.plan_id}` && event.key !== null) return;
      try { setChecks(readProgress(event.newValue, plan.steps)); setStorageWarning(""); }
      catch { setStorageWarning("Saved progress could not be read. The current checklist is unchanged."); }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [plan]);
  const autoPlanKey = useRef("");
  useEffect(() => {
    if (!profile || !roleId || plan || autoPlanKey.current === currentKey) return;
    autoPlanKey.current = currentKey;
    void loadPlanRef.current();
  }, [profile, roleId, currentKey, plan]);
  const generate = async () => {
    if (!profile) return;
    let targetId = roleId;
    if (!targetId) {
      setError("Choose a role to build a plan.");
      return;
    }
    if (!targetRole && !roles.length) {
      try {
        const freshMatches = await match.mutateAsync({ data: { profile, scenario } });
        if (requestKey.current && requestKey.current !== currentKey) return;
        if (!freshMatches.roles.length) { setError("No role matches were returned for this profile. Try a different scenario or update your profile."); return; }
        targetId = freshMatches.roles.find(r=>r.id===targetId)?.id || freshMatches.roles[0].id;
        setResults(freshMatches, profile, scenario);
        setSelectedRole(targetId);
      } catch { setError("We couldn’t find the role list needed for this plan. Try again."); return; }
    }
    if (targetId !== roleId) {
      setSelectedRole(targetId);
      setLocation(`/pathway?role=${encodeURIComponent(targetId)}`);
      return;
    }
    await loadPlan();
  };
  const setStepStatus = (id: string, status: LearningStatus) => {
    if (!plan?.steps.some(step => step.id === id)) return;
    const updated = { ...stepProgress, [id]: status };
    setChecks(updated);
    if (plan) try { localStorage.setItem(`my-next-chapter.progress.${plan.plan_id}`, JSON.stringify(updated)); setStorageWarning(""); }
    catch { setStorageWarning("We couldn’t save progress in this browser. Your change remains visible until you leave this page."); }
  };
  const toggleStep = (id: string) => setStepStatus(id, checks[id] ? "not_started" : "completed");
  const download = () => {
    if (!plan) return;
    const body = { plan_id: plan.plan_id, role: plan.role.name, scenario: plan.scenario, weekly_hours: plan.hours_per_week, total_hours: plan.total_hours, estimated_weeks: plan.weeks, planning_note: "Editorial time estimates for planning, not provider duration or a promise.", steps: plan.steps.map(s=>({ order: s.start_week, title:s.title, skill:s.skill, kind:s.kind, summary:s.summary, hours:s.hours, weeks:`${s.start_week}-${s.end_week}`, sdgs:s.sdgs, resources:s.resources, courses:s.catalog_courses })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `learning-plan-${plan.role.id}.json`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!profile) return <div className="mx-auto max-w-4xl"><PageHeader kicker="04 / Learn by doing" title="Your learning plan"/><section className={`${panel} text-center`}><h2 className="font-display text-2xl font-semibold">First, tell us where you’re starting</h2><p className="mt-2 text-sm text-muted-foreground">Your plan is based on your skills, interests and time available.</p><Link href="/profile" className={`${primaryButton} mt-5`} data-testid="link-pathway-profile">Create my starting point<ArrowRight className="h-4 w-4"/></Link></section></div>;
  if (isLoading) return <div className="mx-auto max-w-5xl"><PageHeader kicker="04 / Learn by doing" title="Your learning plan"/><div className="h-48 animate-pulse rounded-2xl bg-[#ebe9df]"/></div>;
  if (isError || !catalog) return <div className="mx-auto max-w-5xl"><PageHeader kicker="04 / Learn by doing" title="Your learning plan"/><ErrorPanel message="We couldn’t load the role guide." onRetry={()=>refetch()}/></div>;
  const completedCount = plan ? plan.steps.filter(s=>checks[s.id]).length : 0;
  return <div className="mx-auto max-w-6xl pathway-page">
    <PageHeader kicker="04 / Learn by doing" title="Make a route you can follow"><span>Turn one possible role into ordered steps, time estimates and resources. Checkoffs stay tied to this plan; they never change your readiness score.</span></PageHeader>
    <div className="pathway-setup-grid">
      <section className="pathway-setup-card"><div className="pathway-setup-heading"><span className="pathway-step-number">01</span><div><span className="match-desk-label">SET YOUR DIRECTION</span><h2>Choose a role and a lens</h2></div></div>
        <div className="pathway-role-choice"><label htmlFor="pathway-role" className="text-sm font-semibold">Choose your next role</label><select id="pathway-role" value={roleId} onChange={e=>{const next=e.target.value;setLocation(`/pathway${next?`?role=${encodeURIComponent(next)}`:""}`);setSelectedRole(next);setPlan(null);setChecks({});setError("");}} data-testid="select-pathway-role" className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"><option value="">Choose a role</option>{catalog.roles.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select><p className="mt-1 text-sm text-muted-foreground">Your top match is selected when available; any role in the guide works.</p></div>
        <div className="mt-5"><ScenarioPicker scenarios={catalog.scenarios} value={scenario} onChange={s=>{setScenario(s);setPlan(null);setChecks({});setError("");}}/></div>
      </section>
      <aside className="pathway-planning-note"><span className="match-desk-label">YOUR PLANNING NOTES</span><h2>A pace that belongs to you.</h2><p>This plan uses your saved learning time: <strong>{profile.hours_per_week} hours a week</strong>. Hours and weeks are estimates to help you plan, not provider durations or promises.</p><p>{catalog.scenarios.find(s=>s.id===scenario)?.description}</p><button onClick={generate} disabled={!!plan||createPlan.isPending||match.isPending||!roleId} className={primaryButton} data-testid="button-generate-pathway">{plan?<Check className="h-4 w-4"/>:createPlan.isPending||match.isPending?<RefreshCw className="h-4 w-4 animate-spin"/>:<Sparkles className="h-4 w-4"/>}{plan?"Plan ready":createPlan.isPending?"Putting your plan together…":match.isPending?"Finding your role…":"Build my learning plan"}</button></aside>
    </div>
    {error&&<div className="mt-4"><ErrorPanel message={error} onRetry={generate}/></div>}
    {storageWarning&&<p className="mt-4 rounded-xl bg-[#fbede5] p-3 text-sm text-[#8b4932]" role="alert" data-testid="status-progress-storage">{storageWarning}</p>}
    {plan&&<div className="mt-6 rise pathway-plan">
      <section className="rounded-[26px] bg-[#173a37] p-5 text-[#fffaf0] md:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.17em] text-[#abd2bd]">Your working plan · {plan.scenario.replaceAll("_"," ")}</p><h2 className="mt-2 font-display text-3xl font-semibold">{plan.role.name}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">{plan.role.description}</p></div><button onClick={download} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10" data-testid="button-download-plan"><Download className="h-4 w-4"/>Download plan</button></div>
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">{[{value:`${plan.total_hours}h`,label:"estimated learning time"},{value:`${plan.weeks} weeks`,label:"at your chosen pace"},{value:`${plan.hours_per_week}h`,label:"each week"},{value:`${completedCount} / ${plan.steps.length}`,label:"steps checked off"}].map(x=><div key={x.label} className="rounded-xl bg-white/10 p-3"><span className="block font-display text-xl font-semibold">{x.value}</span><span className="text-[11px] text-white/65">{x.label}</span></div>)}</div>
      </section>
      <div className="pathway-plan-columns">
      <div className="pathway-route-column">
      {plan.role.sdgs && plan.role.sdgs.length > 0 ? (
        <section className="mt-4 rounded-2xl border border-[#dce7dc] bg-[#e8f2ed] p-4">
          <h3 className="text-sm font-semibold">Why this role can connect to the wider world</h3>
          <p className="mt-1 text-xs text-muted-foreground">Potential alignment mapped editorially — not UN endorsement or measured impact.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {plan.role.sdgs.map((goal: any, idx: number) => {
              const gid = typeof goal === "object" ? goal.id : goal;
              const title = typeof goal === "object" && goal.title ? goal.title : `Goal ${gid}`;
              const reason = typeof goal === "object" ? goal.reason : "";
              return (
                <Link key={gid || idx} href={`/sdg-alignment?goal=${gid}`} className="rounded-xl bg-white px-3 py-2 text-xs hover:underline" data-testid={`link-pathway-role-sdg-${gid}`}>
                  <b>Goal {gid}: {title}</b>
                  {reason && <span className="mt-1 block text-muted-foreground">{reason}</span>}
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No role-level SDG mapping was supplied.</p>
      )}
      {plan.notes && plan.notes.length > 0 && (
        <div className="mt-4 space-y-2">
          {plan.notes.map((note: any, i: number) => <Warn key={i}>{note}</Warn>)}
        </div>
      )}
      <section className="pathway-route"><header className="pathway-route-heading"><div><span className="match-desk-label">YOUR ROUTE / ORDERED STEPS</span><h2 className="mt-1 font-display text-2xl font-semibold">One step at a time</h2></div><p>Planning estimates only — separate from course duration.</p></header>
      {completedCount>0&&<p className="mb-3 rounded-xl bg-[#e5f1e9] px-4 py-3 text-sm font-semibold text-[#255b4f]" aria-live="polite" data-testid="status-pathway-progress">{completedCount} {completedCount===1?"step":"steps"} checked off. Nice work — keep your pace your own.</p>}
      {plan.steps.length===0&&<section className={`${panel} mb-4`}><h3 className="font-display text-xl font-semibold">No learning steps came back yet</h3><p className="mt-1 text-sm text-muted-foreground">Try another role or scenario. Your profile and saved progress are unchanged.</p></section>}
      <div className="relative space-y-3">{plan.steps.map((step,index)=><article key={step.id} className={`relative rounded-[22px] border p-5 transition-colors ${checks[step.id]?"completion-pop border-[#b7d4c1] bg-[#eff6ef]":"border-[#e7e3d8] bg-card"}`} data-testid={`card-learning-step-${step.id}`}>
        <label className="mb-4 flex flex-wrap items-center gap-2 text-[13px] font-semibold">
          Learning status
          <select aria-label={`Learning status: ${step.title}`} data-testid={`select-step-status-${step.id}`} value={stepProgress[step.id] ?? "not_started"} onChange={event => setStepStatus(step.id, event.target.value as LearningStatus)} className="min-h-10 max-w-full rounded-lg border bg-white px-3 text-[14px]">
            <option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option>
          </select>
        </label>
        <div className="flex items-start gap-3"><button type="button" onClick={()=>toggleStep(step.id)} aria-pressed={!!checks[step.id]} aria-label={`${checks[step.id]?"Mark incomplete":"Mark complete"}: ${step.title}`} data-testid={`button-complete-step-${step.id}`} className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${checks[step.id]?"border-[#578773] bg-[#578773] text-white":"border-[#c9d2c7] bg-white text-transparent hover:border-[#578773]"}`}><Check className="h-4 w-4"/></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#e8f2ed] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#527967]">Step {index+1}</span><span className="text-xs text-muted-foreground">Weeks {step.start_week}–{step.end_week} · {step.hours}h estimate</span><span className="rounded-full bg-[#f4eee2] px-2.5 py-1 text-[11px] font-semibold">{step.kind==="project"?"Build a project":"Grow a skill"}</span></div><h3 className={`mt-2 font-display text-xl font-semibold ${checks[step.id]?"text-[#607c6b] line-through decoration-[#9eb8a5]":""}`}>{step.title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.summary}</p><p className="mt-2 text-xs font-semibold text-[#65766d]">Focus: {step.skill}</p>
          {step.resources.length>0&&<div className="mt-4"><h4 className="text-xs font-bold uppercase tracking-wider text-[#658a78]">Resources</h4><ul className="mt-2 flex flex-wrap gap-2">{step.resources.map((r,i)=><li key={`${r.url}-${i}`}><a href={r.url} target="_blank" rel="noreferrer" data-testid={`link-resource-${step.id}-${i}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#e1e5dd] bg-white px-3 py-2 text-xs font-semibold hover:bg-[#e8f2ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><BookOpen className="h-3.5 w-3.5 text-[#54856f]"/>{r.title}<ExternalLink className="h-3 w-3 text-muted-foreground"/></a><span className="ml-2 text-[11px] text-muted-foreground">{r.cost}</span></li>)}</ul></div>}
          {step.kind === "skill" && <div className="mt-4 text-[13px]"><Link className="font-semibold text-primary underline" href={`/courses?skill=${encodeURIComponent(step.skill)}&from=pathway`} data-testid={`link-find-courses-${step.id}`}>Explore courses for {step.skill}</Link>{step.catalog_courses.length === 0 && <p className="mt-2 text-muted-foreground">No suitable course was found in the current course index for this skill. The skill gap remains unresolved; any separate curated resources below are not a verified catalogue match.</p>}</div>}
          {step.catalog_courses.length>0&&<div className="mt-4"><h4 className="text-xs font-bold uppercase tracking-wider text-[#658a78]">From the course catalogue</h4><div className="mt-2 grid gap-2 sm:grid-cols-2">{step.catalog_courses.map(c=><div key={c.id} className="rounded-xl bg-[#f7f6ef] p-3" data-testid={`course-card-${c.id}`}><p className="text-sm font-semibold">{c.title}</p><p className="mt-1 text-xs text-muted-foreground">{c.provider||"Provider not listed"}{c.level?` · ${c.level}`:""}{c.duration_hours != null?` · ${c.duration_hours}h listed`:""}</p><p className="mt-1 text-xs text-muted-foreground">{c.match_reason}</p><Link href={`/courses?course=${encodeURIComponent(c.id)}&skill=${encodeURIComponent(step.skill)}&from=pathway`} className="mt-2 inline-flex min-h-10 items-center font-semibold text-primary underline" data-testid={`link-course-details-${step.id}-${c.id}`}>View course record</Link>{c.url&&<a href={c.url} target="_blank" rel="noreferrer" className="ml-3 mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#255b4f] underline" data-testid={`link-course-${c.id}`}>Original course<ExternalLink className="h-3 w-3"/></a>}</div>)}</div><p className="mt-2 text-[13px] text-muted-foreground">Course listings can change. Listed provider duration is separate from our planning estimate. Price and prerequisites are not supplied.</p></div>}
          {step.sdgs && step.sdgs.length > 0 ? (
            <div className="mt-4 rounded-xl bg-[#e8f2ed] p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#527967]">Potential alignment — editorial mapping</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {step.sdgs.map((goal: any, idx: number) => {
                  const gid = typeof goal === "object" ? goal.id : goal;
                  const title = typeof goal === "object" && goal.title ? goal.title : `Goal ${gid}`;
                  const reason = typeof goal === "object" ? goal.reason : "";
                  return (
                    <Link key={gid || idx} href={`/sdg-alignment?goal=${gid}`} className="rounded-lg bg-white px-3 py-2 text-xs hover:underline" data-testid={`link-step-sdg-${step.id}-${gid}`}>
                      <b>Goal {gid}: {title}</b>
                      {reason && <span className="mt-1 block text-muted-foreground">{reason}</span>}
                    </Link>
                  );
                })}
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">Not UN endorsement or measured impact. Completing a learning step does not automatically deliver this goal.</p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">No related SDG mapping was supplied for this step.</p>
          )}
        </div></div>
      </article>)}</div></section>
      </div>
      <aside className="pathway-plan-margin"><div className="pathway-margin-label">IN THE MARGINS</div><SdgExplorer goals={catalog.sdgs}/><SourceNote><div className="space-y-2"><p>Learning hours and weeks are editorial planning estimates — not course-provider duration, a guaranteed completion date or a job outcome.</p><p>Completion is saved in this browser per plan ID. It is your own checklist and does not increase or alter the match score. Browser storage can be cleared by your browser.</p><p>Profile and matching inputs are sent to the matching service when needed; the plan is generated for this request and is not a durable server-side profile.</p></div></SourceNote></aside>
      </div>
    </div>}
  </div>;
}

export function MethodologyRedirect() {
  const [, setLocation] = useLocation();
  useEffect(()=>setLocation("/radar"),[setLocation]);
  return <div className="mx-auto max-w-4xl"><PageHeader kicker="Source details" title="Taking you to the radar"/><p className="rounded-xl bg-[#e8f2ed] p-4 text-sm">Source details and limitations live alongside the evidence.</p></div>;
}
