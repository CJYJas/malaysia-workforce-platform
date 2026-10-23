import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useGetJourneyCatalog, useMatchJourney, type RoleMatch } from "@workspace/api-client-react";
import { PageHeader, ErrorPanel } from "@/components/shell";
import { ScenarioPicker } from "@/components/journey-ui";
import { useJourney, profileKey } from "../lib/journey";
import { useJourneyFlow } from "../lib/journey-flow";
import { roleEvidence } from "../lib/match-view-model";
import { MatchResultsView } from "@/components/match-results";

export function MatchesPage() {
  const { profile, scenario, setScenario, results, resultKey, setResults } = useJourney();
  const flow = useJourneyFlow();
  const catalog = useGetJourneyCatalog();
  const mutation = useMatchJourney();
  const [, navigate] = useLocation();
  const search = useSearch();
  const key = profile ? profileKey(profile, scenario) : "";
  const currentResults = resultKey === key && results?.scenario === scenario ? results : null;
  const context = useRef({ key, profile, scenario, setResults });
  context.current = { key, profile, scenario, setResults };
  const mounted = useRef(false);
  const sequence = useRef(0);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const pending = pendingKey === key;
  const error = failure && failure.key === key ? failure.message : null;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; sequence.current += 1; };
  }, []);
  const runMatch = useCallback(async () => {
    const input = context.current;
    if (!input.profile) return;
    const request = ++sequence.current;
    const isCurrent = () => mounted.current && request === sequence.current && context.current.key === input.key;
    setPendingKey(input.key); setFailure(null);
    try {
      const response = await mutation.mutateAsync({ data: { profile: input.profile, scenario: input.scenario } });
      if (!isCurrent()) return;
      context.current.setResults(response, input.key);
    } catch {
      if (isCurrent()) setFailure({ key: input.key, message: "We couldn’t load matches for your current profile and scenario. Your saved profile and learning checklist are unchanged. Try again." });
    } finally {
      if (isCurrent()) setPendingKey(null);
    }
  }, [mutation.mutateAsync]);
  useEffect(() => {
    sequence.current += 1; setFailure(null); setPendingKey(null);
    if (key && !currentResults) void runMatch();
    return () => { sequence.current += 1; };
  }, [key, currentResults, runMatch]);

  const chooseRole = (role: RoleMatch) => {
    if (pending) return;
    if (roleEvidence(role) === "unavailable") {
      setFailure({ key, message: "This role has no usable posting/skill evidence in this response. Choose another supported role; no target or progress has been changed." });
    } else if (flow.chooseRole(role.id)) navigate(`/pathway?role=${encodeURIComponent(role.id)}`);
    else setFailure({ key, message: "These results no longer match your current profile or scenario. Continue from the Radar or refresh your current matches before choosing a pathway." });
  };
  if (!profile) return <section><PageHeader kicker="03 / Role matches" title="Start with your profile" /><Link href="/profile" className="text-primary underline">Build your starting profile →</Link></section>;
  if (catalog.isLoading) return <p className="rounded-xl bg-card p-6 text-sm" role="status">Loading the matching guide…</p>;
  if (catalog.isError || !catalog.data) return <ErrorPanel message="The matching guide could not load. Your profile is still saved." onRetry={() => catalog.refetch()} />;
  return <div className="mx-auto max-w-6xl" data-testid="page-role-matches">
    <PageHeader kicker="03 / Explore your options" title="Your Role Matches">See how your assessed skills, interests and experience align with the roles in this snapshot. Alignment is a readiness heuristic, not a hiring probability.</PageHeader>
    <ScenarioPicker scenarios={catalog.data.scenarios} value={scenario} onChange={setScenario} />
    {error && <div className="my-5"><ErrorPanel message={error} onRetry={runMatch} /></div>}
    {!currentResults ? pending ? <p className="my-6 rounded-xl border border-border bg-card p-6 text-sm" role="status" data-testid="status-match-loading">Calculating matches for this profile and scenario…</p> : null
      : <MatchResultsView profile={profile} catalog={catalog.data} results={currentResults}
          requestedRoleId={new URLSearchParams(search).get("role")} refreshing={pending}
          onRefresh={runMatch} onChooseRole={chooseRole} />}
  </div>;
}
