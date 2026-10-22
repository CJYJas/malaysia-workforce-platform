import { Link } from "wouter";
import { useGetJourneyCatalog } from "@workspace/api-client-react";
import { PageHeader, ErrorPanel } from "@/components/shell";
import { ScenarioPicker } from "@/components/journey-ui";
import { SdgAlignment } from "@/components/sdg-alignment";
import { useJourney } from "@/lib/journey";

export function GoalsPage() {
  return <SdgAlignment />;
}

export function ScenariosPage() {
  const { data, isLoading, isError, refetch } = useGetJourneyCatalog();
  const { scenario, setScenario, profile } = useJourney();
  return <div className="mx-auto max-w-6xl"><PageHeader kicker="06 / Different possible futures" title="More than one way forward">No one knows exactly how the AI era will unfold. Compare different assumptions instead of treating one outcome as certain.</PageHeader>
    {isLoading ? <p role="status">Loading the scenario guide…</p> : isError || !data ? <ErrorPanel message="The scenario guide couldn’t load." onRetry={()=>refetch()}/> : <>
      <ScenarioPicker scenarios={data.scenarios} value={scenario} onChange={setScenario}/>
      <p className="mt-5 text-sm text-muted-foreground">Your selection is saved in this browser and used in your role matches and learning plan. It changes skill-weighting assumptions, not the source’s evidence. Readiness scores and learning times remain estimates, not hiring guarantees.</p>
      <div className="mt-6 flex flex-wrap gap-3"><Link href={profile ? "/matches" : "/profile"} className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">{profile ? "See my matches in this scenario" : "Build my profile to compare matches"}</Link><Link href="/radar" className="rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold">Read the source signals</Link></div>
    </>}
  </div>;
}
