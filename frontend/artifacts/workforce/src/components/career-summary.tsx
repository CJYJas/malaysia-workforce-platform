import { Link } from "wouter";
import { useGetJourneyCatalog, useGetWorkforceOverview, useGetSkillDemand } from "@workspace/api-client-react";
import { useJourney, profileKey } from "@/lib/journey";
import { useJourneyFlow } from "@/lib/journey-flow";
import { usePlanSummary } from "@/lib/use-plan-summary";
import { recognisedAssessment } from "@/lib/match-view-model";
import { fmtDate, fmtNum, fmtPct } from "@/lib/format";

export function CareerSummary() {
  const { profile, selectedRole, scenario, results, resultKey } = useJourney();
  const flow = useJourneyFlow();
  const catalogQuery = useGetJourneyCatalog();
  const overviewQuery = useGetWorkforceOverview();
  const catalog = catalogQuery.data;
  const overview = overviewQuery.data;
  const target = catalog?.roles.find(role => role.id === selectedRole);
  const demand = useGetSkillDemand({ role: target?.name ?? "" }, { query: { enabled: !!target } });
  const { summary, progress, error } = usePlanSummary();
  const currentResults = profile && resultKey === profileKey(profile, scenario) ? results : null;
  const recognised = profile && catalog ? recognisedAssessment(profile, catalog).length : null;
  const currentRole = currentResults?.roles.find(role => role.id === selectedRole);
  const nextSkill = progress?.nextSkill ?? (progress ? null : currentRole?.gaps[0]?.skill);
  const topSkills = demand.data?.skills.slice(0, 5) ?? [];
  const metrics = [
    { label: "Recognised assessed skills", value: recognised === null ? "—" : String(recognised), note: profile ? "Distinct canonical skills; Not sure skills excluded." : "Add your profile to see your starting point." },
    { label: "Roles in the dataset", value: overview ? String(overview.roles.length) : "—", note: "Supported roles, not a count of roles you have visited." },
    { label: "Current role matches", value: currentResults ? String(currentResults.roles.length) : "—", note: currentResults ? "Returned by your current profile/scenario request." : "Open matches after Radar review to load results. No background analysis." },
    { label: "Learning steps complete", value: progress ? `${progress.completed} / ${progress.total}` : "—", note: summary ? `${progress ? `${progress.inProgress} in progress · ` : ""}Last generated plan · ${summary.totalHours} estimated hours.` : "Open or generate your pathway to restore its real checklist summary." },
  ];
  return <section className="mb-7 space-y-5" aria-label="Your career snapshot" data-testid="career-summary">
    {(catalogQuery.isLoading || overviewQuery.isLoading) && <p className="text-sm text-muted-foreground" role="status">Loading the public skill catalogue and dataset coverage…</p>}
    {(catalogQuery.isError || overviewQuery.isError) && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm" role="alert">Some snapshot metrics could not load; missing values are not zero. <button className="font-semibold text-primary underline" onClick={() => { if (catalogQuery.isError) catalogQuery.refetch(); if (overviewQuery.isError) overviewQuery.refetch(); }}>Retry snapshot metrics</button></div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(metric => <div key={metric.label} className="min-w-0 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-muted-foreground">{metric.label}</p><p className="my-2 text-3xl font-semibold tracking-tight" data-testid={`metric-${metric.label.toLowerCase().replaceAll(" ", "-")}`}>{metric.value}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{metric.note}</p>
    </div>)}</div>
    {error && <p className="text-sm text-amber-800" role="status">{error}</p>}
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="min-w-0 rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">Your career direction</h2>
        <p className="mt-2 font-semibold text-primary">{target?.name ?? "A direction to explore"}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{target ? `${profile ? "Your profile is saved." : "Build your profile when ready."} A target preference is not a confirmed match or a hiring prediction.` : "Explore the five supported roles, then use the guided journey to compare them with your own profile."}</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-primary">
          <Link href={target ? `/roles/${target.id}` : "/roles"}>Explore role evidence →</Link>
          <Link href={flow.canAccessStep(3) ? "/role-matches" : flow.completedSteps[0] ? "/skills-radar" : "/profile"}>{flow.canAccessStep(3) ? "Review my matches" : "Continue my guided journey"} →</Link>
        </div>
      </section>
      <section className="min-w-0 rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">Useful next actions</h2>
        <ul className="mt-3 space-y-3 text-sm font-semibold text-primary">
          <li><Link href="/profile">{profile ? "Review the skills and time in your saved profile" : "Build your starting profile"} →</Link></li>
          <li><Link href={target ? `/roles/${target.id}` : "/roles"}>{target ? "Inspect the evidence behind your target role" : "Explore supported roles before choosing a direction"} →</Link></li>
          <li><Link href={nextSkill ? `/courses?skill=${encodeURIComponent(nextSkill)}` : flow.canAccessStep(4) ? "/pathway" : flow.completedSteps[0] ? "/skills-radar" : "/profile"}>{nextSkill ? `Find learning resources for ${nextSkill}` : progress ? progress.completed === progress.total ? "Revisit your completed learning checklist" : "Continue your next learning-plan step" : "Follow the guide to identify a real skills gap"} →</Link></li>
        </ul>
      </section>
    </div>
    <section className="min-w-0 rounded-xl border border-border bg-card p-5">
      <h2 className="text-xl font-semibold">Skills to explore{target ? ` · ${target.name}` : ""}</h2>
      {!target ? <p className="mt-3 text-sm text-muted-foreground">Choose a target preference in your profile, or explore the role catalogue. No role has been selected for you.</p>
        : demand.isLoading ? <p className="mt-3 text-sm" role="status">Loading Malaysian posting evidence…</p>
        : demand.isError ? <div className="mt-3 text-sm" role="alert">Role evidence could not load. <button className="font-semibold text-primary underline" onClick={() => demand.refetch()}>Retry evidence</button></div>
        : <><p className="mt-2 text-sm text-muted-foreground">{fmtNum(demand.data?.denominator ?? 0)} eligible role postings · {overview ? `${fmtDate(overview.coverage_start)}–${fmtDate(overview.coverage_end)}` : "See source coverage"}. Frequency is not growth.</p>
          <ul className="mt-3 divide-y divide-border">{topSkills.map(skill => <li key={skill.skill} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <Link className="font-semibold text-primary" href={`/skills-radar?role=${target.id}&skill=${encodeURIComponent(skill.skill)}`}>{skill.skill} · {fmtPct(skill.posting_share_percentage)}</Link>
            <span className="text-muted-foreground">{fmtNum(skill.mention_count)} / {fmtNum(demand.data!.denominator)} postings</span>
            <Link className="font-semibold text-primary" href={`/courses?skill=${encodeURIComponent(skill.skill)}`}>Courses →</Link>
          </li>)}</ul>
          {!topSkills.length && <p className="mt-3 text-sm text-muted-foreground">No ranked skill records are available for this role.</p>}
          {topSkills[0] && <p className="mt-3 rounded-lg bg-secondary p-3 text-sm leading-relaxed text-muted-foreground">Dataset observation: {topSkills[0].skill} appears in {fmtPct(topSkills[0].posting_share_percentage)} of this role’s eligible postings. This is a historical snapshot, not a statement about current vacancies or future demand. {demand.data?.sample_size_warning && demand.data.warning_message}</p>}
          <Link className="mt-3 inline-block text-sm font-semibold text-primary" href="/methodology">How these numbers are calculated →</Link>
        </>}
    </section>
  </section>;
}
