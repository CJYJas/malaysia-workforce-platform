import { ArrowDown, ArrowUp, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import type { OutlookSignal } from "@workspace/api-client-react";

export function RadarGroup({ title, signals, kind, direction }: {
  title: string; signals: OutlookSignal[]; kind: "role" | "skill"; direction: "rising" | "declining";
}) {
  const items = signals.filter(s => s.kind === kind && s.direction === direction);
  const rising = direction === "rising";
  return <section className="rounded-[22px] border border-[#e7e3d8] bg-card p-5 md:p-6 soft-shadow">
    <div className="flex items-center gap-3">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${rising ? "bg-[#e3f0e6] text-[#38705d]" : "bg-[#f8e8dd] text-[#a75b42]"}`}>
        {rising ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
      </span>
      <div><h2 className="font-display text-xl font-semibold">{title}</h2><p className="text-[13px] text-muted-foreground">Employer expectations · global</p></div>
    </div>
    {!items.length ? <p className="mt-5 text-sm text-muted-foreground">No {kind} signals are available in this report.</p> :
      <ul className="mt-4 space-y-2">{items.map(s => <li key={s.id} className="rounded-xl bg-[#f7f6ef] p-3" data-testid={`signal-${kind}-${s.id}`}>
        <div className="flex items-start gap-2">
          <span className={`mt-0.5 ${rising ? "text-[#54856f]" : "text-[#a75b42]"}`}>{rising ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}</span>
          <div className="min-w-0"><p className="text-sm font-semibold">{s.label}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Named in the report’s expected {rising ? "growth" : "decline"} outlook.</p>
            <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Editorial SDG associations">
              {s.sdgs.map(goal => <Link key={goal.id} href={`/sdg-alignment?goal=${goal.id}`} title={goal.reason} aria-label={`Open Goal ${goal.id}: ${goal.title}. ${goal.reason}`}
                className="rounded-lg border border-[#d8e3d9] bg-white px-2 py-1 text-[13px] font-semibold text-[#315f51] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid={`link-signal-sdg-${s.id}-${goal.id}`}>Goal {goal.id}: {goal.title}</Link>)}
            </div>
          </div>
        </div>
      </li>)}</ul>}
  </section>;
}
