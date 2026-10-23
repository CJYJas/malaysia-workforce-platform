import { useState, useEffect } from "react";
import { useJourney } from "@/lib/journey";
import { flowFingerprint } from "@/lib/journey-flow-model";
import {
  PLAN_SUMMARY_KEY,
  parsePlanSummary,
  summaryMatchesScope,
  readLearningProgress,
  type PlanSummary,
  type LearningProgress,
} from "@/lib/plan-summary-model";

export function usePlanSummary(): {
  summary: PlanSummary | null;
  progress: LearningProgress | null;
  error: string | null;
} {
  const { profile, selectedRole, scenario } = useJourney();
  const [summary, setSummary] = useState<PlanSummary | null>(null);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PLAN_SUMMARY_KEY);
      if (!raw) {
        setSummary(null);
        setProgress(null);
        setError(null);
        return;
      }

      const parsed = parsePlanSummary(raw);
      const fp = flowFingerprint(profile);

      if (parsed && summaryMatchesScope(parsed, fp, selectedRole, scenario)) {
        setSummary(parsed);
        const progressRaw = window.localStorage.getItem(
          `my-next-chapter.progress.${parsed.planId}`
        );
        const prog = readLearningProgress(parsed, progressRaw);
        setProgress(prog);
        setError(null);
      } else {
        setSummary(null);
        setProgress(null);
        setError(null);
      }
    } catch (err: any) {
      setSummary(null);
      setProgress(null);
      setError(err?.message || "Failed to load plan summary");
    }
  }, [profile, selectedRole, scenario]);

  return { summary, progress, error };
}
